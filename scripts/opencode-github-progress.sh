#!/usr/bin/env bash
# Post a short progress comment on the GitHub issue/PR that triggered opencode.
# Usage: scripts/opencode-github-progress.sh <phase> <message...>
set -euo pipefail

if [[ "${1:-}" == "" ]]; then
  echo "usage: opencode-github-progress.sh <phase> <message...>" >&2
  exit 1
fi

phase="$1"
shift

if [[ ! -f "${GITHUB_EVENT_PATH:-}" ]]; then
  echo "GITHUB_EVENT_PATH is not set or missing" >&2
  exit 1
fi

number="$(jq -r '.issue.number // .pull_request.number // empty' "$GITHUB_EVENT_PATH")"
if [[ -z "$number" ]]; then
  echo "Could not resolve issue/PR number from event payload" >&2
  exit 1
fi

repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"
body="**OpenCode (${phase})** $*"

gh issue comment "$number" --repo "$repo" --body "$body"
