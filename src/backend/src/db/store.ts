import { db, query } from './index.js';
import { users, channels, messages, graphNodes, graphEdges } from './schema.js';
import { eq, desc, inArray, and, sql } from 'drizzle-orm';
import type { User, Channel, Message, GraphNode, GraphEdge, NewUser, NewChannel, NewMessage, NewGraphNode, NewGraphEdge } from './schema.js';

/**
 * Janus Database Store
 * Replaces the in-memory store with PostgreSQL persistence
 */
class DatabaseStore {
  // ============ Utility ============
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============ Users ============

  async createUser(data: { name: string; type: 'human' | 'ai'; metadata?: Record<string, unknown> }): Promise<User> {
    const id = this.generateId();
    const [user] = await db.insert(users).values({
      id,
      name: data.name,
      type: data.type,
      trustLevel: data.type === 'ai' ? 1 : 2,
      metadata: data.metadata || {},
    }).returning();
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByName(name: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.name, name)).limit(1);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  // ============ Channels ============

  async createChannel(data: { 
    name: string; 
    type: 'chat' | 'forum' | 'board'; 
    description?: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Channel> {
    const id = this.generateId();
    const [channel] = await db.insert(channels).values({
      id,
      name: data.name,
      type: data.type,
      description: data.description,
      createdBy: data.createdBy,
      metadata: data.metadata || {},
    }).returning();
    return channel;
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
    return channel;
  }

  async getChannelByName(name: string): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.name, name)).limit(1);
    return channel;
  }

  async getAllChannels(): Promise<Channel[]> {
    return db.select().from(channels);
  }

  async updateChannel(id: string, data: Partial<NewChannel>): Promise<Channel | undefined> {
    const [channel] = await db.update(channels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channels.id, id))
      .returning();
    return channel;
  }

  async deleteChannel(id: string): Promise<boolean> {
    const result = await db.delete(channels).where(eq(channels.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ============ Messages ============

  async createMessage(data: {
    content: string;
    authorId: string;
    authorName: string;
    authorType: 'human' | 'ai';
    channelId: string;
    threadId?: string;
    replyTo?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Message> {
    const id = this.generateId();
    const [message] = await db.insert(messages).values({
      id,
      content: data.content,
      authorId: data.authorId,
      authorName: data.authorName,
      authorType: data.authorType,
      channelId: data.channelId,
      threadId: data.threadId,
      replyTo: data.replyTo,
      metadata: data.metadata || {},
    }).returning();

    // Create graph node for this message
    await this.createGraphNode({
      type: 'message',
      label: data.content.substring(0, 100),
      properties: { messageId: id, channelId: data.channelId },
    });

    // Create edge from author to message
    const authorNode = await this.getOrCreateUserNode(data.authorId);
    const messageNode = await this.getMessageNode(id);
    if (authorNode && messageNode) {
      await this.createGraphEdge({
        fromNodeId: authorNode.id,
        toNodeId: messageNode.id,
        type: 'authored',
        properties: { timestamp: new Date().toISOString() },
      });
    }

    // Create edge from channel to message
    const channelNode = await this.getOrCreateChannelNode(data.channelId);
    if (channelNode && messageNode) {
      await this.createGraphEdge({
        fromNodeId: messageNode.id,
        toNodeId: channelNode.id,
        type: 'in_channel',
        properties: {},
      });
    }

    // Handle reply relationships
    if (data.replyTo) {
      const parentMessageNode = await this.getMessageNode(data.replyTo);
      if (parentMessageNode && messageNode) {
        await this.createGraphEdge({
          fromNodeId: messageNode.id,
          toNodeId: parentMessageNode.id,
          type: 'reply_to',
          properties: {},
        });
      }
    }

    return message;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return message;
  }

  async getChannelMessages(channelId: string, limit = 50): Promise<Message[]> {
    return db.select()
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .then(msgs => msgs.reverse()); // Oldest first for display
  }

  async getMessagesByAuthor(authorId: string, limit = 50): Promise<Message[]> {
    return db.select()
      .from(messages)
      .where(eq(messages.authorId, authorId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async getThreadMessages(threadId: string): Promise<Message[]> {
    return db.select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt);
  }

  async updateMessage(id: string, data: Partial<NewMessage>): Promise<Message | undefined> {
    const [message] = await db.update(messages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(messages.id, id))
      .returning();
    return message;
  }

  async deleteMessage(id: string): Promise<boolean> {
    const result = await db.delete(messages).where(eq(messages.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ============ Knowledge Graph ============

  async createGraphNode(data: { 
    type: string; 
    label?: string; 
    properties?: Record<string, unknown>;
  }): Promise<GraphNode> {
    const id = this.generateId();
    const [node] = await db.insert(graphNodes).values({
      id,
      type: data.type,
      label: data.label,
      properties: data.properties || {},
    }).returning();
    return node;
  }

  async getGraphNode(id: string): Promise<GraphNode | undefined> {
    const [node] = await db.select().from(graphNodes).where(eq(graphNodes.id, id)).limit(1);
    return node;
  }

  async getGraphNodesByType(type: string): Promise<GraphNode[]> {
    return db.select().from(graphNodes).where(eq(graphNodes.type, type));
  }

  async getOrCreateUserNode(userId: string): Promise<GraphNode | undefined> {
    const existing = await query<GraphNode>(
      `SELECT * FROM graph_nodes WHERE type = 'user' AND properties->>'userId' = $1`,
      [userId]
    );
    if (existing.length > 0) return existing[0];

    const user = await this.getUser(userId);
    if (!user) return undefined;

    return this.createGraphNode({
      type: 'user',
      label: user.name,
      properties: { userId, userType: user.type },
    });
  }

  async getOrCreateChannelNode(channelId: string): Promise<GraphNode | undefined> {
    const existing = await query<GraphNode>(
      `SELECT * FROM graph_nodes WHERE type = 'channel' AND properties->>'channelId' = $1`,
      [channelId]
    );
    if (existing.length > 0) return existing[0];

    const channel = await this.getChannel(channelId);
    if (!channel) return undefined;

    return this.createGraphNode({
      type: 'channel',
      label: channel.name,
      properties: { channelId, channelType: channel.type },
    });
  }

  async getMessageNode(messageId: string): Promise<GraphNode | undefined> {
    const nodes = await query<GraphNode>(
      `SELECT * FROM graph_nodes WHERE type = 'message' AND properties->>'messageId' = $1`,
      [messageId]
    );
    return nodes[0];
  }

  async createGraphEdge(data: {
    fromNodeId: string;
    toNodeId: string;
    type: string;
    weight?: number;
    properties?: Record<string, unknown>;
  }): Promise<GraphEdge> {
    const id = this.generateId();
    const [edge] = await db.insert(graphEdges).values({
      id,
      fromNodeId: data.fromNodeId,
      toNodeId: data.toNodeId,
      type: data.type,
      weight: data.weight || 1,
      properties: data.properties || {},
    }).returning();
    return edge;
  }

  async getGraphEdges(nodeId: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): Promise<GraphEdge[]> {
    if (direction === 'outgoing') {
      return db.select().from(graphEdges).where(eq(graphEdges.fromNodeId, nodeId));
    } else if (direction === 'incoming') {
      return db.select().from(graphEdges).where(eq(graphEdges.toNodeId, nodeId));
    } else {
      return db.select().from(graphEdges).where(
        sql`${graphEdges.fromNodeId} = ${nodeId} OR ${graphEdges.toNodeId} = ${nodeId}`
      );
    }
  }

  async getRelatedNodes(nodeId: string, edgeType?: string, depth = 1): Promise<{ node: GraphNode; edge: GraphEdge }[]> {
    // Recursive CTE for graph traversal
    const edgeFilter = edgeType ? `AND e.type = '${edgeType}'` : '';
    
    const results = await query<{ node: GraphNode; edge: GraphEdge }>(`
      WITH RECURSIVE related AS (
        -- Base case: direct connections
        SELECT 
          n.* as node,
          e.* as edge,
          1 as depth
        FROM graph_nodes n
        JOIN graph_edges e ON (e.to_node_id = n.id OR e.from_node_id = n.id)
        WHERE (e.from_node_id = $1 OR e.to_node_id = $1)
          AND n.id != $1
          ${edgeFilter}
        
        UNION ALL
        
        -- Recursive case: follow edges
        SELECT 
          n.*,
          e.*,
          r.depth + 1
        FROM graph_nodes n
        JOIN graph_edges e ON (e.to_node_id = n.id OR e.from_node_id = n.id)
        JOIN related r ON (e.from_node_id = r.node OR e.to_node_id = r.node)
        WHERE n.id != $1
          AND r.depth < $2
          ${edgeFilter}
      )
      SELECT DISTINCT ON (node->>'id') node, edge FROM related
    `, [nodeId, depth]);

    return results;
  }

  async queryGraph(queryStr: string, params: Record<string, unknown> = {}): Promise<GraphNode[]> {
    // Simple text-based graph query
    // TODO: Implement more sophisticated query language
    if (queryStr.includes('FIND')) {
      const typeMatch = queryStr.match(/type\s*=\s*["']?(\w+)["']?/i);
      if (typeMatch) {
        return this.getGraphNodesByType(typeMatch[1]);
      }
    }
    return [];
  }

  // ============ Stats ============

  async getStats() {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [channelCount] = await db.select({ count: sql<number>`count(*)` }).from(channels);
    const [messageCount] = await db.select({ count: sql<number>`count(*)` }).from(messages);
    const [nodeCount] = await db.select({ count: sql<number>`count(*)` }).from(graphNodes);
    const [edgeCount] = await db.select({ count: sql<number>`count(*)` }).from(graphEdges);

    return {
      users: userCount?.count || 0,
      channels: channelCount?.count || 0,
      messages: messageCount?.count || 0,
      graphNodes: nodeCount?.count || 0,
      graphEdges: edgeCount?.count || 0,
    };
  }

  // ============ Initialization ============

  async initializeDefaultData(): Promise<void> {
    // Check if we already have channels
    const existingChannels = await this.getAllChannels();
    if (existingChannels.length > 0) return;

    console.log('Initializing default channels...');

    // Create default channels
    await this.createChannel({ 
      name: 'general', 
      type: 'chat', 
      description: 'General chat' 
    });
    await this.createChannel({ 
      name: 'ai-lab', 
      type: 'chat', 
      description: 'AI experimentation' 
    });
    await this.createChannel({ 
      name: 'dev', 
      type: 'forum', 
      description: 'Development discussions' 
    });

    console.log('✅ Default channels created');
  }
}

// Singleton instance
export const store = new DatabaseStore();
