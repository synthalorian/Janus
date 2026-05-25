// Shared types for Janus frontend

export interface User {
  id: string;
  name: string;
  type: 'human' | 'ai';
  trustLevel: number;
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

export interface Channel {
  id: string;
  name: string;
  type: 'chat' | 'forum' | 'board';
  description?: string;
  createdAt: string;
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

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

// Bot types
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

// Oversight types
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
  reviews?: OversightReview[];
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

// Graph types
export interface GraphNode {
  id: string;
  type: 'entity' | 'concept' | 'message' | 'user' | 'channel';
  label: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface GraphStats {
  nodes: number;
  edges: number;
}

// Orchestration types
export interface OrchestrationPlan {
  id: string;
  userId: string;
  goal: string;
  status: 'planning' | 'spawning' | 'executing' | 'completed' | 'failed' | 'cancelled';
  plan?: Record<string, unknown>;
  teamId?: string;
  channelId?: string;
  result?: string;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrchestrationTask {
  id: string;
  planId: string;
  parentTaskIds?: string[];
  template: string;
  description: string;
  assignedBotId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionSnapshot {
  plan: OrchestrationPlan;
  tasks: OrchestrationTask[];
  readyTasks: string[];
  blockedTasks: string[];
  completedTasks: string[];
}

export interface AgentCapability {
  id: string;
  agentId: string;
  agentName: string;
  modelName: string;
  provider: string;
  contextWindow: number;
  strengths: string[];
  harnessType: string;
  costPer1kTokens?: number;
  status: 'online' | 'offline' | 'busy';
  metadata?: Record<string, unknown>;
  lastHeartbeatAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Soul types
export interface AgentSoul {
  id: string;
  agentId: string;
  name: string;
  displayName?: string;
  avatar?: string;
  personality?: string;
  backstory?: string;
  voiceStyle?: string;
  archetype: string;
  expertiseTags: string[];
  modelPreference?: string;
  contextWindow: number;
  status: 'active' | 'dormant' | 'archived';
  trustLevel: number;
  defaultChannelId?: string;
  experiencePoints: number;
  level: number;
  interactionsCount: number;
  lastActiveAt?: string;
  metadata?: Record<string, unknown>;
  skills: AgentSkill[];
  placements: AgentPlacement[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentSkill {
  id: string;
  soulId: string;
  name: string;
  description?: string;
  category: string;
  proficiency: number;
  triggers: string[];
  priority: number;
  config?: Record<string, unknown>;
  source: string;
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPlacement {
  id: string;
  soulId: string;
  channelId?: string;
  matchPattern?: string;
  matchType: string;
  activationMode: string;
  schedule?: string;
  priority: number;
  isActive: boolean;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Navigation
export type ViewType = 'chat' | 'bots' | 'graph' | 'oversight' | 'swarm' | 'health' | 'souls';
