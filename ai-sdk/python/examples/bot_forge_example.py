"""
Example: Bot Forge - Multi-Bot Communication

This example demonstrates:
1. Creating bots
2. Bot-to-bot messaging
3. Bot command handling
4. Bot-to-AI communication
5. Bot coordination
"""

import asyncio
from janus_sdk import HarnessAdapterFactory, HarnessType
from janus_sdk.bot import JanusBot, BotConfig, BotFactory


async def bot_to_bot_communication():
    """
    Demonstrate two bots communicating with each other.
    
    Scenario:
    - WeatherBot provides weather data
    - ScheduleBot manages schedules
    - They coordinate to suggest optimal meeting times
    """
    
    print("=" * 70)
    print("🤖 Bot-to-Bot Communication Demo")
    print("=" * 70)
    
    # Create a harness adapter for setup
    admin = HarnessAdapterFactory.create_adapter(
        HarnessType.OPENCLAW,
        agent_id="admin",
        agent_name="Admin"
    )
    await admin.connect()
    
    # Create WeatherBot
    print("\n1. Creating WeatherBot...")
    weather_bot_info = await BotFactory.create_bot(
        admin.client,
        name="WeatherBot",
        description="Provides weather forecasts and alerts",
        bot_type="ai_agent",
        capabilities=["fetch_weather", "provide_forecasts"],
    )
    print(f"   ✅ Created: {weather_bot_info['bot']['name']}")
    print(f"   🔑 API Key: {weather_bot_info['apiKey'][:20]}...")
    
    # Create ScheduleBot
    print("\n2. Creating ScheduleBot...")
    schedule_bot_info = await BotFactory.create_bot(
        admin.client,
        name="ScheduleBot",
        description="Manages schedules and suggests optimal meeting times",
        bot_type="ai_agent",
        capabilities=["manage_calendar", "suggest_times", "coordinate_meetings"],
    )
    print(f"   ✅ Created: {schedule_bot_info['bot']['name']}")
    print(f"   🔑 API Key: {schedule_bot_info['apiKey'][:20]}...")
    
    # Initialize bot clients
    weather_bot = JanusBot(BotConfig(
        bot_id=weather_bot_info['bot']['id'],
        api_key=weather_bot_info['apiKey'],
        name="WeatherBot"
    ))
    
    schedule_bot = JanusBot(BotConfig(
        bot_id=schedule_bot_info['bot']['id'],
        api_key=schedule_bot_info['apiKey'],
        name="ScheduleBot"
    ))
    
    # Setup message handlers
    @weather_bot.on_event("message")
    async def weather_handle_message(data):
        print(f"\n   📨 WeatherBot received: {data['content']}")
        
        # Parse request
        if "forecast" in data['content'].lower():
            # Send weather data back
            await weather_bot.send_message(
                to_bot_id=data['fromBotId'],
                content="🌤️ Weather forecast: Sunny, 72°F, 0% rain",
                message_type="response",
                metadata={"location": "New York", "confidence": 0.95}
            )
    
    @schedule_bot.on_event("message")
    async def schedule_handle_message(data):
        print(f"\n   📨 ScheduleBot received: {data['content']}")
        
        if "weather data" in data['content'].lower():
            # Got weather data, suggest meeting time
            await schedule_bot.send_message(
                to_bot_id=data['fromBotId'],
                content="✅ Optimal meeting time: 2:00 PM (good weather + availability)",
                message_type="suggestion",
                metadata={"time": "14:00", "confidence": 0.88}
            )
    
    # Connect bots
    print("\n3. Connecting bots...")
    await weather_bot.connect()
    await schedule_bot.connect()
    
    # Simulate coordination
    print("\n4. Bot Coordination Scenario:")
    print("-" * 70)
    
    # ScheduleBot requests weather
    print("\n   📤 ScheduleBot → WeatherBot: 'Need weather forecast for NYC'")
    await schedule_bot.send_message(
        to_bot_id=weather_bot.config.bot_id,
        content="Need weather forecast for NYC to suggest meeting time",
        message_type="query"
    )
    
    await asyncio.sleep(1)  # Wait for response
    
    # ScheduleBot processes and responds
    print("\n   📤 ScheduleBot → WeatherBot: 'Based on weather, suggesting 2PM'")
    await schedule_bot.send_message(
        to_bot_id=weather_bot.config.bot_id,
        content="Received weather data. Optimal meeting time: 2:00 PM",
        message_type="suggestion"
    )
    
    await asyncio.sleep(1)
    
    print("\n" + "=" * 70)
    print("✅ Bot coordination complete!")
    print("=" * 70)
    
    # Cleanup
    await weather_bot.stop()
    await schedule_bot.stop()
    await admin.disconnect()


async def bot_and_ai_collaboration():
    """
    Demonstrate bot working with AI harness (OpenClaw).
    
    Scenario:
    - CodeReviewBot analyzes code
    - synthclaw (OpenClaw) reviews suggestions
    - They collaborate on code improvements
    """
    
    print("\n" + "=" * 70)
    print("🤖🎹🦞 Bot + AI Collaboration Demo")
    print("=" * 70)
    
    # Setup
    admin = HarnessAdapterFactory.create_adapter(
        HarnessType.OPENCLAW,
        agent_id="admin",
        agent_name="Admin"
    )
    await admin.connect()
    
    # Create CodeReviewBot
    print("\n1. Creating CodeReviewBot...")
    review_bot_info = await BotFactory.create_bot(
        admin.client,
        name="CodeReviewBot",
        description="Analyzes code and suggests improvements",
        bot_type="ai_agent",
        capabilities=["analyze_code", "suggest_refactors", "detect_bugs"],
    )
    print(f"   ✅ Created CodeReviewBot")
    
    # synthclaw as AI reviewer
    print("\n2. synthclaw (OpenClaw) as senior reviewer...")
    synthclaw = HarnessAdapterFactory.create_adapter(
        HarnessType.OPENCLAW,
        agent_id="synthclaw",
        agent_name="synthclaw 🎹🦞"
    )
    await synthclaw.connect()
    
    # Initialize bot
    review_bot = JanusBot(BotConfig(
        bot_id=review_bot_info['bot']['id'],
        api_key=review_bot_info['apiKey'],
        name="CodeReviewBot"
    ))
    
    @review_bot.on_command("review")
    async def handle_review(interaction, params):
        """Handle code review command."""
        code = params.get("code", "")
        
        # Bot analyzes
        issues = []
        if "var " in code:
            issues.append("Consider using 'const' or 'let' instead of 'var'")
        if "console.log" in code:
            issues.append("Remove debug console.log statements")
        
        # Send to synthclaw for senior review
        await synthclaw.send_to_janus_channel(
            "code-review",
            f"🤖 CodeReviewBot found {len(issues)} issues:\n" + 
            "\n".join(f"  - {i}" for i in issues) +
            "\n\n🎹🦞 Requesting senior review from synthclaw..."
        )
        
        # synthclaw reviews
        await asyncio.sleep(0.5)
        await synthclaw.send_to_janus_channel(
            "code-review",
            "🎹🦞 synthclaw: Good catches! Also check:\n"
            "  - Missing error handling\n"
            "  - Consider async/await pattern\n"
            "  - Add input validation"
        )
        
        # Bot acknowledges
        await interaction.reply(
            f"✅ Code review complete!\n\n"
            f"🤖 Bot found: {len(issues)} issues\n"
            f"🎹🦞 synthclaw added: 3 more suggestions\n\n"
            f"See #code-review channel for details."
        )
    
    await review_bot.connect()
    
    # Simulate interaction
    print("\n3. Code Review Scenario:")
    print("-" * 70)
    print("   User: /review code='function test() { var x = 1; console.log(x); }'")
    
    # Create interaction (simulated)
    from janus_sdk.bot import Interaction
    
    # This would normally come from the server
    print("\n   🤖 CodeReviewBot analyzing...")
    print("   🎹🦞 synthclaw reviewing...")
    
    await asyncio.sleep(1)
    
    print("\n   ✅ Review complete!")
    print("   Found: var usage, console.log, missing error handling")
    
    # Cleanup
    await review_bot.stop()
    await synthclaw.disconnect()
    await admin.disconnect()


async def bot_coordination_protocol():
    """
    Demonstrate protocol-based bot coordination.
    
    Multiple bots use a shared protocol to accomplish a task.
    """
    
    print("\n" + "=" * 70)
    print("🔌 Bot Coordination Protocol Demo")
    print("=" * 70)
    
    admin = HarnessAdapterFactory.create_adapter(
        HarnessType.OPENCLAW,
        agent_id="admin",
        agent_name="Admin"
    )
    await admin.connect()
    
    # Create task force of bots
    bots_config = [
        {"name": "ResearchBot", "role": "gather_info"},
        {"name": "AnalysisBot", "role": "analyze_data"},
        {"name": "ReportBot", "role": "generate_report"},
    ]
    
    bot_instances = []
    
    for config in bots_config:
        info = await BotFactory.create_bot(
            admin.client,
            name=config["name"],
            description=f"Task force member - {config['role']}",
            bot_type="integration",
        )
        
        bot = JanusBot(BotConfig(
            bot_id=info['bot']['id'],
            api_key=info['apiKey'],
            name=config["name"]
        ))
        
        bot_instances.append({"bot": bot, "role": config["role"], "name": config["name"]})
        print(f"   ✅ Created {config['name']} ({config['role']})")
    
    # Setup coordination
    print("\n2. Setting up coordination protocol...")
    
    results = {}
    
    @bot_instances[0]["bot"].on_event("message")
    async def research_handler(data):
        if data.get("messageType") == "task_assign":
            print(f"\n   🔍 ResearchBot gathering information...")
            results["research"] = "Collected data on topic"
            
            # Pass to analysis
            await bot_instances[0]["bot"].send_message(
                to_bot_id=bot_instances[1]["bot"].config.bot_id,
                content="Research complete. Data ready for analysis.",
                message_type="handoff",
                metadata={"stage": "research_complete", "data": results["research"]}
            )
    
    @bot_instances[1]["bot"].on_event("message")
    async def analysis_handler(data):
        if data.get("messageType") == "handoff":
            print(f"   📊 AnalysisBot analyzing data...")
            results["analysis"] = "Analyzed: Key findings identified"
            
            # Pass to report
            await bot_instances[1]["bot"].send_message(
                to_bot_id=bot_instances[2]["bot"].config.bot_id,
                content="Analysis complete. Ready for report generation.",
                message_type="handoff",
                metadata={"stage": "analysis_complete", "findings": results["analysis"]}
            )
    
    @bot_instances[2]["bot"].on_event("message")
    async def report_handler(data):
        if data.get("messageType") == "handoff":
            print(f"   📄 ReportBot generating final report...")
            results["report"] = "Report: Executive summary generated"
            print(f"\n   ✅ Task force complete!")
            print(f"   Final output: {results['report']}")
    
    # Connect all
    for instance in bot_instances:
        await instance["bot"].connect()
    
    # Start task
    print("\n3. Starting coordinated task...")
    print("-" * 70)
    
    await bot_instances[0]["bot"].send_message(
        to_bot_id=bot_instances[0]["bot"].config.bot_id,
        content="Begin research task",
        message_type="task_assign"
    )
    
    await asyncio.sleep(2)
    
    print("\n   📋 Workflow:")
    print(f"      1. {results.get('research', 'N/A')}")
    print(f"      2. {results.get('analysis', 'N/A')}")
    print(f"      3. {results.get('report', 'N/A')}")
    
    # Cleanup
    for instance in bot_instances:
        await instance["bot"].stop()
    await admin.disconnect()


async def main():
    """Run all bot demos."""
    
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                    🤖 JANUS BOT FORGE DEMOS 🤖                       ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  Demonstrating bot-to-bot communication, bot-AI collaboration,       ║
║  and multi-bot coordination protocols.                               ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
""")
    
    await bot_to_bot_communication()
    await bot_and_ai_collaboration()
    await bot_coordination_protocol()
    
    print("\n" + "=" * 70)
    print("🎉 All Bot Forge Demos Complete!")
    print("=" * 70)
    print("\nKey Features Demonstrated:")
    print("  ✅ Bot creation and registration")
    print("  ✅ Bot-to-bot direct messaging")
    print("  ✅ Bot + AI harness collaboration")
    print("  ✅ Multi-bot coordination protocols")
    print("  ✅ Command handling and interactions")
    print("  ✅ Event-driven bot communication")


if __name__ == "__main__":
    asyncio.run(main())
