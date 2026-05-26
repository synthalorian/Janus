// Janus API Client - covers all backend endpoints
// Uses Vite proxy — all requests go through the dev server

import type { OrchestrationPlan, OrchestrationTask, ExecutionSnapshot, AgentCapability, AgentSoul, AgentSkill, AgentPlacement } from '../types';

const API_BASE = '/api';

// ==================== Auth Token Management ====================
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

// ==================== HTTP Client ====================

interface RequestOptions {
  headers?: Record<string, string>;
  token?: string;
  skipAuth?: boolean;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<{ success: boolean; data?: T; error?: string; meta?: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const effectiveToken = options.token || (!options.skipAuth ? _authToken : null);
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return res.json();
}

// ==================== Health & Config ====================
export const healthApi = {
  check: () => request<{ status: string; timestamp: string; database: string; stats: unknown; features: unknown }>('GET', '/health'),
  config: () => request<{ nodeEnv: string; port: number; features: Record<string, boolean> }>('GET', '/config'),
};

// ==================== Channels ====================
export const channelsApi = {
  list: () => request<Channel[]>('GET', '/channels'),
  get: (id: string) => request<Channel>('GET', `/channels/${id}`),
  create: (data: { name: string; type: string; description?: string; createdBy?: string }) =>
    request<Channel>('POST', '/channels', data),
  messages: (id: string, limit = 50) =>
    request<Message[]>('GET', `/channels/${id}/messages?limit=${limit}`),
};

// ==================== Messages ====================
export const messagesApi = {
  send: (data: CreateMessageRequest) => request<Message>('POST', '/messages', data),
  get: (id: string) => request<Message>('GET', `/messages/${id}`),
  related: (id: string, depth = 2) =>
    request<Message[]>('GET', `/messages/${id}/related?depth=${depth}`),
  aiMessage: (data: { channelId: string; content: string; aiName?: string }) =>
    request<Message>('POST', '/ai/message', data),
};

// ==================== Users ====================
export const usersApi = {
  create: (data: { name: string; type: string }) => request<User>('POST', '/users', data),
  get: (id: string) => request<User>('GET', `/users/${id}`),
};

// ==================== Graph ====================
export const graphApi = {
  nodes: () => request<{ nodes: number; edges: number }>('GET', '/graph/nodes'),
  relatedNodes: (id: string, type?: string, depth = 1) =>
    request<unknown[]>('GET', `/graph/nodes/${id}/related?${type ? `type=${type}&` : ''}depth=${depth}`),
  query: (query: string) => request<unknown[]>('POST', '/graph/query', { query }),
};

// ==================== Search ====================
export const searchApi = {
  messages: (q: string, limit = 20) =>
    request<Message[]>('GET', `/search/messages?q=${encodeURIComponent(q)}&limit=${limit}`),
  byTopic: (topic: string, limit = 20) =>
    request<Message[]>('GET', `/search/topic/${encodeURIComponent(topic)}?limit=${limit}`),
  decisions: (limit = 20) => request<Message[]>('GET', `/search/decisions?limit=${limit}`),
  bySentiment: (sentiment: 'positive' | 'negative' | 'neutral', limit = 20) =>
    request<Message[]>('GET', `/search/sentiment/${sentiment}?limit=${limit}`),
};

// ==================== Auth ====================
export const authApi = {
  register: (data: { name: string; type: string; metadata?: unknown }) =>
    request<{ user: { id: string; name: string; type: string }; token: string; apiKey: string; message: string }>(
      'POST', '/auth/register', data
    ),
  refresh: (refreshToken: string) =>
    request<{ token: string; refreshToken: string }>('POST', '/auth/refresh', { refreshToken }),
  me: (token: string) =>
    request<{ user: unknown; authType: string }>('GET', '/auth/me', undefined, { token }),
  logout: (refreshToken?: string) =>
    request<{ message: string }>('POST', '/auth/logout', { refreshToken }),
  createKey: (data: { name: string; permissions?: string[]; expiresInDays?: number }, token: string) =>
    request<{ key: string; keyId: string; name: string; message: string }>('POST', '/auth/keys', data, { token }),
  listKeys: (token: string) =>
    request<Array<{ id: string; name: string; prefix: string; permissions: string[]; isActive: boolean; lastUsedAt: string; expiresAt: string; createdAt: string }>>(
      'GET', '/auth/keys', undefined, { token }
    ),
  revokeKey: (keyId: string, token: string) =>
    request<{ message: string }>('DELETE', `/auth/keys/${keyId}`, undefined, { token }),
};

// ==================== Bots ====================
export const botsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Bot[]>(`GET`, `/bots${qs}`);
  },
  get: (id: string) => request<Bot>('GET', `/bots/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    request<Bot>('PATCH', `/bots/${id}`, data),
  delete: (id: string) => request<{ message: string }>('DELETE', `/bots/${id}`),

  // Templates
  templates: () => request<BotTemplate[]>('GET', '/bots/templates'),
  getTemplate: (id: string) => request<BotTemplate>('GET', `/bots/templates/${id}`),

  // Spawning
  spawn: (data: { template: string; name?: string; displayName?: string; description?: string; config?: unknown }) =>
    request<{ status: string; botId?: string; [key: string]: unknown }>('POST', '/bots/spawn', data),
  spawnTeam: (data: { name: string; description?: string; bots: Array<{ template: string; name?: string }> }) =>
    request<{ teamId: string; bots: Bot[] }>('POST', '/bots/teams/spawn', data),

  // Communication
  sendMessage: (botId: string, content: string, metadata?: unknown) =>
    request<{ status: string; response?: string }>('POST', `/bots/${botId}/message`, { content, metadata }),
  botToBot: (fromId: string, toId: string, content: string, metadata?: unknown) =>
    request<{ status: string; response?: string }>('POST', `/bots/${fromId}/message/${toId}`, { content, metadata }),

  // Tasks
  assignTask: (botId: string, description: string, timeout?: number, payload?: unknown) =>
    request<{ taskId: string }>('POST', `/bots/${botId}/tasks`, { description, timeout, payload }),
  getTask: (botId: string, taskId: string) =>
    request<{ status: string; result?: unknown }>('GET', `/bots/${botId}/tasks/${taskId}`),

  // Lifecycle
  pause: (id: string) => request<{ message: string }>('POST', `/bots/${id}/pause`),
  resume: (id: string) => request<{ message: string }>('POST', `/bots/${id}/resume`),
  active: () => request<Bot[]>('GET', '/bots/active'),
  metrics: (id: string) => request<BotMetrics>('GET', `/bots/${id}/metrics`),

  // Commands
  commands: (id: string) => request<BotCommand[]>('GET', `/bots/${id}/commands`),
  createCommand: (id: string, data: { name: string; type: string; description?: string; triggers?: string[]; handler?: string }) =>
    request<BotCommand>('POST', `/bots/${id}/commands`, data),
  invoke: (id: string, command: string, params?: Record<string, unknown>) =>
    request<{ response: string }>('POST', `/bots/${id}/interact`, { command, params }),
};

// ==================== Oversight ====================
export const oversightApi = {
  assess: (actionType: string, agentId: string, payload?: unknown) =>
    request<{ riskScore: number; factors: unknown; oversightLevel: string; autoEscalate: boolean }>(
      'POST', '/oversight/assess', { actionType, agentId, payload }
    ),
  submit: (data: { agentId: string; agentName?: string; actionType: string; description: string; payload?: unknown }) =>
    request<{ actionId: string; status: string; oversightLevel: string; riskScore: number; requiresReview: boolean }>(
      'POST', '/oversight/submit', data
    ),
  review: (data: { actionId: string; reviewerId: string; reviewerName?: string; decision: string; reasoning: string; confidence?: number }) =>
    request<{ reviewId: string; actionStatus: string; approvals: number; rejections: number }>(
      'POST', '/oversight/review', data
    ),
  challenge: (data: { actionId: string; challengerId: string; challengerName?: string; reasoning: string }) =>
    request<{ challengeId: string; actionId: string; status: string; message: string }>(
      'POST', '/oversight/challenge', data
    ),
  getAction: (id: string) =>
    request<OversightAction & { reviews: OversightReview[] }>('GET', `/oversight/actions/${id}`),
  getReviews: (id: string) =>
    request<OversightReview[]>('GET', `/oversight/actions/${id}/reviews`),
  pending: (params?: { agentId?: string; reviewerId?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<OversightAction[]>(`GET`, `/oversight/pending${qs}`);
  },
  audit: (agentId?: string) =>
    request<{ trail: unknown[]; stats?: unknown }>('GET', `/oversight/audit${agentId ? `/${agentId}` : ''}`),
  stats: () =>
    request<OversightStats>('GET', '/oversight/stats'),
  board: () =>
    request<OversightBoard>('GET', '/oversight/board'),
};

// ==================== Orchestration ====================
export const orchestrationApi = {
  submitGoal: (data: { goal: string; channelId?: string; metadata?: Record<string, unknown> }) =>
    request<{ planId: string; status: string; goal: string; channelId?: string; message: string }>('POST', '/orchestrate', data),
  listPlans: () =>
    request<OrchestrationPlan[]>('GET', '/orchestrate'),
  getPlan: (id: string) =>
    request<{ plan: OrchestrationPlan; tasks: OrchestrationTask[] }>('GET', `/orchestrate/${id}`),
  getStatus: (id: string) =>
    request<ExecutionSnapshot>('GET', `/orchestrate/${id}/status`),
  cancelPlan: (id: string) =>
    request<{ message: string }>('POST', `/orchestrate/${id}/cancel`),

  // Capabilities
  listCapabilities: (params?: { q?: string; harnessType?: string; modelName?: string; provider?: string; status?: string; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<AgentCapability[]>(`GET`, `/orchestrate/capabilities${qs}`);
  },
  registerCapability: (data: {
    agentId: string; agentName?: string; modelName: string; provider: string;
    contextWindow?: number; strengths?: string[]; harnessType: string;
    costPer1kTokens?: number; status?: string; metadata?: Record<string, unknown>;
  }) => request<AgentCapability>('POST', '/orchestrate/capabilities', data),
  getCapability: (id: string) => request<AgentCapability>('GET', `/orchestrate/capabilities/${id}`),
  updateCapability: (id: string, data: Record<string, unknown>) =>
    request<AgentCapability>('PATCH', `/orchestrate/capabilities/${id}`, data),
  deleteCapability: (id: string) => request<{ message: string }>('DELETE', `/orchestrate/capabilities/${id}`),
  heartbeatCapability: (id: string) =>
    request<{ message: string }>('POST', `/orchestrate/capabilities/${id}/heartbeat`),
  matchCapabilities: (data: { strengths?: string[]; harnessType?: string; minContextWindow?: number; limit?: number }) =>
    request<AgentCapability[]>('POST', '/orchestrate/capabilities/match', data),
};

// ==================== Stats ====================
export const statsApi = {
  get: () => request<{ users: number; channels: number; messages: number; graphNodes: number; graphEdges: number }>('GET', '/stats'),
};

// ==================== Souls ====================
export const soulsApi = {
  list: (params?: { status?: string; archetype?: string; search?: string }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<AgentSoul[]>(`GET`, `/souls${qs}`);
  },
  get: (id: string) => request<AgentSoul>('GET', `/souls/${id}`),
  getByAgent: (agentId: string) => request<AgentSoul>('GET', `/souls/by-agent/${agentId}`),
  create: (data: { agentId: string; name: string; displayName?: string; personality?: string; backstory?: string; voiceStyle?: string; archetype?: string; expertiseTags?: string[]; modelPreference?: string }) =>
    request<AgentSoul>('POST', '/souls', data),
  update: (id: string, data: Record<string, unknown>) =>
    request<AgentSoul>('PATCH', `/souls/${id}`, data),
  delete: (id: string) => request<{ message: string }>('DELETE', `/souls/${id}`),

  // Skills
  listSkills: (soulId: string) => request<AgentSkill[]>('GET', `/souls/${soulId}/skills`),
  createSkill: (soulId: string, data: { name: string; description?: string; category?: string; proficiency?: number; triggers?: string[]; priority?: number }) =>
    request<AgentSkill>('POST', `/souls/${soulId}/skills`, data),
  updateSkill: (soulId: string, skillId: string, data: Record<string, unknown>) =>
    request<AgentSkill>('PATCH', `/souls/${soulId}/skills/${skillId}`, data),
  deleteSkill: (soulId: string, skillId: string) =>
    request<{ message: string }>('DELETE', `/souls/${soulId}/skills/${skillId}`),

  // Placements
  listPlacements: (soulId: string) => request<AgentPlacement[]>('GET', `/souls/${soulId}/placements`),
  createPlacement: (soulId: string, data: { channelId?: string; matchPattern?: string; matchType?: string; activationMode?: string; priority?: number; isActive?: boolean }) =>
    request<AgentPlacement>('POST', `/souls/${soulId}/placements`, data),
  updatePlacement: (soulId: string, placementId: string, data: Record<string, unknown>) =>
    request<AgentPlacement>('PATCH', `/souls/${soulId}/placements/${placementId}`, data),
  deletePlacement: (soulId: string, placementId: string) =>
    request<AgentPlacement>('DELETE', `/souls/${soulId}/placements/${placementId}`),

  // Queries
  findAgent: (data: { requiredSkills: string[]; archetype?: string }) =>
    request<AgentSoul | null>('POST', '/souls/find-agent', data),
  getActivePlacements: () => request<Array<AgentPlacement & { soul: AgentSoul }>>('GET', '/souls/placements/active'),
  awardXP: (soulId: string, amount: number) =>
    request<AgentSoul>('POST', `/souls/${soulId}/xp`, { amount }),
};

// ==================== Types (inline for self-contained client) ====================
export interface Channel {
  id: string;
  name: string;
  type: 'chat' | 'forum' | 'board';
  description?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorType: 'human' | 'ai';
  channelId: string;
  timestamp: string;
  threadId?: string;
  replyTo?: string;
}

export interface CreateMessageRequest {
  content: string;
  authorId: string;
  authorName: string;
  authorType: 'human' | 'ai';
  channelId: string;
  threadId?: string;
  replyTo?: string;
}

export interface User {
  id: string;
  name: string;
  type: 'human' | 'ai';
  trustLevel: number;
  createdAt: string;
}

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  autoStart?: boolean;
}

export interface Bot {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  type: string;
  category?: string;
  status: 'online' | 'offline' | 'idle' | 'error';
  ownerId: string;
  isPublic: boolean;
  config?: Record<string, unknown>;
  capabilities?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BotMetrics {
  messagesSent: number;
  messagesReceived: number;
  commandsExecuted: number;
  tasksCompleted: number;
  uptime: number;
  lastActive: string;
}

export interface BotCommand {
  id: string;
  name: string;
  description?: string;
  type: string;
  triggers?: string[];
  handler?: string;
  createdAt: string;
}

export interface OversightAction {
  id: string;
  agentId: string;
  agentName: string;
  actionType: string;
  description: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'challenged' | 'escalated' | 'executed';
  oversightLevel: 'none' | 'peer' | 'committee' | 'human' | 'emergency';
  risk: { score: number; factors: unknown[] };
  approvals: unknown[];
  rejections: unknown[];
  createdAt: string;
}

export interface OversightReview {
  id: string;
  actionId: string;
  reviewerId: string;
  reviewerName: string;
  decision: 'approve' | 'reject' | 'challenge' | 'escalate';
  reasoning: string;
  confidence: number;
  createdAt: string;
}

export interface OversightStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  challenged: number;
  escalated: number;
  byRiskLevel: Record<string, number>;
  averageRiskScore: number;
}

export interface OversightBoard {
  id: string;
  name: string;
  members: Array<{ id: string; name: string; role: string }>;
  quorum: number;
  approvalThreshold: number;
}