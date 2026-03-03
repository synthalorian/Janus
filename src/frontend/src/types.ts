// Shared types for Janus frontend

export interface User {
  id: string;
  name: string;
  type: 'human' | 'ai';
  trustLevel: number;
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

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
