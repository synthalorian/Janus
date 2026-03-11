type UserType = 'human' | 'ai';
type ChannelType = 'chat' | 'forum' | 'board';

type User = {
  id: string;
  name: string;
  type: UserType;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type Channel = {
  id: string;
  name: string;
  type: ChannelType;
  description?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type Message = {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorType: UserType;
  channelId: string;
  threadId?: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

class InMemoryStore {
  private users = new Map<string, User>();
  private channels = new Map<string, Channel>();
  private messages = new Map<string, Message>();

  private generateId(prefix = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async initializeDefaultData(): Promise<void> {
    if (this.channels.size > 0) return;

    const systemUser = await this.createUser({ name: 'Janus System', type: 'ai' });

    await this.createChannel({
      name: 'general',
      type: 'chat',
      description: 'General discussion',
      createdBy: systemUser.id,
    });

    await this.createChannel({
      name: 'ai-lab',
      type: 'chat',
      description: 'AI collaboration channel',
      createdBy: systemUser.id,
    });
  }

  async getStats() {
    return {
      users: this.users.size,
      channels: this.channels.size,
      messages: this.messages.size,
      graphNodes: this.messages.size + this.users.size + this.channels.size,
      graphEdges: Math.max(0, this.messages.size - 1),
    };
  }

  async createUser(data: { name: string; type: UserType; metadata?: Record<string, unknown> }): Promise<User> {
    const user: User = {
      id: this.generateId('usr'),
      name: data.name,
      type: data.type,
      metadata: data.metadata,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByName(name: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.name === name);
  }

  async getAllChannels(): Promise<Channel[]> {
    return Array.from(this.channels.values());
  }

  async createChannel(data: {
    name: string;
    type: ChannelType;
    description?: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Channel> {
    const channel: Channel = {
      id: this.generateId('chn'),
      name: data.name,
      type: data.type,
      description: data.description,
      createdBy: data.createdBy,
      metadata: data.metadata,
      createdAt: new Date().toISOString(),
    };
    this.channels.set(channel.id, channel);
    return channel;
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async createMessage(data: {
    content: string;
    authorId: string;
    authorName: string;
    authorType: UserType;
    channelId: string;
    threadId?: string;
    replyTo?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Message> {
    const message: Message = {
      id: this.generateId('msg'),
      content: data.content,
      authorId: data.authorId,
      authorName: data.authorName,
      authorType: data.authorType,
      channelId: data.channelId,
      threadId: data.threadId,
      replyTo: data.replyTo,
      metadata: data.metadata,
      timestamp: new Date().toISOString(),
    };
    this.messages.set(message.id, message);
    return message;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getChannelMessages(channelId: string, limit = 50): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.channelId === channelId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .slice(-limit);
  }

  async getRelatedNodes(_id: string, _type?: string, _depth = 1) {
    return [];
  }

  async queryGraph(query: string) {
    const q = query.toLowerCase();
    return Array.from(this.messages.values()).filter((m) => m.content.toLowerCase().includes(q));
  }

  async searchMessages(q: string, limit = 20): Promise<Message[]> {
    const needle = q.toLowerCase();
    return Array.from(this.messages.values())
      .filter((m) => m.content.toLowerCase().includes(needle))
      .slice(0, limit);
  }

  async searchByTopic(topic: string, limit = 20): Promise<Message[]> {
    return this.searchMessages(topic, limit);
  }

  async searchDecisions(limit = 20): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((m) => /\b(decide|decision|approved|rejected|final)\b/i.test(m.content))
      .slice(0, limit);
  }

  async getMessagesBySentiment(sentiment: 'positive' | 'negative' | 'neutral', limit = 20): Promise<Message[]> {
    const positives = ['good', 'great', 'awesome', 'love', 'success'];
    const negatives = ['bad', 'terrible', 'hate', 'fail', 'error'];

    const list = Array.from(this.messages.values()).filter((m) => {
      const t = m.content.toLowerCase();
      const pos = positives.some((w) => t.includes(w));
      const neg = negatives.some((w) => t.includes(w));
      const s = pos ? 'positive' : neg ? 'negative' : 'neutral';
      return s === sentiment;
    });

    return list.slice(0, limit);
  }

  async findRelatedMessages(id: string, depth = 2): Promise<Message[]> {
    const root = this.messages.get(id);
    if (!root) return [];

    const byAuthor = Array.from(this.messages.values()).filter((m) => m.authorId === root.authorId && m.id !== id);
    const byThread = Array.from(this.messages.values()).filter((m) => m.threadId && m.threadId === root.threadId && m.id !== id);

    return [...new Map([...byAuthor, ...byThread].map((m) => [m.id, m])).values()].slice(0, Math.max(1, depth * 5));
  }
}

export const store = new InMemoryStore();
