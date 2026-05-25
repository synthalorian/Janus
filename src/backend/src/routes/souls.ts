import { Router, Request, Response } from 'express';
import { soulService } from '../souls/service.js';
import { requireAuth } from '../auth/middleware.js';

function paramStr(p: unknown): string {
  return Array.isArray(p) ? p[0] : String(p || '');
}

export const soulRouter = Router();

// ═══════════════════════════════════════════════════════════════
// Souls
// ═══════════════════════════════════════════════════════════════

// List all souls
soulRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, archetype, search } = req.query;
    const souls = await soulService.listSouls({
      status: status as string | undefined,
      archetype: archetype as string | undefined,
      search: search as string | undefined,
    });
    res.json({ success: true, data: souls });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a soul
soulRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const soul = await soulService.createSoul(req.body);
    res.status(201).json({ success: true, data: soul });
  } catch (err: any) {
    console.error('[souls] create error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Soul already exists for this agent' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get a soul by ID
soulRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const soul = await soulService.getSoul(paramStr(req.params.id));
    if (!soul) return res.status(404).json({ success: false, error: 'Soul not found' });
    res.json({ success: true, data: soul });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get soul by agent ID
soulRouter.get('/by-agent/:agentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const soul = await soulService.getSoulByAgentId(paramStr(req.params.agentId));
    if (!soul) return res.status(404).json({ success: false, error: 'Soul not found for this agent' });
    res.json({ success: true, data: soul });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a soul
soulRouter.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const soul = await soulService.updateSoul(paramStr(req.params.id), req.body);
    if (!soul) return res.status(404).json({ success: false, error: 'Soul not found' });
    res.json({ success: true, data: soul });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a soul
soulRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await soulService.deleteSoul(paramStr(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, error: 'Soul not found' });
    res.json({ success: true, data: { message: 'Soul deleted' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// Skills (nested under souls)
// ═══════════════════════════════════════════════════════════════

// List skills for a soul
soulRouter.get('/:soulId/skills', requireAuth, async (req: Request, res: Response) => {
  try {
    const skills = await soulService.listSkills(paramStr(req.params.soulId));
    res.json({ success: true, data: skills });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a skill
soulRouter.post('/:soulId/skills', requireAuth, async (req: Request, res: Response) => {
  try {
    const skill = await soulService.createSkill({ ...req.body, soulId: paramStr(req.params.soulId) });
    res.status(201).json({ success: true, data: skill });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a skill
soulRouter.patch('/:soulId/skills/:skillId', requireAuth, async (req: Request, res: Response) => {
  try {
    const skill = await soulService.updateSkill(paramStr(req.params.skillId), req.body);
    if (!skill) return res.status(404).json({ success: false, error: 'Skill not found' });
    res.json({ success: true, data: skill });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a skill
soulRouter.delete('/:soulId/skills/:skillId', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await soulService.deleteSkill(paramStr(req.params.skillId));
    if (!deleted) return res.status(404).json({ success: false, error: 'Skill not found' });
    res.json({ success: true, data: { message: 'Skill deleted' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// Placements (nested under souls)
// ═══════════════════════════════════════════════════════════════

// List placements for a soul
soulRouter.get('/:soulId/placements', requireAuth, async (req: Request, res: Response) => {
  try {
    const placements = await soulService.listPlacements(paramStr(req.params.soulId));
    res.json({ success: true, data: placements });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a placement
soulRouter.post('/:soulId/placements', requireAuth, async (req: Request, res: Response) => {
  try {
    const placement = await soulService.createPlacement({ ...req.body, soulId: paramStr(req.params.soulId) });
    res.status(201).json({ success: true, data: placement });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a placement
soulRouter.patch('/:soulId/placements/:placementId', requireAuth, async (req: Request, res: Response) => {
  try {
    const placement = await soulService.updatePlacement(paramStr(req.params.placementId), req.body);
    if (!placement) return res.status(404).json({ success: false, error: 'Placement not found' });
    res.json({ success: true, data: placement });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a placement
soulRouter.delete('/:soulId/placements/:placementId', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await soulService.deletePlacement(paramStr(req.params.placementId));
    if (!deleted) return res.status(404).json({ success: false, error: 'Placement not found' });
    res.json({ success: true, data: { message: 'Placement deleted' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// Soul Queries
// ═══════════════════════════════════════════════════════════════

// Find best agent for a task
soulRouter.post('/find-agent', requireAuth, async (req: Request, res: Response) => {
  try {
    const { requiredSkills, archetype } = req.body;
    const soul = await soulService.findBestAgent(requiredSkills || [], archetype);
    res.json({ success: true, data: soul });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get active placements across all souls
soulRouter.get('/placements/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const placements = await soulService.getActivePlacements();
    res.json({ success: true, data: placements });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Award XP to a soul
soulRouter.post('/:id/xp', requireAuth, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const soul = await soulService.awardXP(paramStr(req.params.id), amount || 10);
    if (!soul) return res.status(404).json({ success: false, error: 'Soul not found' });
    res.json({ success: true, data: soul });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});