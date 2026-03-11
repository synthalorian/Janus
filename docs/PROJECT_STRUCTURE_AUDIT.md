# Janus Project Structure Audit (2026-03-11)

## Current Strengths
- Clear separation of backend (`src/backend`) and frontend (`src/frontend`).
- Backend organized by domain (`auth`, `bots`, `routes`, `socket`, `db`).
- Good documentation footprint (`docs/`, `PROGRESS.md`, architecture files).

## Critical Issues
1. **Dependency directories are tracked in git** (`src/**/node_modules`).
   - Bloats repository and creates noisy diffs.
2. **A real `.env` is tracked** (`src/backend/.env`).
   - Secret-leak risk.
3. **Root scripts are broken**:
   - `build` and `start` recursively call themselves.
   - `dev` uses invalid command syntax (`concurrently-npm`).
4. **Monorepo orchestration is incomplete**
   - No workspace-aware root setup for backend/frontend lifecycle.

## Moderate Issues
- Root has no single command to run full stack reliably before this cleanup.
- Frontend and backend naming conventions are slightly inconsistent (`frontend` vs `janus-backend`).
- No standard repository-level checklist for onboarding and environment setup.

## Impact
- Higher setup friction for contributors.
- Increased risk of accidental secrets exposure.
- CI/CD and reproducibility risk from script recursion.
- Harder long-term maintainability as app complexity grows.
