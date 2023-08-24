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
    except Exception:
        img_ary = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.uint8)
    return img_ary


def save_tile_to_s3(row, col, img_ary):
    img = Image.fromarray(img_ary)
    img.save("tmp.png")
    s3.Bucket(BUCKET).upload_file(
        "tmp.png", TILE_KEY.format(tile_row=row, tile_col=col)
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


def render_tile(x, y):
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
        init_ary = full_ary[
            x % TILE_SIZE : x % TILE_SIZE + TILE_SIZE,
            y % TILE_SIZE : y % TILE_SIZE + TILE_SIZE,
            :,
        ]

    mask = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.uint8)
    mask[np.all(init_ary == 0, axis=2)] = 255

    test = Image.fromarray(init_ary)
    test.save("tmp.png")
    test = Image.fromarray(mask)
    test.save("tmp-mask.png")

    prompt = "a satellite image"
    image = inpaint_pipe(
        prompt=prompt,
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
            x % TILE_SIZE : x % TILE_SIZE + TILE_SIZE,
            y % TILE_SIZE : y % TILE_SIZE + TILE_SIZE,
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
            print("Render tile", message.data)
            try:
                updates_tiles = render_tile(message.data["x"], message.data["y"])
            except Exception as e:
                print(e)
            await channel.publish("tilesUpdated", {"tiles": updates_tiles})

        async def on_index_tiles(message):
            print("Index tiles", message.data)
            await channel.publish("tilesIndex", {"tiles": get_tiles_index()})

        await channel.subscribe("renderTile", on_render_tile)
        await channel.subscribe("indexTiles", on_index_tiles)
        while True:
            await client.connection.once_async()


if __name__ == "__main__":
    asyncio.run(main())
