#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Janus — Universal AI Harness CLI
#
# Thin entry point. Auto-detects Node.js for the full interactive
# CLI. Falls back to bash mode for scripting/CI.
#
# Symlinked to /usr/local/bin/janus
# ═══════════════════════════════════════════════════════════════

JANUS_SOURCE="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
JANUS_CLI_DIR="${JANUS_SOURCE}/src/cli"
JANUS_BASH_CLI="${JANUS_SOURCE}/ai-sdk/janus-cli.sh"

# If running interactively with no args, try Node.js CLI
if { [ $# -eq 0 ] && [ -t 0 ]; } || [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ "$1" = "help" ]; then
  if command -v node &>/dev/null && [ -f "${JANUS_CLI_DIR}/index.js" ]; then
    exec node "${JANUS_CLI_DIR}/index.js" "$@"
  fi
fi

# For scripts or non-interactive use, route to bash CLI
if [ -f "$JANUS_BASH_CLI" ]; then
  # Export JANUS_CLI_MODE so bash CLI knows it's the real thing
  export JANUS_CLI_MODE="bash"
  exec bash "$JANUS_BASH_CLI" "$@"
fi

# Fallback: try relative path
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/janus-cli.sh" ]; then
  exec bash "${SCRIPT_DIR}/janus-cli.sh" "$@"
fi

echo "Janus CLI not found. Check installation." >&2
exit 1