import { db } from '../db/index.js';
import { agentCapabilities, type AgentCapability, type NewAgentCapability } from '../db/schema.js';
import { eq, and, sql, desc, type SQL } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Capability Registry
 *
 * Every AI agent registers its model, strengths, context window, and harness type.
 * The Orchestrator queries this registry to find the best agent for each subtask.
 */

export interface CapabilityQuery {
  strengths?: string[];
  harnessType?: string;
  modelName?: string;
  provider?: string;
  minContextWindow?: number;
  status?: string;
  limit?: number;
}

export interface CapabilityMatch {
  capability: AgentCapability;
  score: number;
  reasons: string[];
}

export class CapabilityRegistry {
  /**
   * Register a new agent capability.
   */
  async register(data: {
    agentId: string;
    agentName: string;
    modelName: string;
    provider: string;
    contextWindow?: number;
    strengths?: string[];
    harnessType: string;
    costPer1kTokens?: number;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentCapability> {
    const id = uuidv4();

    const [cap] = await db.insert(agentCapabilities).values({
      id,
      agentId: data.agentId,
      agentName: data.agentName,
      modelName: data.modelName,
      provider: data.provider,
      contextWindow: data.contextWindow || 128000,
      strengths: data.strengths || [],
      harnessType: data.harnessType,
      costPer1kTokens: data.costPer1kTokens,
      status: data.status || 'online',
      metadata: data.metadata || {},
      lastHeartbeatAt: new Date(),
    }).returning();

    return cap;
  }

  /**
   * Update an existing capability (e.g., heartbeat, status change).
   */
  async update(
    id: string,
    updates: Partial<Omit<NewAgentCapability, 'id' | 'createdAt'>>
  ): Promise<AgentCapability | undefined> {
    const [cap] = await db.update(agentCapabilities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agentCapabilities.id, id))
      .returning();
    return cap;
  }

  /**
   * Record a heartbeat for an agent.
   */
  async heartbeat(agentId: string): Promise<void> {
    await db.update(agentCapabilities)
      .set({ lastHeartbeatAt: new Date(), updatedAt: new Date() })
      .where(eq(agentCapabilities.agentId, agentId));
  }

  /**
   * Deregister a capability.
   */
  async deregister(id: string): Promise<boolean> {
    const result = await db.delete(agentCapabilities).where(eq(agentCapabilities.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get a capability by ID.
   */
  async get(id: string): Promise<AgentCapability | undefined> {
    const [cap] = await db.select().from(agentCapabilities).where(eq(agentCapabilities.id, id));
    return cap;
  }

  /**
   * Get capability by agent ID.
   */
  async getByAgentId(agentId: string): Promise<AgentCapability | undefined> {
    const [cap] = await db.select().from(agentCapabilities).where(eq(agentCapabilities.agentId, agentId));
    return cap;
  }

  /**
   * List all capabilities with optional filters.
   */
  async list(query: CapabilityQuery = {}): Promise<AgentCapability[]> {
    const conditions: SQL[] = [];

    if (query.harnessType) {
      conditions.push(eq(agentCapabilities.harnessType, query.harnessType));
    }
    if (query.modelName) {
      conditions.push(eq(agentCapabilities.modelName, query.modelName));
    }
    if (query.provider) {
      conditions.push(eq(agentCapabilities.provider, query.provider));
    }
    if (query.status) {
      conditions.push(eq(agentCapabilities.status, query.status));
    }
    if (query.minContextWindow) {
      conditions.push(sql`${agentCapabilities.contextWindow} >= ${query.minContextWindow}`);
    }

    const caps = await db.select()
      .from(agentCapabilities)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(agentCapabilities.lastHeartbeatAt))
      .limit(query.limit || 50);

    return caps;
  }

  /**
   * Find the best matching capabilities for a task.
   *
   * Scoring:
   * - +3 per matching strength keyword
   * - +2 for harness type match
   * - +1 for online status
   * - +1 for larger context window
   * - -1 for busy status
   */
  async findBestMatches(query: CapabilityQuery): Promise<CapabilityMatch[]> {
    const all = await this.list({ status: 'online', limit: 100 });
    const matches: CapabilityMatch[] = [];

    for (const cap of all) {
      let score = 0;
      const reasons: string[] = [];

      // Strength matching
      if (query.strengths && cap.strengths) {
        const capStrengths = cap.strengths.map((s) => s.toLowerCase());
        for (const q of query.strengths) {
          if (capStrengths.includes(q.toLowerCase())) {
            score += 3;
            reasons.push(`strength:${q}`);
          }
        }
      }

      // Harness type
      if (query.harnessType && cap.harnessType === query.harnessType) {
        score += 2;
        reasons.push(`harness:${cap.harnessType}`);
      }

      // Status bonus/penalty
      if (cap.status === 'online') {
        score += 1;
        reasons.push('status:online');
      } else if (cap.status === 'busy') {
        score -= 1;
        reasons.push('status:busy');
      }

      // Context window bonus
      if (query.minContextWindow && cap.contextWindow && cap.contextWindow >= query.minContextWindow) {
        score += 1;
        reasons.push(`context:${cap.contextWindow}`);
      }

      if (score > 0) {
        matches.push({ capability: cap, score, reasons });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Search capabilities by free-text query against model name, strengths, and harness type.
   */
  async search(q: string, limit = 20): Promise<AgentCapability[]> {
    const needle = q.toLowerCase();
    const all = await this.list({ limit: 200 });

    return all
      .filter((cap) => {
        const haystack = [
          cap.modelName,
          cap.provider,
          cap.harnessType,
          cap.agentName,
          ...(cap.strengths || []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, limit);
  }
}

export const capabilityRegistry = new CapabilityRegistry();
