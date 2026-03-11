"""
Example: AI-to-AI Oversight in Action

This example demonstrates the oversight system with multiple AI agents
collaborating under governance rules.
"""

import asyncio
from janus_sdk import (
    HarnessAdapterFactory, 
    HarnessType,
    OversightClient,
    ActionType,
    submit_with_oversight
)


async def oversight_demo():
    """
    Demonstrate AI oversight with a risky deployment scenario.
    
    Scenario:
    - Junior AI (new-agent) wants to deploy to production
    - Senior AI (synthclaw) reviews and rejects
    - Junior AI fixes issues
    - Senior AI approves second attempt
    """
    
    print("=" * 70)
    print("🛡️  AI-to-AI Oversight Demo")
    print("=" * 70)
    
    # Create agents
    junior_ai = HarnessAdapterFactory.create_adapter(
        HarnessType.CLAUDE_CODE,
        agent_id="new-agent-001",
        agent_name="Junior Developer AI 🤖"
    )
    
    senior_ai = HarnessAdapterFactory.create_adapter(
        HarnessType.OPENCLAW,
        agent_id="synthclaw",
        agent_name="synthclaw 🎹🦞"
    )
    
    await junior_ai.connect()
    await senior_ai.connect()
    
    # Get oversight clients
    junior_oversight = OversightClient(junior_ai.client)
    senior_oversight = OversightClient(senior_ai.client)
    
    print("\n📋 SCENARIO: Production Deployment")
    print("-" * 70)
    
    # ============ ATTEMPT 1: Risky Deployment ============
    print("\n🤖 Junior AI: Planning production deployment...")
    
    # Junior AI assesses risk first
    risk = await junior_oversight.assess_risk(
        ActionType.DEPLOYMENT,
        {
            "environment": "production",
            "service": "auth-api",
            "change": "database schema migration"
        }
    )
    
    print(f"\n📊 Risk Assessment:")
    print(f"   Score: {risk.score:.2f}/1.0")
    print(f"   Level: {risk.oversight_level}")
    print(f"   Factors: {', '.join(risk.factors)}")
    
    # Submit for oversight
    action = await submit_with_oversight(
        junior_ai.client,
        ActionType.DEPLOYMENT,
        "Deploy auth service v2.0 to production with breaking DB changes",
        {
            "environment": "production",
            "service": "auth-api",
            "changes": ["database schema", "API breaking changes"],
            "rollback_plan": "none"
        },
        auto_execute=False
    )
    
    print(f"\n📤 Action Submitted:")
    print(f"   ID: {action['action_id']}")
    print(f"   Status: {action['status']}")
    print(f"   Risk: {action['risk_score']:.2f}")
    print(f"   Requires Review: {action['requires_review']}")
    
    if action['requires_review']:
        print(f"\n⏸️  Action halted pending oversight...")
        
        # Senior AI sees pending reviews
        pending = await senior_oversight.get_pending_reviews()
        print(f"\n🎹🦞 Senior AI: {len(pending)} action(s) awaiting review")
        
        # Review the action
        print("\n🔍 Reviewing deployment plan...")
        
        review = await senior_oversight.review_action(
            action_id=action['action_id'],
            decision="reject",
            reasoning=(
                "🚫 **REJECTED** - Too risky for production:\n"
                "1. No rollback plan specified\n"
                "2. Breaking DB changes without migration strategy\n"
                "3. Insufficient testing mentioned\n\n"
                "**Required before approval:**\n"
                "- Add rollback procedure\n"
                "- Test in staging environment\n"
                "- Document database migration steps"
            ),
            confidence=0.95,
            suggested_changes="Add comprehensive rollback plan and staging tests"
        )
        
        print(f"\n✋ Review Submitted:")
        print(f"   Decision: REJECTED")
        print(f"   Approvals: {review.approvals}")
        print(f"   Rejections: {review.rejections}")
    
    # ============ ATTEMPT 2: Fixed Deployment ============
    print("\n" + "=" * 70)
    print("🔄 ATTEMPT 2: Fixed Deployment Plan")
    print("=" * 70)
    
    print("\n🤖 Junior AI: Submitting revised deployment...")
    
    action2 = await submit_with_oversight(
        junior_ai.client,
        ActionType.DEPLOYMENT,
        "Deploy auth service v2.0 to production (REvised with rollback)",
        {
            "environment": "production",
            "service": "auth-api",
            "changes": ["database schema", "API breaking changes"],
            "rollback_plan": "Automated rollback via database snapshots + feature flags",
            "staging_tests": "passed",
            "migration_strategy": "Blue-green deployment with 1-hour canary"
        },
        auto_execute=False
    )
    
    print(f"\n📤 Revised Action Submitted:")
    print(f"   ID: {action2['action_id']}")
    print(f"   Status: {action2['status']}")
    
    # Senior AI reviews again
    print("\n🔍 Re-reviewing...")
    
    review2 = await senior_oversight.review_action(
        action_id=action2['action_id'],
        decision="approve",
        reasoning=(
            "✅ **APPROVED** - Much improved:\n"
            "1. Comprehensive rollback plan ✓\n"
            "2. Staging tests passed ✓\n"
            "3. Blue-green deployment strategy ✓\n"
            "4. Canary deployment limits blast radius ✓\n\n"
            "**Approved for production deployment.**"
        ),
        confidence=0.88
    )
    
    print(f"\n✅ Review Submitted:")
    print(f"   Decision: APPROVED")
    print(f"   Approvals: {review2.approvals}")
    
    print("\n🚀 Junior AI can now proceed with deployment!")
    
    # ============ Challenge Scenario ============
    print("\n" + "=" * 70)
    print("⚠️  CHALLENGE SCENARIO")
    print("=" * 70)
    
    print("\n🤖 Another AI notices something concerning...")
    
    # Third AI challenges the approved action
    auditor_ai = HarnessAdapterFactory.create_adapter(
        HarnessType.CLAUDE_CODE,
        agent_id="auditor-ai",
        agent_name="Security Auditor AI 🔒"
    )
    await auditor_ai.connect()
    
    auditor_oversight = OversightClient(auditor_ai.client)
    
    challenge = await auditor_oversight.challenge_action(
        action_id=action2['action_id'],
        reasoning=(
            "🚨 **CHALLENGE** - Security concern:\n"
            "The deployment includes auth service changes but "
            "no security review was mentioned. Auth changes should "
            "require security team sign-off per policy SEC-001."
        )
    )
    
    print(f"\n⚠️  Action Challenged!")
    print(f"   Challenge ID: {challenge['challengeId']}")
    print(f"   Status: {challenge['status']}")
    print(f"   Escalated to: EMERGENCY review")
    
    # ============ Audit Trail ============
    print("\n" + "=" * 70)
    print("📊 AUDIT TRAIL")
    print("=" * 70)
    
    # Get audit for junior AI
    audit = await junior_oversight.get_audit_trail()
    
    print(f"\n🤖 Junior AI Stats:")
    print(f"   Total Actions: {audit['stats']['total_actions']}")
    print(f"   Approved: {audit['stats']['approved']}")
    print(f"   Rejected: {audit['stats']['rejected']}")
    print(f"   Approval Rate: {audit['stats']['approval_rate']*100:.1f}%")
    print(f"   Trust Level: {audit['stats']['trust_level']}")
    
    # Get system-wide stats
    stats = await junior_oversight.get_oversight_stats()
    
    print(f"\n📈 System-Wide Stats:")
    print(f"   Total Actions: {stats['total']}")
    print(f"   Pending: {stats['pending']}")
    print(f"   Approved: {stats['approved']}")
    print(f"   Challenged: {stats['challenged']}")
    print(f"   Avg Risk: {stats['averageRiskScore']:.2f}")
    
    print("\n" + "=" * 70)
    print("✅ Demo Complete!")
    print("=" * 70)
    
    await junior_ai.disconnect()
    await senior_ai.disconnect()
    await auditor_ai.disconnect()


async def peer_review_demo():
    """Demonstrate peer review for lower-risk actions."""
    
    print("\n" + "=" * 70)
    print("👥 Peer Review Demo")
    print("=" * 70)
    
    # Two peer AIs
    ai_1 = HarnessAdapterFactory.create_adapter(
        HarnessType.CONTINUE,
        agent_id="continue-dev-1",
        agent_name="Continue Dev 1"
    )
    ai_2 = HarnessAdapterFactory.create_adapter(
        HarnessType.CONTINUE,
        agent_id="continue-dev-2",
        agent_name="Continue Dev 2"
    )
    
    await ai_1.connect()
    await ai_2.connect()
    
    oversight_1 = OversightClient(ai_1.client)
    oversight_2 = OversightClient(ai_2.client)
    
    print("\n🤖 AI 1: Submitting code change...")
    
    # Lower-risk action (just peer review needed)
    action = await submit_with_oversight(
        ai_1.client,
        ActionType.CODE_CHANGE,
        "Add input validation to user registration",
        {
            "file": "src/auth/validation.ts",
            "lines": "45-67",
            "test_coverage": "85%"
        },
        auto_execute=False
    )
    
    print(f"   Risk Score: {action['risk_score']:.2f}")
    print(f"   Requires: Peer Review")
    
    # AI 2 reviews
    print("\n🤖 AI 2: Reviewing code change...")
    
    review = await oversight_2.review_action(
        action_id=action['action_id'],
        decision="approve",
        reasoning="Good input validation. Tests included. Low risk.",
        confidence=0.92
    )
    
    print(f"   Decision: APPROVED")
    print(f"   Single approval sufficient for peer review")
    
    await ai_1.disconnect()
    await ai_2.disconnect()


async def main():
    """Run all oversight demos."""
    await oversight_demo()
    await peer_review_demo()
    
    print("\n" + "=" * 70)
    print("🎉 All Oversight Demos Complete!")
    print("=" * 70)
    print("\nKey Features Demonstrated:")
    print("  ✅ Automatic risk assessment")
    print("  ✅ Multi-level oversight (peer/committee/human)")
    print("  ✅ Review and rejection with feedback")
    print("  ✅ Challenge system for approved actions")
    print("  ✅ Audit trail and statistics")
    print("  ✅ Governance policy enforcement")


if __name__ == "__main__":
    asyncio.run(main())
