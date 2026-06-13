// PR stage — deterministic git/GitHub plumbing. Runs only after validate +
// review both passed. All git/gh calls use execFile argv arrays (lib.run) —
// no shell interpolation anywhere, and the only dynamic strings (summary)
// were already whitelist-sanitized in interpret.mjs.
import { copyFileSync, writeFileSync } from "node:fs";
import { loadState, reject, requireEnv, run, gh, saveState, stageDone } from "./lib.mjs";

// Stages a shipped run cleared, in display order. MERGE is implied by a shipped
// PR (auto-merge is queued and gated on the validate check).
const STAGE_KEYS = ["guard", "sanitize", "interpret", "validate", "review", "pr", "merge"];

const ISSUE_NUMBER = requireEnv("ISSUE_NUMBER");
if (!/^\d+$/.test(ISSUE_NUMBER)) reject("pr", "Invalid issue number.");

const state = loadState();
const summary = state.summary ?? "scene update";
const branch = `playground/issue-${ISSUE_NUMBER}`;

run("git", ["config", "user.name", "daki-playground[pipeline]"]);
run("git", ["config", "user.email", "playground@users.noreply.github.com"]);

run("git", ["checkout", "-B", branch]);
copyFileSync("work/scene.next.json", "docs/scene.json");

// Publish a public status feed the portfolio reads straight from Pages — no
// GitHub API call, so no unauthenticated rate limit (the old live view broke
// at 60 req/hr/IP). Every field is a fixed enum, a numeric issue id, or the
// already-whitelist-sanitized summary (interpret.mjs caps it at 60 chars vs
// TEXT_RE); the page renders all of it via textContent. Bundled into the same
// PR as the scene so CI's scope check covers it (ci-check.mjs allows it).
const now = new Date().toISOString();
const status = {
  updated_at: now,
  last_run: {
    issue: Number(ISSUE_NUMBER),
    outcome: "shipped",
    summary,
    stages: Object.fromEntries(STAGE_KEYS.map((k) => [k, "done"])),
    finished_at: now,
  },
};
writeFileSync("docs/status.json", JSON.stringify(status, null, 2) + "\n");

run("git", ["add", "docs/scene.json", "docs/status.json"]);
run("git", ["commit", "-m", `playground: ${summary} (issue #${ISSUE_NUMBER})`]);
run("git", ["push", "--force", "origin", branch]);

const prBody = [
  `Automated scene update for #${ISSUE_NUMBER}.`,
  "",
  `**Change:** ${summary}`,
  "",
  "Pipeline: GUARD ✅ → SANITIZE ✅ → INTERPRET ✅ → VALIDATE ✅ → REVIEW ✅ SHIP → CI → auto-merge",
  "",
  `Closes #${ISSUE_NUMBER}`,
].join("\n");

const prUrl = gh([
  "pr", "create",
  "--head", branch,
  "--title", `Scene update: ${summary}`,
  "--body", prBody,
]);

// Queue auto-merge: merges only once the required "validate" CI check is green.
gh(["pr", "merge", branch, "--auto", "--squash"]);

saveState({ outcome: "shipped", prUrl, branch });
stageDone("pr", { prUrl });
console.log(`[pr] OK - ${prUrl} (auto-merge queued)`);
