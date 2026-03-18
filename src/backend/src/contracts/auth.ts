import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(['human', 'ai']).default('human'),
  metadata: z.record(z.unknown()).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(120),
  permissions: z.array(z.string().min(1)).default(['read']),
  expiresInDays: z.number().int().positive().max(3650).optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.length ? issue.path.join('.') : 'body';
    throw new Error(`Invalid ${path}: ${issue?.message ?? 'unknown validation error'}`);
  }
  return parsed.data;
}
