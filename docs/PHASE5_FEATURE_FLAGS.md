# Phase 5 — Feature Flags + Runtime Config Baseline

## Implemented

### Runtime config module
- Added `src/backend/src/config.ts`
- Centralized parsing for:
  - `PORT`
  - `NODE_ENV`
  - `CORS_ORIGINS`
  - `JANUS_BOTS_ENABLED`
  - `JANUS_OVERSIGHT_ENABLED`

### Server wiring updates
- `src/backend/src/index.ts`
  - Uses `runtimeConfig.port` and `runtimeConfig.corsOrigins`
  - Adds guarded bot route mount via feature flag:
    - If `JANUS_BOTS_ENABLED=false`: logs disabled and skips route
    - If true: attempts runtime route load and mounts `/api/bots`

### API observability
- `src/backend/src/routes/api.ts`
  - `/api/health` now reports active feature flags
  - Added `/api/config` endpoint with runtime-safe config snapshot

### Environment docs
- `src/backend/.env.example` now includes:
  - `CORS_ORIGINS`
  - `JANUS_BOTS_ENABLED`
  - `JANUS_OVERSIGHT_ENABLED`

### README updates
- Added `npm run db:migrate:sql` to setup flow and backend scripts.

## Validation
- Backend build passes.
- Root build passes (backend + frontend).

## Notes
- Bots code remains unstable and intentionally disabled by default.
- This phase provides safe progressive enablement without destabilizing core auth/chat paths.
