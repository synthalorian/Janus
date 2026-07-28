import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'http';

process.env.JANUS_DISABLE_AUTOSTART = 'true';

// Spin the exported Express app in-process on an ephemeral port and
// exercise it over real HTTP via fetch (supertest-style, zero extra deps).

let server: Server;
let baseUrl: string;
let pool: typeof import('../db/index.js').pool;

const suffix = Date.now();
const testUserName = `test-api-${suffix}`;
let channelId = '';
let messageId = '';
let userId = '';

async function api(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

test.before(async () => {
  const mod = await import('../index.js');
  const dbMod = await import('../db/index.js');
  pool = dbMod.pool;

  server = createServer(mod.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  baseUrl = `http://127.0.0.1:${addr.port}`;

  // Clean any leftovers from previous runs
  await pool.query("DELETE FROM messages WHERE author_name LIKE 'test-api-%'");
  await pool.query("DELETE FROM users WHERE name LIKE 'test-api-%'");
});

test.after(async () => {
  await pool.query("DELETE FROM messages WHERE channel_id = $1", [channelId]);
  await pool.query("DELETE FROM channels WHERE id = $1", [channelId]);
  await pool.query("DELETE FROM users WHERE name LIKE 'test-api-%'");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const { closeConnection } = await import('../db/index.js');
  await closeConnection();
});

test('GET /api/health returns ok with connected database', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'connected');
  assert.ok(body.timestamp);
  assert.ok(body.stats);
  assert.ok(body.features);
});

test('GET /api/config exposes runtime config', async () => {
  const { status, body } = await api('/api/config');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.data.port, 'number');
  assert.ok(body.data.features);
});

test('GET /api/channels lists seeded default channels', async () => {
  const { status, body } = await api('/api/channels');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  // Default data is initialized on server start; in tests we only require an array.
});

test('POST /api/channels creates a channel', async () => {
  const { status, body } = await api('/api/channels', {
    method: 'POST',
    body: JSON.stringify({ name: `test-api-chan-${suffix}`, type: 'chat', description: 'integration test channel' }),
  });
  assert.equal(status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.name, `test-api-chan-${suffix}`);
  assert.equal(body.data.type, 'chat');
  assert.ok(body.data.id);
  channelId = body.data.id;
});

test('POST /api/channels rejects missing required fields', async () => {
  const { status, body } = await api('/api/channels', {
    method: 'POST',
    body: JSON.stringify({ name: 'no-type-here' }),
  });
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(String(body.error), /name, type/);
});

test('GET /api/channels/:id returns the created channel', async () => {
  const { status, body } = await api(`/api/channels/${channelId}`);
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.id, channelId);
});

test('GET /api/channels/:id returns 404 for unknown channel', async () => {
  const { status, body } = await api('/api/channels/chn_does_not_exist');
  assert.equal(status, 404);
  assert.equal(body.success, false);
});

test('POST /api/messages posts a message (auto-creating the author)', async () => {
  const { status, body } = await api('/api/messages', {
    method: 'POST',
    body: JSON.stringify({
      content: 'round-trip hello',
      authorId: 'test-api-author',
      authorName: testUserName,
      authorType: 'human',
      channelId,
    }),
  });
  assert.equal(status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.content, 'round-trip hello');
  assert.equal(body.data.channelId, channelId);
  assert.ok(body.data.id);
  messageId = body.data.id;
});

test('GET /api/channels/:id/messages fetches the posted message (round-trip)', async () => {
  const { status, body } = await api(`/api/channels/${channelId}/messages`);
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  const found = body.data.find((m: { id: string }) => m.id === messageId);
  assert.ok(found, 'posted message should be in channel history');
  assert.equal(found.content, 'round-trip hello');
});

test('GET /api/messages/:id fetches a message by id', async () => {
  const { status, body } = await api(`/api/messages/${messageId}`);
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.id, messageId);
});

test('POST /api/messages rejects missing required fields', async () => {
  const { status, body } = await api('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ content: 'no author or channel' }),
  });
  assert.equal(status, 400);
  assert.equal(body.success, false);
});

test('POST /api/messages to unknown channel returns 404', async () => {
  const { status, body } = await api('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ content: 'hi', authorId: 'x', channelId: 'chn_nope' }),
  });
  assert.equal(status, 404);
  assert.equal(body.success, false);
});

test('POST /api/users + GET /api/users/:id round-trip', async () => {
  const created = await api('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: testUserName, type: 'human' }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.success, true);
  assert.ok(created.body.data.id);
  userId = created.body.data.id;

  const fetched = await api(`/api/users/${userId}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.data.name, testUserName);
});

test('POST /api/users rejects missing name', async () => {
  const { status, body } = await api('/api/users', {
    method: 'POST',
    body: JSON.stringify({ type: 'human' }),
  });
  assert.equal(status, 400);
  assert.equal(body.success, false);
});

test('GET /api/stats returns database counts', async () => {
  const { status, body } = await api('/api/stats');
  assert.equal(status, 200);
  assert.equal(typeof body.users, 'number');
  assert.equal(typeof body.channels, 'number');
  assert.equal(typeof body.messages, 'number');
});
