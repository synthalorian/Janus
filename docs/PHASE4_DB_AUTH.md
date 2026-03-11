# Phase 4 — DB-Backed Auth (2026-03-11)

## Completed
Auth was migrated from in-memory maps to PostgreSQL-backed persistence for sessions, refresh tokens, and API keys.

## Changed files
- `src/backend/src/auth/service.ts`
- `src/backend/src/auth/middleware.ts`
- `src/backend/src/routes/auth.ts`

## What changed

### 1) Auth persistence moved to DB
`authService` now uses `pool` directly and persists:
- `sessions` (Bearer token session records)
- `refresh_tokens`
- `api_keys`
- `login_attempts` (table bootstrapped, ready)

### 2) Bootstrapping safety
`authService` now creates required auth tables at runtime (`CREATE TABLE IF NOT EXISTS ...`) to avoid hard dependency on migrations while the repo is still stabilizing.

### 3) JWT/token behavior
- Bearer token generation now writes a session row.
- Verification checks DB session validity + expiry.
- Session `last_used_at` updates on valid usage.

### 4) API keys
- API keys stored hashed (`sha256`) in DB.
- list/revoke/verify now fully persistent.

### 5) User lookup in middleware
`requireAuth` and `optionalAuth` now resolve users through `authService.getUserById()` (DB-backed), not the in-memory app store.

## Build status
Passed:
- `npm --prefix src/backend run build`
- `npm run build` (repo root)

## Phase 4.2 update
Completed:
- Added SQL migration: `src/backend/drizzle/0001_auth_tables.sql`
- Added migration runner script: `src/backend/scripts/apply-migrations.sh`
- Added npm script: `npm run db:migrate:sql`
- Removed runtime `CREATE TABLE` bootstrap from `authService`; migrations are now the source of truth.

## Remaining risk
- Main chat/store domain is still using in-memory store and is not yet DB-backed.
- Auth lifecycle integration tests are still pending.

## Suggested next step
- Add integration tests for auth lifecycle (`register -> me -> key create/list/revoke -> refresh`).
