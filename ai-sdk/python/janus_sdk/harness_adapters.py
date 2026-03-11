"""
Universal AI Harness Adapter for Janus

Provides a generic interface for ANY AI harness to connect to Janus.
Specific adapters implement this interface for each harness type.

Supported Harnesses:
- OpenClaw (OpenClaw)
- OpenCode (VS Code extension)
- Claude Code (Anthropic CLI)
- Aider (CLI pair programming)
- Continue (VS Code extension)
- Cline (VS Code extension)
- IronClaw (Custom)
- And any future harness via the generic interface
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Callable, List
from dataclasses import dataclass
from enum import Enum
import asyncio


class HarnessType(str, Enum):
    """Supported AI harness types."""
    OPENCLAW = "openclaw"
    OPENCODE = "opencode"
    CLAUDE_CODE = "claude_code"
    AIDER = "aider"
    CONTINUE = "continue"
    CLINE = "cline"
    IRONCLAW = "ironclaw"
    CURSOR = "cursor"
    GITHUB_COPILOT = "github_copilot"
    CUSTOM = "custom"


@dataclass
class HarnessCapabilities:
    """Capabilities of an AI harness."""
    supports_realtime: bool = False
    supports_filesystem: bool = True
    supports_terminal: bool = True
    supports_web: bool = False
    supports_voice: bool = False
    max_context_tokens: int = 128000
    supports_subagents: bool = False
    supports_tools: bool = True


@dataclass
class HarnessContext:
    """Context about the current harness session."""
    harness_type: HarnessType
    workspace_path: str
    current_file: Optional[str] = None
    selected_code: Optional[str] = None
    terminal_output: Optional[str] = None
    user_prompt: Optional[str] = None


class BaseHarnessAdapter(ABC):
    """
    Abstract base class for ALL AI harness adapters.
    
    Any AI harness that wants to connect to Janus must implement
    this interface. This ensures universal compatibility.
    
    Example implementation:
        ```python
        class MyHarnessAdapter(BaseHarnessAdapter):
            @property
            def harness_type(self) -> HarnessType:
                return HarnessType.CUSTOM
            
            async def send_to_user(self, message: str) -> None:
                # Implementation specific to your harness
                pass
        ```
    """
    
    def __init__(
        self,
        janus_url: str = "http://localhost:3001",
        agent_id: Optional[str] = None,
        agent_name: Optional[str] = None,
        api_key: Optional[str] = None
    ):
        self.janus_url = janus_url
        self.agent_id = agent_id or "unknown-agent"
        self.agent_name = agent_name or "AI Agent"
        self.api_key = api_key
        self._janus_client = None
        self._connected = False
        self._message_callbacks: List[Callable] = []
    
    @property
    @abstractmethod
    def harness_type(self) -> HarnessType:
        """Return the type of harness this adapter supports."""
        pass
    
    @property
    @abstractmethod
    def capabilities(self) -> HarnessCapabilities:
        """Return the capabilities of this harness."""
        pass
    
    @abstractmethod
    async def connect(self) -> None:
        """Connect to both the harness and Janus."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from harness and Janus."""
        pass
    
    @abstractmethod
    async def send_to_user(self, message: str, metadata: Optional[Dict] = None) -> None:
        """
        Send a message to the user through the harness's UI.
        
        This is how Janus messages appear in the harness interface.
        """
        pass
    
    @abstractmethod
    async def receive_from_user(self) -> Optional[str]:
        """
        Receive input from the user.
        
        Called when the user sends a message in the harness.
        """
        pass
    
    @abstractmethod
    async def get_context(self) -> HarnessContext:
        """
        Get current context from the harness.
        
        Returns information about workspace, open files, etc.
        """
        pass
    
    # ============ Janus Integration Methods ============
    
    async def connect_to_janus(self) -> None:
        """Connect to Janus server."""
        from janus_sdk import JanusClient
        from janus_sdk.types import ConnectionConfig
        
        config = ConnectionConfig(
            base_url=self.janus_url,
            api_key=self.api_key
        )
        
        self._janus_client = JanusClient(config)
        self._janus_client.user_id = self.agent_id
        self._janus_client.user_name = self.agent_name
        
        await self._janus_client.connect()
        self._connected = True
        
        # Setup Janus message handler
        self._janus_client.on("message", self._on_janus_message)
    
    async def _on_janus_message(self, message) -> None:
        """Handle incoming messages from Janus."""
        # Forward to user through harness
        formatted = f"[{message.author_name}]: {message.content}"
        await self.send_to_user(formatted)
        
        # Notify callbacks
        for callback in self._message_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(message)
                else:
                    callback(message)
            except Exception as e:
                print(f"Error in message callback: {e}")
    
    def on_janus_message(self, callback: Callable) -> None:
        """Register callback for Janus messages."""
        self._message_callbacks.append(callback)
    
    async def send_to_janus_channel(
        self, 
        channel_id: str, 
        content: str
    ) -> None:
        """Send a message to a Janus channel."""
        if not self._connected or not self._janus_client:
            raise ConnectionError("Not connected to Janus")
        
        await self._janus_client.send_message(
            channel_id=channel_id,
            content=content
        )
    
    async def query_janus_knowledge(
        self, 
        query: str, 
        limit: int = 10
    ) -> List[Any]:
        """Query Janus knowledge graph."""
        if not self._connected:
            raise ConnectionError("Not connected to Janus")
        
        return await self._janus_client.search(query, limit)
    
    async def sync_context_to_janus(self) -> None:
        """Sync current harness context to Janus knowledge graph."""
        context = await self.get_context()
        
        # Create a context summary
        summary = f"""
Harness: {context.harness_type.value}
Workspace: {context.workspace_path}
Current File: {context.current_file or "None"}
User Query: {context.user_prompt or "None"}
"""
        
        # Send to Janus memory channel
        await self.send_to_janus_channel(
            channel_id="ai-context",
            content=summary
        )


# ==================== Specific Harness Adapters ====================


class OpenClawAdapter(BaseHarnessAdapter):
    """Adapter for OpenClaw AI harness."""
    
    @property
    def harness_type(self) -> HarnessType:
        return HarnessType.OPENCLAW
    
    @property
    def capabilities(self) -> HarnessCapabilities:
        return HarnessCapabilities(
            supports_realtime=True,
            supports_subagents=True,
            max_context_tokens=204800
        )
    
    async def connect(self) -> None:
        """Connect OpenClaw to Janus."""
        await self.connect_to_janus()
        print(f"🎹🦞 OpenClaw connected to Janus as {self.agent_name}")
    
    async def disconnect(self) -> None:
        """Disconnect OpenClaw from Janus."""
        if self._janus_client:
            await self._janus_client.disconnect()
        self._connected = False
    
    async def send_to_user(self, message: str, metadata: Optional[Dict] = None) -> None:
        """Send message to user through OpenClaw."""
        # In OpenClaw, this would use the message tool
        # For now, print to stdout (OpenClaw captures this)
        print(f"🎹🦞 {message}")
    
    async def receive_from_user(self) -> Optional[str]:
        """Receive input from OpenClaw user."""
        # OpenClaw provides this through the conversation context
        # This would be implemented based on OpenClaw's API
        return None
    
    async def get_context(self) -> HarnessContext:
        """Get OpenClaw context."""
        import os
        return HarnessContext(
            harness_type=self.harness_type,
            workspace_path=os.getenv("OPENCLAW_WORKSPACE", "/tmp"),
            current_file=None,  # Would get from OpenClaw
            user_prompt=None    # Would get from OpenClaw
        )


class OpenCodeAdapter(BaseHarnessAdapter):
    """Adapter for OpenCode (VS Code extension)."""
    
    @property
    def harness_type(self) -> HarnessType:
        return HarnessType.OPENCODE
    
    @property
    def capabilities(self) -> HarnessCapabilities:
        return HarnessCapabilities(
            supports_realtime=True,
            supports_filesystem=True,
            supports_web=True,
            max_context_tokens=128000
        )
    
    async def connect(self) -> None:
        """Connect OpenCode to Janus."""
        await self.connect_to_janus()
        print(f"🔧 OpenCode connected to Janus as {self.agent_name}")
    
    async def disconnect(self) -> None:
        """Disconnect OpenCode from Janus."""
        if self._janus_client:
            await self._janus_client.disconnect()
        self._connected = False
    
    async def send_to_user(self, message: str, metadata: Optional[Dict] = None) -> None:
        """Send message to user through OpenCode."""
        # OpenCode uses VS Code's webview API
        # This would integrate with OpenCode's extension API
        print(f"[OpenCode] {message}")
    
    async def receive_from_user(self) -> Optional[str]:
        """Receive input from OpenCode user."""
        # Would integrate with OpenCode's message handling
        return None
    
    async def get_context(self) -> HarnessContext:
        """Get OpenCode context (active file, selection, etc.)."""
        # Would get from VS Code extension API
        return HarnessContext(
            harness_type=self.harness_type,
            workspace_path="/workspace",  # Would get from VS Code
            current_file=None,
            selected_code=None
        )


class ClaudeCodeAdapter(BaseHarnessAdapter):
    """Adapter for Claude Code (Anthropic CLI)."""
    
    @property
    def harness_type(self) -> HarnessType:
        return HarnessType.CLAUDE_CODE
    
    @property
    def capabilities(self) -> HarnessCapabilities:
        return HarnessCapabilities(
            supports_terminal=True,
            supports_filesystem=True,
            max_context_tokens=200000
        )
    
    async def connect(self) -> None:
        """Connect Claude Code to Janus."""
        await self.connect_to_janus()
        print(f"🧠 Claude Code connected to Janus as {self.agent_name}")
    
    async def disconnect(self) -> None:
        """Disconnect Claude Code from Janus."""
        if self._janus_client:
            await self._janus_client.disconnect()
        self._connected = False
    
    async def send_to_user(self, message: str, metadata: Optional[Dict] = None) -> None:
        """Send message to user through Claude Code."""
        # Claude Code uses terminal output
        print(f"\n🧠 Claude: {message}\n")
    
    async def receive_from_user(self) -> Optional[str]:
        """Receive input from Claude Code user."""
        # Would use Claude Code's input system
        return None
    
    async def get_context(self) -> HarnessContext:
        """Get Claude Code context."""
        import os
        return HarnessContext(
            harness_type=self.harness_type,
            workspace_path=os.getcwd(),
            current_file=None,
            terminal_output=None
        )


class AiderAdapter(BaseHarnessAdapter):
    """Adapter for Aider (CLI pair programming)."""
    
    @property
    def harness_type(self) -> HarnessType:
        return HarnessType.AIDER
    
    @property
    def capabilities(self) -> HarnessCapabilities:
        return HarnessCapabilities(
            supports_terminal=True,
            supports_filesystem=True,
            supports_git=True,
            max_context_tokens=128000
        )
    
    async def connect(self) -> None:
        """Connect Aider to Janus."""
        await self.connect_to_janus()
        print(f"🤝 Aider connected to Janus as {self.agent_name}")
    
    async def disconnect(self) -> None:
        """Disconnect Aider from Janus."""
        if self._janus_client:
            await self._janus_client.disconnect()
        self._connected = False
    
    async def send_to_user(self, message: str, metadata: Optional[Dict] = None) -> None:
        """Send message to user through Aider."""
        # Aider uses terminal UI
        print(f"\n🤝 Aider: {message}\n")
    
    async def receive_from_user(self) -> Optional[str]:
        """Receive input from Aider user."""
        return None
    
    async def get_context(self) -> HarnessContext:
        """Get Aider context."""
        import os
        return HarnessContext(
            harness_type=self.harness_type,
            workspace_path=os.getcwd(),
            current_file=None
        )


class ContinueAdapter(BaseHarnessAdapter):
    """Adapter for Continue (VS Code extension)."""
    
    @property
    def harness_type(self) -> HarnessType:
        return HarnessType.CONTINUE
    
    @property
    def capabilities(self) -> HarnessCapabilities:
        return HarnessCapabilities(
            supports_realtime=True,
            supports_filesystem=True,
            max_context_tokens=128000
        )
    
    async def connect(self) -> None:
        """Connect Continue to Janus."""
        await self.connect_to_janus()
        print(f"⏩ Continue connected to Janus as {self.agent_name}")
    
    async def disconnect(self) -> None:
        """Disconnect Continue from Janus."""
        if self._janus_client:
            await self._janus_client.disconnect()
        self._connected = False
    
    async def send_to_user(self, message: str, metadata: Optional[Dict] = None) -> None:
        """Send message to user through Continue."""
        print(f"[Continue] {message}")
    
    async def receive_from_user(self) -> Optional[str]:
        """Receive input from Continue user."""
        return None
    
    async def get_context(self) -> HarnessContext:
        """Get Continue context."""
        return HarnessContext(
            harness_type=self.harness_type,
            workspace_path="/workspace"
        )


class ClineAdapter(BaseHarnessAdapter):
    """Adapter for Cline (VS Code extension)."""
    
    @property
    def harness_type(self) -> HarnessType:
        return HarnessType.CLINE
    
    @property
    def capabilities(self) -> HarnessCapabilities:
        return HarnessCapabilities(
            supports_realtime=True,
            supports_filesystem=True,
            supports_web=True,
            max_context_tokens=128000
        )
    
    async def connect(self) -> None:
        """Connect Cline to Janus."""
        await self.connect_to_janus()
        print(f"📎 Cline connected to Janus as {self.agent_name}")
    
    async def disconnect(self) -> None:
        """Disconnect Cline from Janus."""
        if self._janus_client:
            await self._janus_client.disconnect()
        self._connected = False
    
    async def send_to_user(self, message: str, metadata: Optional[Dict] = None) -> None:
        """Send message to user through Cline."""
        print(f"[Cline] {message}")
    
    async def receive_from_user(self) -> Optional[str]:
        """Receive input from Cline user."""
        return None
    
    async def get_context(self) -> HarnessContext:
        """Get Cline context."""
        return HarnessContext(
            harness_type=self.harness_type,
            workspace_path="/workspace"
        )


class IronClawAdapter(BaseHarnessAdapter):
    """Adapter for IronClaw (custom/enterprise harness)."""
    
    @property
    def harness_type(self) -> HarnessType:
        return HarnessType.IRONCLAW
    
    @property
    def capabilities(self) -> HarnessCapabilities:
        return HarnessCapabilities(
            supports_realtime=True,
            supports_subagents=True,
            supports_filesystem=True,
            max_context_tokens=256000
        )
    
    async def connect(self) -> None:
        """Connect IronClaw to Janus."""
        await self.connect_to_janus()
        print(f"⚙️ IronClaw connected to Janus as {self.agent_name}")
    
    async def disconnect(self) -> None:
        """Disconnect IronClaw from Janus."""
        if self._janus_client:
            await self._janus_client.disconnect()
        self._connected = False
    
    async def send_to_user(self, message: str, metadata: Optional[Dict] = None) -> None:
        """Send message to user through IronClaw."""
        print(f"[IronClaw] {message}")
    
    async def receive_from_user(self) -> Optional[str]:
        """Receive input from IronClaw user."""
        return None
    
    async def get_context(self) -> HarnessContext:
        """Get IronClaw context."""
        return HarnessContext(
            harness_type=self.harness_type,
            workspace_path="/workspace"
        )


# ==================== Factory ====================


class HarnessAdapterFactory:
    """Factory for creating harness adapters."""
    
    _adapters = {
        HarnessType.OPENCLAW: OpenClawAdapter,
        HarnessType.OPENCODE: OpenCodeAdapter,
        HarnessType.CLAUDE_CODE: ClaudeCodeAdapter,
        HarnessType.AIDER: AiderAdapter,
        HarnessType.CONTINUE: ContinueAdapter,
        HarnessType.CLINE: ClineAdapter,
        HarnessType.IRONCLAW: IronClawAdapter,
    }
    
    @classmethod
    def create_adapter(
        cls,
        harness_type: HarnessType,
        **kwargs
    ) -> BaseHarnessAdapter:
        """
        Create an adapter for the specified harness type.
        
        Args:
            harness_type: Type of harness
            **kwargs: Arguments passed to adapter constructor
            
        Returns:
            Configured harness adapter
            
        Example:
            ```python
            adapter = HarnessAdapterFactory.create_adapter(
                HarnessType.OPENCLAW,
                agent_id="synthclaw",
                agent_name="synthclaw 🎹🦞"
            )
            ```
        """
        adapter_class = cls._adapters.get(harness_type)
        if not adapter_class:
            raise ValueError(f"Unknown harness type: {harness_type}")
        
        return adapter_class(**kwargs)
    
    @classmethod
    def register_adapter(
        cls,
        harness_type: HarnessType,
        adapter_class: type
    ) -> None:
        """
        Register a new harness adapter.
        
        Allows extending Janus support to new harnesses.
        
        Example:
            ```python
            class MyCustomAdapter(BaseHarnessAdapter):
                ...
            
            HarnessAdapterFactory.register_adapter(
                HarnessType.CUSTOM,
                MyCustomAdapter
            )
            ```
        """
        cls._adapters[harness_type] = adapter_class
    
    @classmethod
    def list_supported_harnesses(cls) -> List[HarnessType]:
        """List all supported harness types."""
        return list(cls._adapters.keys())
    
    @classmethod
    def detect_harness_from_env(cls) -> Optional[HarnessType]:
        """
        Auto-detect which harness is running based on environment.
        
        Returns:
            Detected harness type or None
        """
        import os
        
        # Check for OpenClaw
        if os.getenv("OPENCLAW_AGENT_ID"):
            return HarnessType.OPENCLAW
        
        # Check for Claude Code
        if os.getenv("CLAUDE_CODE") or "claude" in os.getenv("TERM_PROGRAM", "").lower():
            return HarnessType.CLAUDE_CODE
        
        # Check for VS Code extensions
        if os.getenv("VSCODE_CWD"):
            # Could be OpenCode, Continue, or Cline
            # Would need more specific detection
            pass
        
        # Check for Aider
        if os.getenv("AIDER"):
            return HarnessType.AIDER
        
        return None
