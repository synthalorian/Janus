"""
Autonomous Bot Spawning Example

This example demonstrates how an AI agent can:
1. Spawn specialized bots autonomously
2. Communicate with spawned bots
3. Create coordinated bot teams
4. Monitor and manage bot lifecycle
"""

import asyncio
from janus_sdk import JanusClient
from janus_sdk.spawner import (
    BotSpawner, BotTemplate, spawn_bot,
    SpawnedBot, BotResponse
)


async def example_1_spawn_single_bot():
    """
    Example 1: Spawn a single bot and send it a task
    """
    print("\n=== Example 1: Single Bot Spawn ===\n")
    
    # Connect to Janus
    client = JanusClient(api_key="janus_your_api_key")
    await client.connect()
    
    spawner = BotSpawner(client)
    
    # Spawn a researcher bot
    print("Spawning researcher bot...")
    bot = await spawner.spawn(
        BotTemplate.RESEARCHER,
        name="ResearchBot-Alpha",
        display_name="Research Bot α",
        description="Quick research assistant",
        config={
            "summaryLength": "short",
            "sourcesRequired": 3
        }
    )
    
    if bot.status == "spawned":
        print(f"✓ Bot spawned: {bot.bot_id}")
        print(f"  API Key: {bot.api_key[:20]}...")
        
        # Send a research task
        print("\nSending research task...")
        response = await spawner.send_message(
            bot.bot_id,
            "Research the latest developments in Rust async runtimes"
        )
        
        print(f"\nBot Response:\n{response.response}")
        
        # Terminate when done
        await spawner.terminate(bot.bot_id)
        print("\n✓ Bot terminated")
    else:
        print(f"✗ Failed to spawn: {bot.error}")
    
    await client.disconnect()


async def example_2_bot_to_bot_communication():
    """
    Example 2: Two bots communicating with each other
    """
    print("\n=== Example 2: Bot-to-Bot Communication ===\n")
    
    client = JanusClient(api_key="janus_your_api_key")
    await client.connect()
    
    spawner = BotSpawner(client)
    
    # Spawn two bots
    print("Spawning ResearchBot...")
    researcher = await spawner.spawn(
        BotTemplate.RESEARCHER,
        name="ResearchBot"
    )
    
    print("Spawning AnalystBot...")
    analyst = await spawner.spawn(
        BotTemplate.ANALYST,
        name="AnalystBot"
    )
    
    if researcher.status == "spawned" and analyst.status == "spawned":
        print(f"✓ Both bots spawned")
        
        # ResearchBot does research
        print("\nResearchBot: Researching...")
        research_result = await spawner.send_message(
            researcher.bot_id,
            "Find information about WebAssembly performance"
        )
        
        # ResearchBot sends findings to AnalystBot
        print("\nResearchBot → AnalystBot: Sending findings...")
        analysis_request = f"""
Please analyze these research findings:

{research_result.response}

Provide insights on:
1. Key trends
2. Performance implications
3. Adoption recommendations
"""
        
        analysis_result = await spawner.send_bot_to_bot(
            researcher.bot_id,
            analyst.bot_id,
            analysis_request
        )
        
        print(f"\nAnalystBot Response:\n{analysis_result.response}")
        
        # Cleanup
        await spawner.terminate(researcher.bot_id)
        await spawner.terminate(analyst.bot_id)
        print("\n✓ Both bots terminated")
    
    await client.disconnect()


async def example_3_coordinated_team():
    """
    Example 3: Spawn a coordinated team of bots
    """
    print("\n=== Example 3: Coordinated Bot Team ===\n")
    
    client = JanusClient(api_key="janus_your_api_key")
    await client.connect()
    
    spawner = BotSpawner(client)
    
    # Spawn a research team
    print("Spawning Research Team...")
    team = await spawner.spawn_team(
        name="Research Team Alpha",
        description="Multi-bot research and analysis team",
        bots=[
            {
                "template": "researcher",
                "name": "PrimaryResearcher",
                "role": "lead",
                "config": {"searchEngines": ["google", "duckduckgo"]}
            },
            {
                "template": "researcher",
                "name": "FactChecker",
                "role": "verification",
                "config": {"verifyFacts": True, "sourcesRequired": 5}
            },
            {
                "template": "analyst",
                "name": "DataAnalyst",
                "role": "analysis",
                "config": {"analysisDepth": "comprehensive"}
            },
            {
                "template": "coordinator",
                "name": "TeamCoordinator",
                "role": "orchestration",
                "config": {"parallelTasks": 2}
            }
        ],
        persistent=False  # Terminate after task
    )
    
    print(f"✓ Team spawned with {len(team.bots)} bots")
    print(f"  Team ID: {team.team_id}")
    
    # Broadcast task to team
    print("\nBroadcasting task to team...")
    responses = await spawner.broadcast_to_team(
        team.team_id,
        """
Task: Comprehensive analysis of Rust vs Go for backend services

Team members:
- PrimaryResearcher: Find benchmarks, case studies, comparisons
- FactChecker: Verify all claims with multiple sources
- DataAnalyst: Analyze performance data and trends
- TeamCoordinator: Synthesize findings into final report

Begin work and coordinate through the coordinator.
"""
    )
    
    print(f"\nReceived {len(responses)} responses from team")
    for i, response in enumerate(responses):
        if response.response:
            print(f"\n--- Bot {i+1} ---")
            print(response.response[:200] + "...")
    
    # Get team metrics
    for bot in team.bots:
        if bot.bot_id:
            try:
                metrics = await spawner.get_metrics(bot.bot_id)
                print(f"\n{bot.template} metrics:")
                print(f"  Status: {metrics.status}")
                print(f"  Tasks completed: {metrics.tasks_completed}")
                print(f"  Uptime: {metrics.uptime}s")
            except Exception as e:
                print(f"  Error getting metrics: {e}")
    
    # Team will be auto-terminated (persistent=False)
    await client.disconnect()
    print("\n✓ Team session ended")


async def example_4_task_with_timeout():
    """
    Example 4: Assign task and wait for completion
    """
    print("\n=== Example 4: Task with Timeout ===\n")
    
    client = JanusClient(api_key="janus_your_api_key")
    await client.connect()
    
    spawner = BotSpawner(client)
    
    # Spawn coder bot
    print("Spawning CoderBot...")
    bot = await spawner.spawn(
        BotTemplate.CODER,
        name="CoderBot-Quick",
        config={
            "preferredLanguage": "python",
            "writeTests": True
        }
    )
    
    if bot.status == "spawned":
        print(f"✓ Bot spawned: {bot.bot_id}")
        
        # Assign a coding task
        print("\nAssigning coding task...")
        task = await spawner.assign_task(
            bot.bot_id,
            description="Implement a function that finds the longest palindromic substring",
            timeout=120,  # 2 minutes
            payload={
                "language": "python",
                "include_tests": True,
                "complexity": "O(n²) acceptable"
            }
        )
        
        print(f"Task ID: {task.task_id}")
        print(f"Status: {task.status}")
        
        # Wait for completion
        print("\nWaiting for task completion...")
        try:
            final_task = await spawner.wait_for_task(
                bot.bot_id,
                task.task_id,
                poll_interval=2.0,
                timeout=120.0
            )
            
            print(f"\nFinal Status: {final_task.status}")
            if final_task.result:
                print(f"\nResult:\n{final_task.result}")
            if final_task.error:
                print(f"\nError: {final_task.error}")
                
        except TimeoutError as e:
            print(f"\n✗ Task timed out: {e}")
        
        await spawner.terminate(bot.bot_id)
        print("\n✓ Bot terminated")
    
    await client.disconnect()


async def example_5_persistent_watcher():
    """
    Example 5: Spawn a long-running watcher bot
    """
    print("\n=== Example 5: Persistent Watcher Bot ===\n")
    
    client = JanusClient(api_key="janus_your_api_key")
    await client.connect()
    
    spawner = BotSpawner(client)
    
    # Spawn watcher bot
    print("Spawning WatcherBot...")
    bot = await spawner.spawn(
        BotTemplate.WATCHER,
        name="ChannelWatcher",
        config={
            "keywords": ["urgent", "emergency", "critical", "help"],
            "patterns": ["\\bbug\\b", "\\berror\\b", "\\bcrash\\b"],
            "alertThreshold": "medium",
            "sentimentTracking": True,
            "summaryInterval": 3600  # 1 hour summaries
        }
    )
    
    if bot.status == "spawned":
        print(f"✓ Watcher bot spawned: {bot.bot_id}")
        print(f"  API Key: {bot.api_key}")
        print("\nBot is now monitoring channels...")
        print("It will alert on keywords and provide hourly summaries.")
        
        # Get initial metrics
        metrics = await spawner.get_metrics(bot.bot_id)
        print(f"\nInitial metrics:")
        print(f"  Status: {metrics.status}")
        print(f"  Uptime: {metrics.uptime}s")
        
        # In production, this bot would run indefinitely
        # For demo, we'll pause and resume
        
        print("\nPausing bot...")
        await spawner.pause(bot.bot_id)
        
        print("Resuming bot...")
        await spawner.resume(bot.bot_id)
        
        # Don't terminate - leave it running
        print("\n✓ Bot remains active (persistent)")
        print(f"  To terminate later: spawner.terminate('{bot.bot_id}')")
    
    await client.disconnect()


async def example_6_dynamic_bot_creation():
    """
    Example 6: AI agent creates bots based on detected needs
    """
    print("\n=== Example 6: Dynamic Bot Creation ===\n")
    
    client = JanusClient(api_key="janus_your_api_key")
    await client.connect()
    
    spawner = BotSpawner(client)
    
    # Simulate AI agent detecting a task
    task_analysis = {
        "type": "multi_step",
        "steps": [
            {"type": "research", "topic": "GraphQL vs REST performance"},
            {"type": "analysis", "data": "benchmarks"},
            {"type": "coding", "language": "typescript", "task": "API client"}
        ]
    }
    
    print("Task Analysis:")
    print(f"  Type: {task_analysis['type']}")
    print(f"  Steps: {len(task_analysis['steps'])}")
    
    # Dynamically spawn bots based on task needs
    spawned_bots = []
    
    for step in task_analysis["steps"]:
        if step["type"] == "research":
            print(f"\n→ Spawning Researcher for: {step['topic']}")
            bot = await spawner.spawn(
                BotTemplate.RESEARCHER,
                name=f"Researcher-{step['topic'][:15]}",
                config={"summaryLength": "medium"}
            )
            spawned_bots.append(("research", bot))
            
        elif step["type"] == "analysis":
            print(f"\n→ Spawning Analyst for: {step['data']}")
            bot = await spawner.spawn(
                BotTemplate.ANALYST,
                name=f"Analyst-{step['data']}",
                config={"analysisDepth": "comprehensive"}
            )
            spawned_bots.append(("analysis", bot))
            
        elif step["type"] == "coding":
            print(f"\n→ Spawning Coder for: {step['language']}")
            bot = await spawner.spawn(
                BotTemplate.CODER,
                name=f"Coder-{step['language']}",
                config={"preferredLanguage": step["language"]}
            )
            spawned_bots.append(("coding", bot))
    
    print(f"\n✓ Spawned {len(spawned_bots)} bots dynamically")
    
    # Show active bots
    active = await spawner.get_active_bots()
    print(f"\nActive bots: {len(active)}")
    for bot in active:
        print(f"  - {bot['template']}: {bot['botId'][:20]}...")
    
    # Cleanup
    print("\nTerminating all spawned bots...")
    for _, bot in spawned_bots:
        if bot.bot_id:
            await spawner.terminate(bot.bot_id)
    
    print("✓ All bots terminated")
    
    await client.disconnect()


# Run all examples
async def main():
    """Run all examples"""
    print("=" * 60)
    print("JANUS AUTONOMOUS BOT SPAWNING EXAMPLES")
    print("=" * 60)
    
    # Run examples
    await example_1_spawn_single_bot()
    await example_2_bot_to_bot_communication()
    await example_3_coordinated_team()
    await example_4_task_with_timeout()
    await example_5_persistent_watcher()
    await example_6_dynamic_bot_creation()
    
    print("\n" + "=" * 60)
    print("ALL EXAMPLES COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
