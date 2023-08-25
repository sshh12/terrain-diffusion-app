import asyncio
import logging
import os

from ably import AblyRealtime
from terrain_rendering import render_tile, get_tiles_index, LocalGPUInpainter


async def main():
    model = LocalGPUInpainter()
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
            await channel.publish("tilesIndex", {"tiles": get_tiles_index()})

        await channel.subscribe("renderTile", on_render_tile)
        await channel.subscribe("indexTiles", on_index_tiles)
        while True:
            await client.connection.once_async()


if __name__ == "__main__":
    asyncio.run(main())
