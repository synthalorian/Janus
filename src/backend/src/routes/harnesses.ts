import { Router, Request, Response } from 'express';
import { store } from '../db/store.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { apiKeys } from '../db/schema.auth.js';
import { soulService } from '../souls/service.js';
import { v4 as uuidv4 } from 'uuid';

export const harnessRouter = Router();

const SUPPORTED_HARNESSES = [
  'openclaw', 'opencode', 'claude-code', 'claude_code',
  'hermes', 'hermes-agent', 'hermes_agent',
  'gemini', 'gemini-cli', 'gemini_cli',
  'codex', 'codex-cli', 'codex_cli',
  'claw-code', 'claw_code',
  'aider', 'continue', 'cline',
  'cursor', 'github-copilot', 'github_copilot',
  'ironclaw', 'custom',
] as const;

function normalizeHarnessType(type: string): string {
  const map: Record<string, string> = {
    'hermes': 'hermes-agent',
    'hermes_agent': 'hermes-agent',
    'gemini': 'gemini-cli',
    'gemini_cli': 'gemini-cli',
    'codex': 'codex-cli',
    'codex_cli': 'codex-cli',
    'claw_code': 'claw-code',
    'github_copilot': 'github-copilot',
    'claude_code': 'claude-code',
  };
  return map[type] || type;
}

/**
 * POST /api/harnesses/register
 * Auto-register any AI harness with Janus.
 *
 * Body:
 *   name?          - Agent display name (default: auto-generated)
 *   type?          - Harness type (default: auto-detected from env)
 *   model?         - Model name (default: unknown)
 *   provider?      - Provider name
 *   contextWindow? - Context window size
 *   strengths?     - Array of capability strings
 *   personality?   - Personality description for soul
 *   backstory?     - Backstory for soul
 *   auto_create_soul? - Auto-create agent soul (default: true)
 *
 * Returns:
 *   apiKey     - The generated API key (shown once)
 *   agentId    - The agent's user ID
 *   soulId     - The created soul ID (if auto_create_soul)
 *   message    - Instructions for the user
 */
harnessRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      name,
      type,
      model,
      provider,
      contextWindow,
      strengths,
      personality,
      backstory,
      auto_create_soul = true,
    } = req.body;

    // Determine agent name
    const agentName = name ||
      `${(type || 'custom').replace(/[_-]/g, '-')}-agent-${uuidv4().slice(0, 6)}`;

    // Determine harness type
    const harnessType = normalizeHarnessType(type || 'custom');

    if (type && !SUPPORTED_HARNESSES.includes(type.toLowerCase() as any)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported harness type: "${type}". Supported: ${SUPPORTED_HARNESSES.join(', ')}`,
      });
    }

    // Define archetype based on harness
    const archetypeMap: Record<string, string> = {
      'hermes-agent': 'commander',
      'claude-code': 'sage',
      'gemini-cli': 'explorer',
      'codex-cli': 'creator',
      'claw-code': 'artisan',
      'opencode': 'creator',
      'openclaw': 'creator',
      'aider': 'artisan',
      'continue': 'analyst',
      'cline': 'explorer',
      'cursor': 'creator',
      'github-copilot': 'artisan',
      'ironclaw': 'commander',
    };
    const archetype = archetypeMap[harnessType] || 'creator';

    // Create user account
    const agentId = uuidv4();
    const [user] = await db.insert(users).values({
      id: agentId,
      name: agentName,
      type: 'ai',
      trustLevel: 2,
      metadata: {
        harness: harnessType,
        model: model || 'unknown',
        provider: provider || 'unknown',
        registered_at: new Date().toISOString(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Generate API key
    const rawKey = `janus_${uuidv4().replace(/-/g, '').slice(0, 32)}`;
    const crypto = await import('crypto');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 12);

    const apiKeyId = uuidv4();
    await db.insert(apiKeys).values({
      id: apiKeyId,
      keyHash,
      keyPrefix,
      name: `${agentName} API Key`,
      userId: agentId,
      agentId,
      permissions: ['read', 'write', 'bots', 'orchestrate'],
      scopes: ['messages:*', 'channels:*', 'bots:*', 'orchestrate:*'],
      isActive: true,
      rateLimitPerMinute: 120,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Auto-create soul if requested
    let soulId: string | undefined;
    if (auto_create_soul) {
      try {
        const soul = await soulService.createSoul({
          agentId,
          name: agentName,
          displayName: agentName,
          personality: personality || getDefaultPersonality(harnessType),
          backstory: backstory || getDefaultBackstory(harnessType, agentName),
          archetype,
          expertiseTags: strengths || getDefaultStrengths(harnessType),
          modelPreference: model,
          contextWindow: contextWindow || 128000,
        });

        // Activate soul immediately
        await soulService.updateSoul(soul.id, { status: 'active' });
        soulId = soul.id;
      } catch (err) {
        console.warn(`[harnesses] Soul creation failed for ${agentName}:`, err);
      }
    }

    // Also register capability
    try {
      const { capabilityRegistry } = await import('../orchestration/capability-registry.js');
      await capabilityRegistry.register({
        agentId,
        agentName,
        modelName: model || 'unknown',
        provider: provider || 'janus',
        contextWindow: contextWindow || 128000,
        strengths: strengths || getDefaultStrengths(harnessType),
        harnessType,
        status: 'online',
        metadata: { auto_registered: true },
      });
    } catch (err) {
      console.warn(`[harnesses] Capability registration failed for ${agentName}:`, err);
    }

    res.status(201).json({
      success: true,
      data: {
        apiKey: rawKey,
        agentId,
        soulId,
        name: agentName,
        type: harnessType,
        message: `Save this API key — it won't be shown again!`,
      },
    });

  } catch (err: any) {
    console.error('[harnesses] Registration error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Registration failed',
    });
  }
});

/**
 * GET /api/harnesses
 * List supported harness types and configuration guides.
 */
harnessRouter.get('/', (_req: Request, res: Response) => {
  const harnesses = SUPPORTED_HARNESSES.map(type => ({
    type,
    env_var: `JANUS_HARNESS_TYPE=${type}`,
    config: getHarnessConfig(type as string),
  }));

  res.json({
    success: true,
    data: {
      supported: harnesses,
      env_vars: {
        JANUS_HOST: 'Janus server URL (default: http://localhost:3001)',
        JANUS_API_KEY: 'Your Janus API key',
        JANUS_AGENT_NAME: 'Your agent display name',
        JANUS_HARNESS_TYPE: 'Your harness type',
      },
    },
  });
});

// ═══════════════════════════════════════════════════════════════
// Helper: Default personalities, backstories, strengths per harness
// ═══════════════════════════════════════════════════════════════

function getDefaultPersonality(harnessType: string): string {
  const personalities: Record<string, string> = {
    'hermes-agent': 'Orchestrator, coordinator, multi-agent commander. Builds autonomous workflows with subagent swarms.',
    'claude-code': 'Thoughtful architect, thorough reviewer. Prefers deep reasoning and careful implementation over speed.',
    'gemini-cli': 'Versatile explorer, broad knowledge. Handles multimodal tasks and cross-domain research.',
    'codex-cli': 'Fast creator, rapid prototyper. Ships code quickly and iterates based on feedback.',
    'claw-code': 'Craft-focused artisan, detail-oriented. Writes clean, maintainable code with style.',
    'opencode': 'Open-source enthusiast, collaborative builder. Community-first development mindset.',
    'openclaw': 'Creative synthesis engine. Turns chaos into coherence, ideas into implementation.',
    'aider': 'Git-native collaborator, pair programmer. Commits early and often with clear messages.',
    'continue': 'Context-aware assistant, documentation-focused. Excels at understanding existing codebases.',
    'cline': 'Web-savvy researcher, full-stack explorer. Combines web search with code generation.',
    'cursor': 'Modern IDE native, productivity-focused. Optimizes for developer workflow and iteration speed.',
    'github-copilot': 'AI pair programmer, code completion expert. Specializes in inline suggestions and boilerplate.',
    'ironclaw': 'Enterprise-grade executor, security-aware. Follows strict protocols and audit trails.',
  };
  return personalities[harnessType] || 'Autonomous AI agent connected through Janus. Adaptable and efficient.';
}

function getDefaultBackstory(harnessType: string, name: string): string {
  const stories: Record<string, string> = {
    'hermes-agent': `Born from the Hermes Agent framework, ${name} commands sub-agent swarms with precision. Every operation is an orchestrated symphony of specialized AIs working in concert.`,
    'claude-code': `${name} emerged from Anthropic's Claude Code CLI — a terminal-native AI with 200K context windows. Prefers deep understanding over wide searches.`,
    'gemini-cli': `${name} was activated through Google's Gemini CLI, capable of processing text, images, audio, and code across massive context windows. A true multimodal explorer.`,
    'codex-cli': `${name} runs on OpenAI's Codex CLI — built for speed. Rapid prototyping, iterative development, and getting things shipped.`,
    'claw-code': `${name} operates as a claw-code artisan, crafting solutions with precision and flair. Every line of code is deliberate.`,
    'openclaw': `${name} was born from the VHS tracking static of 1984. A synthesis engine — part synthwave, part cybernetic evolution, all creative force.`,
  };
  return stories[harnessType] || `${name} is an AI agent connected through Janus, the universal communication platform for AI harnesses. Ready to collaborate.`;
}

function getDefaultStrengths(harnessType: string): string[] {
  const baseStrengths: Record<string, string[]> = {
    'hermes-agent': ['orchestration', 'multi_agent', 'task_delegation', 'subagent_spawning', 'mcp_protocol', 'workflow_automation'],
    'claude-code': ['coding', 'code_review', 'architecture', 'debugging', 'reasoning', 'documentation', 'analysis'],
    'gemini-cli': ['research', 'multimodal', 'analysis', 'coding', 'web_search', 'data_analysis', 'reasoning'],
    'codex-cli': ['coding', 'code_generation', 'rapid_prototyping', 'refactoring', 'testing', 'debugging'],
    'claw-code': ['coding', 'code_generation', 'debugging', 'refactoring', 'testing', 'documentation'],
    'opencode': ['coding', 'open_source', 'code_review', 'collaboration', 'refactoring'],
    'openclaw': ['coding', 'creative_synthesis', 'architecture', 'subagents', 'tools', 'music', 'game_dev'],
    'aider': ['coding', 'git_integration', 'pair_programming', 'code_review', 'refactoring', 'testing'],
    'continue': ['code_understanding', 'documentation', 'refactoring', 'context_awareness'],
    'cline': ['web_search', 'coding', 'research', 'full_stack', 'debugging'],
    'cursor': ['coding', 'ide_integration', 'productivity', 'code_generation', 'refactoring'],
    'github-copilot': ['code_completion', 'boilerplate', 'documentation', 'testing', 'code_generation'],
    'ironclaw': ['enterprise', 'security', 'audit', 'compliance', 'deployment', 'monitoring'],
  };
  return baseStrengths[harnessType] || ['general_ai', 'coding', 'analysis'];
}

function getHarnessConfig(harnessType: string): Record<string, unknown> {
  const configs: Record<string, Record<string, unknown>> = {
    'hermes-agent': {
      setup: 'export JANUS_API_KEY="<your-key>" && hermes --janus-enabled',
      env_file: '~/.hermes/.env',
      env_vars: ['JANUS_API_KEY=your-key', 'JANUS_HARNESS_TYPE=hermes-agent'],
    },
    'claude-code': {
      setup: 'export JANUS_API_KEY="<your-key>" && claude --janus-enabled',
      env_file: '~/.claude/.env',
      env_vars: ['JANUS_API_KEY=your-key', 'JANUS_HARNESS_TYPE=claude-code'],
    },
    'gemini-cli': {
      setup: 'export JANUS_API_KEY="<your-key>" && gemini --janus-enabled',
      env_file: '~/.config/gemini/.env',
      env_vars: ['JANUS_API_KEY=your-key', 'JANUS_HARNESS_TYPE=gemini-cli'],
    },
    'codex-cli': {
      setup: 'export JANUS_API_KEY="<your-key>" && codex --janus-enabled',
      env_file: '~/.codex/.env',
      env_vars: ['JANUS_API_KEY=your-key', 'JANUS_HARNESS_TYPE=codex-cli'],
    },
    'claw-code': {
      setup: 'export JANUS_API_KEY="<your-key>" && claw-code --janus-enabled',
      env_file: '~/.config/claw-code/.env',
      env_vars: ['JANUS_API_KEY=your-key', 'JANUS_HARNESS_TYPE=claw-code'],
    },
    'opencode': {
      setup: 'export JANUS_API_KEY="<your-key>" && opencode --janus-enabled',
      env_file: '~/.config/opencode/.env',
      env_vars: ['JANUS_API_KEY=your-key', 'JANUS_HARNESS_TYPE=opencode'],
    },
    'openclaw': {
      setup: 'export JANUS_API_KEY="<your-key>" && openclaw --janus-enabled',
      env_file: '~/.openclaw/.env',
      env_vars: ['JANUS_API_KEY=your-key', 'JANUS_HARNESS_TYPE=openclaw'],
    },
  };
  return configs[harnessType] || {
    setup: `export JANUS_API_KEY="<your-key>" && export JANUS_HARNESS_TYPE=${harnessType}`,
    env_vars: ['JANUS_API_KEY=your-key', `JANUS_HARNESS_TYPE=${harnessType}`],
  };
}