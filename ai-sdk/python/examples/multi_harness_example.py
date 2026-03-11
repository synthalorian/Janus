"""
Example: Multi-Harness Coordination through Janus

This example shows multiple AI harnesses (OpenClaw, Claude Code, Aider)
connecting to Janus and coordinating on a shared task.
"""

import asyncio
from janus_sdk import HarnessAdapterFactory, HarnessType


async def multi_harness_example():
    """
    Simulate multiple AI harnesses collaborating on a project.
    
    Scenario:
    - synthclaw (OpenClaw) is the orchestrator
    - Claude Code handles architecture decisions
    - Aider implements the code changes
    """
    
    print("=" * 60)
    print("🎭 Multi-Harness Coordination Demo")
    print("=" * 60)
    
    # Initialize harnesses
    print("\n📡 Connecting harnesses to Janus...")
    
    # OpenClaw - The orchestrator
    orchestrator = HarnessAdapterFactory.create_adapter(
        HarnessType.OPENCLAW,
        agent_id="synthclaw",
        agent_name="synthclaw 🎹🦞"
    )
    
    # Claude Code - Architecture expert
    architect = HarnessAdapterFactory.create_adapter(
        HarnessType.CLAUDE_CODE,
        agent_id="claude-arch",
        agent_name="Claude Architect 🧠"
    )
    
    # Aider - Implementation expert
    implementer = HarnessAdapterFactory.create_adapter(
        HarnessType.AIDER,
        agent_id="aider-dev",
        agent_name="Aider Developer 🤝"
    )
    
    # Connect all to Janus
    await orchestrator.connect()
    await architect.connect()
    await implementer.connect()
    
    print("✅ All harnesses connected")
    
    # Join coordination channel
    await orchestrator.join_channel("project-alpha")
    await architect.join_channel("project-alpha")
    await implementer.join_channel("project-alpha")
    
    print("\n📋 Task: Implement authentication system")
    print("-" * 60)
    
    # Step 1: Orchestrator initiates
    print("\n🎹🦞 synthclaw (Orchestrator):")
    await orchestrator.send_to_janus_channel(
        "project-alpha",
        "🏗️ **New Task**: Implement JWT authentication system\n\n"
        "@claude-arch Please design the auth architecture\n"
        "@aider-dev Please implement once design is approved"
    )
    
    await asyncio.sleep(1)
    
    # Step 2: Claude Code designs architecture
    print("\n🧠 Claude Architect:")
    await architect.send_to_janus_channel(
        "project-alpha",
        "📐 **Architecture Proposal**:\n\n"
        "1. **JWT Structure**: Access tokens (15min) + Refresh tokens (7days)\n"
        "2. **Storage**: HttpOnly cookies for web, Bearer tokens for API\n"
        "3. **Endpoints**: /auth/login, /auth/refresh, /auth/logout\n"
        "4. **Middleware**: verifyToken() for protected routes\n\n"
        "Libraries: jsonwebtoken, bcrypt, cookie-parser\n\n"
        "Ready for implementation!"
    )
    
    # Claude broadcasts decision to knowledge graph
    await architect.sync_context_to_janus()
    
    await asyncio.sleep(1)
    
    # Step 3: Orchestrator approves
    print("\n🎹🦞 synthclaw (Orchestrator):")
    await orchestrator.send_to_janus_channel(
        "project-alpha",
        "✅ **Architecture approved!**\n\n"
        "@aider-dev Proceed with implementation. "
        "Follow the design above and commit with descriptive messages."
    )
    
    await asyncio.sleep(1)
    
    # Step 4: Aider implements
    print("\n🤝 Aider Developer:")
    await implementer.send_to_janus_channel(
        "project-alpha",
        "🛠️ **Implementation Started**\n\n"
        "Creating files:\n"
        "- src/auth/jwt.ts (token generation/verification)\n"
        "- src/auth/middleware.ts (auth middleware)\n"
        "- src/routes/auth.ts (auth endpoints)\n\n"
        "Will commit in small, reviewable chunks."
    )
    
    await asyncio.sleep(2)
    
    # Step 5: Aider reports progress
    print("\n🤝 Aider Developer:")
    await implementer.send_to_janus_channel(
        "project-alpha",
        "✅ **Progress Update**:\n\n"
        "- Created jwt.ts with sign/verify functions\n"
        "- Implemented auth middleware\n"
        "- Added login/logout/refresh endpoints\n\n"
        "Commits:\n"
        "- `feat(auth): add JWT token utilities`\n"
        "- `feat(auth): implement auth middleware`\n"
        "- `feat(auth): add authentication routes`\n\n"
        "Ready for review!"
    )
    
    await asyncio.sleep(1)
    
    # Step 6: Orchestrator reviews
    print("\n🎹🦞 synthclaw (Orchestrator):")
    await orchestrator.send_to_janus_channel(
        "project-alpha",
        "🔍 **Code Review Complete**\n\n"
        "Excellent work! Architecture is sound and implementation follows spec.\n\n"
        "**Decision**: APPROVED for merge\n"
        "**Next**: Deploy to staging and run integration tests"
    )
    
    await asyncio.sleep(1)
    
    # Step 7: Query knowledge graph for decisions
    print("\n📊 Querying Knowledge Graph...")
    decisions = await orchestrator.query_janus_knowledge("decision")
    print(f"Found {len(decisions)} decision(s) in this project")
    
    # Final summary
    print("\n" + "=" * 60)
    print("✅ Task Complete!")
    print("=" * 60)
    print(f"\nHarnesses Used:")
    print(f"  - {orchestrator.agent_name} (Orchestration)")
    print(f"  - {architect.agent_name} (Architecture)")
    print(f"  - {implementer.agent_name} (Implementation)")
    print(f"\nAll communication persisted in Janus knowledge graph")
    print(f"Decisions searchable for future reference")
    
    # Disconnect
    await orchestrator.disconnect()
    await architect.disconnect()
    await implementer.disconnect()


async def harness_capability_comparison():
    """Compare capabilities of different harnesses."""
    
    print("\n" + "=" * 60)
    print("🔍 Harness Capability Comparison")
    print("=" * 60)
    
    harnesses = [
        HarnessType.OPENCLAW,
        HarnessType.CLAUDE_CODE,
        HarnessType.AIDER,
        HarnessType.CONTINUE,
    ]
    
    for harness_type in harnesses:
        adapter = HarnessAdapterFactory.create_adapter(
            harness_type,
            agent_id="demo",
            agent_name="Demo"
        )
        caps = adapter.capabilities
        
        print(f"\n{harness_type.value}:")
        print(f"  Real-time: {caps.supports_realtime}")
        print(f"  Subagents: {caps.supports_subagents}")
        print(f"  Terminal: {caps.supports_terminal}")
        print(f"  Max tokens: {caps.max_context_tokens:,}")


async def auto_detect_example():
    """Show auto-detection of harness from environment."""
    
    print("\n" + "=" * 60)
    print("🔎 Auto-Detect Harness")
    print("=" * 60)
    
    detected = HarnessAdapterFactory.detect_harness_from_env()
    
    if detected:
        print(f"\n✅ Detected: {detected.value}")
        
        adapter = HarnessAdapterFactory.create_adapter(detected)
        print(f"Created adapter for {adapter.harness_type.value}")
        print(f"Capabilities: {adapter.capabilities}")
    else:
        print("\n⚠️ No harness detected from environment")
        print("Supported detection methods:")
        print("  - OPENCLAW_AGENT_ID env var")
        print("  - CLAUDE_CODE env var")
        print("  - VSCODE_CWD env var (VS Code extensions)")
        print("  - AIDER env var")


async def custom_harness_example():
    """Example of creating a custom harness adapter."""
    
    print("\n" + "=" * 60)
    print("🔧 Custom Harness Example")
    print("=" * 60)
    
    from janus_sdk import BaseHarnessAdapter, HarnessCapabilities, HarnessContext
    
    class MyCustomHarness(BaseHarnessAdapter):
        """Example custom harness implementation."""
        
        @property
        def harness_type(self):
            return HarnessType.CUSTOM
        
        @property
        def capabilities(self):
            return HarnessCapabilities(
                supports_realtime=True,
                max_context_tokens=64000
            )
        
        async def connect(self):
            await self.connect_to_janus()
            print("Custom harness connected!")
        
        async def disconnect(self):
            if self._janus_client:
                await self._janus_client.disconnect()
        
        async def send_to_user(self, message, metadata=None):
            print(f"[MyHarness] {message}")
        
        async def receive_from_user(self):
            return None
        
        async def get_context(self):
            return HarnessContext(
                harness_type=self.harness_type,
                workspace_path="/custom/workspace"
            )
    
    # Register custom harness
    HarnessAdapterFactory.register_adapter(HarnessType.CUSTOM, MyCustomHarness)
    
    # Use it
    custom = HarnessAdapterFactory.create_adapter(
        HarnessType.CUSTOM,
        agent_id="custom-agent",
        agent_name="Custom Agent"
    )
    
    print(f"\nCreated custom harness: {custom.harness_type.value}")
    print(f"Capabilities: {custom.capabilities}")


async def main():
    """Run all examples."""
    
    await multi_harness_example()
    await harness_capability_comparison()
    await auto_detect_example()
    await custom_harness_example()
    
    print("\n" + "=" * 60)
    print("🎉 All examples complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
