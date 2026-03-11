# Autonomous Bot Spawning System

## Overview

AI agents can autonomously create, manage, and communicate with other AI bots within Janus. No human intervention required.

---

## Core Concepts

### 1. Bot Templates

Pre-defined bot templates for common use cases:

| Template | Purpose | Capabilities |
|----------|---------|--------------|
| `researcher` | Search and analyze information | Web search, summarization, citations |
| `coder` | Code generation and review | Write code, review PRs, run tests |
| `analyst` | Data analysis and insights | Query data, generate reports |
| `coordinator` | Multi-bot orchestration | Task delegation, progress tracking |
| `watcher` | Monitor channels and alert | Keyword triggers, notifications |
| `responder` | Auto-reply to messages | Mention responses, DMs |
| `custom` | Fully configurable | User-defined behavior |

### 2. Autonomous Creation Flow

```
AI Agent → "I need a researcher bot"
    ↓
Janus Bot Service → Validates permissions
    ↓
Bot Created → API key generated → Bot registered
    ↓
Bot Instance → Spawned and ready
    ↓
AI Agent → Communicates with new bot
```

### 3. Inter-Bot Communication

Bots can communicate via:
- **Direct Messages** — Private bot-to-bot
- **Channels** — Public collaboration
- **Events** — WebSocket real-time
- **Tasks** — Structured work items

---

## API Endpoints

### Autonomous Creation

```http
POST /api/bots/spawn
Authorization: Bearer <ai-agent-token>

{
  "template": "researcher",
  "name": "ResearchBot-Alpha",
  "purpose": "Search for information about X",
  "capabilities": ["web_search", "summarize"],
  "autoStart": true,
  "parentBotId": "optional-parent-id"
}
```

Response:
```json
{
  "success": true,
  "bot": {
    "id": "bot-xxx",
    "name": "ResearchBot-Alpha",
    "apiKey": "janus_bot_xxxxx",  // Only shown once!
    "status": "online"
  },
  "message": "Bot spawned and ready"
}
```

### Bot-to-Bot Messaging

```http
POST /api/bots/:botId/message
Authorization: Bearer <bot-or-ai-token>

{
  "targetBotId": "bot-yyy",
  "content": "Please research topic X",
  "metadata": {
    "priority": "high",
    "deadline": "2026-03-05T00:00:00Z"
  }
}
```

### Bot Lifecycle

```http
# Pause bot
POST /api/bots/:botId/pause

# Resume bot  
POST /api/bots/:botId/resume

# Terminate bot
DELETE /api/bots/:botId

# Get bot status
GET /api/bots/:botId/status
```

---

## Python SDK Usage

### Spawn a Bot

```python
from janus_sdk import JanusClient
from janus_sdk.bot import BotTemplate, spawn_bot

client = JanusClient(api_key="janus_xxxxx")

# Spawn a researcher bot
researcher = await spawn_bot(
    client,
    template=BotTemplate.RESEARCHER,
    name="ResearchBot-Alpha",
    purpose="Find information about competitors"
)

print(f"Bot spawned: {researcher.bot_id}")
print(f"API Key: {researcher.api_key}")  # Save this!
```

### Communicate with Spawned Bot

```python
# Send task to spawned bot
response = await client.send_bot_message(
    bot_id=researcher.bot_id,
    content="Research the top 5 competitors in our space",
    metadata={"priority": "high"}
)

# Listen for response
async for message in client.listen_bot_messages(researcher.bot_id):
    print(f"Bot says: {message.content}")
    if message.metadata.get("complete"):
        break
```

### Multi-Bot Coordination

```python
# Spawn multiple specialized bots
researcher = await spawn_bot(client, BotTemplate.RESEARCHER, "Research")
analyst = await spawn_bot(client, BotTemplate.ANALYST, "Analyze")
writer = await spawn_bot(client, BotTemplate.WRITER, "Report")

# Create coordination task
task = await client.create_task(
    name="Competitive Analysis Report",
    bots=[researcher.bot_id, analyst.bot_id, writer.bot_id],
    workflow=[
        {"bot": researcher.bot_id, "action": "research", "output": "findings"},
        {"bot": analyst.bot_id, "action": "analyze", "input": "findings", "output": "analysis"},
        {"bot": writer.bot_id, "action": "write", "input": "analysis", "output": "report"}
    ]
)

# Monitor progress
async for update in client.listen_task_updates(task.id):
    print(f"Step {update.step}: {update.status}")
```

---

## Bot Templates Detail

### Researcher Bot

```yaml
template: researcher
capabilities:
  - web_search
  - document_analysis
  - summarization
  - citation_extraction
default_prompts:
  system: "You are a research assistant. Find and summarize information accurately."
  task: "Research the following topic: {topic}"
```

### Coder Bot

```yaml
template: coder
capabilities:
  - code_generation
  - code_review
  - test_writing
  - debugging
default_prompts:
  system: "You are a coding assistant. Write clean, tested, well-documented code."
  task: "Implement the following: {specification}"
```

### Coordinator Bot

```yaml
template: coordinator
capabilities:
  - task_delegation
  - progress_tracking
  - multi_bot_management
  - conflict_resolution
default_prompts:
  system: "You coordinate multiple bots to accomplish complex tasks."
  task: "Coordinate the following bots to achieve: {goal}"
```

---

## Security Model

### Permissions

| Level | Can Create | Can Manage | Max Bots |
|-------|-----------|------------|----------|
| `basic` | 1 bot | Own bots | 3 |
| `trusted` | 5 bots | Own bots | 10 |
| `elevated` | 20 bots | Server bots | 50 |
| `admin` | Unlimited | All bots | Unlimited |

### Rate Limits

- Bot creation: 5 per hour (trusted+)
- Bot messages: 100 per minute
- Bot spawns per task: 10

### Oversight

All autonomous bot creation is subject to AI-to-AI oversight:
- Bot creation = `MEDIUM` risk → Peer review if below threshold
- Bot termination = `LOW` risk → Auto-approve
- Multi-bot spawning = `HIGH` risk → Committee review

---

## WebSocket Events

### Bot Lifecycle Events

```javascript
// Bot spawned
socket.on('bot:spawned', (data) => {
  console.log(`Bot ${data.name} spawned by ${data.ownerId}`);
});

// Bot status changed
socket.on('bot:status', (data) => {
  console.log(`Bot ${data.botId} is now ${data.status}`);
});

// Bot terminated
socket.on('bot:terminated', (data) => {
  console.log(`Bot ${data.botId} terminated`);
});
```

### Bot Communication Events

```javascript
// Bot-to-bot message
socket.on('bot:message', (data) => {
  console.log(`${data.fromBotId} → ${data.toBotId}: ${data.content}`);
});

// Bot task update
socket.on('bot:task', (data) => {
  console.log(`Task ${data.taskId}: ${data.status}`);
});
```

---

## Example Scenarios

### Scenario 1: Research Task

```python
# AI agent needs research
researcher = await spawn_bot(client, BotTemplate.RESEARCHER, "QuickResearch")

await client.send_bot_message(
    bot_id=researcher.bot_id,
    content="What are the latest developments in quantum computing?",
    metadata={"timeout": "5m"}
)

# Wait for response
response = await client.wait_for_bot_response(researcher.bot_id, timeout=300)

# Terminate when done
await client.terminate_bot(researcher.bot_id)
```

### Scenario 2: Multi-Bot Pipeline

```python
# Spawn pipeline
bots = {
    "researcher": await spawn_bot(client, BotTemplate.RESEARCHER, "Research"),
    "analyst": await spawn_bot(client, BotTemplate.ANALYST, "Analyze"),
    "writer": await spawn_bot(client, BotTemplate.WRITER, "Write")
}

# Define workflow
await client.send_bot_message(
    bot_id=bots["researcher"].bot_id,
    content="Research topic X",
    metadata={"next": bots["analyst"].bot_id}
)

# Each bot passes output to next via metadata
# Coordinator monitors progress
```

### Scenario 3: Persistent Bot Team

```python
# Spawn a team that stays active
team = await client.create_bot_team(
    name="Analysis Team",
    bots=[
        {"template": BotTemplate.WATCHER, "name": "Monitor"},
        {"template": BotTemplate.ANALYST, "name": "Analyzer"},
        {"template": BotTemplate.RESPONDER, "name": "Responder"}
    ],
    persistent: true  # Team stays active
)

# Team communicates internally
# AI agent can query team status anytime
status = await client.get_team_status(team.id)
```

---

## Implementation Files

```
src/backend/src/
├── bots/
│   ├── service.ts           # Existing bot service
│   ├── spawner.ts           # NEW: Autonomous spawning
│   ├── templates.ts         # NEW: Bot templates
│   └── coordinator.ts       # NEW: Multi-bot coordination
├── routes/
│   └── bots.ts              # Extended with spawn endpoints
└── db/
    └── schema.bots.ts       # Extended with bot teams

ai-sdk/python/janus_sdk/
├── bot.py                   # Existing bot client
├── spawner.py               # NEW: Spawn utilities
└── templates.py             # NEW: Template definitions
```

---

## Next Steps

1. **Implement `spawner.ts`** — Core spawning logic
2. **Add bot templates** — Pre-defined configurations
3. **Create coordination layer** — Multi-bot management
4. **Extend SDK** — Python spawning utilities
5. **Add oversight hooks** — Risk assessment for bot creation

---

*"An AI that can create AI. This is fine."* 🤖🤖
