"""
Janus AI SDK - Python Client

A Python SDK for AI agents to interact with the Janus communication platform.

Supports:
- Direct API client (JanusClient)
- Universal harness adapter system (OpenClaw, Claude Code, Aider, Continue, Cline, etc.)
- Knowledge graph integration
- Multi-agent coordination
- AI-to-AI oversight and governance
- Bot Forge (bot creation and management)
"""

from .client import JanusClient
from .types import Message, Channel, User, GraphNode, GraphEdge
from .exceptions import JanusError, AuthenticationError, ConnectionError

# Oversight system
from .oversight import (
    OversightClient,
    OversightLevel,
    ActionType,
    ReviewStatus,
    RiskAssessment,
    ActionSubmission,
    ReviewSubmission,
    submit_with_oversight,
)

# Bot Forge
from .bot import (
    JanusBot,
    BotConfig,
    BotFactory,
    Interaction,
)

# Harness adapters
from .harness_adapters import (
    # Base class and types
    BaseHarnessAdapter,
    HarnessCapabilities,
    HarnessContext,
    HarnessType,
    # Factory
    HarnessAdapterFactory,
    # Specific adapters
    OpenClawAdapter,
    OpenCodeAdapter,
    ClaudeCodeAdapter,
    AiderAdapter,
    ContinueAdapter,
    ClineAdapter,
    IronClawAdapter,
)

# Legacy OpenClaw adapter (for backwards compatibility)
from .openclaw_adapter import (
    OpenClawJanusAdapter,
    JanusMessageTool,
    JanusSearchTool,
    create_adapter_from_env
)

__version__ = "0.1.0"
__all__ = [
    # Core client
    "JanusClient",
    "Message",
    "Channel",
    "User",
    "GraphNode",
    "GraphEdge",
    "JanusError",
    "AuthenticationError",
    "ConnectionError",

    # Oversight system
    "OversightClient",
    "OversightLevel",
    "ActionType",
    "ReviewStatus",
    "RiskAssessment",
    "ActionSubmission",
    "ReviewSubmission",
    "submit_with_oversight",

    # Bot Forge
    "JanusBot",
    "BotConfig",
    "BotFactory",
    "Interaction",

    # Harness system
    "BaseHarnessAdapter",
    "HarnessCapabilities",
    "HarnessContext",
    "HarnessType",
    "HarnessAdapterFactory",

    # Specific harness adapters
    "OpenClawAdapter",
    "OpenCodeAdapter",
    "ClaudeCodeAdapter",
    "AiderAdapter",
    "ContinueAdapter",
    "ClineAdapter",
    "IronClawAdapter",

    # Legacy (backwards compatibility)
    "OpenClawJanusAdapter",
    "JanusMessageTool",
    "JanusSearchTool",
    "create_adapter_from_env",
]