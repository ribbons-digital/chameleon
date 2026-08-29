#!/usr/bin/env bash
# Create or update the "Protect main" repository ruleset.
# Requires a GitHub identity with admin on the repo (gh auth status).
# Apply only after .github/workflows/ci.yml is on the default branch.
set -euo pipefail

REPO="${REPO:-ribbons-digital/chameleon}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PAYLOAD_FILE="${ROOT}/.github/rulesets/protect-main.json"
RULESET_NAME="Protect main"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required. Install GitHub CLI and authenticate with repo admin." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

REPO_ID="$(gh api "repos/${REPO}" --jq .id)"
DEFAULT_BRANCH="$(gh api "repos/${REPO}" --jq .default_branch)"
CI_PATH=".github/workflows/ci.yml"

if ! gh api "repos/${REPO}/contents/${CI_PATH}?ref=${DEFAULT_BRANCH}" --jq .path >/dev/null 2>&1; then
  echo "${CI_PATH} is not on ${DEFAULT_BRANCH}. Merge the CI workflow first, then re-run." >&2
  exit 1
fi

PAYLOAD="$(
  jq --argjson repo_id "${REPO_ID}" '
    .rules |= map(
      if .type == "workflows" then
        .parameters.workflows |= map(.repository_id = $repo_id)
      else
        .
      end
    )
  ' "${PAYLOAD_FILE}"
)"

EXISTING_ID="$(
  gh api "repos/${REPO}/rulesets" --jq --arg name "${RULESET_NAME}" \
    '.[] | select(.name == $name) | .id' | head -n 1
)"

if [[ -n "${EXISTING_ID}" ]]; then
  echo "Updating ruleset ${EXISTING_ID} (${RULESET_NAME}) on ${REPO}"
  echo "${PAYLOAD}" | gh api --method PUT "repos/${REPO}/rulesets/${EXISTING_ID}" --input -
else
  echo "Creating ruleset ${RULESET_NAME} on ${REPO}"
  echo "${PAYLOAD}" | gh api --method POST "repos/${REPO}/rulesets" --input -
fi

echo
gh api "repos/${REPO}/rulesets" --jq \
  '.[] | {id, name, enforcement, target}'
