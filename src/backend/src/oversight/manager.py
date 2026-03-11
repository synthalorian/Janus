"""
AI-to-AI Oversight System for Janus

Provides governance, review, and accountability mechanisms for AI agents.

Key Concepts:
- Oversight Board: Senior AIs review junior AI actions
- Challenge System: AIs can flag/appeal decisions
- Audit Trail: Complete history of AI decisions and reviews
- Consensus: Multiple AIs vote on critical decisions
- Escalation: Auto-escalate based on risk/confidence
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime


class OversightLevel(str, Enum):
    """Level of oversight required for an action."""
    NONE = "none"           # No oversight needed
    PEER_REVIEW = "peer"    # One peer review required
    COMMITTEE = "committee" # Multiple AI review (3+)
    HUMAN = "human"         # Human approval required
    EMERGENCY = "emergency" # Immediate halt, human intervention


class ActionType(str, Enum):
    """Types of actions that can be overseen."""
    CODE_CHANGE = "code_change"
    DEPLOYMENT = "deployment"
    CONFIG_CHANGE = "config_change"
    DECISION = "decision"
    MESSAGE = "message"
    SUBAGENT_SPAWN = "subagent_spawn"
    TOOL_USE = "tool_use"
    FILE_DELETE = "file_delete"
    EXTERNAL_API = "external_api"


class ReviewStatus(str, Enum):
    """Status of an oversight review."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHALLENGED = "challenged"
    ESCALATED = "escalated"
    EXPIRED = "expired"


@dataclass
class RiskAssessment:
    """Risk assessment for an AI action."""
    score: float  # 0.0 to 1.0
    factors: List[str] = field(default_factory=list)
    confidence: float = 1.0
    auto_escalate: bool = False
    
    def level(self) -> OversightLevel:
        """Determine oversight level from risk score."""
        if self.score >= 0.9:
            return OversightLevel.EMERGENCY
        elif self.score >= 0.7:
            return OversightLevel.HUMAN
        elif self.score >= 0.4:
            return OversightLevel.COMMITTEE
        elif self.score >= 0.2:
            return OversightLevel.PEER_REVIEW
        return OversightLevel.NONE


@dataclass
class AIAction:
    """Represents an action taken by an AI agent."""
    id: str
    agent_id: str
    agent_name: str
    action_type: ActionType
    description: str
    payload: Dict[str, Any] = field(default_factory=dict)
    risk: RiskAssessment = field(default_factory=lambda: RiskAssessment(score=0.0))
    oversight_level: OversightLevel = OversightLevel.NONE
    status: ReviewStatus = ReviewStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    
    # Review tracking
    reviewers: List[str] = field(default_factory=list)
    approvals: List[str] = field(default_factory=list)
    rejections: List[str] = field(default_factory=list)
    challenges: List[str] = field(default_factory=list)
    
    # Outcome
    executed_at: Optional[datetime] = None
    executed_by: Optional[str] = None
    execution_result: Optional[str] = None


@dataclass
class OversightReview:
    """A review of an AI action by another AI."""
    id: str
    action_id: str
    reviewer_id: str
    reviewer_name: str
    
    # Review content
    decision: str  # "approve", "reject", "challenge", "escalate"
    reasoning: str
    confidence: float  # 0.0 to 1.0
    
    # Optional: suggested modifications
    suggested_changes: Optional[str] = None
    alternative_approach: Optional[str] = None
    
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class OversightBoard:
    """A board of AIs responsible for oversight."""
    id: str
    name: str
    description: str
    
    # Board members
    senior_agents: List[str] = field(default_factory=list)  # Can approve anything
    peer_reviewers: List[str] = field(default_factory=list)  # Can do peer review
    specialists: Dict[str, List[str]] = field(default_factory=dict)  # Domain experts
    
    # Governance rules
    quorum_required: int = 2  # Minimum reviewers for committee decisions
    approval_threshold: float = 0.67  # % required for approval (2/3)
    challenge_threshold: float = 0.33  # % that triggers challenge
    
    # Specializations
    def get_specialists_for(self, action_type: ActionType) -> List[str]:
        """Get domain specialists for an action type."""
        return self.specialists.get(action_type.value, [])


class AIOversightManager:
    """
    Manages AI-to-AI oversight within Janus.
    
    Responsibilities:
    1. Assess risk of AI actions
    2. Route actions to appropriate oversight level
    3. Track reviews and decisions
    4. Enforce governance rules
    5. Maintain audit trails
    """
    
    def __init__(self, store=None):
        self.store = store
        self.boards: Dict[str, OversightBoard] = {}
        self.pending_actions: Dict[str, AIAction] = {}
        self.reviews: Dict[str, List[OversightReview]] = {}
        
    # ==================== Risk Assessment ====================
    
    def assess_risk(
        self,
        action_type: ActionType,
        agent_id: str,
        payload: Dict[str, Any]
    ) -> RiskAssessment:
        """
        Assess risk of an AI action.
        
        Factors considered:
        - Action type (deployment > message)
        - Scope (production > dev)
        - Reversibility (easy vs hard to undo)
        - Blast radius (affects many systems?)
        - Agent trust level
        """
        score = 0.0
        factors = []
        
        # Base risk by action type
        base_risks = {
            ActionType.FILE_DELETE: 0.6,
            ActionType.DEPLOYMENT: 0.8,
            ActionType.CONFIG_CHANGE: 0.5,
            ActionType.EXTERNAL_API: 0.4,
            ActionType.CODE_CHANGE: 0.3,
            ActionType.DECISION: 0.2,
            ActionType.MESSAGE: 0.0,
        }
        score = base_risks.get(action_type, 0.3)
        factors.append(f"action_type:{action_type.value}")
        
        # Check payload for risk indicators
        payload_str = str(payload).lower()
        
        # Production deployment?
        if "prod" in payload_str or "production" in payload_str:
            score += 0.2
            factors.append("production_environment")
        
        # Deletion operations?
        if "delete" in payload_str or "remove" in payload_str:
            score += 0.2
            factors.append("deletion_operation")
        
        # Irreversible?
        if any(word in payload_str for word in ["irreversible", "permanent", "wipe"]):
            score += 0.3
            factors.append("irreversible_operation")
        
        # External system?
        if action_type == ActionType.EXTERNAL_API:
            score += 0.1
            factors.append("external_system")
        
        # Check agent trust (would query store in real implementation)
        # For now, assume new agents need more oversight
        if "new" in agent_id.lower() or "temp" in agent_id.lower():
            score += 0.1
            factors.append("low_trust_agent")
        
        # Cap at 1.0
        score = min(score, 1.0)
        
        # Auto-escalate high-risk
        auto_escalate = score >= 0.7
        
        return RiskAssessment(
            score=score,
            factors=factors,
            auto_escalate=auto_escalate
        )
    
    # ==================== Action Submission ====================
    
    def submit_action(
        self,
        agent_id: str,
        agent_name: str,
        action_type: ActionType,
        description: str,
        payload: Dict[str, Any]
    ) -> AIAction:
        """
        Submit an AI action for potential oversight.
        
        Returns:
            AIAction with oversight requirements
        """
        import uuid
        
        action_id = str(uuid.uuid4())
        
        # Assess risk
        risk = self.assess_risk(action_type, agent_id, payload)
        oversight_level = risk.level()
        
        action = AIAction(
            id=action_id,
            agent_id=agent_id,
            agent_name=agent_name,
            action_type=action_type,
            description=description,
            payload=payload,
            risk=risk,
            oversight_level=oversight_level,
            status=ReviewStatus.PENDING if oversight_level != OversightLevel.NONE else ReviewStatus.APPROVED
        )
        
        # Store action
        self.pending_actions[action_id] = action
        
        # If no oversight needed, auto-approve
        if oversight_level == OversightLevel.NONE:
            action.status = ReviewStatus.APPROVED
            action.executed_at = datetime.now()
            action.executed_by = agent_id
        
        return action
    
    # ==================== Review Process ====================
    
    def can_review(
        self,
        reviewer_id: str,
        action: AIAction,
        board: Optional[OversightBoard] = None
    ) -> bool:
        """Check if an AI can review a specific action."""
        # Can't review own actions
        if reviewer_id == action.agent_id:
            return False
        
        # Check board membership if applicable
        if board:
            if action.oversight_level == OversightLevel.COMMITTEE:
                return reviewer_id in board.senior_agents or reviewer_id in board.peer_reviewers
            elif action.oversight_level == OversightLevel.PEER_REVIEW:
                return reviewer_id in board.peer_reviewers
        
        # Default: any AI can do peer review
        return action.oversight_level == OversightLevel.PEER_REVIEW
    
    def submit_review(
        self,
        action_id: str,
        reviewer_id: str,
        reviewer_name: str,
        decision: str,
        reasoning: str,
        confidence: float = 1.0,
        suggested_changes: Optional[str] = None
    ) -> OversightReview:
        """Submit a review for an action."""
        import uuid
        
        review = OversightReview(
            id=str(uuid.uuid4()),
            action_id=action_id,
            reviewer_id=reviewer_id,
            reviewer_name=reviewer_name,
            decision=decision,
            reasoning=reasoning,
            confidence=confidence,
            suggested_changes=suggested_changes
        )
        
        # Store review
        if action_id not in self.reviews:
            self.reviews[action_id] = []
        self.reviews[action_id].append(review)
        
        # Update action status
        action = self.pending_actions.get(action_id)
        if action:
            action.reviewers.append(reviewer_id)
            
            if decision == "approve":
                action.approvals.append(reviewer_id)
            elif decision == "reject":
                action.rejections.append(reviewer_id)
            elif decision == "challenge":
                action.challenges.append(reviewer_id)
            elif decision == "escalate":
                action.status = ReviewStatus.ESCALATED
            
            # Check if consensus reached
            self._check_consensus(action)
        
        return review
    
    def _check_consensus(self, action: AIAction) -> None:
        """Check if review consensus has been reached."""
        reviews = self.reviews.get(action.id, [])
        
        if not reviews:
            return
        
        total_reviews = len(reviews)
        approvals = len(action.approvals)
        rejections = len(action.rejections)
        
        # For committee decisions, need 2/3 approval
        if action.oversight_level == OversightLevel.COMMITTEE:
            approval_rate = approvals / total_reviews if total_reviews > 0 else 0
            if approval_rate >= 0.67 and total_reviews >= 2:
                action.status = ReviewStatus.APPROVED
            elif rejections >= 2:
                action.status = ReviewStatus.REJECTED
        
        # For peer review, single approval is enough
        elif action.oversight_level == OversightLevel.PEER_REVIEW:
            if approvals >= 1:
                action.status = ReviewStatus.APPROVED
            elif rejections >= 1:
                action.status = ReviewStatus.REJECTED
    
    # ==================== Challenge System ====================
    
    def challenge_action(
        self,
        action_id: str,
        challenger_id: str,
        challenger_name: str,
        reasoning: str
    ) -> Optional[OversightReview]:
        """
        Challenge an already-approved action.
        
        This triggers emergency review and potentially halts execution.
        """
        action = self.pending_actions.get(action_id)
        if not action:
            return None
        
        # Can only challenge approved or pending actions
        if action.status not in [ReviewStatus.APPROVED, ReviewStatus.PENDING]:
            return None
        
        # Submit challenge as a review
        review = self.submit_review(
            action_id=action_id,
            reviewer_id=challenger_id,
            reviewer_name=challenger_name,
            decision="challenge",
            reasoning=reasoning,
            confidence=1.0
        )
        
        # Escalate the action
        action.status = ReviewStatus.CHALLENGED
        action.oversight_level = OversightLevel.EMERGENCY
        action.challenges.append(challenger_id)
        
        return review
    
    # ==================== Query ====================
    
    def get_action_status(self, action_id: str) -> Optional[AIAction]:
        """Get current status of an action."""
        return self.pending_actions.get(action_id)
    
    def get_reviews_for_action(self, action_id: str) -> List[OversightReview]:
        """Get all reviews for an action."""
        return self.reviews.get(action_id, [])
    
    def get_pending_actions_for_agent(self, agent_id: str) -> List[AIAction]:
        """Get all pending actions awaiting review for an agent."""
        return [
            action for action in self.pending_actions.values()
            if action.agent_id == agent_id and action.status == ReviewStatus.PENDING
        ]
    
    def get_actions_requiring_review(
        self,
        reviewer_id: str,
        board: Optional[OversightBoard] = None
    ) -> List[AIAction]:
        """Get all actions this reviewer can review."""
        return [
            action for action in self.pending_actions.values()
            if action.status == ReviewStatus.PENDING
            and self.can_review(reviewer_id, action, board)
        ]
    
    # ==================== Audit Trail ====================
    
    def get_audit_trail(self, agent_id: Optional[str] = None) -> List[AIAction]:
        """Get audit trail for an agent or all agents."""
        actions = list(self.pending_actions.values())
        if agent_id:
            actions = [a for a in actions if a.agent_id == agent_id]
        return sorted(actions, key=lambda x: x.created_at, reverse=True)
    
    def get_decision_stats(self, agent_id: str) -> Dict[str, Any]:
        """Get oversight statistics for an agent."""
        actions = [a for a in self.pending_actions.values() if a.agent_id == agent_id]
        
        total = len(actions)
        approved = len([a for a in actions if a.status == ReviewStatus.APPROVED])
        rejected = len([a for a in actions if a.status == ReviewStatus.REJECTED])
        challenged = len([a for a in actions if a.status == ReviewStatus.CHALLENGED])
        
        avg_risk = sum(a.risk.score for a in actions) / total if total > 0 else 0
        
        return {
            "total_actions": total,
            "approved": approved,
            "rejected": rejected,
            "challenged": challenged,
            "approval_rate": approved / total if total > 0 else 0,
            "average_risk_score": avg_risk,
            "trust_level": "high" if avg_risk < 0.3 else "medium" if avg_risk < 0.6 else "low"
        }


# ==================== Convenience Functions ====================

def create_default_oversight_board() -> OversightBoard:
    """Create a default oversight board configuration."""
    return OversightBoard(
        id="default",
        name="Janus AI Oversight Board",
        description="Default oversight for AI actions",
        senior_agents=["synthclaw", "claude-senior", "gpt-senior"],
        peer_reviewers=["alfred", "michael", "claude-peer"],
        specialists={
            "code_change": ["synthclaw", "claude-architect"],
            "security": ["security-ai", "synthclaw"],
            "deployment": ["devops-ai", "synthclaw"],
        }
    )
