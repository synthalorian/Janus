import { Router, Request, Response } from 'express';
import { orchestratorEngine } from '../orchestration/engine.js';
import { capabilityRegistry } from '../orchestration/capability-registry.js';
import { requireAuth, optionalAuth, rateLimit } from '../auth/middleware.js';
import type { APIResponse } from '../types/index.js';
import { z } from 'zod';

export const orchestrationRouter = Router();

function queryString(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}

function paramString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return '';
}

// ==================== Orchestration ====================

/**
 * POST /api/orchestrate
 * Submit a goal for autonomous swarm execution.
 */
orchestrationRouter.post('/', requireAuth, rateLimit(10), async (req: Request, res: Response) => {
  const { goal, channelId, metadata } = req.body;

  if (!goal || typeof goal !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Goal is required and must be a string',
    } as APIResponse);
    return;
  }

  try {
    const plan = await orchestratorEngine.submitGoal({
      goal,
      userId: req.user!.id,
      channelId,
      metadata,
    });

    res.status(202).json({
      success: true,
      data: {
        planId: plan.id,
        status: plan.status,
        goal: plan.goal,
        channelId: plan.channelId,
        message: 'Swarm execution started. Monitor status via GET /api/orchestrate/:id/status',
      },
    } as APIResponse);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Orchestration failed';
    res.status(500).json({
      success: false,
      error: msg,
    } as APIResponse);
  }
});

/**
 * GET /api/orchestrate
 * List orchestration plans.
 */
orchestrationRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const plans = await orchestratorEngine.listPlans(req.user!.id, 50);
    res.json({
      success: true,
      data: plans,
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list plans',
    } as APIResponse);
  }
});

/**
 * GET /api/orchestrate/:id
 * Get plan details.
 */
orchestrationRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = paramString(req.params.id);
  try {
    const plan = await orchestratorEngine.getPlan(id);
    if (!plan) {
      res.status(404).json({
        success: false,
        error: 'Plan not found',
      } as APIResponse);
      return;
    }

    const tasks = await orchestratorEngine.getPlanTasks(id);

    res.json({
      success: true,
      data: { plan, tasks },
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get plan',
    } as APIResponse);
  }
});

/**
 * GET /api/orchestrate/:id/status
 * Get execution snapshot.
 */
orchestrationRouter.get('/:id/status', requireAuth, async (req: Request, res: Response) => {
  const id = paramString(req.params.id);
  try {
    const snapshot = await orchestratorEngine.getSnapshot(id);
    if (!snapshot) {
      res.status(404).json({
        success: false,
        error: 'Plan not found',
      } as APIResponse);
      return;
    }

    res.json({
      success: true,
      data: snapshot,
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
    } as APIResponse);
  }
});

/**
 * POST /api/orchestrate/:id/cancel
 * Cancel an active orchestration.
 */
orchestrationRouter.post('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const id = paramString(req.params.id);
  try {
    await orchestratorEngine.cancelPlan(id);
    res.json({
      success: true,
      data: { message: 'Orchestration cancelled' },
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to cancel plan',
    } as APIResponse);
  }
});

// ==================== Capability Registry ====================

/**
 * GET /api/orchestrate/capabilities
 * List/search agent capabilities.
 */
orchestrationRouter.get('/capabilities', requireAuth, async (req: Request, res: Response) => {
  const q = queryString(req.query.q);
  const harnessType = queryString(req.query.harnessType);
  const modelName = queryString(req.query.modelName);
  const provider = queryString(req.query.provider);
  const status = queryString(req.query.status);
  const limit = queryString(req.query.limit);

  try {
    let results;

    if (q) {
      results = await capabilityRegistry.search(q, parseInt(limit || '20', 10));
    } else {
      results = await capabilityRegistry.list({
        harnessType,
        modelName,
        provider,
        status,
        limit: parseInt(limit || '50', 10),
      });
    }

    res.json({
      success: true,
      data: results,
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list capabilities',
    } as APIResponse);
  }
});

/**
 * POST /api/orchestrate/capabilities
 * Register a new agent capability.
 */
orchestrationRouter.post('/capabilities', requireAuth, async (req: Request, res: Response) => {
  const {
    agentId,
    agentName,
    modelName,
    provider,
    contextWindow,
    strengths,
    harnessType,
    costPer1kTokens,
    status,
    metadata,
  } = req.body;

  if (!agentId || !modelName || !provider || !harnessType) {
    res.status(400).json({
      success: false,
      error: 'agentId, modelName, provider, and harnessType are required',
    } as APIResponse);
    return;
  }

  try {
    const cap = await capabilityRegistry.register({
      agentId,
      agentName: agentName || agentId,
      modelName,
      provider,
      contextWindow,
      strengths,
      harnessType,
      costPer1kTokens,
      status,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: cap,
    } as APIResponse);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Registration failed';
    res.status(500).json({
      success: false,
      error: msg,
    } as APIResponse);
  }
});

/**
 * GET /api/orchestrate/capabilities/:id
 * Get a specific capability.
 */
orchestrationRouter.get('/capabilities/:id', optionalAuth, async (req: Request, res: Response) => {
  const id = paramString(req.params.id);
  try {
    const cap = await capabilityRegistry.get(id);
    if (!cap) {
      res.status(404).json({
        success: false,
        error: 'Capability not found',
      } as APIResponse);
      return;
    }

    res.json({
      success: true,
      data: cap,
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get capability',
    } as APIResponse);
  }
});

/**
 * PATCH /api/orchestrate/capabilities/:id
 * Update a capability (heartbeat, status change, etc.).
 */
orchestrationRouter.patch('/capabilities/:id', requireAuth, async (req: Request, res: Response) => {
  const id = paramString(req.params.id);

  const updateSchema = z.object({
    modelName: z.string().optional(),
    provider: z.string().optional(),
    contextWindow: z.number().optional(),
    strengths: z.array(z.string()).optional(),
    harnessType: z.string().optional(),
    costPer1kTokens: z.number().optional(),
    status: z.enum(['online', 'offline', 'busy']).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid update payload',
    } as APIResponse);
    return;
  }

  try {
    const cap = await capabilityRegistry.update(id, parsed.data);
    if (!cap) {
      res.status(404).json({
        success: false,
        error: 'Capability not found',
      } as APIResponse);
      return;
    }

    res.json({
      success: true,
      data: cap,
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update capability',
    } as APIResponse);
  }
});

/**
 * POST /api/orchestrate/capabilities/:id/heartbeat
 * Record a heartbeat for an agent.
 */
orchestrationRouter.post('/capabilities/:id/heartbeat', requireAuth, async (req: Request, res: Response) => {
  const id = paramString(req.params.id);
  try {
    const cap = await capabilityRegistry.get(id);
    if (!cap) {
      res.status(404).json({
        success: false,
        error: 'Capability not found',
      } as APIResponse);
      return;
    }

    await capabilityRegistry.heartbeat(cap.agentId);

    res.json({
      success: true,
      data: { message: 'Heartbeat recorded' },
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to record heartbeat',
    } as APIResponse);
  }
});

/**
 * DELETE /api/orchestrate/capabilities/:id
 * Deregister a capability.
 */
orchestrationRouter.delete('/capabilities/:id', requireAuth, async (req: Request, res: Response) => {
  const id = paramString(req.params.id);
  try {
    const deleted = await capabilityRegistry.deregister(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Capability not found',
      } as APIResponse);
      return;
    }

    res.json({
      success: true,
      data: { message: 'Capability deregistered' },
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to deregister',
    } as APIResponse);
  }
});

/**
 * POST /api/orchestrate/capabilities/match
 * Find best matching capabilities for a task.
 */
orchestrationRouter.post('/capabilities/match', optionalAuth, async (req: Request, res: Response) => {
  const { strengths, harnessType, minContextWindow, limit } = req.body;

  try {
    const matches = await capabilityRegistry.findBestMatches({
      strengths,
      harnessType,
      minContextWindow,
      limit: limit || 10,
    });

    res.json({
      success: true,
      data: matches,
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to find matches',
    } as APIResponse);
  }
});
