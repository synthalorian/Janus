/**
 * LLM Service
 *
 * Pluggable LLM provider interface for the Janus backend.
 * Supports any OpenAI-compatible API (OpenAI, Anthropic via proxy,
 * local models like Ollama, vLLM, etc.).
 */

import { z } from 'zod';

// ─── Configuration ──────────────────────────────────────────────

export interface LLMConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

function getEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export function loadLLMConfig(): LLMConfig {
  return {
    apiKey: getEnv('LLM_API_KEY', ''),
    baseURL: getEnv('LLM_BASE_URL', 'https://api.openai.com/v1'),
    model: getEnv('LLM_MODEL', 'gpt-4o-mini'),
    temperature: parseFloat(getEnv('LLM_TEMPERATURE', '0.2')),
    maxTokens: parseInt(getEnv('LLM_MAX_TOKENS', '2048'), 10),
    timeoutMs: parseInt(getEnv('LLM_TIMEOUT_MS', '30000'), 10),
  };
}

export function isLLMEnabled(): boolean {
  const cfg = loadLLMConfig();
  return cfg.apiKey.length > 0;
}

// ─── Types ────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model?: string;
}

// ─── Zod Schema for Goal Decomposition ───────────────────────────

const TaskSchema = z.object({
  id: z.string(),
  template: z.string(),
  description: z.string(),
  dependsOn: z.array(z.string()),
  requiredStrengths: z.array(z.string()),
  preferredHarness: z.string().optional(),
  minContextWindow: z.number().optional(),
});

const PlanSchema = z.object({
  tasks: z.array(TaskSchema),
  parallelGroups: z.array(z.array(z.string())),
});

export type LLMPlanDefinition = z.infer<typeof PlanSchema>;

// ─── Provider Interface ───────────────────────────────────────────

export interface LLMProvider {
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
}

// ─── OpenAI-Compatible Provider ─────────────────────────────────

export class OpenAICompatibleProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config?: LLMConfig) {
    this.config = config || loadLLMConfig();
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => 'unknown');
        throw new Error(`LLM API error ${res.status}: ${text}`);
      }

      const json = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        model?: string;
      };
      const choice = json.choices?.[0];
      const content = choice?.message?.content || '';

      return {
        content,
        usage: json.usage,
        model: json.model,
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ─── Goal Decomposition Prompt ──────────────────────────────────

const SYSTEM_PROMPT = `You are Janus Orchestrator, an AI swarm planner.
Decompose the user's goal into a directed acyclic graph (DAG) of subtasks.

Available bot templates and their strengths:
- researcher:   research, web_search, summarization, information_gathering
- coder:        coding, code_generation, debugging, testing, refactoring
- analyst:      analysis, data_analysis, report_generation, metrics
- coordinator:  coordination, task_delegation, project_management
- custom:       design, architecture, planning, review, validation, deployment, devops, documentation, technical_writing

Response MUST be valid JSON with this exact structure:
{
  "tasks": [
    {
      "id": "task-1",
      "template": "researcher",
      "description": "Research and gather information...",
      "dependsOn": [],
      "requiredStrengths": ["research", "web_search", "summarization"]
    }
  ],
  "parallelGroups": [["task-1"], ["task-2"]]
}

Rules:
1. task ids must be exactly "task-1", "task-2", etc. in order of creation.
2. dependsOn must reference existing task ids.
3. parallelGroups lists task ids that can run concurrently (topological layers).
4. Each parallelGroup layer must only contain tasks whose dependencies are in earlier layers.
5. Use the simplest template that fits the task.
6. If the goal is simple, return a single task with template "coordinator".
7. NEVER include markdown fences or explanations outside the JSON.`;

// ─── Service ──────────────────────────────────────────────────────

export class LLMService {
  public readonly provider: LLMProvider;
  private config: LLMConfig;

  constructor(provider?: LLMProvider) {
    this.config = loadLLMConfig();
    this.provider = provider || new OpenAICompatibleProvider(this.config);
  }

  /**
   * Decompose a natural-language goal into a PlanDefinition via LLM.
   * Returns null if LLM is disabled or the call fails.
   */
  async decomposeGoal(goal: string): Promise<LLMPlanDefinition | null> {
    if (!isLLMEnabled()) {
      return null;
    }

    try {
      const response = await this.provider.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Goal: ${goal}` },
      ]);

      const raw = response.content.trim();
      // Strip markdown fences if the model ignored instructions
      const jsonText = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '');

      const parsed = JSON.parse(jsonText);
      const validated = PlanSchema.parse(parsed);

      // Validate that all dependencies exist
      const taskIds = new Set(validated.tasks.map((t) => t.id));
      for (const task of validated.tasks) {
        for (const dep of task.dependsOn) {
          if (!taskIds.has(dep)) {
            throw new Error(`Task ${task.id} depends on unknown task ${dep}`);
          }
        }
      }

      // Validate parallelGroups reference real tasks and respect dependencies
      const seen = new Set<string>();
      for (const group of validated.parallelGroups) {
        for (const tid of group) {
          if (!taskIds.has(tid)) {
            throw new Error(`parallelGroups references unknown task ${tid}`);
          }
          if (seen.has(tid)) {
            throw new Error(`Task ${tid} appears in multiple parallelGroups`);
          }
          seen.add(tid);
          const task = validated.tasks.find((t) => t.id === tid)!;
          for (const dep of task.dependsOn) {
            if (!seen.has(dep)) {
              throw new Error(`Task ${tid} dependency ${dep} not in earlier parallelGroup`);
            }
          }
        }
      }

      return validated;
    } catch (err) {
      console.warn('⚠️ LLM decomposition failed, falling back to heuristics:', err);
      return null;
    }
  }
}

export const llmService = new LLMService();
