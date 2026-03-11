"""
Bot Client for Janus SDK

Provides bot-specific functionality for the Janus Bot Forge.
Bots can use this to:
- Register themselves
- Handle commands/interactions
- Communicate with other bots
- Manage their state
"""

from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass
import socketio


@dataclass
class BotConfig:
    """Configuration for a Janus bot."""
    bot_id: str
    api_key: str
    name: str
    janus_url: str = "http://localhost:3001"
    ws_url: str = "ws://localhost:3001/bots"


class JanusBot:
    """
    Client for Janus Bot Forge.
    
    Example:
        ```python
        bot = JanusBot(
            bot_id="my-bot-123",
            api_key="janus_xxxx",
            name="My Bot"
        )
        
        @bot.on_command("ping")
        async def handle_ping(interaction, params):
            await interaction.reply("Pong!")
        
        await bot.connect()
        await bot.start()
        ```
    """
    
    def __init__(self, config: BotConfig):
        self.config = config
        self.client = None  # JanusClient instance
        self.socket: Optional[socketio.AsyncClient] = None
        self._command_handlers: Dict[str, Callable] = {}
        self._event_handlers: Dict[str, Callable] = {}
        self._connected = False
    
    async def connect(self) -> None:
        """Connect to Janus Bot Forge WebSocket."""
        self.socket = socketio.AsyncClient()
        
        # Setup event handlers
        self._setup_socket_events()
        
        await self.socket.connect(
            self.config.ws_url,
            headers={"Authorization": f"ApiKey {self.config.api_key}"}
        )
        
        # Authenticate as bot
        await self.socket.emit("bot:auth", {
            "botId": self.config.bot_id,
            "apiKey": self.config.api_key
        })
        
        self._connected = True
        print(f"🤖 Bot '{self.config.name}' connected to Janus")
    
    def _setup_socket_events(self) -> None:
        """Setup WebSocket event handlers."""
        
        @self.socket.on("bot:authenticated")
        async def on_authenticated(data):
            print(f"✅ Bot authenticated: {data}")
        
        @self.socket.on("bot:event")
        async def on_event(event):
            event_type = event.get("type")
            handler = self._event_handlers.get(event_type)
            if handler:
                await handler(event)
        
        @self.socket.on("interaction.created")
        async def on_interaction(event):
            interaction = event.get("data", {}).get("interaction", {})
            command_name = interaction.get("commandName")
            
            if command_name and command_name in self._command_handlers:
                handler = self._command_handlers[command_name]
                await handler(Interaction(self, interaction))
        
        @self.socket.on("bot.message.received")
        async def on_bot_message(event):
            handler = self._event_handlers.get("message")
            if handler:
                await handler(event.get("data"))
    
    def on_command(self, name: str):
        """
        Decorator to register a command handler.
        
        Example:
            ```python
            @bot.on_command("ping")
            async def ping(interaction, params):
                await interaction.reply("Pong!")
            ```
        """
        def decorator(func: Callable):
            self._command_handlers[name] = func
            return func
        return decorator
    
    def on_event(self, event_type: str):
        """
        Decorator to register an event handler.
        
        Event types:
        - 'message' - Bot-to-bot message received
        - 'ready' - Bot is ready
        - 'disconnect' - Bot disconnected
        """
        def decorator(func: Callable):
            self._event_handlers[event_type] = func
            return func
        return decorator
    
    async def send_message(
        self,
        to_bot_id: str,
        content: str,
        message_type: str = "message",
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Send a message to another bot.
        
        Args:
            to_bot_id: Target bot ID
            content: Message content
            message_type: Type of message
            metadata: Additional metadata
        """
        if not self.client:
            raise RuntimeError("Bot not connected")
        
        resp = await self.client._request(
            "POST",
            f"/api/bots/{self.config.bot_id}/message",
            json={
                "toBotId": to_bot_id,
                "content": content,
                "messageType": message_type,
                "metadata": metadata or {}
            }
        )
        return resp.get("data", {})
    
    async def get_messages(
        self,
        direction: str = "both",
        unread_only: bool = False,
        limit: int = 50
    ) -> List[Dict]:
        """Get bot messages."""
        if not self.client:
            raise RuntimeError("Bot not connected")
        
        resp = await self.client._request(
            "GET",
            f"/api/bots/{self.config.bot_id}/messages",
            params={
                "direction": direction,
                "unreadOnly": str(unread_only).lower(),
                "limit": limit
            }
        )
        return resp.get("data", [])
    
    async def mark_messages_read(self, message_ids: Optional[List[str]] = None) -> None:
        """Mark messages as read."""
        if not self.client:
            raise RuntimeError("Bot not connected")
        
        await self.client._request(
            "POST",
            f"/api/bots/{self.config.bot_id}/messages/read",
            json={"messageIds": message_ids} if message_ids else {}
        )
    
    async def update_status(self, status: str) -> None:
        """
        Update bot status.
        
        Status options: 'online', 'offline', 'idle', 'dnd', 'error'
        """
        if not self.client:
            raise RuntimeError("Bot not connected")
        
        await self.client._request(
            "POST",
            f"/api/bots/{self.config.bot_id}/status",
            json={"status": status}
        )
    
    async def start(self) -> None:
        """Start the bot and keep running."""
        if not self._connected:
            await self.connect()
        
        # Set status to online
        await self.update_status("online")
        
        print(f"🤖 Bot '{self.config.name}' is running!")
        
        # Keep running
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            await self.stop()
    
    async def stop(self) -> None:
        """Stop the bot."""
        # Set status to offline
        await self.update_status("offline")
        
        if self.socket:
            await self.socket.disconnect()
        
        self._connected = False
        print(f"🛑 Bot '{self.config.name}' stopped")


class Interaction:
    """Represents a bot interaction (command invocation)."""
    
    def __init__(self, bot: JanusBot, data: Dict[str, Any]):
        self.bot = bot
        self.id = data.get("id")
        self.type = data.get("type")
        self.command_name = data.get("commandName")
        self.parameters = data.get("parameters", {})
        self.user_id = data.get("userId")
        self.server_id = data.get("serverId")
        self.channel_id = data.get("channelId")
        self._responded = False
    
    async def reply(self, content: str, response_type: str = "message") -> None:
        """Reply to the interaction."""
        if self._responded:
            return
        
        if not self.bot.client:
            raise RuntimeError("Bot not connected")
        
        await self.bot.client._request(
            "POST",
            f"/api/bots/interactions/{self.id}/response",
            json={
                "responseType": response_type,
                "responseContent": content,
                "status": "completed"
            }
        )
        
        self._responded = True
    
    async def defer(self) -> None:
        """Defer the response (acknowledge but respond later)."""
        if not self.bot.client:
            raise RuntimeError("Bot not connected")
        
        await self.bot.client._request(
            "POST",
            f"/api/bots/interactions/{self.id}/response",
            json={
                "responseType": "defer",
                "status": "processing"
            }
        )


# ==================== Bot Factory ====================

class BotFactory:
    """Factory for creating and managing bots."""
    
    @staticmethod
    async def create_bot(
        client,
        name: str,
        description: str = "",
        bot_type: str = "custom",
        scopes: Optional[List[str]] = None,
        capabilities: Optional[List[str]] = None,
        is_public: bool = False,
    ) -> Dict[str, Any]:
        """
        Create a new bot.
        
        Returns bot info including API key (shown only once).
        """
        resp = await client._request(
            "POST",
            "/api/bots",
            json={
                "name": name,
                "description": description,
                "type": bot_type,
                "scopes": scopes or ["bot:read", "bot:write"],
                "capabilities": capabilities or ["read_messages", "send_messages"],
                "isPublic": is_public,
            }
        )
        return resp.get("data", {})
    
    @staticmethod
    async def get_bot(client, bot_id: str) -> Dict[str, Any]:
        """Get bot information."""
        resp = await client._request("GET", f"/api/bots/{bot_id}")
        return resp.get("data", {})
    
    @staticmethod
    async def list_bots(
        client,
        category: Optional[str] = None,
        is_public: Optional[bool] = None,
        limit: int = 50
    ) -> List[Dict]:
        """List available bots."""
        params = {"limit": limit}
        if category:
            params["category"] = category
        if is_public is not None:
            params["isPublic"] = str(is_public).lower()
        
        resp = await client._request("GET", "/api/bots", params=params)
        return resp.get("data", [])
    
    @staticmethod
    async def install_bot(
        client,
        bot_id: str,
        server_id: str,
        scopes: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Install a bot to a server."""
        resp = await client._request(
            "POST",
            f"/api/bots/{bot_id}/install",
            json={
                "serverId": server_id,
                "scopes": scopes
            }
        )
        return resp.get("data", {})


# ==================== Example Usage ====================

async def example_bot():
    """Example bot implementation."""
    import asyncio
    
    config = BotConfig(
        bot_id="ping-bot-123",
        api_key="janus_xxxxx",
        name="Ping Bot"
    )
    
    bot = JanusBot(config)
    
    @bot.on_command("ping")
    async def handle_ping(interaction: Interaction, params: Dict):
        await interaction.reply("🏓 Pong!")
    
    @bot.on_command("help")
    async def handle_help(interaction: Interaction, params: Dict):
        await interaction.reply("Available commands: ping, help")
    
    @bot.on_event("message")
    async def handle_message(data: Dict):
        print(f"Received message from {data.get('fromBotId')}: {data.get('content')}")
    
    await bot.start()


if __name__ == "__main__":
    import asyncio
    asyncio.run(example_bot())
