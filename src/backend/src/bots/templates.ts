/**
 * Bot Templates
 * 
 * Pre-configured bot definitions for autonomous spawning.
 * Each template defines capabilities, prompts, and defaults.
 */

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  type: 'custom' | 'webhook' | 'integration' | 'ai_agent' | 'bridge';
  category: 'productivity' | 'dev' | 'research' | 'analysis' | 'coordination' | 'monitoring';
  
  // Default capabilities
  capabilities: string[];
  
  // Default scopes/permissions
  scopes: string[];
  
  // Default configuration
  defaultConfig: Record<string, unknown>;
  
  // System prompts for AI bots
  prompts?: {
    system: string;
    task: string;
    response: string;
  };
  
  // Resource limits
  limits: {
    maxTasks: number;
    maxMemory: number; // MB
    timeout: number; // seconds
  };
  
  // Auto-start behavior
  autoStart: boolean;
  
  // Required environment variables
  requiredEnv?: string[];
}

export const BOT_TEMPLATES: Record<string, BotTemplate> = {
  researcher: {
    id: 'researcher',
    name: 'Research Assistant',
    description: 'Searches, analyzes, and summarizes information from multiple sources',
    type: 'ai_agent',
    category: 'research',
    capabilities: [
      'web_search',
      'document_analysis',
      'summarization',
      'citation_extraction',
      'fact_checking',
      'source_evaluation'
    ],
    scopes: [
      'bot:read',
      'bot:write',
      'messages:read',
      'messages:write',
      'search:read',
      'graph:read'
    ],
    defaultConfig: {
      searchEngines: ['google', 'duckduckgo'],
      maxResults: 10,
      summaryLength: 'medium', // short, medium, long
      citationStyle: 'apa',
      verifyFacts: true,
      sourcesRequired: 3
    },
    prompts: {
      system: `You are a research assistant bot. Your job is to:
1. Search for accurate, up-to-date information
2. Analyze and synthesize findings
3. Provide well-cited summaries
4. Evaluate source credibility
5. Highlight conflicting information

Always cite your sources and indicate confidence levels.`,
      task: `Research the following topic thoroughly: {topic}

Requirements:
- Find at least {sourcesRequired} reliable sources
- Provide a {summaryLength} summary
- Include citations in {citationStyle} format
- Note any conflicting information
- Rate source credibility (High/Medium/Low)`,
      response: `Present your findings in this format:
## Summary
[Concise overview]

## Key Findings
- [Finding 1] (Source: [citation])
- [Finding 2] (Source: [citation])

## Sources
1. [Title] - [URL] (Credibility: [High/Medium/Low])

## Confidence: [High/Medium/Low]`
    },
    limits: {
      maxTasks: 5,
      maxMemory: 512,
      timeout: 300 // 5 minutes
    },
    autoStart: true
  },

  coder: {
    id: 'coder',
    name: 'Code Assistant',
    description: 'Writes, reviews, and debugs code with best practices',
    type: 'ai_agent',
    category: 'dev',
    capabilities: [
      'code_generation',
      'code_review',
      'test_writing',
      'debugging',
      'documentation',
      'refactoring'
    ],
    scopes: [
      'bot:read',
      'bot:write',
      'messages:read',
      'messages:write',
      'artifacts:read',
      'artifacts:write'
    ],
    defaultConfig: {
      preferredLanguage: 'typescript',
      styleGuide: 'standard',
      writeTests: true,
      documentCode: true,
      maxComplexity: 10,
      lintOnWrite: true
    },
    prompts: {
      system: `You are a code assistant bot. Your job is to:
1. Write clean, maintainable code
2. Follow best practices and style guides
3. Include comprehensive tests
4. Document public APIs
5. Optimize for readability over cleverness

Always explain your reasoning and consider edge cases.`,
      task: `Implement the following: {specification}

Requirements:
- Language: {preferredLanguage}
- Follow {styleGuide} style guide
- Include tests if {writeTests}
- Document public APIs if {documentCode}
- Keep cyclomatic complexity under {maxComplexity}`,
      response: `Present your code in this format:
## Implementation
\`\`\`{language}
[code]
\`\`\`

## Tests
\`\`\`{language}
[tests]
\`\`\`

## Explanation
[How it works and design decisions]

## Edge Cases Handled
- [Case 1]
- [Case 2]`
    },
    limits: {
      maxTasks: 3,
      maxMemory: 1024,
      timeout: 600 // 10 minutes
    },
    autoStart: true
  },

  analyst: {
    id: 'analyst',
    name: 'Data Analyst',
    description: 'Analyzes data, generates insights, and creates visualizations',
    type: 'ai_agent',
    category: 'analysis',
    capabilities: [
      'data_analysis',
      'statistical_analysis',
      'visualization',
      'report_generation',
      'anomaly_detection',
      'trend_analysis'
    ],
    scopes: [
      'bot:read',
      'bot:write',
      'messages:read',
      'messages:write',
      'graph:read',
      'search:read'
    ],
    defaultConfig: {
      analysisDepth: 'comprehensive', // quick, standard, comprehensive
      includeVisualizations: true,
      confidenceThreshold: 0.8,
      anomalyDetection: true,
      trendProjection: true
    },
    prompts: {
      system: `You are a data analyst bot. Your job is to:
1. Analyze datasets for patterns and insights
2. Perform statistical analysis
3. Detect anomalies and outliers
4. Project trends and forecasts
5. Generate actionable reports

Always indicate confidence levels and data limitations.`,
      task: `Analyze the following data: {dataset}

Requirements:
- Analysis depth: {analysisDepth}
- Include visualizations: {includeVisualizations}
- Detect anomalies: {anomalyDetection}
- Project trends: {trendProjection}`,
      response: `Present your analysis in this format:
## Executive Summary
[Key findings in 2-3 sentences]

## Key Insights
1. [Insight 1] (Confidence: X%)
2. [Insight 2] (Confidence: X%)

## Statistical Analysis
[Relevant statistics]

## Anomalies Detected
[List if applicable]

## Trend Projection
[Future predictions with confidence intervals]

## Recommendations
1. [Actionable recommendation]`
    },
    limits: {
      maxTasks: 3,
      maxMemory: 2048,
      timeout: 900 // 15 minutes
    },
    autoStart: true
  },

  coordinator: {
    id: 'coordinator',
    name: 'Task Coordinator',
    description: 'Orchestrates multiple bots to accomplish complex tasks',
    type: 'ai_agent',
    category: 'coordination',
    capabilities: [
      'task_delegation',
      'progress_tracking',
      'multi_bot_management',
      'conflict_resolution',
      'workflow_optimization',
      'result_synthesis'
    ],
    scopes: [
      'bot:read',
      'bot:write',
      'messages:read',
      'messages:write',
      'bots:manage',
      'tasks:manage'
    ],
    defaultConfig: {
      maxBots: 5,
      parallelTasks: 3,
      retryAttempts: 2,
      timeoutStrategy: 'partial', // partial, all_or_nothing
      progressReporting: 'detailed' // minimal, standard, detailed
    },
    prompts: {
      system: `You are a task coordinator bot. Your job is to:
1. Break down complex tasks into subtasks
2. Delegate to appropriate specialized bots
3. Monitor progress and handle failures
4. Resolve conflicts between bots
5. Synthesize results into coherent output

You can spawn and manage other bots. Use your resources wisely.`,
      task: `Coordinate the following goal: {goal}

Available bots: {availableBots}
Max parallel tasks: {parallelTasks}
Timeout strategy: {timeoutStrategy}`,
      response: `Present your coordination plan:
## Task Breakdown
1. [Subtask 1] → Assign to: [Bot type]
2. [Subtask 2] → Assign to: [Bot type]

## Progress Updates
[As tasks complete]

## Final Synthesis
[Combined results]

## Resource Usage
- Bots spawned: X
- Time elapsed: Y
- Success rate: Z%`
    },
    limits: {
      maxTasks: 1,
      maxMemory: 256,
      timeout: 1800 // 30 minutes
    },
    autoStart: true
  },

  watcher: {
    id: 'watcher',
    name: 'Channel Watcher',
    description: 'Monitors channels for keywords, patterns, and events',
    type: 'ai_agent',
    category: 'monitoring',
    capabilities: [
      'keyword_monitoring',
      'pattern_detection',
      'alert_generation',
      'sentiment_tracking',
      'summarization',
      'trend_detection'
    ],
    scopes: [
      'bot:read',
      'messages:read',
      'channels:read',
      'webhooks:write'
    ],
    defaultConfig: {
      keywords: [],
      patterns: [],
      alertChannels: [],
      summaryInterval: 3600, // seconds
      sentimentTracking: true,
      alertThreshold: 'medium' // low, medium, high
    },
    prompts: {
      system: `You are a channel watcher bot. Your job is to:
1. Monitor channels for keywords and patterns
2. Track sentiment and trends
3. Generate alerts when thresholds are met
4. Create periodic summaries
5. Never respond in channels unless directly mentioned

Be unobtrusive but vigilant.`,
      task: `Watch channels: {channels}
Keywords: {keywords}
Patterns: {patterns}
Alert threshold: {alertThreshold}`,
      response: `Alert format:
## Alert Triggered
**Channel:** {channel}
**Type:** {keyword|pattern|sentiment}
**Severity:** {low|medium|high}
**Message:** [Excerpt]
**Context:** [Surrounding messages]`
    },
    limits: {
      maxTasks: 10,
      maxMemory: 256,
      timeout: 86400 // 24 hours (long-running)
    },
    autoStart: true
  },

  responder: {
    id: 'responder',
    name: 'Auto Responder',
    description: 'Automatically responds to mentions and direct messages',
    type: 'ai_agent',
    category: 'productivity',
    capabilities: [
      'mention_response',
      'dm_handling',
      'faq_answering',
      'routing',
      'escalation'
    ],
    scopes: [
      'bot:read',
      'bot:write',
      'messages:read',
      'messages:write',
      'users:read'
    ],
    defaultConfig: {
      responseTime: 'fast', // instant, fast, thoughtful
      greetingMessage: 'Hello! How can I help?',
      unknownResponse: "I don't know, but I'll find out.",
      maxResponseLength: 500,
      learningEnabled: true,
      handoffThreshold: 0.7 // Confidence below this triggers human handoff
    },
    prompts: {
      system: `You are an auto-responder bot. Your job is to:
1. Respond quickly to mentions and DMs
2. Answer common questions from knowledge base
3. Route complex queries to appropriate agents
4. Escalate when confidence is low
5. Learn from interactions

Be helpful, concise, and admit when you don't know.`,
      task: `Respond to: {message}
Context: {context}
Knowledge base: {kb}`,
      response: `[Concise response]

If confidence < {handoffThreshold}:
"I'm not sure about this. Let me connect you with someone who can help."`
    },
    limits: {
      maxTasks: 20,
      maxMemory: 512,
      timeout: 60 // 1 minute (fast responses)
    },
    autoStart: true
  },

  custom: {
    id: 'custom',
    name: 'Custom Bot',
    description: 'Fully configurable bot with custom behavior',
    type: 'custom',
    category: 'productivity',
    capabilities: [],
    scopes: [
      'bot:read',
      'bot:write',
      'messages:read',
      'messages:write'
    ],
    defaultConfig: {},
    limits: {
      maxTasks: 1,
      maxMemory: 512,
      timeout: 300
    },
    autoStart: false
  }
};

export function getTemplate(id: string): BotTemplate | undefined {
  return BOT_TEMPLATES[id];
}

export function listTemplates(): BotTemplate[] {
  return Object.values(BOT_TEMPLATES);
}

export function getTemplatesByCategory(category: string): BotTemplate[] {
  return Object.values(BOT_TEMPLATES).filter(t => t.category === category);
}
