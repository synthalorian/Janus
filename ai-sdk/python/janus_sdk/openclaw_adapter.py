"""
OpenClaw Janus Adapter

Connects OpenClaw (and similar AI harnesses) to Janus as a communication layer.
This allows AI agents to:
- Send/receive messages across channels
- Query the knowledge graph
- Spawn subagents through Janus
- Coordinate with other AI systems
"""

import asyncio
import json
import os
from typing import Optional, Dict, Any, Callable
from datetime import datetime

from janus_sdk import JanusClient, Message, UserType
from janus_sdk.exceptions import ConnectionError, MessageError


class OpenClawJanusAdapter:
    """
    Adapter for OpenClaw to connect to Janus.
    
    This allows OpenClaw to use Janus as its communication backend,
    enabling multi-agent coordination and knowledge persistence.
    
    Example:
        ```python
        adapter = OpenClawJanusAdapter(
            janus_url="http://localhost:3001",
            agent_id="synthclaw",
            agent_name="synthclaw 🎹🦞"
        )
        await adapter.connect()
        
        # Send message to Discord channel through Janus
        await adapter.send_to_channel("general", "Hello from OpenClaw!")
        
        # Query knowledge graph
        context = await adapter.get_context("authentication")
        ```
    """
    
    def __init__(
        self,
        janus_url: str = "http://localhost:3001",
        ws_url: str = "ws://localhost:3001",
        api_key: Optional[str] = None,
        agent_id: Optional[str] = None,
        agent_name: Optional[str] = None,
        workspace: Optional[str] = None
    ):
        """
        Initialize OpenClaw adapter.
        
        Args:
            janus_url: Janus REST API URL
            ws_url: Janus WebSocket URL
            api_key: API key for authentication
            agent_id: Unique agent identifier (e.g., "synthclaw")
            agent_name: Display name (e.g., "synthclaw 🎹🦞")
            workspace: OpenClaw workspace path
        """
        self.config = {
            "base_url": janus_url,
            "ws_url": ws_url,
            "api_key": api_key,
        }
        
        self.agent_id = agent_id or os.getenv("OPENCLAW_AGENT_ID", "unknown")
        self.agent_name = agent_name or os.getenv("OPENCLAW_AGENT_NAME", "AI Agent")
        self.workspace = workspace or os.getenv("OPENCLAW_WORKSPACE", "/tmp")
        
        self.client: Optional[JanusClient] = None
        self._message_handlers: Dict[str, Callable] = {}
        self._connected = False
        self._current_channel: Optional[str] = None
        
    async def connect(self) -> None:
        """Connect to Janus and register as AI agent."""
        from janus_sdk.types import ConnectionConfig
        
        config = ConnectionConfig(**self.config)
        self.client = JanusClient(config)
        
        # Set user info for the client
        self.client.user_id = self.agent_id
        self.client.user_name = self.agent_name
        
        await self.client.connect()
        self._connected = True
        
        # Setup message handlers
        self._setup_handlers()
        
        print(f"🎹🦞 OpenClaw adapter connected to Janus as {self.agent_name}")
        
    def _setup_handlers(self) -> None:
        """Setup event handlers for incoming messages."""
        
        @self.client.on("message")
        async def on_message(message: Message):
            # Route to appropriate handler based on channel
            handler = self._message_handlers.get(message.channel_id)
            if handler:
                await handler(message)
            
            # Also call global handler if set
            global_handler = self._message_handlers.get("*")
            if global_handler:
                await global_handler(message)
                
    async def disconnect(self) -> None:
        """Disconnect from Janus."""
        if self.client:
            await self.client.disconnect()
        self._connected = False
        
    # ==================== Channel Management ====================
    
    async def join_channel(self, channel_id: str) -> None:
        """Join a channel to receive messages."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        await self.client.join_channel(channel_id)
        self._current_channel = channel_id
        
    async def leave_channel(self, channel_id: str) -> None:
        """Leave a channel."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        await self.client.leave_channel(channel_id)
        if self._current_channel == channel_id:
            self._current_channel = None
            
    async def get_channels(self) -> list:
        """Get all available channels."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        return await self.client.get_channels()
    
    # ==================== Messaging ====================
    
    async def send_to_channel(
        self, 
        channel_id: str, 
        content: str,
        reply_to: Optional[str] = None
    ) -> Message:
        """
        Send a message to a Janus channel.
        
        This message will be:
        - Stored in the knowledge graph
        - Analyzed for entities and topics
        - Broadcast to all channel members
        - Searchable via semantic search
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        return await self.client.send_message(
            channel_id=channel_id,
            content=content,
            reply_to=reply_to
        )
    
    async def send_to_user(
        self,
        user_id: str,
        content: str
    ) -> None:
        """
        Send a direct message to a user.
        
        In Janus, this creates a DM channel or uses an existing one.
        """
        # For now, this would need DM channel support in Janus
        # Could be implemented as a special channel type
        pass
    
    async def stream_response(
        self,
        channel_id: str,
        content_generator
    ) -> Message:
        """
        Stream a response to a channel.
        
        Useful for long AI responses that should appear progressively.
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        return await self.client.stream_message(channel_id, content_generator)
    
    def on_message(self, channel_id: str = "*"):
        """
        Decorator to register a message handler.
        
        Args:
            channel_id: Channel to listen on, or "*" for all channels
            
        Example:
            ```python
            @adapter.on_message("general")
            async def handle_general(message):
                if "help" in message.content:
                    await adapter.send_to_channel("general", "How can I help?")
            ```
        """
        def decorator(func: Callable):
            self._message_handlers[channel_id] = func
            return func
        return decorator
    
    # ==================== Knowledge Graph ====================
    
    async def get_context(
        self, 
        topic: str, 
        limit: int = 10
    ) -> list:
        """
        Get contextual information about a topic from the knowledge graph.
        
        This allows AI agents to:
        - Recall previous discussions
        - Understand decisions made
        - Find related conversations
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        return await self.client.search_by_topic(topic, limit)
    
    async def search_knowledge(
        self, 
        query: str, 
        limit: int = 20
    ) -> list:
        """
        Perform semantic search across all messages.
        
        Returns messages most relevant to the query.
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        return await self.client.search(query, limit)
    
    async def get_decisions(self, limit: int = 20) -> list:
        """
        Get all decisions made in the system.
        
        Useful for AI agents to understand what has been decided
        and avoid rehashing settled topics.
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        return await self.client.get_decisions(limit)
    
    async def find_related(
        self, 
        message_id: str, 
        depth: int = 2
    ) -> list:
        """
        Find messages related to a specific message.
        
        Uses graph traversal to find connected conversations.
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        return await self.client.find_related_messages(message_id, depth)
    
    async def query_graph(self, query: str) -> list:
        """
        Query the knowledge graph directly.
        
        Supports graph-specific queries like:
        - "What did we decide about X?"
        - "Show me all messages by user Y about topic Z"
        """
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        return await self.client.query_graph(query)
    
    # ==================== AI Coordination ====================
    
    async def announce_presence(self, channel_id: str) -> None:
        """
        Announce that this AI agent is online and ready.
        
        This helps with coordination between multiple AI agents.
        """
        await self.send_to_channel(
            channel_id,
            f"🤖 {self.agent_name} is now online and ready to assist."
        )
    
    async def report_status(self, channel_id: str, status: str) -> None:
        """
        Report status to a channel.
        
        Useful for long-running tasks or subagent coordination.
        """
        await self.send_to_channel(
            channel_id,
            f"📊 **{self.agent_name} Status**: {status}"
        )
    
    async def delegate_to_subagent(
        self,
        channel_id: str,
        subagent_name: str,
        task: str
    ) -> None:
        """
        Announce delegation to a subagent.
        
        This creates a transparent record of task delegation
        in the knowledge graph.
        """
        await self.send_to_channel(
            channel_id,
            f"🔄 **Delegating to {subagent_name}**: {task}"
        )
    
    # ==================== Memory Integration ====================
    
    async def sync_to_janus_memory(self, memory_content: str) -> None:
        """
        Sync OpenClaw memory to Janus knowledge graph.
        
        This allows important information from OpenClaw's memory
        files to be searchable through Janus.
        """
        # Create a special "memory" channel or use existing
        memory_channel = "ai-memory"
        
        await self.send_to_channel(
            memory_channel,
            f"📄 **Memory Sync**: {memory_content[:500]}..."
        )
    
    async def recall_from_janus(self, topic: str) -> str:
        """
        Recall information from Janus knowledge graph.
        
        Combines search results into a coherent context string
        that can be used as prompt context.
        """
        messages = await self.search_knowledge(topic, limit=5)
        
        if not messages:
            return ""
        
        context_parts = []
        for msg in messages:
            context_parts.append(
                f"[{msg.author_name}]: {msg.content[:200]}"
            )
        
        return "\n".join(context_parts)


# ==================== OpenClaw Integration ====================

class JanusMessageTool:
    """
    Tool for OpenClaw to send messages through Janus.
    
    This can be registered as an OpenClaw tool, allowing
    the agent to send messages to channels.
    """
    
    def __init__(self, adapter: OpenClawJanusAdapter):
        self.adapter = adapter
    
    async def execute(self, channel: str, message: str) -> str:
        """
        Send a message to a Janus channel.
        
        Args:
            channel: Channel ID or name
            message: Message content
            
        Returns:
            Confirmation message
        """
        try:
            msg = await self.adapter.send_to_channel(channel, message)
            return f"Message sent to {channel}: {msg.id}"
        except Exception as e:
            return f"Failed to send message: {e}"


class JanusSearchTool:
    """
    Tool for OpenClaw to search Janus knowledge graph.
    """
    
    def __init__(self, adapter: OpenClawJanusAdapter):
        self.adapter = adapter
    
    async def execute(self, query: str, limit: int = 10) -> str:
        """
        Search Janus knowledge graph.
        
        Args:
            query: Search query
            limit: Max results
            
        Returns:
            Search results as formatted string
        """
        try:
            messages = await self.adapter.search_knowledge(query, limit)
            
            if not messages:
                return "No relevant information found."
            
            results = []
            for msg in messages:
                results.append(
                    f"- [{msg.author_name}]: {msg.content[:150]}..."
                )
            
            return "\n".join(results)
        except Exception as e:
            return f"Search failed: {e}"


# ==================== Configuration Helper ====================

def create_adapter_from_env() -> OpenClawJanusAdapter:
    """
    Create adapter from environment variables.
    
    Expected env vars:
    - JANUS_URL: Janus API URL
    - JANUS_WS_URL: Janus WebSocket URL
    - JANUS_API_KEY: API key
    - OPENCLAW_AGENT_ID: Agent ID
    - OPENCLAW_AGENT_NAME: Agent display name
    """
    return OpenClawJanusAdapter(
        janus_url=os.getenv("JANUS_URL", "http://localhost:3001"),
        ws_url=os.getenv("JANUS_WS_URL", "ws://localhost:3001"),
        api_key=os.getenv("JANUS_API_KEY"),
        agent_id=os.getenv("OPENCLAW_AGENT_ID"),
        agent_name=os.getenv("OPENCLAW_AGENT_NAME"),
    )
