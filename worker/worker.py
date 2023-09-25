import asyncio
import logging
import os
import modal

from ably import AblyRealtime

logging.basicConfig(level=logging.INFO)


async def main():
    render_tile = modal.Function.lookup("terrain-diffusion-app", "render_tile")

    async with AblyRealtime(os.environ["ABLY_API_KEY"]) as client:
        channel = client.channels.get("channel:global")

        async def on_render_tile(message):
            logging.info(f"Render Tile: {message.data}")
            try:
                updated_tiles = await render_tile.remote.aio(
                    message.data["x"],
                    message.data["y"],
                    message.data["caption"],
                    message.data["space"],
                )
            except Exception as e:
                logging.error(f"Error rendering tile: {e}")
                updated_tiles = []
            await channel.publish(
                "tilesUpdated", {"tiles": updated_tiles, "id": message.data["id"]}
            )

        await channel.subscribe("renderTile", on_render_tile)

        while True:
            await client.connection.once_async()


if __name__ == "__main__":
    asyncio.run(main())
