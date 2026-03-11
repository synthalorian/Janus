import { Router, Request, Response } from 'express';
import { oversightManager } from '../index.js';
import { APIResponse } from '../types/index.js';

export const oversightRouter = Router();

// ==================== Risk Assessment ====================

oversightRouter.post('/assess', async (req: Request, res: Response) => {
  const { actionType, agentId, payload } = req.body;
  
  if (!actionType || !agentId) {
    res.status(400).json<APIResponse>({ 
      success: false, 
      error: 'actionType and agentId required' 
    });
    return;
  }
  
  const risk = oversightManager.assessRisk(actionType, agentId, payload || {});
  
  res.json<APIResponse>({
    success: true,
    data: {
      riskScore: risk.score,
      factors: risk.factors,
      oversightLevel: risk.level(),
      autoEscalate: risk.autoEscalate
    }
  });
});

// ==================== Action Submission ====================

oversightRouter.post('/submit', async (req: Request, res: Response) => {
  const { agentId, agentName, actionType, description, payload } = req.body;
  
  if (!agentId || !actionType || !description) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Missing required fields'
    });
    return;
  }
  
  const action = oversightManager.submitAction(
    agentId,
    agentName || agentId,
    actionType,
    description,
    payload || {}
  );
  
  res.status(201).json<APIResponse>({
    success: true,
    data: {
      actionId: action.id,
      status: action.status,
      oversightLevel: action.oversightLevel,
      riskScore: action.risk.score,
      requiresReview: action.oversightLevel !== 'none'
    }
  });
});

// ==================== Reviews ====================

oversightRouter.post('/review', async (req: Request, res: Response) => {
  const {
    actionId,
    reviewerId,
    reviewerName,
    decision,
    reasoning,
    confidence,
    suggestedChanges
  } = req.body;
  
  if (!actionId || !reviewerId || !decision || !reasoning) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Missing required fields'
    });
    return;
  }
  
  // Validate decision
  const validDecisions = ['approve', 'reject', 'challenge', 'escalate'];
  if (!validDecisions.includes(decision)) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Invalid decision. Must be: approve, reject, challenge, or escalate'
    });
    return;
  }
  
  const review = oversightManager.submitReview(
    actionId,
    reviewerId,
    reviewerName || reviewerId,
    decision,
    reasoning,
    confidence || 1.0,
    suggestedChanges
  );
  
  // Get updated action status
  const action = oversightManager.getActionStatus(actionId);
  
  res.json<APIResponse>({
    success: true,
    data: {
      reviewId: review.id,
      actionStatus: action?.status,
      approvals: action?.approvals.length || 0,
      rejections: action?.rejections.length || 0
    }
  });
});

// ==================== Challenges ====================

oversightRouter.post('/challenge', async (req: Request, res: Response) => {
  const { actionId, challengerId, challengerName, reasoning } = req.body;
  
  if (!actionId || !challengerId || !reasoning) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Missing required fields'
    });
    return;
  }
  
  const review = oversightManager.challengeAction(
    actionId,
    challengerId,
    challengerName || challengerId,
    reasoning
  );
  
  if (!review) {
    res.status(404).json<APIResponse>({
      success: false,
      error: 'Action not found or cannot be challenged'
    });
    return;
  }
  
  res.json<APIResponse>({
    success: true,
    data: {
      challengeId: review.id,
      actionId,
      status: 'challenged',
      message: 'Action escalated to emergency review'
    }
  });
});

// ==================== Queries ====================

oversightRouter.get('/actions/:id', async (req: Request, res: Response) => {
  const action = oversightManager.getActionStatus(req.params.id);
  
  if (!action) {
    res.status(404).json<APIResponse>({
      success: false,
      error: 'Action not found'
    });
    return;
  }
  
  const reviews = oversightManager.getReviewsForAction(req.params.id);
  
  res.json<APIResponse>({
    success: true,
    data: {
      ...action,
      reviews
    }
  });
});

oversightRouter.get('/actions/:id/reviews', async (req: Request, res: Response) => {
  const reviews = oversightManager.getReviewsForAction(req.params.id);
  
  res.json<APIResponse>({
    success: true,
    data: reviews
  });
});

oversightRouter.get('/pending', async (req: Request, res: Response) => {
  const { agentId, reviewerId } = req.query;
  
  let actions;
  if (agentId) {
    actions = oversightManager.getPendingActionsForAgent(agentId as string);
  } else if (reviewerId) {
    actions = oversightManager.getActionsRequiringReview(reviewerId as string);
  } else {
    // Return all pending actions
    actions = Object.values(oversightManager.pendingActions).filter(
      a => a.status === 'pending'
    );
  }
  
  res.json<APIResponse>({
    success: true,
    data: actions,
    count: actions.length
  });
});

// ==================== Audit Trail ====================

oversightRouter.get('/audit/:agentId', async (req: Request, res: Response) => {
  const trail = oversightManager.getAuditTrail(req.params.agentId);
  const stats = oversightManager.getDecisionStats(req.params.agentId);
  
  res.json<APIResponse>({
    success: true,
    data: {
      trail,
      stats
    }
  });
});

oversightRouter.get('/audit', async (req: Request, res: Response) => {
  const trail = oversightManager.getAuditTrail();
  
  res.json<APIResponse>({
    success: true,
    data: trail,
    count: trail.length
  });
});

// ==================== Board Management ====================

oversightRouter.get('/board', async (_req: Request, res: Response) => {
  const board = oversightManager.boards.get('default');
  
  if (!board) {
    res.status(404).json<APIResponse>({
      success: false,
      error: 'No oversight board configured'
    });
    return;
  }
  
  res.json<APIResponse>({
    success: true,
    data: board
  });
});

// ==================== Stats ====================

oversightRouter.get('/stats', async (_req: Request, res: Response) => {
  const actions = Object.values(oversightManager.pendingActions);
  
  const stats = {
    total: actions.length,
    pending: actions.filter(a => a.status === 'pending').length,
    approved: actions.filter(a => a.status === 'approved').length,
    rejected: actions.filter(a => a.status === 'rejected').length,
    challenged: actions.filter(a => a.status === 'challenged').length,
    escalated: actions.filter(a => a.status === 'escalated').length,
    
    byRiskLevel: {
      none: actions.filter(a => a.oversightLevel === 'none').length,
      peer: actions.filter(a => a.oversightLevel === 'peer').length,
      committee: actions.filter(a => a.oversightLevel === 'committee').length,
      human: actions.filter(a => a.oversightLevel === 'human').length,
      emergency: actions.filter(a => a.oversightLevel === 'emergency').length,
    },
    
    averageRiskScore: actions.length > 0 
      ? actions.reduce((sum, a) => sum + a.risk.score, 0) / actions.length 
      : 0
  };
  
  res.json<APIResponse>({
    success: true,
    data: stats
  });
});
