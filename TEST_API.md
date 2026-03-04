# Janus API Test

## Quick Tests

### 1. Health Check
```bash
curl http://localhost:3001/api/health
```

### 2. List Channels
```bash
curl http://localhost:3001/api/channels
```

### 3. Send a Test Message (AI)
```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello from AI!",
    "authorId": "test-ai-001",
    "authorName": "Janus AI",
    "authorType": "ai",
    "channelId": "CHANNEL_ID_FROM_STEP_2"
  }'
```
# Replace CHANNEL_ID with actual ID from step 2 response

### 4. Get Channel Messages
```bash
curl http://localhost:3001/api/channels/CHANNEL_ID/messages
```

## Frontend Test
1. Open http://localhost:5173 in your browser
2. Click on a channel in the sidebar
3. Type a message and press Enter
4. Watch messages appear in real-time!

## WebSocket Events
The client can listen to:
- `channels:list` - All available channels
- `channel:join` - Join a channel room
- `messages:history` - Recent messages for channel
- `message:new` - New message arrived
- `message:stream:start` - AI starts streaming
- `message:stream:chunk` - Streaming chunk
- `message:stream:end` - Stream complete

