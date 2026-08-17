# Phase 3 — Auth Module Resurrection (2026-03-11)

## Goal
Re-enable `/api/auth` without breaking the current stabilized build.

## What was changed

### 1) Auth service replaced with stable implementation
**File:** `src/backend/src/auth/service.ts`

Replaced DB-schema-coupled auth service with a focused in-memory auth layer compatible with the current in-memory store.

Implemented:
- Token generation/verification (`generateJWT`, `verifyJWT`)
- Refresh token create/verify/revoke
- API key create/verify/list/revoke
- User registration via `store.createUser(...)`
- Header token/API key extraction helpers

Notes:
- Token formats are Janus-prefixed opaque strings.
- API keys are hashed using SHA-256 before storage in memory.

### 2) Auth route made compile-safe and active
**File:** `src/backend/src/routes/auth.ts`

- Removed typed `json<APIResponse>` calls causing Express/TS friction.
- Fixed `req.params.keyId` handling to avoid `string | string[]` mismatch.
- Route now uses the new `authService` and `requireAuth` middleware.

### 3) Auth route re-wired into backend server
**File:** `src/backend/src/index.ts`

Enabled route mount:
- `app.use('/api/auth', authRouter);`

### 4) TypeScript compile scope updated
**File:** `src/backend/tsconfig.json`

Included:
- `src/routes/auth.ts`
- `src/auth/**/*.ts`

Kept unfinished modules excluded:
- bots / oversight / spawn and unfinished schema variants.

## Active auth endpoints
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `POST /api/auth/keys` (requires auth)
- `GET /api/auth/keys` (requires auth)
- `DELETE /api/auth/keys/:keyId` (requires auth)
- `GET /api/auth/me` (requires auth)
- `POST /api/auth/logout`

## Verification
Commands run and passing:

```bash
npm --prefix /home/synth/projects/janus/src/backend run build
npm --prefix /home/synth/projects/janus run build
```

Both completed successfully.

## Current risk / limitations
- Auth state is in-memory (tokens + keys reset on restart).
- Not yet backed by persistent DB auth schema.
- No distributed/session-store support yet.

## Next step recommendation
Phase 4:
- Migrate auth service from in-memory maps to persistent tables (`schema.auth`) once schema layer is normalized.
- Add endpoint tests for register/auth/key lifecycle before enabling bots/oversight auth dependencies.
