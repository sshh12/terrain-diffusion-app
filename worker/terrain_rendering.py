from typing import List, Dict
from concurrent.futures import ProcessPoolExecutor
import asyncio
import io

import boto3
import numpy as np
from PIL import Image

TILE_PATH = "public/tiles/global/"
TILE_KEY = TILE_PATH + "{tile_row}_{tile_col}.png"
BUCKET = "terrain-diffusion-app"
TILE_SIZE = 512

s3 = boto3.resource("s3")
s3_client = boto3.client("s3")


def _local_init():
    global inpaint_pipe
    from diffusers import StableDiffusionInpaintPipeline
    import torch

    inpaint_pipe = StableDiffusionInpaintPipeline.from_pretrained(
        "stabilityai/stable-diffusion-2-inpainting",
        torch_dtype=torch.float16,
        cache_dir=r"F:\hf-wsl-cache",
    )
    inpaint_pipe.unet.load_attn_procs(
        "F:\output-sd2-inpaint-8x4-1e6-drop03\checkpoint-15000\pytorch_model.bin",
        use_safetensors=False,
    )
    inpaint_pipe.to("cuda")


def _run_local(kwargs):
    global inpaint_pipe
    image = inpaint_pipe(**kwargs).images[0]
    return image


class LocalGPUInpainter:
    def __init__(self):
        self.executor = ProcessPoolExecutor(max_workers=1, initializer=_local_init)

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


def get_tile_from_s3(row: int, col: int) -> np.ndarray:
    path = TILE_KEY.format(tile_row=row, tile_col=col)
    buffer = io.BytesIO()
    try:
        s3_client.download_fileobj(Bucket=BUCKET, Key=path, Fileobj=buffer)
        img = Image.open(buffer)
        img_ary = np.array(img)
        if img_ary.shape[2] == 4:
            img_ary = img_ary[:, :, :3]
    except Exception:
        img_ary = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.uint8)
    return img_ary


def save_tile_to_s3(row: int, col: int, img_ary: np.ndarray):
    buffer = io.BytesIO()
    img_rgba = np.concatenate([img_ary, np.full((*img_ary.shape[:2], 1), 255)], axis=-1)
    black_pixels = np.all(img_ary == [0, 0, 0], axis=-1)
    img_rgba[black_pixels] = [0, 0, 0, 0]
    img = Image.fromarray(np.uint8(img_rgba))
    img.save(buffer, format="PNG")
    buffer.seek(0)
    s3_client.upload_fileobj(
        buffer, BUCKET, TILE_KEY.format(tile_row=row, tile_col=col)
    )


def get_tiles_index() -> List:
    tiles = []
    for item in s3.Bucket(BUCKET).objects.filter(Prefix=TILE_PATH):
        item_key = item.key.split("/")[-1].replace(".png", "")
        if "_" in item_key:
            row, col = item_key.split("_")
            tiles.append((int(row), int(col)))
    return tiles


async def render_tile(model: LocalGPUInpainter, x: int, y: int, caption: str) -> List:
    tiles_coords = _overlapping_tiles(x, y)
    while len(tiles_coords) not in [1, 4]:
        x -= 1
        y -= 1
        tiles_coords = _overlapping_tiles(x, y)

    if len(tiles_coords) == 1:
        init_ary = get_tile_from_s3(*tiles_coords[0])
    else:
        top_left = get_tile_from_s3(*tiles_coords[0])
        top_right = get_tile_from_s3(*tiles_coords[1])
        bottom_left = get_tile_from_s3(*tiles_coords[2])
        bottom_right = get_tile_from_s3(*tiles_coords[3])
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

    image = await model.run(
        prompt=caption,
        image=Image.fromarray(init_ary),
        mask_image=Image.fromarray(mask),
        num_inference_steps=50,
        guidance_scale=7.5,
    )

    out_ary = np.array(image)

    if len(tiles_coords) == 1:
        save_tile_to_s3(*tiles_coords[0], out_ary)
    else:
        full_ary[
            y - offset_y : y - offset_y + TILE_SIZE,
            x - offset_x : x - offset_x + TILE_SIZE,
            :,
        ] = out_ary
        save_tile_to_s3(*tiles_coords[0], full_ary[:TILE_SIZE, :TILE_SIZE, :])
        save_tile_to_s3(*tiles_coords[1], full_ary[:TILE_SIZE, TILE_SIZE:, :])
        save_tile_to_s3(*tiles_coords[2], full_ary[TILE_SIZE:, :TILE_SIZE, :])
        save_tile_to_s3(*tiles_coords[3], full_ary[TILE_SIZE:, TILE_SIZE:, :])

    return tiles_coords
