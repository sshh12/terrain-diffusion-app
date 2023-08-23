import asyncio
import os

import requests
import boto3
from PIL import Image
from ably import AblyRealtime

BUCKET = "terrain-diffusion-app"
s3 = boto3.resource("s3")


def render_tile(x, y):
    url = "https://picsum.photos/512/512"
    # pil from url
    img = Image.open(requests.get(url, stream=True).raw)
    img.save("tmp.png")
    tile_row = y // 512
    tile_col = x // 512
    s3.Bucket(BUCKET).upload_file(
        "tmp.png", f"public/tiles/global/{tile_row}_{tile_col}.png"
    )
    return [(tile_row, tile_col)]


async def main():
    async with AblyRealtime(os.environ["ABLY_API_KEY"]) as client:
        channel = client.channels.get("channel:global")

        async def on_render_tile(message):
            print("Render tile", message.data)
            updates_tiles = render_tile(message.data["x"], message.data["y"])
            await channel.publish("tilesUpdated", {"tiles": updates_tiles})

        await channel.subscribe("renderTile", on_render_tile)
        await client.connection.once_async()


if __name__ == "__main__":
    asyncio.run(main())
