// PR stage — deterministic git/GitHub plumbing. Runs only after validate +
// review both passed. All git/gh calls use execFile argv arrays (lib.run) —
// no shell interpolation anywhere, and the only dynamic strings (summary)
// were already whitelist-sanitized in interpret.mjs.
import { copyFileSync } from "node:fs";
import { loadState, reject, requireEnv, run, gh, saveState, stageDone } from "./lib.mjs";

const ISSUE_NUMBER = requireEnv("ISSUE_NUMBER");
if (!/^\d+$/.test(ISSUE_NUMBER)) reject("pr", "Invalid issue number.");

const state = loadState();
const summary = state.summary ?? "scene update";
const branch = `playground/issue-${ISSUE_NUMBER}`;

run("git", ["config", "user.name", "daki-playground[pipeline]"]);
run("git", ["config", "user.email", "playground@users.noreply.github.com"]);

run("git", ["checkout", "-B", branch]);
copyFileSync("work/scene.next.json", "docs/scene.json");
run("git", ["add", "docs/scene.json"]);
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
