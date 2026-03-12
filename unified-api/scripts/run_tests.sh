#!/usr/bin/env bash
# Run the chat-agent test suite inside the unified-api container.
#
# Usage (from project root):
#   bash unified-api/scripts/run_tests.sh
#
# Pass extra pytest args:
#   bash unified-api/scripts/run_tests.sh -k test_gold_price -s

set -e
cd "$(dirname "$0")/../.."

docker compose run --rm \
  --no-deps \
  -e GOOGLE_API_KEY=test \
  -e JWT_SECRET_KEY=test \
  -e DATABASE_URL=postgresql+asyncpg://x:x@localhost/x \
  unified-api \
  sh -c "pip install -q pytest pytest-asyncio && python -m pytest tests/ -v $*"
