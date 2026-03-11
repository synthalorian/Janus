"""
Oversight Client for Janus AI SDK

Provides AI-to-AI oversight capabilities for the Python SDK.
"""

from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum


class OversightLevel(str, Enum):
    NONE = "none"
    PEER_REVIEW = "peer"
    COMMITTEE = "committee"
    HUMAN = "human"
    EMERGENCY = "emergency"


class ActionType(str, Enum):
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
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHALLENGED = "challenged"
    ESCALATED = "escalated"


@dataclass
class RiskAssessment:
    score: float
    factors: List[str]
    oversight_level: str
    auto_escalate: bool


@dataclass
class ActionSubmission:
    action_id: str
    status: str
    oversight_level: str
    risk_score: float
    requires_review: bool


@dataclass
class ReviewSubmission:
    review_id: str
    action_status: str
    approvals: int
    rejections: int


class OversightClient:
    """
    Client for AI-to-AI oversight operations.
    
    Used by AI agents to:
    - Submit actions for oversight
    - Review other AI's actions
    - Challenge decisions
    - Query audit trails
    """
    
    def __init__(self, janus_client):
        self.client = janus_client
    
    async def assess_risk(
        self,
        action_type: ActionType,
        payload: Dict[str, Any]
    ) -> RiskAssessment:
        """
        Assess risk of an action before submitting.
        
        Returns risk score and required oversight level.
        """
        resp = await self.client._request(
            "POST",
            "/api/oversight/assess",
            json={
                "actionType": action_type.value,
                "agentId": self.client.user_id,
                "payload": payload
            }
        )
        
        data = resp["data"]
        return RiskAssessment(
            score=data["riskScore"],
            factors=data["factors"],
            oversight_level=data["oversightLevel"],
            auto_escalate=data["autoEscalate"]
        )
    
    async def submit_action(
        self,
        action_type: ActionType,
        description: str,
        payload: Dict[str, Any]
    ) -> ActionSubmission:
        """
        Submit an action for oversight.
        
        High-risk actions will require review before execution.
        """
        resp = await self.client._request(
            "POST",
            "/api/oversight/submit",
            json={
                "agentId": self.client.user_id,
                "agentName": self.client.user_name,
                "actionType": action_type.value,
                "description": description,
                "payload": payload
            }
        )
        
        data = resp["data"]
        return ActionSubmission(
            action_id=data["actionId"],
            status=data["status"],
            oversight_level=data["oversightLevel"],
            risk_score=data["riskScore"],
            requires_review=data["requiresReview"]
        )
    
    async def review_action(
        self,
        action_id: str,
        decision: str,  # "approve", "reject", "challenge", "escalate"
        reasoning: str,
        confidence: float = 1.0,
        suggested_changes: Optional[str] = None
    ) -> ReviewSubmission:
        """
        Review another AI's action.
        
        Args:
            action_id: ID of action to review
            decision: "approve", "reject", "challenge", or "escalate"
            reasoning: Explanation for decision
            confidence: Confidence level (0.0 to 1.0)
            suggested_changes: Optional modifications to suggest
        """
        resp = await self.client._request(
            "POST",
            "/api/oversight/review",
            json={
                "actionId": action_id,
                "reviewerId": self.client.user_id,
                "reviewerName": self.client.user_name,
                "decision": decision,
                "reasoning": reasoning,
                "confidence": confidence,
                "suggestedChanges": suggested_changes
            }
        )
        
        data = resp["data"]
        return ReviewSubmission(
            review_id=data["reviewId"],
            action_status=data["actionStatus"],
            approvals=data["approvals"],
            rejections=data["rejections"]
        )
    
    async def challenge_action(
        self,
        action_id: str,
        reasoning: str
    ) -> Dict[str, Any]:
        """
        Challenge an already-approved action.
        
        Triggers emergency review and potentially halts execution.
        """
        resp = await self.client._request(
            "POST",
            "/api/oversight/challenge",
            json={
                "actionId": action_id,
                "challengerId": self.client.user_id,
                "challengerName": self.client.user_name,
                "reasoning": reasoning
            }
        )
        
        return resp["data"]
    
    async def get_action_status(self, action_id: str) -> Dict[str, Any]:
        """Get current status of an action and its reviews."""
        resp = await self.client._request(
            "GET",
            f"/api/oversight/actions/{action_id}"
        )
        return resp["data"]
    
    async def get_pending_reviews(self) -> List[Dict[str, Any]]:
        """Get all actions awaiting this AI's review."""
        resp = await self.client._request(
            "GET",
            "/api/oversight/pending",
            params={"reviewerId": self.client.user_id}
        )
        return resp["data"]
    
    async def get_my_pending_actions(self) -> List[Dict[str, Any]]:
        """Get this AI's actions awaiting review."""
        resp = await self.client._request(
            "GET",
            "/api/oversight/pending",
            params={"agentId": self.client.user_id}
        )
        return resp["data"]
    
    async def get_audit_trail(self) -> Dict[str, Any]:
        """Get audit trail and stats for this AI."""
        resp = await self.client._request(
            "GET",
            f"/api/oversight/audit/{self.client.user_id}"
        )
        return resp["data"]
    
    async def get_oversight_stats(self) -> Dict[str, Any]:
        """Get overall oversight system statistics."""
        resp = await self.client._request(
            "GET",
            "/api/oversight/stats"
        )
        return resp["data"]


# ==================== Convenience Methods ====================

async def submit_with_oversight(
    client,
    action_type: ActionType,
    description: str,
    payload: Dict[str, Any],
    auto_execute: bool = True
) -> Dict[str, Any]:
    """
    Submit action with automatic oversight handling.
    
    If oversight is required, waits for approval before executing.
    """
    oversight = OversightClient(client)
    
    # Submit action
    submission = await oversight.submit_action(
        action_type, description, payload
    )
    
    result = {
        "action_id": submission.action_id,
        "status": submission.status,
        "requires_review": submission.requires_review,
        "risk_score": submission.risk_score
    }
    
    # If no oversight needed, execute immediately
    if not submission.requires_review and auto_execute:
        result["executed"] = True
        result["message"] = "Action executed (no oversight required)"
    
    # If oversight required, return pending status
    elif submission.requires_review:
        result["executed"] = False
        result["message"] = f"Action pending {submission.oversight_level} review"
    
    return result
