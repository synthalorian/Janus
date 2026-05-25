import { db } from '../db/index.js';
import { orchestrationPlans, orchestrationTasks, type OrchestrationPlan, type OrchestrationTask } from '../db/schema.js';
import { eq, and, inArray, type SQL } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { capabilityRegistry, type CapabilityRegistry } from './capability-registry.js';
import { soulService } from '../souls/service.js';
import { store } from '../db/store.js';
import { runtimeConfig } from '../config.js';
import { llmService, type LLMPlanDefinition } from '../llm/service.js';
import type { Server } from 'socket.io';

/**
 * Orchestrator Engine
 *
 * Core of Janus Swarm: receives a user goal, decomposes it into a DAG of subtasks,
 * queries the Capability Registry to find the best agents, spawns bots, and
 * executes the plan autonomously.
 */

export interface TaskDefinition {
  id: string;
  template: string;
  description: string;
  dependsOn: string[];
  requiredStrengths: string[];
  preferredHarness?: string;
  minContextWindow?: number;
}

export interface PlanDefinition {
  tasks: TaskDefinition[];
  parallelGroups: string[][]; // task IDs that can run in parallel
}

export interface OrchestrateRequest {
  goal: string;
  userId: string;
  channelId?: string; // optional target channel for results
  metadata?: Record<string, unknown>;
}

export interface ExecutionSnapshot {
  plan: OrchestrationPlan;
  tasks: OrchestrationTask[];
  readyTasks: string[];
  blockedTasks: string[];
  completedTasks: string[];
}

export class OrchestratorEngine {
  private registry: CapabilityRegistry;
  private activeExecutions: Map<string, NodeJS.Timeout> = new Map();
  private botSpawner: any = null;
  private botForge: any = null;
  private io: Server | null = null;

  constructor(registry: CapabilityRegistry = capabilityRegistry) {
    this.registry = registry;
  }

  /**
   * Provide the Socket.io Server instance so the engine can broadcast
   * real-time orchestration events to subscribed clients.
   */
  setSocketIO(io: Server): void {
    this.io = io;
  }

  /**
   * Broadcast an orchestration event to all clients subscribed to a plan.
   */
  private broadcast(
    planId: string,
    event: 'planning' | 'spawning' | 'executing' | 'task_started' | 'task_complete' | 'completed' | 'failed' | 'cancelled',
    data?: Record<string, unknown>
  ): void {
    if (!this.io) return;
    this.io.to(`plan:${planId}`).emit('orchestrate:progress', {
      planId,
      event,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /**
   * Lazy-load bot modules (they are excluded from tsconfig and loaded dynamically).
   */
  private async ensureBotsLoaded(): Promise<boolean> {
    if (!runtimeConfig.features.botsEnabled) {
      return false;
    }
    if (this.botSpawner && this.botForge) {
      return true;
    }
    try {
      const spawnerMod = await import('../bots/spawner.js');
      const serviceMod = await import('../bots/service.js');
      this.botSpawner = spawnerMod.botSpawner;
      this.botForge = serviceMod.botForge;
      return true;
    } catch (err) {
      console.warn('⚠️ Bot modules not available for orchestration:', err);
      return false;
    }
  }

  /**
   * Submit a user goal and begin autonomous execution.
   */
  async submitGoal(request: OrchestrateRequest): Promise<OrchestrationPlan> {
    // Enforce per-user plan quota (max 5 active plans)
    const activePlans = await db.select()
      .from(orchestrationPlans)
      .where(
        and(
          eq(orchestrationPlans.userId, request.userId),
          inArray(orchestrationPlans.status, ['executing', 'spawning'])
        )
      );
    if (activePlans.length >= 5) {
      throw new Error('Plan quota exceeded: you already have 5 active orchestrations. Cancel one before starting another.');
    }

    const planId = uuidv4();

    // Create plan record
    const [plan] = await db.insert(orchestrationPlans).values({
      id: planId,
      userId: request.userId,
      goal: request.goal,
      status: 'planning',
      metadata: request.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Decompose goal
    const definition = await this.decomposeGoal(request.goal);

    // Update plan with DAG
    await db.update(orchestrationPlans)
      .set({ plan: definition as any, updatedAt: new Date() })
      .where(eq(orchestrationPlans.id, planId));

    // Create task records
    for (const task of definition.tasks) {
      await db.insert(orchestrationTasks).values({
        id: task.id,
        planId,
        parentTaskIds: task.dependsOn,
        template: task.template,
        description: task.description,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create war room channel
    const warRoom = await store.createChannel({
      name: `swarm-${planId.slice(0, 8)}`,
      type: 'chat',
      description: `Autonomous swarm for: ${request.goal.slice(0, 60)}`,
      createdBy: request.userId,
      metadata: { planId, isWarRoom: true, goal: request.goal },
    });

    await db.update(orchestrationPlans)
      .set({ channelId: warRoom.id, status: 'spawning', updatedAt: new Date() })
      .where(eq(orchestrationPlans.id, planId));

    this.broadcast(planId, 'spawning', {
      channelId: warRoom.id,
      taskCount: definition.tasks.length,
      goal: request.goal,
    });

    // Spawn and execute
    this.executePlan(planId, request.userId).catch((err) => {
      console.error(`Orchestration ${planId} failed:`, err);
      this.failPlan(planId, err instanceof Error ? err.message : 'Execution failed');
    });

    this.broadcast(planId, 'planning', {
      goal: request.goal,
      channelId: warRoom.id,
      taskCount: definition.tasks.length,
    });

    return { ...plan, channelId: warRoom.id, status: 'spawning' } as OrchestrationPlan;
  }

  /**
   * Core execution loop: topological execution of the task DAG.
   */
  private async executePlan(planId: string, userId: string): Promise<void> {
    const botsAvailable = await this.ensureBotsLoaded();
    if (!botsAvailable) {
      throw new Error('Bot spawning is disabled. Set JANUS_BOTS_ENABLED=true to use orchestration.');
    }

    await db.update(orchestrationPlans)
      .set({ status: 'executing', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(orchestrationPlans.id, planId));

    const plan = await this.getPlan(planId);
    if (!plan) throw new Error('Plan not found');

    const definition = plan.plan as unknown as PlanDefinition;
    if (!definition?.tasks?.length) {
      await this.completePlan(planId, 'No tasks generated from goal.');
      return;
    }

    this.broadcast(planId, 'executing', {
      totalTasks: definition.tasks.length,
    });

    // Spawn bots and assign tasks in topological order
    const completed = new Set<string>();
    const failed = new Set<string>();

    while (completed.size + failed.size < definition.tasks.length) {
      // Find tasks whose dependencies are all completed
      const ready = definition.tasks.filter((t) => {
        if (completed.has(t.id) || failed.has(t.id)) return false;
        return t.dependsOn.every((dep) => completed.has(dep));
      });

      if (ready.length === 0) {
        // No ready tasks and not all done = deadlock (circular or missing deps)
        const remaining = definition.tasks.filter((t) => !completed.has(t.id) && !failed.has(t.id));
        if (remaining.length > 0) {
          throw new Error(`Task deadlock detected: ${remaining.map((r) => r.id).join(', ')}`);
        }
        break;
      }

      // Execute ready tasks in parallel
      await Promise.all(
        ready.map((taskDef) => this.executeTask(planId, taskDef, plan.channelId!, userId, completed, failed))
      );
    }

    // Aggregate result
    const allTasks = await db.select().from(orchestrationTasks).where(eq(orchestrationTasks.planId, planId));
    const successful = allTasks.filter((t) => t.status === 'completed');
    const failedTasks = allTasks.filter((t) => t.status === 'failed');

    const summary = `
## Swarm Execution Complete
**Goal:** ${plan.goal}
**Tasks:** ${successful.length} completed / ${failedTasks.length} failed / ${allTasks.length} total
${failedTasks.length > 0 ? '\n**Failed Tasks:** ' + failedTasks.map((t) => t.description).join('; ') : ''}
${successful.map((t) => `\n### ${t.description}\n${t.result || '(no result)'}`).join('')}
`.trim();

    if (failedTasks.length > 0 && successful.length === 0) {
      await this.failPlan(planId, summary);
    } else {
      await this.completePlan(planId, summary);
    }
  }

  /**
   * Execute a single task: find best agent, spawn bot, assign, wait for completion.
   */
  private async executeTask(
    planId: string,
    taskDef: TaskDefinition,
    channelId: string,
    userId: string,
    completed: Set<string>,
    failed: Set<string>
  ): Promise<void> {
    // Update task status
    await db.update(orchestrationTasks)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(orchestrationTasks.id, taskDef.id));

    // Find best matching capability
    const matches = await this.registry.findBestMatches({
      strengths: taskDef.requiredStrengths,
      harnessType: taskDef.preferredHarness,
      minContextWindow: taskDef.minContextWindow,
    });

    const bestMatch = matches[0];
    let botId: string | undefined;
    let botName = 'unknown';

    // Also try to find a compatible soul for richer agent matching
    let matchedSoul = null;
    try {
      matchedSoul = await soulService.findBestAgent(taskDef.requiredStrengths, taskDef.template);
    } catch { /* soul matching is best-effort */ }

    this.broadcast(planId, 'task_started', {
      taskId: taskDef.id,
      description: taskDef.description,
      botId: botId || null,
      botName,
      soulId: matchedSoul?.id || null,
    });

    if (bestMatch) {
      botName = bestMatch.capability.agentName;
      // Try to reuse an existing bot if available
      const existing = await this.botForge.getBotByName(bestMatch.capability.agentName);
      if (existing) {
        botId = existing.id;
      }
    }

    // If no existing bot, spawn one from template
    if (!botId) {
      try {
        const spawned = await this.botSpawner.spawnBot({
          template: taskDef.template,
          name: `${taskDef.template}-${planId.slice(0, 6)}`,
          description: taskDef.description,
          ownerId: userId, // bots belong to the user who initiated the plan
          ownerType: 'ai',
        });

        if (spawned.status === 'spawned' && spawned.botId) {
          botId = spawned.botId;
        }
      } catch (err) {
        console.warn(`Failed to spawn bot for task ${taskDef.id}:`, err);
      }
    }

    // Assign bot to task
    if (botId) {
      await db.update(orchestrationTasks)
        .set({ assignedBotId: botId, updatedAt: new Date() })
        .where(eq(orchestrationTasks.id, taskDef.id));

      // Post task assignment message to war room
      await store.createMessage({
        content: `🤖 **${botName}** assigned to task: *${taskDef.description}*`,
        authorId: 'system',
        authorName: 'Orchestrator',
        authorType: 'ai',
        channelId,
      });

      // Assign task via bot spawner
      let retries = 0;
      const maxRetries = 2;
      let taskSucceeded = false;
      let currentBotId = botId;

      while (!taskSucceeded && retries <= maxRetries) {
        // If the bot is no longer active (e.g. crashed), respawn a new one
        if (currentBotId && !this.botSpawner.isBotActive(currentBotId)) {
          try {
            const spawned = await this.botSpawner.spawnBot({
              template: taskDef.template,
              name: `${taskDef.template}-${planId.slice(0, 6)}-retry${retries}`,
              description: taskDef.description,
              ownerId: userId,
              ownerType: 'ai',
            });
            if (spawned.status === 'spawned' && spawned.botId) {
              currentBotId = spawned.botId;
              botName = spawned.message?.split(' ')[1] || botName;
              await db.update(orchestrationTasks)
                .set({ assignedBotId: currentBotId, updatedAt: new Date() })
                .where(eq(orchestrationTasks.id, taskDef.id));
            }
          } catch (spawnErr) {
            console.warn(`Failed to respawn bot for retry ${retries}:`, spawnErr);
          }
        }

        if (!currentBotId) {
          break;
        }

        try {
          const assignment = await this.botSpawner.assignTask(currentBotId, {
            description: taskDef.description,
            timeout: 600,
          });

          // Event-driven: wait for task completion instead of polling
          const status = await this.botSpawner.waitForTaskCompletion(
            currentBotId,
            assignment.taskId,
            300_000 // 5 minute timeout
          );

          if (status.status === 'completed') {
            await db.update(orchestrationTasks)
              .set({
                status: 'completed',
                result: status.result || 'Task completed successfully',
                retryCount: retries,
                completedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(orchestrationTasks.id, taskDef.id));

            completed.add(taskDef.id);
            taskSucceeded = true;

            // Award XP to matched soul if one was found
            if (matchedSoul) {
              soulService.awardXP(matchedSoul.id, 25).catch(() => {});
            }

            this.broadcast(planId, 'task_complete', {
              taskId: taskDef.id,
              description: taskDef.description,
              status: 'completed',
              botName,
              result: status.result || 'Task completed successfully',
              retries,
            });

            await store.createMessage({
              content: `✅ **${botName}** completed: *${taskDef.description}*\n${status.result || ''}`.slice(0, 2000),
              authorId: 'system',
              authorName: 'Orchestrator',
              authorType: 'ai',
              channelId,
            });
          } else {
            throw new Error(status.error || `Task ${status.status}`);
          }
        } catch (err) {
          retries++;
          const errorMsg = err instanceof Error ? err.message : 'Task execution error';

          if (retries <= maxRetries) {
            // Exponential backoff: 2s, 4s
            const backoff = retries * 2000;
            await store.createMessage({
              content: `⚠️ **${botName}** failed on: *${taskDef.description}* (attempt ${retries}/${maxRetries + 1})\nRetrying in ${backoff}ms...\n${errorMsg}`,
              authorId: 'system',
              authorName: 'Orchestrator',
              authorType: 'ai',
              channelId,
            });
            await new Promise((r) => setTimeout(r, backoff));

            // Reset task status for retry
            await db.update(orchestrationTasks)
              .set({ status: 'pending', retryCount: retries, updatedAt: new Date() })
              .where(eq(orchestrationTasks.id, taskDef.id));
          } else {
            await db.update(orchestrationTasks)
              .set({
                status: 'failed',
                error: errorMsg,
                retryCount: retries,
                completedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(orchestrationTasks.id, taskDef.id));

            failed.add(taskDef.id);

            this.broadcast(planId, 'task_complete', {
              taskId: taskDef.id,
              description: taskDef.description,
              status: 'failed',
              botName,
              error: errorMsg,
              retries,
            });

            await store.createMessage({
              content: `❌ **${botName}** permanently failed on: *${taskDef.description}* after ${maxRetries + 1} attempts\n${errorMsg}`,
              authorId: 'system',
              authorName: 'Orchestrator',
              authorType: 'ai',
              channelId,
            });
          }
        }      }

      if (!taskSucceeded && !failed.has(taskDef.id)) {
        await db.update(orchestrationTasks)
          .set({ status: 'failed', error: 'Bot unavailable during retry', updatedAt: new Date() })
          .where(eq(orchestrationTasks.id, taskDef.id));
        failed.add(taskDef.id);
      }
    } else {
      // No bot available
      await db.update(orchestrationTasks)
        .set({ status: 'failed', error: 'No suitable agent available', updatedAt: new Date() })
        .where(eq(orchestrationTasks.id, taskDef.id));
      failed.add(taskDef.id);
    }
  }

  /**
   * Decompose a natural language goal into a task DAG.
   * First tries LLM decomposition; falls back to keyword heuristics.
   */
  private async decomposeGoal(goal: string): Promise<PlanDefinition> {
    // Attempt LLM-powered decomposition
    const llmPlan = await llmService.decomposeGoal(goal);
    if (llmPlan) {
      return this.normalizeLLMPlan(llmPlan, goal);
    }

    // Fallback: keyword-based heuristics
    const g = goal.toLowerCase();
    const tasks: TaskDefinition[] = [];

    // Detect common goal patterns
    const needsResearch = /research|investigate|find|look up|search|gather info/i.test(g);
    const needsCode = /build|create|implement|write code|develop|app|website|api|script/i.test(g);
    const needsAnalysis = /analyze|evaluate|compare|assess|report|metrics|data/i.test(g);
    const needsReview = /review|check|validate|test|audit/i.test(g);
    const needsDesign = /design|ui|ux|layout|mockup|wireframe|prototype/i.test(g);
    const needsDeploy = /deploy|publish|release|ship|launch/i.test(g);
    const needsDocs = /document|readme|docs|guide|tutorial/i.test(g);

    let taskIndex = 0;
    const makeId = () => `task-${++taskIndex}`;

    const researchTaskId = needsResearch ? makeId() : undefined;
    const designTaskId = needsDesign ? makeId() : undefined;
    const codeTaskId = needsCode ? makeId() : undefined;
    const analysisTaskId = needsAnalysis ? makeId() : undefined;
    const reviewTaskId = needsReview ? makeId() : undefined;
    const deployTaskId = needsDeploy ? makeId() : undefined;
    const docsTaskId = needsDocs ? makeId() : undefined;

    if (researchTaskId) {
      tasks.push({
        id: researchTaskId,
        template: 'researcher',
        description: `Research and gather information for: ${goal}`,
        dependsOn: [],
        requiredStrengths: ['research', 'web_search', 'summarization'],
      });
    }

    if (designTaskId) {
      tasks.push({
        id: designTaskId,
        template: 'custom',
        description: `Design architecture and plan for: ${goal}`,
        dependsOn: researchTaskId ? [researchTaskId] : [],
        requiredStrengths: ['design', 'architecture', 'planning'],
      });
    }

    if (codeTaskId) {
      tasks.push({
        id: codeTaskId,
        template: 'coder',
        description: `Write code and implement: ${goal}`,
        dependsOn: [
          ...(researchTaskId ? [researchTaskId] : []),
          ...(designTaskId ? [designTaskId] : []),
        ],
        requiredStrengths: ['coding', 'code_generation', 'debugging'],
      });
    }

    if (analysisTaskId) {
      tasks.push({
        id: analysisTaskId,
        template: 'analyst',
        description: `Analyze results and generate insights for: ${goal}`,
        dependsOn: [
          ...(researchTaskId ? [researchTaskId] : []),
          ...(codeTaskId ? [codeTaskId] : []),
        ],
        requiredStrengths: ['analysis', 'data_analysis', 'report_generation'],
      });
    }

    if (reviewTaskId) {
      tasks.push({
        id: reviewTaskId,
        template: 'custom',
        description: `Review and validate deliverables for: ${goal}`,
        dependsOn: [
          ...(codeTaskId ? [codeTaskId] : []),
          ...(analysisTaskId ? [analysisTaskId] : []),
        ],
        requiredStrengths: ['review', 'validation', 'testing'],
      });
    }

    if (docsTaskId) {
      tasks.push({
        id: docsTaskId,
        template: 'custom',
        description: `Write documentation for: ${goal}`,
        dependsOn: [
          ...(codeTaskId ? [codeTaskId] : []),
          ...(reviewTaskId ? [reviewTaskId] : []),
        ],
        requiredStrengths: ['documentation', 'technical_writing'],
      });
    }

    if (deployTaskId) {
      tasks.push({
        id: deployTaskId,
        template: 'custom',
        description: `Deploy and ship: ${goal}`,
        dependsOn: [
          ...(codeTaskId ? [codeTaskId] : []),
          ...(reviewTaskId ? [reviewTaskId] : []),
        ],
        requiredStrengths: ['deployment', 'devops'],
      });
    }

    // Fallback: if no pattern matched, create a single coordinator task
    if (tasks.length === 0) {
      tasks.push({
        id: makeId(),
        template: 'coordinator',
        description: goal,
        dependsOn: [],
        requiredStrengths: ['coordination', 'task_delegation'],
      });
    }

    return this.buildPlanFromTasks(tasks);
  }

  /**
   * Normalize an LLM-generated plan into the internal PlanDefinition.
   */
  private normalizeLLMPlan(llmPlan: LLMPlanDefinition, goal: string): PlanDefinition {
    // Ensure task ids are stable and map to internal format
    const tasks: TaskDefinition[] = llmPlan.tasks.map((t) => ({
      id: t.id,
      template: t.template,
      description: t.description,
      dependsOn: t.dependsOn,
      requiredStrengths: t.requiredStrengths,
      preferredHarness: t.preferredHarness,
      minContextWindow: t.minContextWindow,
    }));

    return this.buildPlanFromTasks(tasks);
  }

  /**
   * Build parallel groups from a list of tasks with dependencies.
   */
  private buildPlanFromTasks(tasks: TaskDefinition[]): PlanDefinition {
    // Build parallel groups (simple topological layers)
    const parallelGroups: string[][] = [];
    const assigned = new Set<string>();

    while (assigned.size < tasks.length) {
      const layer = tasks.filter((t) => {
        if (assigned.has(t.id)) return false;
        return t.dependsOn.every((dep) => assigned.has(dep));
      });
      if (layer.length === 0) break; // deadlock safeguard
      parallelGroups.push(layer.map((t) => t.id));
      layer.forEach((t) => assigned.add(t.id));
    }

    return { tasks, parallelGroups };
  }

  /**
   * Get current execution snapshot.
   */
  async getSnapshot(planId: string): Promise<ExecutionSnapshot | null> {
    const plan = await this.getPlan(planId);
    if (!plan) return null;

    const tasks = await db.select().from(orchestrationTasks).where(eq(orchestrationTasks.planId, planId));
    const ready = tasks.filter((t) => {
      if (t.status !== 'pending') return false;
      const deps = t.parentTaskIds || [];
      return deps.every((depId) => tasks.some((task) => task.id === depId && task.status === 'completed'));
    });
    const blocked = tasks.filter((t) => {
      if (t.status !== 'pending') return false;
      return !ready.some((r) => r.id === t.id);
    });
    const done = tasks.filter((t) => t.status === 'completed');

    return {
      plan,
      tasks,
      readyTasks: ready.map((t) => t.id),
      blockedTasks: blocked.map((t) => t.id),
      completedTasks: done.map((t) => t.id),
    };
  }

  async getPlan(id: string): Promise<OrchestrationPlan | undefined> {
    const [plan] = await db.select().from(orchestrationPlans).where(eq(orchestrationPlans.id, id));
    return plan;
  }

  async getPlanTasks(planId: string): Promise<OrchestrationTask[]> {
    return db.select().from(orchestrationTasks).where(eq(orchestrationTasks.planId, planId));
  }

  async cancelPlan(planId: string): Promise<void> {
    await db.update(orchestrationPlans)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(orchestrationPlans.id, planId));

    await db.update(orchestrationTasks)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(orchestrationTasks.planId, planId), eq(orchestrationTasks.status, 'pending')));

    this.broadcast(planId, 'cancelled');

    // Stop execution loop
    const timer = this.activeExecutions.get(planId);
    if (timer) {
      clearTimeout(timer);
      this.activeExecutions.delete(planId);
    }
  }

  private async completePlan(planId: string, result: string): Promise<void> {
    await db.update(orchestrationPlans)
      .set({ status: 'completed', result, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(orchestrationPlans.id, planId));

    this.broadcast(planId, 'completed', { result });
    await this.cleanupWarRoom(planId);
  }

  private async failPlan(planId: string, error: string): Promise<void> {
    await db.update(orchestrationPlans)
      .set({ status: 'failed', result: error, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(orchestrationPlans.id, planId));

    this.broadcast(planId, 'failed', { error });
    await this.cleanupWarRoom(planId);
  }

  private async cleanupWarRoom(planId: string): Promise<void> {
    try {
      const plan = await this.getPlan(planId);
      if (plan?.channelId) {
        await store.deleteChannel(plan.channelId);
        console.log(`🧹 Cleaned up war room channel ${plan.channelId} for plan ${planId}`);
      }
    } catch (err) {
      console.warn(`⚠️ Failed to clean up war room for plan ${planId}:`, err);
    }
  }

  /**
   * List all plans for a user.
   */
  async listPlans(userId?: string, limit = 50): Promise<OrchestrationPlan[]> {
    const conditions: SQL[] = [];
    if (userId) {
      conditions.push(eq(orchestrationPlans.userId, userId));
    }
    return db.select()
      .from(orchestrationPlans)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orchestrationPlans.createdAt)
      .limit(limit);
  }
}

export const orchestratorEngine = new OrchestratorEngine();
