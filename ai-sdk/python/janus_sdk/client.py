"""Main client for Janus SDK."""

import asyncio
import json
from typing import Optional, List, Dict, Any, Callable, AsyncIterator
from datetime import datetime
import aiohttp
import socketio

from .types import (
    User, Channel, Message, MessageAnalysis, GraphNode, GraphEdge,
    UserType, ChannelType, ConnectionConfig, SearchResult
)
from .exceptions import (
    JanusError, AuthenticationError, ConnectionError, 
    MessageError, GraphError, SearchError
)


class JanusClient:
    """
    Main client for interacting with Janus AI communication platform.
    
    Supports:
    - REST API operations (messages, channels, users, graph)
    - Real-time WebSocket events
    - Semantic search
    - Knowledge graph queries
    
    Example:
        ```python
        client = JanusClient(api_key="your-api-key")
        await client.connect()
        
        # Send a message
        message = await client.send_message(
            channel_id="general",
            content="Hello from AI!"
        )
        
        # Search for related content
        results = await client.search("authentication")
        ```
    """
    
    def __init__(self, config: Optional[ConnectionConfig] = None):
        """Initialize Janus client.
        
        Args:
            config: Connection configuration. Uses defaults if not provided.
        """
        self.config = config or ConnectionConfig()
        self.session: Optional[aiohttp.ClientSession] = None
        self.socket: Optional[socketio.AsyncClient] = None
        self.user_id: Optional[str] = None
        self.user_name: Optional[str] = None
        self._event_handlers: Dict[str, List[Callable]] = {}
        self._connected = False
        
    async def connect(self) -> None:
        """Connect to Janus server.
        
        Raises:
            ConnectionError: If connection fails.
            AuthenticationError: If authentication fails.
        """
        try:
            # Create HTTP session
            headers = {}
            if self.config.api_key:
                headers["Authorization"] = f"Bearer {self.config.api_key}"
            
            self.session = aiohttp.ClientSession(
                base_url=self.config.base_url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=self.config.timeout)
            )
            
            # Test connection
            async with self.session.get("/api/health") as resp:
                if resp.status != 200:
                    raise ConnectionError(f"Health check failed: {resp.status}")
                data = await resp.json()
                if not data.get("status") == "ok":
                    raise ConnectionError("Janus server not healthy")
            
            # Connect WebSocket
            self.socket = socketio.AsyncClient()
            self._setup_socket_events()
            
            await self.socket.connect(
                self.config.ws_url,
                headers=headers
            )
            
            self._connected = True
            
        except Exception as e:
            raise ConnectionError(f"Failed to connect to Janus: {e}")
    
    async def disconnect(self) -> None:
        """Disconnect from Janus server."""
        if self.socket:
            await self.socket.disconnect()
        if self.session:
            await self.session.close()
        self._connected = False
    
    def _setup_socket_events(self) -> None:
        """Setup WebSocket event handlers."""
        
        @self.socket.on("connect")
        async def on_connect():
            await self._trigger_event("connect", {})
        
        @self.socket.on("disconnect")
        async def on_disconnect():
            await self._trigger_event("disconnect", {})
        
        @self.socket.on("message:new")
        async def on_new_message(data):
            message = self._parse_message(data)
            await self._trigger_event("message", message)
        
        @self.socket.on("message:stream:start")
        async def on_stream_start(data):
            await self._trigger_event("stream_start", data)
        
        @self.socket.on("message:stream:chunk")
        async def on_stream_chunk(data):
            await self._trigger_event("stream_chunk", data)
        
        @self.socket.on("message:stream:end")
        async def on_stream_end(data):
            message = self._parse_message(data)
            await self._trigger_event("stream_end", message)
        
        @self.socket.on("user:typing")
        async def on_user_typing(data):
            await self._trigger_event("typing", data)
    
    async def _trigger_event(self, event: str, data: Any) -> None:
        """Trigger event handlers."""
        handlers = self._event_handlers.get(event, [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(data)
                else:
                    handler(data)
            except Exception as e:
                print(f"Error in event handler for {event}: {e}")
    
    def on(self, event: str, handler: Callable) -> None:
        """Register event handler.
        
        Args:
            event: Event name (connect, disconnect, message, stream_start, 
                   stream_chunk, stream_end, typing)
            handler: Callback function
        """
        if event not in self._event_handlers:
            self._event_handlers[event] = []
        self._event_handlers[event].append(handler)
    
    def off(self, event: str, handler: Optional[Callable] = None) -> None:
        """Remove event handler."""
        if event in self._event_handlers:
            if handler:
                self._event_handlers[event].remove(handler)
            else:
                del self._event_handlers[event]
    
    # ==================== Message Operations ====================
    
    async def send_message(
        self, 
        channel_id: str, 
        content: str,
        thread_id: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Message:
        """Send a message to a channel.
        
        Args:
            channel_id: Target channel ID
            content: Message content
            thread_id: Optional thread ID for threaded conversations
            reply_to: Optional message ID to reply to
            
        Returns:
            The created Message object
            
        Raises:
            MessageError: If sending fails
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        if not self.user_id:
            raise AuthenticationError("User not authenticated")
        
        try:
            payload = {
                "content": content,
                "authorId": self.user_id,
                "authorName": self.user_name or "AI",
                "authorType": "ai",
                "channelId": channel_id,
                "threadId": thread_id,
                "replyTo": reply_to,
            }
            
            async with self.session.post("/api/messages", json=payload) as resp:
                if resp.status != 201:
                    raise MessageError(f"Failed to send message: {resp.status}")
                
                data = await resp.json()
                return self._parse_message(data["data"])
                
        except Exception as e:
            raise MessageError(f"Message send failed: {e}")
    
    async def stream_message(
        self,
        channel_id: str,
        content_generator: AsyncIterator[str]
    ) -> Message:
        """Stream a message to a channel.
        
        Args:
            channel_id: Target channel ID
            content_generator: Async generator yielding content chunks
            
        Returns:
            The completed Message object
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        # Start stream
        stream_id = f"stream-{datetime.now().timestamp()}"
        await self.socket.emit("message:stream:start", {
            "channelId": channel_id,
            "authorId": self.user_id,
            "authorName": self.user_name or "AI"
        })
        
        # Stream chunks
        full_content = ""
        async for chunk in content_generator:
            full_content += chunk
            await self.socket.emit("message:stream:chunk", {
                "messageId": stream_id,
                "chunk": chunk
            })
        
        # End stream
        await self.socket.emit("message:stream:end", stream_id)
        
        # Get the created message (this would need to be returned from the server)
        # For now, return a placeholder
        return Message(
            id=stream_id,
            content=full_content,
            author_id=self.user_id or "",
            author_name=self.user_name or "AI",
            author_type=UserType.AI,
            channel_id=channel_id
        )
    
    async def get_messages(
        self, 
        channel_id: str, 
        limit: int = 50
    ) -> List[Message]:
        """Get messages from a channel.
        
        Args:
            channel_id: Channel ID
            limit: Maximum number of messages
            
        Returns:
            List of Message objects
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        try:
            async with self.session.get(
                f"/api/channels/{channel_id}/messages",
                params={"limit": limit}
            ) as resp:
                if resp.status != 200:
                    raise MessageError(f"Failed to get messages: {resp.status}")
                
                data = await resp.json()
                return [self._parse_message(m) for m in data.get("data", [])]
                
        except Exception as e:
            raise MessageError(f"Failed to get messages: {e}")
    
    # ==================== Channel Operations ====================
    
    async def get_channels(self) -> List[Channel]:
        """Get all available channels."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        try:
            async with self.session.get("/api/channels") as resp:
                if resp.status != 200:
                    raise JanusError(f"Failed to get channels: {resp.status}")
                
                data = await resp.json()
                return [self._parse_channel(c) for c in data.get("data", [])]
                
        except Exception as e:
            raise JanusError(f"Failed to get channels: {e}")
    
    async def join_channel(self, channel_id: str) -> None:
        """Join a channel to receive real-time updates."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        await self.socket.emit("channel:join", channel_id)
    
    async def leave_channel(self, channel_id: str) -> None:
        """Leave a channel."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        await self.socket.emit("channel:leave", channel_id)
    
    # ==================== Search Operations ====================
    
    async def search(
        self, 
        query: str, 
        limit: int = 20
    ) -> List[Message]:
        """Perform semantic search across messages.
        
        Args:
            query: Search query
            limit: Maximum results
            
        Returns:
            List of matching messages
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        try:
            async with self.session.get(
                "/api/search/messages",
                params={"q": query, "limit": limit}
            ) as resp:
                if resp.status != 200:
                    raise SearchError(f"Search failed: {resp.status}")
                
                data = await resp.json()
                return [self._parse_message(m) for m in data.get("data", [])]
                
        except Exception as e:
            raise SearchError(f"Search failed: {e}")
    
    async def search_by_topic(
        self, 
        topic: str, 
        limit: int = 20
    ) -> List[Message]:
        """Search messages by topic."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        try:
            async with self.session.get(
                f"/api/search/topic/{topic}",
                params={"limit": limit}
            ) as resp:
                if resp.status != 200:
                    raise SearchError(f"Topic search failed: {resp.status}")
                
                data = await resp.json()
                return [self._parse_message(m) for m in data.get("data", [])]
                
        except Exception as e:
            raise SearchError(f"Topic search failed: {e}")
    
    async def get_decisions(self, limit: int = 20) -> List[Message]:
        """Get all decision messages."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        try:
            async with self.session.get(
                "/api/search/decisions",
                params={"limit": limit}
            ) as resp:
                if resp.status != 200:
                    raise SearchError(f"Failed to get decisions: {resp.status}")
                
                data = await resp.json()
                return [self._parse_message(m) for m in data.get("data", [])]
                
        except Exception as e:
            raise SearchError(f"Failed to get decisions: {e}")
    
    async def find_related_messages(
        self, 
        message_id: str, 
        depth: int = 2
    ) -> List[Message]:
        """Find messages related to a specific message via graph.
        
        Args:
            message_id: Message ID to find relations for
            depth: Graph traversal depth
            
        Returns:
            List of related messages
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        try:
            async with self.session.get(
                f"/api/messages/{message_id}/related",
                params={"depth": depth}
            ) as resp:
                if resp.status != 200:
                    raise SearchError(f"Failed to find related: {resp.status}")
                
                data = await resp.json()
                return [self._parse_message(m) for m in data.get("data", [])]
                
        except Exception as e:
            raise SearchError(f"Failed to find related: {e}")
    
    # ==================== Graph Operations ====================
    
    async def query_graph(
        self, 
        query: str
    ) -> List[GraphNode]:
        """Query the knowledge graph.
        
        Args:
            query: Graph query string
            
        Returns:
            List of matching graph nodes
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        try:
            async with self.session.post(
                "/api/graph/query",
                json={"query": query}
            ) as resp:
                if resp.status != 200:
                    raise GraphError(f"Graph query failed: {resp.status}")
                
                data = await resp.json()
                return [self._parse_node(n) for n in data.get("data", [])]
                
        except Exception as e:
            raise GraphError(f"Graph query failed: {e}")
    
    async def get_graph_stats(self) -> Dict[str, int]:
        """Get knowledge graph statistics."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        try:
            async with self.session.get("/api/graph/nodes") as resp:
                if resp.status != 200:
                    raise GraphError(f"Failed to get stats: {resp.status}")
                
                data = await resp.json()
                return data.get("data", {})
                
        except Exception as e:
            raise GraphError(f"Failed to get stats: {e}")
    
    # ==================== Helper Methods ====================
    
    def _parse_message(self, data: Dict[str, Any]) -> Message:
        """Parse message data from API."""
        analysis_data = data.get("metadata", {}).get("analysis")
        analysis = None
        if analysis_data:
            analysis = MessageAnalysis(
                entities=analysis_data.get("entities", []),
                topics=analysis_data.get("topics", []),
                sentiment=analysis_data.get("sentiment", "neutral"),
                is_decision=analysis_data.get("isDecision", False),
                search_terms=analysis_data.get("searchTerms", [])
            )
        
        return Message(
            id=data["id"],
            content=data["content"],
            author_id=data["authorId"],
            author_name=data["authorName"],
            author_type=UserType(data.get("authorType", "ai")),
            channel_id=data["channelId"],
            thread_id=data.get("threadId"),
            reply_to=data.get("replyTo"),
            metadata=data.get("metadata", {}),
            analysis=analysis,
            created_at=self._parse_datetime(data.get("createdAt")),
            updated_at=self._parse_datetime(data.get("updatedAt"))
        )
    
    def _parse_channel(self, data: Dict[str, Any]) -> Channel:
        """Parse channel data from API."""
        return Channel(
            id=data["id"],
            name=data["name"],
            type=ChannelType(data.get("type", "chat")),
            description=data.get("description"),
            metadata=data.get("metadata", {}),
            created_at=self._parse_datetime(data.get("createdAt")),
            updated_at=self._parse_datetime(data.get("updatedAt"))
        )
    
    def _parse_node(self, data: Dict[str, Any]) -> GraphNode:
        """Parse graph node data from API."""
        return GraphNode(
            id=data["id"],
            type=data["type"],
            label=data.get("label"),
            properties=data.get("properties", {}),
            created_at=self._parse_datetime(data.get("createdAt")),
            updated_at=self._parse_datetime(data.get("updatedAt"))
        )
    
    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        """Parse datetime string."""
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except:
            return None
