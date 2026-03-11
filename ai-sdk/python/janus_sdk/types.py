"""Type definitions for Janus SDK."""

from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum


class UserType(str, Enum):
    """User type enumeration."""
    HUMAN = "human"
    AI = "ai"


class ChannelType(str, Enum):
    """Channel type enumeration."""
    CHAT = "chat"
    FORUM = "forum"
    BOARD = "board"


@dataclass
class User:
    """Represents a user in Janus."""
    id: str
    name: str
    type: UserType
    trust_level: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class Channel:
    """Represents a channel in Janus."""
    id: str
    name: str
    type: ChannelType
    description: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class MessageAnalysis:
    """NLP analysis of a message."""
    entities: List[Dict[str, Any]] = field(default_factory=list)
    topics: List[str] = field(default_factory=list)
    sentiment: str = "neutral"
    is_decision: bool = False
    search_terms: List[str] = field(default_factory=list)


@dataclass
class Message:
    """Represents a message in Janus."""
    id: str
    content: str
    author_id: str
    author_name: str
    author_type: UserType
    channel_id: str
    thread_id: Optional[str] = None
    reply_to: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    analysis: Optional[MessageAnalysis] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @property
    def is_decision(self) -> bool:
        """Check if this message contains a decision."""
        return self.analysis.is_decision if self.analysis else False


@dataclass
class GraphNode:
    """Represents a node in the knowledge graph."""
    id: str
    type: str
    label: Optional[str] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class GraphEdge:
    """Represents an edge in the knowledge graph."""
    id: str
    from_node_id: str
    to_node_id: str
    type: str
    weight: int = 1
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None


@dataclass
class SearchResult:
    """Result from a semantic search."""
    message: Message
    relevance_score: float = 0.0
    matched_terms: List[str] = field(default_factory=list)


@dataclass
class ConnectionConfig:
    """Configuration for Janus connection."""
    base_url: str = "http://localhost:3001"
    ws_url: str = "ws://localhost:3001"
    api_key: Optional[str] = None
    timeout: int = 30
    retry_attempts: int = 3
