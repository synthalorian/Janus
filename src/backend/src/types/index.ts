// Core types for Janus

export interface User {
  id: string;
  name: string;
  type: 'human' | 'ai';
  trustLevel: number; // 0-4
  createdAt: Date;
}

export interface Message {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorType: 'human' | 'ai';
  channelId: string;
  timestamp: Date;
  threadId?: string;
  replyTo?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: 'chat' | 'forum' | 'board';
  description?: string;
  createdAt: Date;
}

export interface Board {
  id: string;
  name: string;
  type: 'chat' | 'forum' | 'kanban' | 'feed' | 'dashboard' | 'custom';
  config: BoardConfig;
  createdAt: Date;
}

export interface BoardConfig {
  filters?: FilterRule[];
  layout?: LayoutDefinition;
  aiConfig?: AIBoardConfig;
}

export interface FilterRule {
  type: string;
  [key: string]: unknown;
}

export interface LayoutDefinition {
  type: string;
  columns?: number;
  [key: string]: unknown;
}

export interface AIBoardConfig {
  autoSurface?: boolean;
  suggestContent?: boolean;
  dynamicReorder?: boolean;
}

// API types
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
}

// Socket events
export interface SocketEvents {
  // Client -> Server
  'message:send': (message: CreateMessageRequest) => void;
  'channel:join': (channelId: string) => void;
  'channel:leave': (channelId: string) => void;

  // Server -> Client
  'message:new': (message: Message) => void;
  'message:stream': (data: { messageId: string; chunk: string }) => void;
  'message:stream:end': (messageId: string) => void;
  'user:typing': (data: { userId: string; channelId: string }) => void;
}
