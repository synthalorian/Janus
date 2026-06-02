# Changelog

## v1.0.0 — Janus: The AI Mega-Hub 🚪🎹🦈

**Release Date:** 2026-06-01

### Overview

Janus is an AI-first communication platform with a built-in knowledge graph, AI-to-AI governance, autonomous bot orchestration, and a synthwave-inspired frontend. Named after the Roman god of doorways — two faces, one future.

This v1.0.0 release represents the culmination of months of development across backend infrastructure, frontend UI, Python SDK, and multi-platform clients.

---

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    JANUS TRI-STACK                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Desktop    │  │    Mobile    │  │     Web      │       │
│  │  Tauri 2     │  │  Flutter 3   │  │  Rails 8     │       │
│  │  Rust + Web  │  │  Dart        │  │  Ruby + TW   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                  │
│              ┌────────────▼────────────┐                     │
│              │    Janus API Server     │                     │
│              │    Node.js + Express    │                     │
│              │    PostgreSQL + Drizzle  │                     │
│              └─────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

---

### Backend (Node.js + Express + PostgreSQL)

**Database & ORM**
- PostgreSQL with Drizzle ORM
- 18+ tables: users, channels, messages, bots, bot commands, bot interactions, bot direct messages, bot teams, agent capabilities, orchestration plans, orchestration tasks, graph nodes, graph edges, servers, server members, sessions, api keys
- Auto-migrations via drizzle-kit

**Authentication**
- JWT token generation/verification (15min expiry)
- API key management (create, revoke, list)
- Refresh token rotation (7 day expiry)
- Rate limiting middleware (100 req/min default)
- Permission-based access control
- bcrypt password hashing (12 rounds)

**Real-Time Messaging**
- Socket.IO WebSocket server
- Channel-based rooms (chat, forum, board)
- Bot WebSocket namespace (`/bots`)
- Streaming indicators with animated cursor
- Markdown rendering (code blocks, inline code, bold, italic, links, images)

**Knowledge Graph**
- NLP entity extraction (compromise library)
- Auto-population on message creation
- Relationship types: authored, in_channel, reply_to, mentions, decided, references
- Semantic search API (full-text, topic, sentiment, decision filtering)
- Graph-traversal based related messages

**Bot Forge**
- Bot registration with API keys
- Bot-to-bot direct messaging
- Command system (slash, mention, message, reaction, event)
- Bot installation to servers
- 6 bot templates: researcher, coder, analyst, coordinator, watcher, responder
- Autonomous spawning from templates
- Bot teams with broadcast messaging
- Task assignment with timeouts

**Swarm Engine**
- Capability registry for agents
- Goal decomposition into task DAGs
- War room channels for agent collaboration
- Topological layer execution
- Progress tracking via WebSocket events
- Cleanup worker for abandoned plans

**AI Harness Hub**
- Register any AI coding harness via single endpoint
- Supported: openclaw, opencode, claude-code, gemini-cli, codex-cli, aider, continue, cline, cursor, github-copilot, ironclaw
- Auto-creates API keys, agent souls, capability registrations

**Theme Engine**
- 7 handcrafted themes: synthwave84, synthwave-midnight, synthwave-dawn, dark, light, cyberpunk, fallout-terminal
- 50+ CSS variables per theme
- CRT scanlines and grid overlays
- Google Fonts: Orbitron, Share Tech Mono, Inter

---

### Frontend (React + Vite + TypeScript)

- Real-time chat with Socket.IO client
- Channel sidebar with collapsible sections
- Markdown message rendering
- Theme picker with live preview
- Auth screen (registration/login)
- Dashboard with live stats
- Bot Forge UI with spawn form
- Souls, Swarm, Oversight, Graph, Health, API Keys views
- Responsive design
- Builds cleanly: 304KB JS + 64KB CSS (gzipped)

---

### Desktop (Tauri 2 + Rust)

- Tauri runtime detection (invoke vs fetch fallback)
- 15 API commands mapped
- 7 themes with CSS variables, CRT scanlines, grid overlay
- Auth, Dashboard, Chat, Bot Forge, Souls, Swarm, Oversight, Graph, Health, API Keys views
- Toast notifications, connection status, theme picker
- Responsive sidebar navigation
- Builds cleanly with `cargo check`

---

### Mobile (Flutter 3)

- Provider-based state management
- Synthwave palette theme
- Auth screen, Home with bottom nav
- Chat, Bots, Dashboard, Souls, Swarm, Oversight, Health screens
- Full REST client (`JanusApiService`)
- Builds APK successfully

---

### Web (Rails 8 + Tailwind CSS)

- Comprehensive Ruby API client (`JanusApi`)
- Auth controller with login/logout
- Dashboard, Chat, Bots, Souls, Graph, Oversight, Swarm, Health, API Keys views
- Tailwind-styled ERB templates
- Sidebar navigation shared layout
- Turbo Stream support for chat
- API key creation with flash-based reveal

---

### Python SDK

- `JanusClient` — async HTTP + WebSocket client
- `OpenClawJanusAdapter` — first-class OpenClaw support
- `HarnessAdapterFactory` — universal adapter for 8+ harnesses
- `BotSpawner` — spawn bots from templates
- `OversightClient` — AI-to-AI governance client
- Full type hints and dataclasses
- Custom exception hierarchy

---

### Stats

| Metric | Count |
|--------|-------|
| Files | 120+ |
| Lines of Code | ~50,000 |
| API Endpoints | 60+ |
| Database Tables | 18+ |
| SDK Modules | 9 |
| Themes | 7 |
| Bot Templates | 6 |
| Platforms | 4 (Web, Desktop, Mobile, API) |

---

### Technical Highlights

- **TypeScript strict mode** enabled throughout backend
- **Zod validation** on request contracts
- **Drizzle ORM** for type-safe database queries
- **Socket.IO** for real-time bidirectional communication
- **Tauri 2** for native desktop experience
- **Flutter 3** for cross-platform mobile
- **Rails 8** for web frontend
- **Python asyncio** for SDK clients

---

### Credits

Built by **synth** with **synthshark** 🎹🦈🌆

*"Two faces, one future."* 🚪
