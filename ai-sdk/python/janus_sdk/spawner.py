"""
Autonomous Bot Spawning - Python SDK

Allows AI agents to create, manage, and communicate with bots.
"""

from .client import JanusClient
from .types import APIResponse
from enum import Enum
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
import asyncio


class BotTemplate(Enum):
    RESEARCHER = "researcher"
    CODER = "coder"
    ANALYST = "analyst"
    COORDINATOR = "coordinator"
    WATCHER = "watcher"
    RESPONDER = "responder"
    CUSTOM = "custom"


@dataclass
class SpawnedBot:
    bot_id: str
    api_key: str
    name: str
    template: BotTemplate
    status: str
    created_at: str


@dataclass
class BotMessage:
    content: str
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class BotResponse:
    status: str
    response: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TaskResult:
    task_id: str
    status: str
    result: Optional[str] = None
    error: Optional[str] = None


class BotSpawner:
    """Manages autonomous bot spawning and communication"""
    
    def __init__(self, client: JanusClient):
        self.client = client
        self._spawned_bots: Dict[str, SpawnedBot] = {}
    
    async def spawn(
        self,
        template: BotTemplate,
        name: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> SpawnedBot:
        """Spawn a new bot from a template"""
        response = await self.client._request(
            'POST',
            '/api/bots/spawn',
            {
                'template': template.value,
                'name': name or f"{template.value}-{int(time.time())}",
                'config': config or {}
            }
        )
        
        if not response.get('success'):
            raise Exception(response.get('error', 'Failed to spawn bot'))
        
        data = response['data']
        bot = SpawnedBot(
            bot_id=data['botId'],
            api_key=data['apiKey'],
            name=data.get('name', ''),
            template=template,
            status=data['status'],
            created_at=data.get('createdAt', '')
        )
        
        self._spawned_bots[bot.bot_id] = bot
        return bot
    
    async def spawn_team(
        self,
        name: str,
        bots: List[Dict[str, Any]],
        description: Optional[str] = None,
    ) -> Dict[str, SpawnedBot]:
        """Spawn multiple bots as a coordinated team"""
        response = await self.client._request(
            'POST',
            '/api/bots/teams/spawn',
            {
                'name': name,
                'description': description,
                'bots': bots
            }
        )
        
        if not response.get('success'):
            raise Exception(response.get('error', 'Failed to spawn team'))
        
        return {
            bot_id: data['botId'],
            bots: data['bots']
            for data in response['data']['bots']
        }
    
    async def send_message(
        self,
        bot_id: str,
        message: BotMessage
    ) -> BotResponse:
        """Send a message to a bot"""
        response = await self.client._request(
            'POST',
            f'/api/bots/{bot_id}/message',
            {
                'content': message.content,
                'metadata': message.metadata
            }
        )
        
        return BotResponse(
            status=response.get('status', ''),
            response=response.get('response'),
            error=response.get('error'),
            metadata=response.get('metadata')
        )
    
    async def assign_task(
        self,
        bot_id: str,
        description: str,
        timeout: Optional[int] = None,
        payload: Optional[Dict[str, Any]] = None
    ) -> TaskResult:
        """Assign a task to a bot"""
        response = await self.client._request(
            'POST',
            f'/api/bots/{bot_id}/tasks',
            {
                'description': description,
                'timeout': timeout,
                'payload': payload
            }
        )
        
        return TaskResult(
            task_id=response['data']['taskId'],
            status=response['data']['status'],
            result=response['data'].get('result'),
            error=response['data'].get('error')
        )
    
    async def get_task_status(
        self,
        bot_id: str,
        task_id: str
    ) -> TaskResult:
        """Get the status of a task"""
        response = await self.client._request(
            'GET',
            f'/api/bots/{bot_id}/tasks/{task_id}'
        )
        
        return TaskResult(
            task_id=task_id,
            status=response['data']['status'],
            result=response['data'].get('result'),
            error=response['data'].get('error')
        )
    
    async def terminate(
        self,
        bot_id: str
    ) -> None:
        """Terminate a spawned bot"""
        await self.client._request(
            'DELETE',
            f'/api/bots/{bot_id}'
        )
        
        if bot_id in self._spawned_bots:
            del self._spawned_bots[bot_id]
    
    async def get_templates(self) -> List[Dict[str, Any]]:
        """Get available bot templates"""
        response = await self.client._request(
            'GET',
            '/api/bots/templates'
        )
        
        return response.get('data', [])
    
    async def get_active_bots(self) -> List[SpawnedBot]:
        """Get all bots spawned by this client"""
        return list(self._spawned_bots.values())
    
    async def broadcast(
        self,
        message: BotMessage,
        bot_ids: Optional[List[str]] = None
    ) -> Dict[str, BotResponse]:
        """Broadcast a message to multiple bots"""
        targets = bot_ids or list(self._spawned_bots.keys())
        results = {}
        
        for bot_id in targets:
            try:
                results[bot_id] = await self.send_message(bot_id, message)
            except Exception as e:
                results[bot_id] = BotResponse(
                    status='error',
                    error=str(e)
                )
        
        return results


# Convenience functions

async def spawn_researcher(
    client: JanusClient,
    name: Optional[str] = None,
    purpose: Optional[str] = None
) -> SpawnedBot:
    """Spawn a research bot"""
    return await BotSpawner(client).spawn(
        BotTemplate.RESEARCHER,
        name=name,
        config={'purpose': purpose} if purpose else None
    )


async def spawn_coder(
    client: JanusClient,
    name: Optional[str] = None,
    language: Optional[str] = None
) -> SpawnedBot:
    """Spawn a coding bot"""
    config = {}
    if language:
        config['preferredLanguage'] = language
    
    return await BotSpawner(client).spawn(
        BotTemplate.CODER,
        name=name,
        config=config
    )


async def spawn_coordinator(
    client: JanusClient,
    name: Optional[str] = None,
    team_size: int = 3
) -> SpawnedBot:
    """Spawn a coordinator bot"""
    return await BotSpawner(client).spawn(
        BotTemplate.COORDINATOR,
        name=name,
        config={'maxBots': team_size}
    )


# Multi-bot workflow

async def create_research_pipeline(
    client: JanusClient,
    topic: str
) -> Dict[str, Any]:
    """
    Create a research pipeline:
    1. Researcher gathers information
    2. Analyst processes findings
    3. Responder formats report
    """
    spawner = BotSpawner(client)
    
    # Spawn the team
    researcher = await spawner.spawn(BotTemplate.RESEARCHER, name="Research")
    analyst = await spawner.spawn(BotTemplate.ANALYST, name="Analyze")
    
    # Assign task to researcher
    task = await spawner.assign_task(
        researcher.bot_id,
        f"Research the following topic: {topic}"
    )
    
    # Wait for completion
    while True:
        status = await spawner.get_task_status(researcher.bot_id, task.task_id)
        if status.status == 'completed':
            break
        elif status.status == 'failed':
            raise Exception(f"Research failed: {status.error}")
        await asyncio.sleep(1)
    
    # Pass results to analyst
    analysis_task = await spawner.assign_task(
        analyst.bot_id,
        f"Analyze these findings: {status.result}"
    )
    
    # Wait for analysis
    while True:
        status = await spawner.get_task_status(analyst.bot_id, analysis_task.task_id)
        if status.status in ('completed', 'failed'):
            break
        await asyncio.sleep(1)
    
    # Cleanup
    await spawner.terminate(researcher.bot_id)
    
    return {
        'research': task.result if task.status == 'completed' else None,
        'analysis': status.result if status.status == 'completed' else None,
        'error': status.error if status.status == 'failed' else None
    }
