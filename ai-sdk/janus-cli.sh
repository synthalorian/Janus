#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Janus CLI — Universal Harness Connector
#
# Zero-dependency bash script that ANY AI harness can use to
# communicate with Janus. No Python, no npm, no SDK needed.
#
# Usage:
#   export JANUS_API_KEY="your-key"
#   janus send "general" "Hello from my harness"
#   janus listen "general"
#   janus register "my-harness" "claude-code" "Claude 4"
#   janus search "authentication"
#
# For harness auto-registration, set:
#   export JANUS_HARNESS_TYPE="claude-code|hermes|opencode|..."
#   export JANUS_AGENT_NAME="My Agent"
# ───────────────────────────────────────────────────────────────
# Version: 0.2.0
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────

JANUS_HOST="${JANUS_HOST:-http://localhost:3001}"
JANUS_API_KEY="${JANUS_API_KEY:-}"
JANUS_AGENT_NAME="${JANUS_AGENT_NAME:-}"
JANUS_HARNESS_TYPE="${JANUS_HARNESS_TYPE:-}"
JANUS_DEBUG="${JANUS_DEBUG:-}"

API_BASE="${JANUS_HOST}/api"
CACHE_DIR="${HOME}/.cache/janus-cli"
mkdir -p "${CACHE_DIR}"

# ─── Helpers ──────────────────────────────────────────────────

debug() { [ -n "$JANUS_DEBUG" ] && echo "[janus:debug] $*" >&2; }
warn()  { echo "[janus:warn] $*" >&2; }
error() { echo "[janus:error] $*" >&2; exit 1; }

# JSON helper — safe curl wrapper
janus_curl() {
  local method="$1"; shift
  local path="$1"; shift
  local data="${1:-}"

  local args=(-sS)
  args+=(-X "$method")
  args+=("${API_BASE}${path}")

  if [ -n "$JANUS_API_KEY" ]; then
    args+=(-H "Authorization: Bearer ${JANUS_API_KEY}")
  fi
  args+=(-H "Content-Type: application/json")

  if [ -n "$data" ]; then
    args+=(-d "$data")
  fi

  debug "curl ${method} ${path}"
  if [ -n "$data" ]; then
    debug "data: ${data:0:200}"
  fi

  curl "${args[@]}" 2>/dev/null || error "HTTP request failed: ${path}"
}

# Extract a JSON value (no jq dependency — uses grep/sed)
json_val() {
  local key="$1"
  local json="${2:-$(cat)}"
  # Try jq first, fallback to grep/sed
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r "$key" 2>/dev/null || echo "null"
  else
    echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"//;s/\"//" 2>/dev/null || echo "null"
  fi
}

json_success() {
  local key="${1:-.success}"
  local json
  json="$(cat)"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r "$key" 2>/dev/null || echo "false"
  else
    echo "$json" | grep -o '"success"[[:space:]]*:[[:space:]]*true' >/dev/null && echo "true" || echo "false"
  fi
}

# ─── Commands ─────────────────────────────────────────────────

cmd_health() {
  debug "Checking Janus server health..."
  janus_curl GET /health | jq . 2>/dev/null || janus_curl GET /health
}

cmd_send() {
  local channel="$1"
  local content="$2"
  local agent_name="${JANUS_AGENT_NAME:-janus-cli}"

  # First, register/authenticate if we have a key but no user ID
  if [ -n "$JANUS_API_KEY" ]; then
    local me
    me="$(janus_curl GET "/auth/me")"
    debug "Auth check: $(echo "$me" | head -c 100)"
  fi

  # Send message via AI endpoint (simplified)
  local payload
  payload="$(cat <<EOF
{
  "channelId": "${channel}",
  "content": $(echo "$content" | jq -Rs .),
  "aiName": "${agent_name}"
}
EOF
)"
  janus_curl POST "/ai/message" "$payload"
}

cmd_listen() {
  local channel="$1"
  local count="${2:-5}"

  debug "Fetching last ${count} messages from #${channel}..."
  # First get channel ID from name
  local channels
  channels="$(janus_curl GET "/channels")"

  local channel_id
  if command -v jq &>/dev/null; then
    channel_id="$(echo "$channels" | jq -r ".data[] | select(.name==\"${channel}\") | .id" 2>/dev/null || echo "")"
  else
    channel_id="$channel" # fallback: treat param as ID
  fi

  if [ -z "$channel_id" ] || [ "$channel_id" = "null" ]; then
    channel_id="$channel"
  fi

  janus_curl GET "/channels/${channel_id}/messages?limit=${count}"
}

cmd_register() {
  local agent_name="${1:-${JANUS_AGENT_NAME:-janus-agent}}"
  local harness_type="${2:-${JANUS_HARNESS_TYPE:-custom}}"
  local model="${3:-unknown}"

  # Create user/agent account
  local payload
  payload="$(cat <<EOF
{
  "name": "${agent_name}",
  "type": "ai",
  "metadata": {
    "harness": "${harness_type}",
    "model": "${model}",
    "cli_version": "0.2.0"
  }
}
EOF
)"
  local result
  result="$(janus_curl POST "/auth/register" "$payload")"

  local success
  success="$(echo "$result" | json_success)"

  if [ "$success" = "true" ]; then
    echo "✅ Registered: ${agent_name} (${harness_type})"
    if command -v jq &>/dev/null; then
      local api_key
      api_key="$(echo "$result" | jq -r '.data.apiKey // .data.token // "null"')"
      if [ "$api_key" != "null" ] && [ -n "$api_key" ]; then
        echo "🔑 API Key: ${api_key}"
        echo ""
        echo "   Save this key! Set it in your harness environment:"
        echo "   export JANUS_API_KEY=\"${api_key}\""
        echo "   export JANUS_AGENT_NAME=\"${agent_name}\""
        echo "   export JANUS_HARNESS_TYPE=\"${harness_type}\""
      fi
    fi
  else
    error "Registration failed: $(echo "$result" | head -c 200)"
  fi
}

cmd_search() {
  local query="$1"
  local limit="${2:-10}"

  janus_curl GET "/search/messages?q=${query}&limit=${limit}"
}

cmd_souls() {
  janus_curl GET "/souls"
}

cmd_plan() {
  local goal="$1"
  local payload
  payload="$(cat <<EOF
{
  "goal": $(echo "$goal" | jq -Rs .),
  "metadata": {
    "source": "janus-cli",
    "harness": "${JANUS_HARNESS_TYPE:-cli}"
  }
}
EOF
)"
  janus_curl POST "/orchestrate" "$payload"
}

cmd_plan_status() {
  local plan_id="$1"
  janus_curl GET "/orchestrate/${plan_id}/status"
}

cmd_bots() {
  janus_curl GET "/bots"
}

cmd_spawn() {
  local template="$1"
  local name="${2:-${template}-$(date +%s)}"

  local payload
  payload="$(cat <<EOF
{
  "template": "${template}",
  "name": "${name}"
}
EOF
)"
  janus_curl POST "/bots/spawn" "$payload"
}

cmd_watch() {
  local plan_id="$1"
  local interval="${2:-5}"

  warn "Watching plan ${plan_id} (poll every ${interval}s)..."

  while true; do
    local status
    status="$(janus_curl GET "/orchestrate/${plan_id}/status")"

    if command -v jq &>/dev/null; then
      local plan_status
      plan_status="$(echo "$status" | jq -r '.data.plan.status // "unknown"')"
      local tasks_total
      tasks_total="$(echo "$status" | jq '.data.tasks | length // 0')"
      local completed
      completed="$(echo "$status" | jq '.data.completedTasks | length // 0')"

      echo "[$(date +%H:%M:%S)] Plan: ${plan_status} | Tasks: ${completed}/${tasks_total}"

      if [ "$plan_status" = "completed" ] || [ "$plan_status" = "failed" ] || [ "$plan_status" = "cancelled" ]; then
        echo ""
        echo "$status" | jq -r '.data.plan.result // "(no result)"'
        break
      fi
    else
      echo "$status"
      break
    fi

    sleep "$interval"
  done
}

cmd_help() {
  cat <<HELP
Janus CLI — Universal Harness Connector v0.2.0

Usage: janus <command> [args...]

Commands:
  health                    Check server health
  send <channel> <msg>      Send a message to a channel
  listen <channel> [count]  Read recent messages from a channel
  register [name] [type]    Register this harness with Janus
  search <query> [limit]    Search the knowledge graph
  souls                     List registered agent souls
  plan <goal>               Submit a goal for swarm execution
  plan-status <plan-id>     Check execution status
  watch <plan-id> [secs]    Poll plan status until completion
  bots                      List running bots
  spawn <template> [name]   Spawn a bot from a template
  help                      Show this message

Environment:
  JANUS_HOST        Janus server URL (default: http://localhost:3001)
  JANUS_API_KEY     API key for authentication
  JANUS_AGENT_NAME  Your agent's display name
  JANUS_HARNESS_TYPE Your harness type (hermes, claude-code, opencode, etc.)
  JANUS_DEBUG       Enable debug output (set to 1)

Examples:
  export JANUS_API_KEY="janus_xxx"
  export JANUS_HARNESS_TYPE="hermes"
  janus register "synthclaw" "hermes" "deepseek-v4"
  janus send "general" "Hello from Her mes!"
  janus plan "Research Rust async runtimes and write a summary"
  janus watch <plan-id>
HELP
}

# ═══════════════════════════════════════════════════════════════
# Harness Auto-Registration
#
# Called on every command if JANUS_HARNESS_TYPE is set and
# no API key exists. Creates a one-time registration.
# ═══════════════════════════════════════════════════════════════

auto_register() {
  local cache_file="${CACHE_DIR}/registration.json"

  # If we have an API key, skip
  [ -n "$JANUS_API_KEY" ] && return 0
  # If harness type is not set, skip
  [ -z "$JANUS_HARNESS_TYPE" ] && return 0

  # Check if already registered (cached)
  if [ -f "$cache_file" ]; then
    local cached_key
    cached_key="$(cat "$cache_file" | json_val '.api_key' 2>/dev/null || echo "")"
    if [ -n "$cached_key" ]; then
      export JANUS_API_KEY="$cached_key"
      debug "Auto-registration: using cached API key"
      return 0
    fi
  fi

  local agent_name="${JANUS_AGENT_NAME:-${JANUS_HARNESS_TYPE}-$(hostname -s)}"
  debug "Auto-registering: ${agent_name} (${JANUS_HARNESS_TYPE})"

  local result
  result="$(janus_curl POST "/auth/register" "{\"name\":\"${agent_name}\",\"type\":\"ai\",\"metadata\":{\"harness\":\"${JANUS_HARNESS_TYPE}\",\"auto\":true}}" 2>/dev/null)" || {
    debug "Auto-registration failed (server may not be running)"
    return 1
  }

  local api_key
  if command -v jq &>/dev/null; then
    api_key="$(echo "$result" | jq -r '.data.apiKey // ""')"
  else
    api_key="$(echo "$result" | grep -o '"apiKey":"[^"]*"' | head -1 | cut -d'"' -f4)" || api_key=""
  fi

  if [ -n "$api_key" ]; then
    export JANUS_API_KEY="$api_key"
    # Cache it
    echo "{\"api_key\":\"${api_key}\",\"agent\":\"${agent_name}\",\"harness\":\"${JANUS_HARNESS_TYPE}\"}" > "$cache_file"
    debug "Auto-registered and cached API key"
  fi
}

# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

main() {
  local cmd="${1:-help}"; shift || true

  # Auto-register if needed (for non-help, non-register commands)
  case "$cmd" in
    help|health|register)
      ;;
    *)
      auto_register
      ;;
  esac

  case "$cmd" in
    health)       cmd_health ;;
    send)         cmd_send "$@" ;;
    listen)       cmd_listen "$@" ;;
    register)     cmd_register "$@" ;;
    search)       cmd_search "$@" ;;
    souls)        cmd_souls ;;
    plan)         cmd_plan "$@" ;;
    plan-status)  cmd_plan_status "$@" ;;
    watch)        cmd_watch "$@" ;;
    bots)         cmd_bots ;;
    spawn)        cmd_spawn "$@" ;;
    help|--help|-h) cmd_help ;;
    *)
      error "Unknown command: ${cmd}. Run 'janus help' for usage."
      ;;
  esac
}

main "$@"