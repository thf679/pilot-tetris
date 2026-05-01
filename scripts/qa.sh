#!/usr/bin/env bash
# Thin wrapper that forwards to scripts/qa.py so users can run either form.
#
# Examples:
#   scripts/qa.sh --question "How does scoring work?"
#   npm run qa -- --question "What are the controls?"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/qa.py" "$@"
