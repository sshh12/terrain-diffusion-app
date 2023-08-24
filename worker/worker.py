import asyncio
import os
import io

import requests
import boto3
import numpy as np
from PIL import Image
from ably import AblyRealtime

TILE_KEY = "public/tiles/global/{tile_row}_{tile_col}.png"
BUCKET = "terrain-diffusion-app"
TILE_SIZE = 512

s3 = boto3.resource("s3")
s3_client = boto3.client("s3")

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


def get_tile_from_s3(row, col):
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


def save_tile_to_s3(row, col, img_ary):
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


def overlapping_tiles(top_left_x, top_left_y):
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


def render_tile(x, y, caption):
    tiles_coords = overlapping_tiles(x, y)
    while len(tiles_coords) not in [1, 4]:
        x -= 1
        y -= 1
        tiles_coords = overlapping_tiles(x, y)

    print(tiles_coords)

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

    image = inpaint_pipe(
        prompt=caption,
        image=Image.fromarray(init_ary),
        mask_image=Image.fromarray(mask),
        num_inference_steps=50,
        guidance_scale=7.5,
    ).images[0]
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


def get_tiles_index():
    tiles = []
    for item in s3.Bucket(BUCKET).objects.filter(Prefix="public/tiles/global/"):
        item_key = item.key.split("/")[-1].replace(".png", "")
        if "_" in item_key:
            row, col = item_key.split("_")
            tiles.append((int(row), int(col)))
    return tiles


async def main():
    async with AblyRealtime(os.environ["ABLY_API_KEY"]) as client:
        channel = client.channels.get("channel:global")

        async def on_render_tile(message):
            print("Render Tile", message.data)
            try:
                updates_tiles = render_tile(
                    message.data["x"], message.data["y"], message.data["caption"]
                )
            except Exception as e:
                print(e)
            await channel.publish(
                "tilesUpdated", {"tiles": updates_tiles, "id": message.data["id"]}
            )

        async def on_index_tiles(message):
            print("Index Tiles", message.data)
            await channel.publish("tilesIndex", {"tiles": get_tiles_index()})

        await channel.subscribe("renderTile", on_render_tile)
        await channel.subscribe("indexTiles", on_index_tiles)
        while True:
            await client.connection.once_async()


if __name__ == "__main__":
    asyncio.run(main())
