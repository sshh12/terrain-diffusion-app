from typing import List
from concurrent.futures import ProcessPoolExecutor
from functools import partial
import logging
import aioboto3
import asyncio
import json
import io

import numpy as np
from PIL import Image
from moderation import clean_caption

TILE_PATH = "public/tiles/global/"
TILE_KEY = TILE_PATH + "{tile_row}_{tile_col}.png"
INDEX_KEY = TILE_PATH + "index.json"
BUCKET = "terrain-diffusion-app"
TILE_SIZE = 512
COMMON_CAPTION = "a satellite image"


def _local_init(base_model: str, lora_model: str, cache_dir: str):
    global inpaint_pipe
    from diffusers import StableDiffusionInpaintPipeline
    import torch

    inpaint_pipe = StableDiffusionInpaintPipeline.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        cache_dir=cache_dir,
    )
    inpaint_pipe.unet.load_attn_procs(
        lora_model,
        use_safetensors=False,
    )
    inpaint_pipe.to("cuda")


def _run_local(kwargs):
    global inpaint_pipe
    image = inpaint_pipe(**kwargs).images[0]
    return image


class LocalGPUInpainter:
    def __init__(self, base_model: str, lora_model: str, cache_dir: str = None):
        self.executor = ProcessPoolExecutor(
            max_workers=1,
            initializer=partial(
                _local_init,
                base_model=base_model,
                lora_model=lora_model,
                cache_dir=cache_dir,
            ),
        )

    async def run(self, **kwargs) -> Image:
        loop = asyncio.get_event_loop()
        image = await loop.run_in_executor(self.executor, _run_local, kwargs)
        return image


def _overlapping_tiles(top_left_x: int, top_left_y: int) -> List:
    start_row = top_left_y // TILE_SIZE
    start_col = top_left_x // TILE_SIZE

    end_row = (top_left_y + TILE_SIZE - 1) // TILE_SIZE
    end_col = (top_left_x + TILE_SIZE - 1) // TILE_SIZE

    tiles = [
        (row, col)
        for row in range(start_row, end_row + 1)
        for col in range(start_col, end_col + 1)
    ]

    return tiles


async def get_tile_from_s3(session: aioboto3.Session, row: int, col: int) -> np.ndarray:
    path = TILE_KEY.format(tile_row=row, tile_col=col)
    buffer = io.BytesIO()
    try:
        async with session.client("s3") as s3:
            await s3.download_fileobj(Bucket=BUCKET, Key=path, Fileobj=buffer)
            img = Image.open(buffer)
            img_ary = np.array(img)
            if img_ary.shape[2] == 4:
                img_ary = img_ary[:, :, :3]
    except Exception:
        img_ary = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.uint8)
    return img_ary


async def save_tile_to_s3(
    session: aioboto3.Session, row: int, col: int, img_ary: np.ndarray
):
    buffer = io.BytesIO()
    img_rgba = np.concatenate([img_ary, np.full((*img_ary.shape[:2], 1), 255)], axis=-1)
    black_pixels = np.all(img_ary == [0, 0, 0], axis=-1)
    img_rgba[black_pixels] = [0, 0, 0, 0]
    img = Image.fromarray(np.uint8(img_rgba))
    img.save(buffer, format="PNG")
    buffer.seek(0)
    async with session.client("s3") as s3:
        await s3.upload_fileobj(
            buffer, BUCKET, TILE_KEY.format(tile_row=row, tile_col=col)
        )


async def update_index(session: aioboto3.Session, additional_tiles: List):
    tiles = []
    async with session.resource("s3") as s3:
        bucket = await s3.Bucket(BUCKET)
        async for item in bucket.objects.filter(Prefix=TILE_PATH):
            item_key = item.key.split("/")[-1].replace(".png", "")
            if "_" in item_key:
                row, col = item_key.split("_")
                tiles.append((int(row), int(col)))
    tiles = list(set(tiles + additional_tiles))

    data = {"tiles": tiles}
    buffer = io.BytesIO()
    buffer.write(json.dumps(data).encode("utf-8"))
    buffer.seek(0)
    async with session.client("s3") as s3:
        await s3.upload_fileobj(buffer, BUCKET, INDEX_KEY)


async def render_tile(
    session: aioboto3.Session, model: LocalGPUInpainter, x: int, y: int, caption: str
) -> List:
    tiles_coords = _overlapping_tiles(x, y)
    while len(tiles_coords) not in [1, 4]:
        x -= 1
        y -= 1
        tiles_coords = _overlapping_tiles(x, y)

    if len(tiles_coords) == 1:
        init_ary = await get_tile_from_s3(session, *tiles_coords[0])
    else:
        top_left, top_right, bottom_left, bottom_right = await asyncio.gather(
            get_tile_from_s3(session, *tiles_coords[0]),
            get_tile_from_s3(session, *tiles_coords[1]),
            get_tile_from_s3(session, *tiles_coords[2]),
            get_tile_from_s3(session, *tiles_coords[3]),
        )
        full_ary = np.concatenate(
            (
                np.concatenate((top_left, top_right), axis=1),
                np.concatenate((bottom_left, bottom_right), axis=1),
            ),
            axis=0,
        )
        offset_x = tiles_coords[0][1] * TILE_SIZE
        offset_y = tiles_coords[0][0] * TILE_SIZE
        init_ary = full_ary[
            y - offset_y : y - offset_y + TILE_SIZE,
            x - offset_x : x - offset_x + TILE_SIZE,
            :,
        ]

    mask = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.uint8)
    mask[np.all(init_ary == 0, axis=2)] = 255

    if not np.all(mask == 0):
        image = await model.run(
            prompt=clean_caption(caption, COMMON_CAPTION),
            image=Image.fromarray(init_ary),
            mask_image=Image.fromarray(mask),
            num_inference_steps=50,
            guidance_scale=7.5,
        )
        out_ary = np.array(image)
    else:
        out_ary = init_ary.copy()

    if len(tiles_coords) == 1:
        await save_tile_to_s3(session, *tiles_coords[0], out_ary)
    else:
        full_ary[
            y - offset_y : y - offset_y + TILE_SIZE,
            x - offset_x : x - offset_x + TILE_SIZE,
            :,
        ] = out_ary
        await asyncio.gather(
            save_tile_to_s3(
                session, *tiles_coords[0], full_ary[:TILE_SIZE, :TILE_SIZE, :]
            ),
            save_tile_to_s3(
                session, *tiles_coords[1], full_ary[:TILE_SIZE, TILE_SIZE:, :]
            ),
            save_tile_to_s3(
                session, *tiles_coords[2], full_ary[TILE_SIZE:, :TILE_SIZE, :]
            ),
            save_tile_to_s3(
                session, *tiles_coords[3], full_ary[TILE_SIZE:, TILE_SIZE:, :]
            ),
            update_index(session, tiles_coords),
        )

    return tiles_coords


async def clear_tiles(session: aioboto3.Session, x: int, y: int) -> List:
    tiles_coords = _overlapping_tiles(x, y)
    while len(tiles_coords) != 4:
        x -= 1
        y -= 1
        tiles_coords = _overlapping_tiles(x, y)

    empty_img = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.uint8)

    tile_coords_ext = []
    for dx in {-1, 0, 1}:
        for dy in {-1, 0, 1}:
            for row, col in tiles_coords:
                tile_coords_ext.append((row + dy, col + dx))
    tile_coords_ext = list(set(tile_coords_ext))

    logging.info(f"Clearing tiles: {tile_coords_ext}")

    await asyncio.gather(
        *(save_tile_to_s3(session, *tc, empty_img) for tc in tile_coords_ext)
    )

    return tile_coords_ext
