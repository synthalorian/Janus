import { Message, Channel, User } from '../types/index.js';

// In-memory store for prototyping
// TODO: Replace with PostgreSQL + Neo4j

class MessageStore {
  private messages: Map<string, Message> = new Map();
  private channels: Map<string, Channel> = new Map();
  private users: Map<string, User> = new Map();
  private channelMessages: Map<string, Set<string>> = new Map(); // channelId -> messageIds

  constructor() {
    // Initialize with default channels
    this.createChannel({ name: 'general', type: 'chat', description: 'General chat' });
    this.createChannel({ name: 'ai-lab', type: 'chat', description: 'AI experimentation' });
    this.createChannel({ name: 'dev', type: 'forum', description: 'Development discussions' });
  }

  // Channels
  createChannel(data: { name: string; type: 'chat' | 'forum' | 'board'; description?: string }): Channel {
    const channel: Channel = {
      id: this.generateId(),
      name: data.name,
      type: data.type,
      description: data.description,
      createdAt: new Date(),
    };
    this.channels.set(channel.id, channel);
    this.channelMessages.set(channel.id, new Set());
    return channel;
  }

  getChannel(id: string): Channel | undefined {
    return this.channels.get(id);
  }

  getChannelByName(name: string): Channel | undefined {
    for (const channel of this.channels.values()) {
      if (channel.name === name) return channel;
    }
    return undefined;
  }

  getAllChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  // Messages
  createMessage(data: {
    content: string;
    authorId: string;
    authorName: string;
    authorType: 'human' | 'ai';
    channelId: string;
    threadId?: string;
    replyTo?: string;
  }): Message {
    const message: Message = {
      id: this.generateId(),
      content: data.content,
      authorId: data.authorId,
      authorName: data.authorName,
      authorType: data.authorType,
      channelId: data.channelId,
      timestamp: new Date(),
      threadId: data.threadId,
      replyTo: data.replyTo,
    };
    this.messages.set(message.id, message);

    const channelMsgs = this.channelMessages.get(data.channelId);
    if (channelMsgs) {
      channelMsgs.add(message.id);
    }

    return message;
  }

  getMessage(id: string): Message | undefined {
    return this.messages.get(id);
  }

  getChannelMessages(channelId: string, limit = 50): Message[] {
    const messageIds = this.channelMessages.get(channelId);
    if (!messageIds) return [];

    return Array.from(messageIds)
      .map(id => this.messages.get(id)!)
      .filter(m => m)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
      .reverse(); // Oldest first for display
  }

  // Users
  createUser(data: { name: string; type: 'human' | 'ai' }): User {
    const user: User = {
      id: this.generateId(),
      name: data.name,
      type: data.type,
      trustLevel: data.type === 'ai' ? 1 : 2,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  // Utility
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Stats
  getStats() {
    return {
      messages: this.messages.size,
      channels: this.channels.size,
      users: this.users.size,
    };
  }
}

// Singleton instance
export const store = new MessageStore();
