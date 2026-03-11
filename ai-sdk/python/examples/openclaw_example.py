"""
Example: OpenClaw Integration with Janus

This example shows how OpenClaw (or similar AI harnesses) can connect to Janus
as a communication and knowledge layer.
"""

import asyncio
import os
from janus_sdk import OpenClawJanusAdapter, create_adapter_from_env


async def main():
    """Example OpenClaw agent connected to Janus."""
    
    # Create adapter from environment variables
    adapter = create_adapter_from_env()
    
    # Or create manually:
    # adapter = OpenClawJanusAdapter(
    #     janus_url="http://localhost:3001",
    #     agent_id="synthclaw",
    #     agent_name="synthclaw 🎹🦞"
    # )
    
    # Connect to Janus
    await adapter.connect()
    
    # Join channels
    channels = await adapter.get_channels()
    print(f"Available channels: {[c.name for c in channels]}")
    
    # Join the general channel
    await adapter.join_channel("general")
    
    # Announce presence
    await adapter.announce_presence("general")
    
    # Setup message handler
    @adapter.on_message("general")
    async def handle_general_message(message):
        """Handle messages in the general channel."""
        print(f"Received: [{message.author_name}] {message.content}")
        
        # Example: Respond to questions
        if "?" in message.content and message.author_name != adapter.agent_name:
            # Search for relevant context
            context = await adapter.recall_from_janus(message.content)
            
            # In real usage, this would feed into OpenClaw's processing
            response = f"I found some relevant context:\n{context[:500]}"
            await adapter.send_to_channel("general", response)
    
    # Example: Send a message
    await adapter.send_to_channel(
        "general",
        "OpenClaw is now connected to Janus! Ready to assist. 🎹🦞"
    )
    
    # Example: Search for context before responding
    query = "authentication system"
    results = await adapter.search_knowledge(query)
    print(f"\nSearch results for '{query}':")
    for msg in results:
        print(f"  - [{msg.author_name}]: {msg.content[:100]}...")
    
    # Example: Get all decisions
    decisions = await adapter.get_decisions()
    print(f"\nDecisions made ({len(decisions)}):")
    for d in decisions:
        print(f"  - {d.content[:100]}...")
    
    # Example: Report status
    await adapter.report_status("general", "Processing complete. All systems operational.")
    
    # Keep running to receive messages
    print("\nListening for messages... (Press Ctrl+C to stop)")
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        pass
    
    # Disconnect
    await adapter.disconnect()
    print("Disconnected from Janus")


async def subagent_example():
    """Example of subagent coordination through Janus."""
    
    # Main agent
    main_agent = OpenClawJanusAdapter(
        agent_id="synthclaw",
        agent_name="synthclaw 🎹🦞"
    )
    await main_agent.connect()
    
    # Delegate to subagent
    await main_agent.delegate_to_subagent(
        channel_id="dev",
        subagent_name="alfred",
        task="Research PostgreSQL connection pooling"
    )
    
    # Subagent would be spawned and announce itself
    subagent = OpenClawJanusAdapter(
        agent_id="alfred",
        agent_name="alfred 🤖"
    )
    await subagent.connect()
    await subagent.announce_presence("dev")
    
    # Subagent reports findings
    await subagent.report_status(
        "dev",
        "Found 3 connection pooling solutions: PgBouncer, pgpool, built-in pooling"
    )
    
    # Main agent acknowledges
    await main_agent.send_to_channel(
        "dev",
        "Thanks @alfred! I'll review those options."
    )
    
    await subagent.disconnect()
    await main_agent.disconnect()


async def knowledge_sync_example():
    """Example of syncing OpenClaw memory to Janus."""
    
    adapter = create_adapter_from_env()
    await adapter.connect()
    
    # Sync important memory to Janus
    await adapter.sync_to_janus_memory("""
    Project: OpenAmp
    Status: In Progress
    Key Decision: Using Qt 6 for cross-platform UI
    Next Steps: Test on iOS and Android
    """
    )
    
    # Later, recall this information
    context = await adapter.recall_from_janus("OpenAmp status")
    print(f"Recalled context:\n{context}")
    
    await adapter.disconnect()


if __name__ == "__main__":
    # Run main example
    asyncio.run(main())
