export interface RuntimeConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  features: {
    botsEnabled: boolean;
    oversightEnabled: boolean;
  };
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parsePort(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) return ['http://localhost:5173', 'http://localhost:3000'];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

export const runtimeConfig: RuntimeConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsePort(process.env.PORT, 3001),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  features: {
    botsEnabled: parseBoolean(process.env.JANUS_BOTS_ENABLED, false),
    oversightEnabled: parseBoolean(process.env.JANUS_OVERSIGHT_ENABLED, false),
  },
};
