from typing import Dict
import asyncio
import logging
import argparse
import os

from ably import AblyRealtime
from terrain_rendering import render_tile, get_all_tiles, LocalGPUInpainter

logging.basicConfig(level=logging.INFO)


async def main(kwargs_inpainter: Dict):
    model = LocalGPUInpainter(**kwargs_inpainter)
    async with AblyRealtime(os.environ["ABLY_API_KEY"]) as client:
        channel = client.channels.get("channel:global")

        async def on_render_tile(message):
            logging.info(f"Render Tile: {message.data}")
            try:
                updated_tiles = await render_tile(
                    model, message.data["x"], message.data["y"], message.data["caption"]
                )
            except Exception as e:
                logging.error(f"Error rendering tile: {e}")
                updated_tiles = []
            await channel.publish(
                "tilesUpdated", {"tiles": updated_tiles, "id": message.data["id"]}
            )

        async def on_index_tiles(message):
            logging.info(f"Index Tiles: {message.data}")
            await channel.publish("tilesIndex", {"tiles": await get_all_tiles()})

        await channel.subscribe("renderTile", on_render_tile)
        await channel.subscribe("indexTiles", on_index_tiles)
        while True:
            await client.connection.once_async()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base_model", type=str, default="stabilityai/stable-diffusion-2-inpainting"
    )
    parser.add_argument(
        "--lora_model",
        type=str,
        default="F:\output-sd2-inpaint-8x4-1e6-drop03\checkpoint-15000\pytorch_model.bin",
    )
    parser.add_argument(
        "--cache_dir",
        type=str,
        default=None,
    )
    args = parser.parse_args()
    kwargs_inpainter = dict(
        base_model=args.base_model, lora_model=args.lora_model, cache_dir=args.cache_dir
    )
    asyncio.run(main(kwargs_inpainter))
