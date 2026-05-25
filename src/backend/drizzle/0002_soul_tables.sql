-- Agent Souls - Phase 2: Souls, Skills, and Placements
-- Run: psql -d janus -f 0002_soul_tables.sql

BEGIN;

-- ── Agent Souls ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_souls (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,

  -- Personality & Role
  personality TEXT DEFAULT '',
  backstory TEXT DEFAULT '',
  voice_style TEXT DEFAULT '',
  archetype VARCHAR(50) DEFAULT 'creator',

  -- Expertise & Tags
  expertise_tags JSONB DEFAULT '[]'::jsonb,
  model_preference TEXT DEFAULT '',
  context_window INTEGER DEFAULT 128000,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'dormant',
  trust_level INTEGER NOT NULL DEFAULT 1,

  -- Placement defaults
  default_channel_id TEXT REFERENCES channels(id),

  -- Soul evolution
  experience_points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  interactions_count INTEGER NOT NULL DEFAULT 0,
  last_active_at TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Agent Skills ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_skills (
  id TEXT PRIMARY KEY,
  soul_id TEXT NOT NULL REFERENCES agent_souls(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  proficiency REAL NOT NULL DEFAULT 0.5,
  triggers JSONB DEFAULT '[]'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  source VARCHAR(20) DEFAULT 'custom',

  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Agent Placements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_placements (
  id TEXT PRIMARY KEY,
  soul_id TEXT NOT NULL REFERENCES agent_souls(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES channels(id),

  match_pattern TEXT DEFAULT '',
  match_type VARCHAR(20) DEFAULT 'keyword',
  activation_mode VARCHAR(20) NOT NULL DEFAULT 'passive',
  schedule TEXT,

  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agent_souls_status ON agent_souls(status);
CREATE INDEX IF NOT EXISTS idx_agent_souls_archetype ON agent_souls(archetype);
CREATE INDEX IF NOT EXISTS idx_agent_souls_agent_id ON agent_souls(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_soul_id ON agent_skills(soul_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_category ON agent_skills(category);
CREATE INDEX IF NOT EXISTS idx_agent_placements_soul_id ON agent_placements(soul_id);
CREATE INDEX IF NOT EXISTS idx_agent_placements_channel ON agent_placements(channel_id);
CREATE INDEX IF NOT EXISTS idx_agent_placements_active ON agent_placements(is_active);

COMMIT;