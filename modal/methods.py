import os
import modal
from typing import Dict
from ably import AblyRest

import streaming

METHODS = {}


def method():
    def wrap(func):
        async def wrapper(ably: streaming.AblyClient, **kwargs):
            return await func(ably, **kwargs)

        METHODS[func.__name__] = wrapper

    return wrap


@method()
async def request_ably_token(ably: streaming.AblyClient, client_id: str) -> Dict:
    ably_api_key = os.environ.get("ABLY_API_KEY")
    client = AblyRest(ably_api_key)
    token_request_data = await client.auth.create_token_request(
        {"client_id": client_id}
    )
    return token_request_data.to_dict()


@method()
async def render_tile(
    ably: streaming.AblyClient, caption: str, space: str, id: str, x: int, y: int
) -> Dict:
    render_tile = modal.Function.lookup("terrain-diffusion-app", "render_tile")
    try:
        updated_tiles = await render_tile.remote.aio(
            x,
            y,
            caption,
            space,
        )
    except Exception as e:
        print(f"Error rendering tile: {e}")
        updated_tiles = []
    await ably.publish(
        "tilesUpdated",
        {"tiles": updated_tiles, "id": id, "space": space},
    )
    return {"tiles": updated_tiles, "id": id, "space": space}
