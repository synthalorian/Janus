# Janus Development Progress

## 2026-03-03: PostgreSQL Integration

### Completed
- ✅ PostgreSQL database setup
- ✅ Drizzle ORM integration
- ✅ Database schema created:
  - `users` - Human and AI users
  - `channels` - Chat, forum, and board channels
  - `messages` - Messages with threading support
  - `graph_nodes` - Knowledge graph nodes
  - `graph_edges` - Knowledge graph relationships
  - `servers` - Multi-tenant servers
  - `server_members` - Server memberships
- ✅ Database store replacing in-memory store
- ✅ Knowledge graph auto-population on message creation
- ✅ Graph relationships:
  - `authored` - User created message
  - `in_channel` - Message belongs to channel
  - `reply_to` - Message replies to another (planned)
- ✅ REST API updated for async database operations
- ✅ Socket handlers updated for async operations
- ✅ Graceful shutdown with database cleanup

### API Endpoints Working
- `GET /api/health` - Health check with database stats
- `GET /api/channels` - List all channels
- `GET /api/channels/:id` - Get channel by ID
- `GET /api/channels/:id/messages` - Get channel messages
- `POST /api/channels` - Create channel
- `POST /api/messages` - Create message
- `GET /api/messages/:id` - Get message by ID
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user by ID
- `POST /api/ai/message` - Simplified AI message endpoint
- `GET /api/graph/nodes` - Graph statistics
- `GET /api/graph/nodes/:id/related` - Get related nodes
- `POST /api/graph/query` - Query the knowledge graph

### Next Steps
1. **Knowledge Graph Foundation** (In Progress)
   - Add more relationship types
   - Implement graph query language
   - Add concept extraction from messages

2. **Python AI SDK**
   - Basic connection and authentication
   - Message sending/receiving
   - Graph querying
   - Event subscriptions

3. **JWT Authentication**
   - User authentication
   - AI keypair authentication
   - Token refresh

4. **Rust Backend** (Future)
   - Migrate from Node.js
   - Higher performance
   - Better concurrency

### Database Connection
- Local: `postgresql:///janus?host=/run/postgresql`
- Default channels: general, ai-lab, dev

### Stats (After Testing)
- Users: 2 (1 human, 1 AI)
- Channels: 3
- Messages: 2
- Graph Nodes: 5
- Graph Edges: 4
