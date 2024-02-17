import os
from typing import Dict
from ably import AblyRealtime


class AblyClient:
    def __init__(self):
        self._client = None
        self._channel = None

    def _ensure_connection(self):
        if self._client is None:
            self._client = AblyRealtime(os.environ["ABLY_API_KEY"])
            self._channel = self._client.channels.get("channel:global2")

    async def publish(self, event: str, data: Dict):
        self._ensure_connection()
        await self._channel.publish(event, data)

    async def disconnect(self):
        if self._client is not None:
            await self._client.close()
            self._client = None
            self._channel = None
