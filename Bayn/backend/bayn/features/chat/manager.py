"""WebSocket Connection Manager to track and route active real-time connections."""

import uuid
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # Maps a user_id to their active WebSocket connection(s).
        # We use a list of WebSockets because a single user might have 
        # multiple active tabs open simultaneously (multi-tab support!).
        self.active_connections: dict[uuid.UUID, list[WebSocket]] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        """Accepts a new connection and registers the user as online."""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
            
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        """Removes a closed socket connection from the registry."""
        if user_id in self.active_connections:
            # Safely remove this specific tab/device connection
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            
            # If the user has no remaining open connections/tabs, mark them offline
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: uuid.UUID) -> None:
        """Sends a direct payload to a specific user across all their open tabs."""
        connections = self.active_connections.get(user_id)
        if connections:
            for websocket in connections:
                try:
                    await websocket.send_json(message)
                except Exception:
                    # Clean up broken/stale connections silently if they fail
                    self.disconnect(user_id, websocket)

    async def broadcast_to_conversation(
        self, message: dict, member_ids: list[uuid.UUID]
    ) -> None:
        """
        Broadcasts a message payload to all active members of a conversation.
        
        We pass the list of member IDs directly into this function so the manager 
        doesn't have to touch the database, keeping it fast and lightweight.
        """
        for member_id in member_ids:
            await self.send_personal_message(message, member_id)


# Instantiate a single global manager to be imported across the app
manager = ConnectionManager()