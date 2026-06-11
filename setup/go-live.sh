#!/usr/bin/env bash
# Go-live for the daki playground. RUN THIS YOURSELF — it activates hosted
# Actions, which is a maintainer billing/publishing decision by design.
#
# Prerequisites you must do first (cannot be scripted):
#   1. Create a DEDICATED Anthropic API key in a fresh workspace with a hard
#      monthly spend cap (e.g. $10). Console -> Settings -> Workspaces.
#   2. Create a FINE-GRAINED GitHub PAT scoped to ONLY this repo:
#      Permissions: Contents RW, Pull requests RW, Issues RW, Actions Read.
#      DO NOT grant the "Workflows" permission (so the pipeline's token can
#      never modify its own cage even if everything else fails).
#   3. Make the repo PUBLIC (Actions minutes become free; Pages becomes available).
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="lirova/daki-playground"

echo "==> Activating workflows"
mkdir -p .github/workflows
git mv setup/workflows/playground.yml .github/workflows/
git mv setup/workflows/ci.yml .github/workflows/
git commit -m "go-live: activate pipeline + ci workflows"
git push origin main

echo "==> Secrets (paste values when prompted)"
gh secret set ANTHROPIC_API_KEY --repo "$REPO"
gh secret set PLAYGROUND_PAT --repo "$REPO"

echo "==> Kill switch ON (set to 'false' anytime to freeze the playground)"
gh variable set PLAYGROUND_ENABLED --repo "$REPO" --body "true"

echo "==> Repo settings: allow auto-merge, delete merged branches"
gh api -X PATCH "repos/$REPO" \
  -F allow_auto_merge=true -F delete_branch_on_merge=true \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false

echo "==> Branch protection on main: require the 'validate' CI check"
gh api -X PUT "repos/$REPO/branches/main/protection" \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["validate"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "==> GitHub Pages from main:/docs"
gh api -X POST "repos/$REPO/pages" \
  -F "source[branch]=main" -F "source[path]=/docs" 2>/dev/null \
  || gh api -X PUT "repos/$REPO/pages" \
       -F "source[branch]=main" -F "source[path]=/docs"

echo
echo "Done. Smoke-test it: file a 'Change the page' issue and watch Actions."
echo "Kill switch: gh variable set PLAYGROUND_ENABLED --repo $REPO --body false"
