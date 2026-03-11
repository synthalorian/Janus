# Janus Structure Improvement Plan

## Changes Applied
- Fixed root `package.json` scripts to properly orchestrate backend + frontend.
- Added root workspaces for `src/backend` and `src/frontend`.
- Added `concurrently` as root dev dependency.
- Replaced malformed `.gitignore` with full project-safe ignore rules.

## Next Required Cleanup (run once)

> These commands remove tracked generated/dependency/secrets files from git history moving forward.

```bash
cd /home/synth/projects/janus

git rm -r --cached src/backend/node_modules src/frontend/node_modules || true
git rm --cached src/backend/.env || true

git add .gitignore package.json docs/PROJECT_STRUCTURE_AUDIT.md docs/PROJECT_STRUCTURE_IMPROVEMENT_PLAN.md
```

Then reinstall cleanly:

```bash
npm install
npm --prefix src/backend install
npm --prefix src/frontend install
```

## Recommended Target Layout

```text
janus/
├── docs/
├── ai-sdk/
├── examples/
├── src/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── bots/
│   │   │   ├── db/
│   │   │   ├── oversight/
│   │   │   ├── routes/
│   │   │   ├── socket/
│   │   │   └── index.ts
│   │   ├── .env.example
│   │   └── package.json
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── features/
│   │   │   └── main.tsx
│   │   └── package.json
│   └── shared/
├── package.json
└── .gitignore
```

## Optional Next Step (high value)
- Add `src/shared/contracts/` for shared API schemas/types (Zod/OpenAPI) to eliminate backend/frontend drift.
