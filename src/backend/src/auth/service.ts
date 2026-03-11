import { randomBytes, createHash } from 'crypto';
import { store } from '../db/store.js';

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
  keyHash: string;
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

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

class AuthService {
  private jwtTokens = new Map<string, JWTPayload>();
  private refreshTokens = new Map<string, { userId: string; expiresAt: number; revoked: boolean }>();
  private apiKeys = new Map<string, APIKeyRecord>();

  generateJWT(user: AuthUser): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      userId: user.id,
      type: user.type === 'ai' ? 'ai' : 'user',
      permissions: ['read', 'write'],
      iat: now,
      exp: now + JWT_EXPIRES_SECONDS,
    };

    const token = `janus_jwt_${randomBytes(18).toString('hex')}`;
    this.jwtTokens.set(token, payload);
    return token;
  }

  verifyJWT(token: string): JWTPayload | null {
    const payload = this.jwtTokens.get(token);
    if (!payload) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      this.jwtTokens.delete(token);
      return null;
    }
    return payload;
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = `janus_refresh_${randomBytes(18).toString('hex')}`;
    this.refreshTokens.set(token, {
      userId,
      expiresAt: Date.now() + REFRESH_EXPIRES_MS,
      revoked: false,
    });
    return token;
  }

  async verifyRefreshToken(token: string): Promise<AuthUser | null> {
    const record = this.refreshTokens.get(token);
    if (!record || record.revoked || record.expiresAt < Date.now()) return null;
    const user = await store.getUser(record.userId);
    if (!user) return null;
    return { id: user.id, name: user.name, type: user.type };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const record = this.refreshTokens.get(token);
    if (!record) return;
    record.revoked = true;
  }

  async createAPIKey(userId: string, name: string, permissions: string[] = ['read'], expiresInDays?: number): Promise<APIKeyResult> {
    const key = `janus_${randomBytes(20).toString('hex')}`;
    const record: APIKeyRecord = {
      id: id('key'),
      userId,
      name,
      keyPrefix: key.slice(0, 12),
      keyHash: hash(key),
      permissions,
      isActive: true,
      createdAt: new Date().toISOString(),
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : undefined,
    };
    this.apiKeys.set(record.id, record);
    return { success: true, key, keyId: record.id, name: record.name };
  }

  async verifyAPIKey(key: string): Promise<{ user: AuthUser; permissions: string[] } | null> {
    const keyHash = hash(key);
    for (const record of this.apiKeys.values()) {
      if (!record.isActive) continue;
      if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) continue;
      if (record.keyHash !== keyHash) continue;

      const user = await store.getUser(record.userId);
      if (!user) return null;

      record.lastUsedAt = new Date().toISOString();
      return {
        user: { id: user.id, name: user.name, type: user.type },
        permissions: record.permissions,
      };
    }
    return null;
  }

  async revokeAPIKey(keyId: string, userId: string): Promise<boolean> {
    const record = this.apiKeys.get(keyId);
    if (!record || record.userId !== userId) return false;
    record.isActive = false;
    return true;
  }

  async listAPIKeys(userId: string): Promise<APIKeyRecord[]> {
    return Array.from(this.apiKeys.values()).filter((k) => k.userId === userId);
  }

  async registerUser(name: string, type: 'human' | 'ai' = 'human', metadata?: Record<string, unknown>) {
    const user = await store.createUser({ name, type, metadata });
    const apiKeyResult = await this.createAPIKey(user.id, 'Default API Key', ['read', 'write']);
    return {
      user: { id: user.id, name: user.name, type: user.type as 'human' | 'ai' },
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
