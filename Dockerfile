# ── Janus Backend ────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY src/backend/package.json src/backend/
COPY src/frontend/package.json src/frontend/
RUN npm ci --workspace=src/backend --workspace=src/frontend

# Build backend
FROM deps AS build-backend
COPY src/backend/ src/backend/
RUN npm run build:backend

# Build frontend
FROM deps AS build-frontend
COPY src/frontend/ src/frontend/
RUN npm run build:frontend

# Production image
FROM node:22-alpine AS production
WORKDIR /app

COPY package.json package-lock.json ./
COPY src/backend/package.json src/backend/
RUN npm ci --workspace=src/backend --omit=dev

COPY --from=build-backend /app/src/backend/dist/ src/backend/dist/
COPY --from=build-backend /app/src/backend/drizzle/ src/backend/drizzle/
COPY --from=build-frontend /app/src/frontend/dist/ src/frontend/dist/

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/backend/dist/index.js"]
