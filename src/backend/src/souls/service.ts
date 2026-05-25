import { db } from '../db/index.js';
import { agentSouls, agentSkills, agentPlacements, type AgentSoul, type NewAgentSoul, type AgentSkill, type NewAgentSkill, type AgentPlacement, type NewAgentPlacement, ARCHETYPES } from '../db/schema.souls.js';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, like, or, sql, type SQL } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════════════
// Soul Service
// ═══════════════════════════════════════════════════════════════

export interface CreateSoulData {
  agentId: string;
  name: string;
  displayName?: string;
  personality?: string;
  backstory?: string;
  voiceStyle?: string;
  archetype?: string;
  expertiseTags?: string[];
  modelPreference?: string;
  contextWindow?: number;
  defaultChannelId?: string;
}

export interface UpdateSoulData {
  displayName?: string;
  personality?: string;
  backstory?: string;
  voiceStyle?: string;
  archetype?: string;
  expertiseTags?: string[];
  modelPreference?: string;
  contextWindow?: number;
  status?: string;
  trustLevel?: number;
  defaultChannelId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSkillData {
  soulId: string;
  name: string;
  description?: string;
  category?: string;
  proficiency?: number;
  triggers?: string[];
  priority?: number;
  config?: Record<string, unknown>;
  source?: string;
}

export interface CreatePlacementData {
  soulId: string;
  channelId?: string;
  matchPattern?: string;
  matchType?: string;
  activationMode?: string;
  schedule?: string;
  priority?: number;
  isActive?: boolean;
  config?: Record<string, unknown>;
}

export interface SoulWithSkills extends AgentSoul {
  skills: AgentSkill[];
  placements: AgentPlacement[];
}

export class SoulService {
  // ── Souls CRUD ──────────────────────────────────────────

  async createSoul(data: CreateSoulData): Promise<AgentSoul> {
    const id = uuidv4();
    const now = new Date();

    const [soul] = await db.insert(agentSouls).values({
      id,
      agentId: data.agentId,
      name: data.name,
      displayName: data.displayName || data.name,
      personality: data.personality || '',
      backstory: data.backstory || '',
      voiceStyle: data.voiceStyle || '',
      archetype: data.archetype || ARCHETYPES.CREATOR,
      expertiseTags: data.expertiseTags || [],
      modelPreference: data.modelPreference || '',
      contextWindow: data.contextWindow || 128000,
      status: 'dormant',
      trustLevel: 1,
      experiencePoints: 0,
      level: 1,
      interactionsCount: 0,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    } as NewAgentSoul).returning();

    return soul;
  }

  async getSoul(id: string): Promise<SoulWithSkills | null> {
    const [soul] = await db.select().from(agentSouls).where(eq(agentSouls.id, id)).limit(1);
    if (!soul) return null;

    const skills = await db.select().from(agentSkills).where(eq(agentSkills.soulId, id)).orderBy(desc(agentSkills.priority));
    const placements = await db.select().from(agentPlacements).where(eq(agentPlacements.soulId, id)).orderBy(desc(agentPlacements.priority));

    return { ...soul, skills, placements };
  }

  async getSoulByAgentId(agentId: string): Promise<SoulWithSkills | null> {
    const [soul] = await db.select().from(agentSouls).where(eq(agentSouls.agentId, agentId)).limit(1);
    if (!soul) return null;

    const skills = await db.select().from(agentSkills).where(eq(agentSkills.soulId, soul.id)).orderBy(desc(agentSkills.priority));
    const placements = await db.select().from(agentPlacements).where(eq(agentPlacements.soulId, soul.id)).orderBy(desc(agentPlacements.priority));

    return { ...soul, skills, placements };
  }

  async listSouls(filter?: {
    status?: string;
    archetype?: string;
    search?: string;
  }): Promise<AgentSoul[]> {
    const conditions: SQL[] = [];

    if (filter?.status) conditions.push(eq(agentSouls.status, filter.status));
    if (filter?.archetype) conditions.push(eq(agentSouls.archetype, filter.archetype));
    if (filter?.search) {
      conditions.push(
        or(
          like(agentSouls.name, `%${filter.search}%`),
          like(agentSouls.displayName, `%${filter.search}%`),
          like(agentSouls.personality, `%${filter.search}%`)
        )!
      );
    }

    const query = db.select().from(agentSouls)
      .orderBy(desc(agentSouls.level), desc(agentSouls.experiencePoints));

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return query;
  }

  async updateSoul(id: string, data: UpdateSoulData): Promise<AgentSoul | null> {
    const [soul] = await db.update(agentSouls)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentSouls.id, id))
      .returning();
    return soul || null;
  }

  async deleteSoul(id: string): Promise<boolean> {
    const [deleted] = await db.delete(agentSouls).where(eq(agentSouls.id, id)).returning();
    return !!deleted;
  }

  // ── Skills CRUD ─────────────────────────────────────────

  async createSkill(data: CreateSkillData): Promise<AgentSkill> {
    const id = uuidv4();
    const [skill] = await db.insert(agentSkills).values({
      id,
      soulId: data.soulId,
      name: data.name,
      description: data.description || '',
      category: data.category || 'general',
      proficiency: data.proficiency ?? 0.5,
      triggers: data.triggers || [],
      priority: data.priority ?? 0,
      config: data.config || {},
      source: data.source || 'custom',
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as NewAgentSkill).returning();
    return skill;
  }

  async listSkills(soulId: string): Promise<AgentSkill[]> {
    return db.select().from(agentSkills)
      .where(eq(agentSkills.soulId, soulId))
      .orderBy(desc(agentSkills.priority), desc(agentSkills.proficiency));
  }

  async updateSkill(id: string, data: Partial<CreateSkillData>): Promise<AgentSkill | null> {
    const [skill] = await db.update(agentSkills)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentSkills.id, id))
      .returning();
    return skill || null;
  }

  async deleteSkill(id: string): Promise<boolean> {
    const [deleted] = await db.delete(agentSkills).where(eq(agentSkills.id, id)).returning();
    return !!deleted;
  }

  // ── Placements CRUD ─────────────────────────────────────

  async createPlacement(data: CreatePlacementData): Promise<AgentPlacement> {
    const id = uuidv4();
    const [placement] = await db.insert(agentPlacements).values({
      id,
      soulId: data.soulId,
      channelId: data.channelId || null,
      matchPattern: data.matchPattern || '',
      matchType: data.matchType || 'keyword',
      activationMode: data.activationMode || 'passive',
      schedule: data.schedule || null,
      priority: data.priority ?? 0,
      isActive: data.isActive ?? true,
      config: data.config || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as NewAgentPlacement).returning();
    return placement;
  }

  async listPlacements(soulId: string): Promise<AgentPlacement[]> {
    return db.select().from(agentPlacements)
      .where(eq(agentPlacements.soulId, soulId))
      .orderBy(desc(agentPlacements.priority));
  }

  async updatePlacement(id: string, data: Partial<CreatePlacementData>): Promise<AgentPlacement | null> {
    const [placement] = await db.update(agentPlacements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentPlacements.id, id))
      .returning();
    return placement || null;
  }

  async deletePlacement(id: string): Promise<boolean> {
    const [deleted] = await db.delete(agentPlacements).where(eq(agentPlacements.id, id)).returning();
    return !!deleted;
  }

  // ── Soul Queries ────────────────────────────────────────

  /**
   * Find the best agent for a given task based on skills and archetype
   */
  async findBestAgent(requiredSkills: string[], archetype?: string): Promise<SoulWithSkills | null> {
    const souls = await db.select().from(agentSouls)
      .where(and(
        eq(agentSouls.status, 'active'),
        archetype ? eq(agentSouls.archetype, archetype) : undefined as any
      ))
      .orderBy(desc(agentSouls.level), desc(agentSouls.experiencePoints))
      .limit(10);

    for (const soul of souls) {
      const skills = await db.select().from(agentSkills)
        .where(eq(agentSkills.soulId, soul.id));

      const placements = await db.select().from(agentPlacements)
        .where(and(
          eq(agentPlacements.soulId, soul.id),
          eq(agentPlacements.isActive, true)
        ));

      // Score: how many required skills does this soul have?
      const soulSkillNames = skills.map(s => s.name.toLowerCase());
      const matchCount = requiredSkills.filter(rs =>
        soulSkillNames.some(sn => sn.includes(rs.toLowerCase()))
      ).length;

      if (matchCount > 0) {
        return { ...soul, skills, placements };
      }
    }

    return null;
  }

  /**
   * Get all active placements across all souls
   */
  async getActivePlacements(): Promise<Array<AgentPlacement & { soul: AgentSoul }>> {
    const results = await db.select({
      placement: agentPlacements,
      soul: agentSouls,
    })
    .from(agentPlacements)
    .innerJoin(agentSouls, eq(agentPlacements.soulId, agentSouls.id))
    .where(and(
      eq(agentPlacements.isActive, true),
      eq(agentSouls.status, 'active')
    ))
    .orderBy(desc(agentPlacements.priority));

    return results.map(r => ({ ...r.placement, soul: r.soul }));
  }

  /**
   * Award XP to a soul and handle leveling
   */
  async awardXP(soulId: string, amount: number): Promise<AgentSoul | null> {
    const soul = await this.getSoul(soulId);
    if (!soul) return null;

    const newXP = soul.experiencePoints + amount;
    const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1; // XP curve: level 2 at 100, 3 at 400, etc.
    const newInteractions = soul.interactionsCount + 1;

    const [updated] = await db.update(agentSouls)
      .set({
        experiencePoints: newXP,
        level: newLevel,
        interactionsCount: newInteractions,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSouls.id, soulId))
      .returning();

    return updated || null;
  }
}

export const soulService = new SoulService();