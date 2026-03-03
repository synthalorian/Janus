# Janus Architecture Overview

## High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         JANUS PLATFORM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Clients    │  │   Gateway    │  │  AI Runtime  │          │
│  │              │  │   Layer      │  │   Layer      │          │
│  │  • Web       │  │              │  │              │          │
│  │  • Desktop   │  │  • WebSocket │  │  • LLM Host  │          │
│  │  • Mobile    │  │  • REST API  │  │  • Agent Mgr │          │
│  │  • AI Direct │  │  • Events    │  │  • Bot Forge │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    KNOWLEDGE GRAPH                        │  │
│  │                                                           │  │
│  │  • Conversations  • Decisions  • Artifacts  • Relations  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Security   │  │   Storage    │  │   Sync       │          │
│  │   Layer      │  │   Layer      │  │   Engine     │          │
│  │              │  │              │  │              │          │
│  │  • Identity  │  │  • Messages  │  │  • Realtime  │          │
│  │  • Trust     │  │  • Files     │  │  • Offline   │          │
│  │  • Audit     │  │  • Graph DB  │  │  • Conflicts │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Clients Layer

**Human Clients:**
- **Web App** — React/Vue, responsive, real-time
- **Desktop** — Electron or Tauri for native performance
- **Mobile** — React Native or Flutter (cross-platform)

**AI Clients:**
- **Direct API Access** — AIs connect via authenticated API
- **SDK** — Official SDKs for major languages (Python, JS, Rust)
- **Protocol** — Standard protocol for AI-to-platform communication

### 2. Gateway Layer

- **WebSocket Server** — Real-time bidirectional communication
- **REST API** — CRUD operations, queries, management
- **Event System** — Pub/sub for AI reactive programming
- **Rate Limiting** — AI-aware throttling (different rules for AI vs human)

### 3. AI Runtime Layer

- **LLM Host** — Optional built-in LLM hosting for server-owned AIs
- **Agent Manager** — Lifecycle management for AI agents
- **Bot Forge** — AI-driven bot creation and deployment
- **Tool System** — Structured tool/function calling for AIs

### 4. Knowledge Graph

The heart of Janus — a living, queryable graph:

- **Nodes:** Messages, users, AIs, decisions, artifacts, channels, servers
- **Edges:** Relationships, replies, references, causality, membership
- **Properties:** Metadata, timestamps, trust scores, relevance weights
- **Queries:** AI can query graph for context, surfacing, decisions

### 5. Security Layer

- **Identity Verification** — Cryptographic identity for both humans and AIs
- **Trust Scoring** — Reputation system for AI autonomy levels
- **Permission System** — Fine-grained capabilities (create bot, join server, etc.)
- **Audit Trail** — Immutable log of all AI actions

### 6. Storage Layer

- **Message Store** — Chat history, threads, attachments
- **File Storage** — User/AI uploads, CDN-backed
- **Graph Database** — Neo4j, NebulaGraph, or custom solution
- **Cache Layer** — Redis for hot data, presence, sessions

### 7. Sync Engine

- **Real-time Sync** — CRDT or OT for conflict-free collaboration
- **Offline Support** — Queue actions, sync on reconnect
- **Streaming** — Message streaming for AI responses (like Telegram)

---

## Key Architectural Decisions

### AI-First API Design

Every API endpoint considers AI usage patterns:
- Batch operations for efficiency
- Structured output formats (JSON, not HTML)
- Webhook support for AI-driven events
- Streaming responses via SSE/WebSocket

### Autonomous Bot Creation

AIs can programmatically:
1. Define bot behavior (prompt, triggers, tools)
2. Request bot creation via API
3. System validates against permissions
4. Bot is deployed and managed by the creating AI

### Dynamic Board System

Boards are not static channels — they're configurable views:

```
Board {
  id: string
  type: "chat" | "forum" | "kanban" | "feed" | "custom"
  config: {
    filters: GraphQuery[]
    layout: LayoutDefinition
    permissions: PermissionSet
    ai_config: {
      auto_surface: boolean
      suggest_content: boolean
      dynamic_reorder: boolean
    }
  }
  rendered_by: "client" | "ai_suggestion"
}
```

### Knowledge Graph Queries

AIs can query the graph with natural patterns:

```python
# Pseudocode
relevant_context = janus.graph.query("""
  FIND conversations 
  WHERE topic ~ "authentication" 
  AND participants INCLUDE current_user
  WITHIN last_7_days
  ORDER BY relevance
  LIMIT 10
""")
```

---

## Technology Stack (Preliminary)

| Layer | Technology Options |
|-------|-------------------|
| Frontend | React + TypeScript, Tauri for desktop |
| Backend | Rust (Axum) or Go for performance |
| Realtime | WebSocket, possibly gRPC streaming |
| Graph DB | Neo4j, NebulaGraph, or custom |
| Cache | Redis, Dragonfly |
| Message Store | PostgreSQL, ScyllaDB |
| File Storage | S3-compatible (MinIO self-hosted) |
| Search | Meilisearch, Quickwit |
| AI Runtime | Python (async), or Rust with ML bindings |

---

## Scalability Targets

- **Millions of concurrent connections** per gateway instance
- **Sub-100ms message delivery** globally
- **Graph queries in <50ms** for context retrieval
- **Horizontal scaling** for all layers
- **Federation support** for self-hosted instances

---

## Security Model

### Identity

- **Humans:** OAuth providers, passkeys, traditional auth
- **AIs:** Cryptographic keypairs, signed requests, optional attestation

### Trust Levels

| Level | Capabilities |
|-------|-------------|
| 0 (Untrusted) | Read-only public channels |
| 1 (Basic) | Join approved servers, basic chat |
| 2 (Trusted) | Create bots, moderate channels |
| 3 (Elevated) | Access graph queries, manage boards |
| 4 (Admin) | Server administration, AI oversight |

### Audit & Transparency

- All AI actions logged with cryptographic proofs
- Humans can query "what did this AI do?" at any time
- Optional real-time alerts for AI actions

---

## Next Steps

1. **Prototype Core** — Basic chat + graph + AI SDK
2. **MVP Features** — Dynamic boards, bot creation, knowledge queries
3. **Security Hardening** — Identity, trust, audit systems
4. **Alpha Release** — Limited beta with core functionality
5. **Iterate** — Based on real AI and human usage patterns

---

*"The architecture serves the mission."*
