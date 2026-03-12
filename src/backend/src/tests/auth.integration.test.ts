import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { pool } from '../db/index.js';

process.env.JANUS_DISABLE_AUTOSTART = 'true';

let app: any;

test.before(async () => {
  const mod = await import('../index.js');
  app = mod.app;
});

test('auth lifecycle: register -> me -> key create/list/revoke', async () => {
  await pool.query('DELETE FROM api_keys');
  await pool.query('DELETE FROM refresh_tokens');
  await pool.query('DELETE FROM sessions');
  await pool.query("DELETE FROM users WHERE name LIKE 'test-auth-%'");

  const suffix = Date.now();
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ name: `test-auth-${suffix}`, type: 'human' });

  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.body.success, true);

  const token = registerRes.body.data.token as string;
  assert.ok(token);

  const meRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.success, true);
  assert.equal(meRes.body.data.user.name, `test-auth-${suffix}`);

  const createKeyRes = await request(app)
    .post('/api/auth/keys')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'integration-key', permissions: ['read'] });

  assert.equal(createKeyRes.status, 201);
  assert.equal(createKeyRes.body.success, true);

  const keyId = createKeyRes.body.data.keyId as string;
  assert.ok(keyId);

  const listKeysRes = await request(app)
    .get('/api/auth/keys')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(listKeysRes.status, 200);
  assert.equal(listKeysRes.body.success, true);
  assert.ok(Array.isArray(listKeysRes.body.data));
  assert.ok(listKeysRes.body.data.some((k: { id: string }) => k.id === keyId));

  const revokeKeyRes = await request(app)
    .delete(`/api/auth/keys/${keyId}`)
    .set('Authorization', `Bearer ${token}`);

  assert.equal(revokeKeyRes.status, 200);
  assert.equal(revokeKeyRes.body.success, true);
});

test('auth rejects invalid bearer token', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', 'Bearer invalid_token');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('auth refresh returns new token pair', async () => {
  const suffix = Date.now();
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ name: `test-auth-refresh-${suffix}`, type: 'human' });

  assert.equal(registerRes.status, 201);
  const token = registerRes.body.data.token as string;

  const refreshCreateRes = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: 'invalid' });

  assert.equal(refreshCreateRes.status, 401);

  // create a real refresh token by hitting service path through login flow simulation
  // current API only creates refresh tokens via /refresh rotation; generate one by direct DB-backed service use
  const { authService } = await import('../auth/service.js');
  const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  const userId = meRes.body.data.user.id as string;
  const refreshToken = await authService.createRefreshToken(userId);

  const refreshRes = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken });

  assert.equal(refreshRes.status, 200);
  assert.equal(refreshRes.body.success, true);
  assert.ok(refreshRes.body.data.token);
  assert.ok(refreshRes.body.data.refreshToken);
});


test.after(async () => {
  await pool.end();
});
