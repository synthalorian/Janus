export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface ExtractedEntity {
  type: 'topic' | 'mention' | 'tag' | 'keyword';
  value: string;
  confidence: number;
}

export interface MessageAnalysis {
  sentiment: Sentiment;
  confidence: number;
  entities: ExtractedEntity[];
  topics: string[];
  references: string[];
  isDecision: boolean;
}

const positiveWords = ['good', 'great', 'awesome', 'love', 'excellent', 'win', 'success'];
const negativeWords = ['bad', 'terrible', 'hate', 'broken', 'fail', 'failure', 'error'];

export function analyzeMessage(text: string): MessageAnalysis {
  const input = (text || '').toLowerCase();
  let score = 0;

  for (const word of positiveWords) {
    if (input.includes(word)) score += 1;
  }
  for (const word of negativeWords) {
    if (input.includes(word)) score -= 1;
  }

  const sentiment: Sentiment = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  const confidence = score === 0 ? 0.6 : Math.min(1, 0.5 + Math.abs(score) * 0.1);

  const topics = buildSearchTerms(input).slice(0, 8);
  const entities: ExtractedEntity[] = [
    ...extractEntities(text).map((value) => {
      const type: ExtractedEntity['type'] = value.startsWith('@')
        ? 'mention'
        : value.startsWith('#')
        ? 'tag'
        : 'keyword';
      return { type, value, confidence: 0.7 };
    }),
    ...topics.slice(0, 3).map((value) => ({ type: 'topic' as const, value, confidence: 0.65 })),
  ];

  const references = Array.from((text || '').matchAll(/\b(?:msg|message|ref):([a-zA-Z0-9_-]+)\b/g)).map(
    (m) => m[1],
  );

  const isDecision = extractDecision(text) !== null;

  return { sentiment, confidence, entities, topics, references, isDecision };
}

export function extractEntities(text: string): string[] {
  const tokens = (text || '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  return [...new Set(tokens.filter((t) => /^[@#A-Z]/.test(t) || t.length > 14))].slice(0, 20);
}

export function extractDecision(text: string): string | null {
  const input = (text || '').trim();
  const decisionSignals = ['decide', 'decision', 'approved', 'rejected', 'we will', 'final'];
  return decisionSignals.some((s) => input.toLowerCase().includes(s)) ? input : null;
}

export function buildSearchTerms(text: string): string[] {
  const words = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return [...new Set(words)].slice(0, 50);
}
