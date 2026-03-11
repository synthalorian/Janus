import { createHash, randomBytes } from 'crypto';
import { pool } from '../db/index.js';

export interface AuthUser {
  id: string;
  name: string;
  type: 'human' | 'ai';
}

export interface JWTPayload {
  userId: string;
  type: 'user' | 'ai';
  permissions: string[];
  iat: number;
  exp: number;
}

export interface APIKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface APIKeyResult {
  success: boolean;
  key?: string;
  keyId?: string;
  name?: string;
  error?: string;
}

const JWT_EXPIRES_SECONDS = 15 * 60;
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

class AuthService {
  async getUserById(userId: string): Promise<AuthUser | null> {
    const result = await pool.query(`SELECT id, name, type FROM users WHERE id = $1 LIMIT 1`, [userId]);
    const row = result.rows[0];
    if (!row) return null;
    return { id: row.id, name: row.name, type: row.type === 'ai' ? 'ai' : 'human' };
  }

  async generateJWT(user: AuthUser): Promise<string> {
    const token = `janus_jwt_${randomBytes(18).toString('hex')}`;
    const expiresAt = new Date(Date.now() + JWT_EXPIRES_SECONDS * 1000);

    await pool.query(
      `INSERT INTO sessions (id, user_id, token, permissions, token_type, expires_at, is_active)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, TRUE)`,
      [id('ses'), user.id, token, JSON.stringify(['read', 'write']), user.type === 'ai' ? 'ai' : 'user', expiresAt],
    );

    return token;
  }

  async verifyJWT(token: string): Promise<JWTPayload | null> {
    const result = await pool.query(
      `SELECT s.user_id, s.permissions, s.token_type, s.expires_at
       FROM sessions s
       WHERE s.token = $1 AND s.is_active = TRUE
       LIMIT 1`,
      [token],
    );

    const row = result.rows[0];
    if (!row) return null;

    const expMs = new Date(row.expires_at).getTime();
    if (expMs < Date.now()) {
      await pool.query(`UPDATE sessions SET is_active = FALSE WHERE token = $1`, [token]);
      return null;
    }

    await pool.query(`UPDATE sessions SET last_used_at = NOW() WHERE token = $1`, [token]);

    const exp = Math.floor(expMs / 1000);
    const iat = Math.floor((expMs - JWT_EXPIRES_SECONDS * 1000) / 1000);

    return {
      userId: row.user_id,
      type: row.token_type === 'ai' ? 'ai' : 'user',
      permissions: Array.isArray(row.permissions) ? row.permissions : ['read', 'write'],
      iat,
      exp,
    };
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = `janus_refresh_${randomBytes(18).toString('hex')}`;
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

    await pool.query(
      `INSERT INTO refresh_tokens (id, token_hash, user_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id('rft'), sha256(token), userId, expiresAt],
    );

    return token;
  }

  async verifyRefreshToken(token: string): Promise<AuthUser | null> {
    const tokenHash = sha256(token);
    const result = await pool.query(
      `SELECT user_id, expires_at, revoked_at FROM refresh_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );

    const row = result.rows[0];
    if (!row) return null;
    if (row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;

    await pool.query(`UPDATE refresh_tokens SET last_used_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    return this.getUserById(row.user_id);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [sha256(token)]);
  }

  async createAPIKey(userId: string, name: string, permissions: string[] = ['read'], expiresInDays?: number): Promise<APIKeyResult> {
    const key = `janus_${randomBytes(20).toString('hex')}`;
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

    const keyId = id('key');
    await pool.query(
      `INSERT INTO api_keys (id, key_hash, key_prefix, name, user_id, permissions, is_active, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, TRUE, $7)`,
      [keyId, sha256(key), key.slice(0, 12), name, userId, JSON.stringify(permissions), expiresAt],
    );

    return { success: true, key, keyId, name };
  }

  async verifyAPIKey(key: string): Promise<{ user: AuthUser; permissions: string[] } | null> {
    const result = await pool.query(
      `SELECT id, user_id, permissions, expires_at
       FROM api_keys
       WHERE key_hash = $1 AND is_active = TRUE
       LIMIT 1`,
      [sha256(key)],
    );

    const row = result.rows[0];
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;

    await pool.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]);

    const user = await this.getUserById(row.user_id);
    if (!user) return null;

    return {
      user,
      permissions: Array.isArray(row.permissions) ? row.permissions : ['read'],
    };
  }

  async revokeAPIKey(keyId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE api_keys SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId],
    );
    return result.rowCount > 0;
  }

  async listAPIKeys(userId: string): Promise<APIKeyRecord[]> {
    const result = await pool.query(
      `SELECT id, user_id, name, key_prefix, permissions, is_active, created_at, last_used_at, expires_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      permissions: Array.isArray(row.permissions) ? row.permissions : ['read'],
      isActive: !!row.is_active,
      createdAt: new Date(row.created_at).toISOString(),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
    }));
  }

  async registerUser(name: string, type: 'human' | 'ai' = 'human', metadata?: Record<string, unknown>) {
    const userId = id('usr');
    await pool.query(
      `INSERT INTO users (id, name, type, trust_level, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [userId, name, type, type === 'ai' ? 1 : 2, JSON.stringify(metadata || {})],
    );

    const user: AuthUser = { id: userId, name, type };
    const apiKeyResult = await this.createAPIKey(userId, 'Default API Key', ['read', 'write']);

    return {
      user,
      apiKey: apiKeyResult.key!,
    };
  }

  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    const [scheme, value] = authHeader.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }

  extractAPIKeyFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    const [scheme, value] = authHeader.split(' ');
    return scheme === 'ApiKey' && value ? value : null;
  }
}

export const authService = new AuthService();
