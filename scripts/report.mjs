// REPORT stage — always runs last (workflow `if: always()`). Tells the visitor
// what happened on their issue, and cleans up on rejection. All comment bodies
// are assembled from fixed strings + whitelist-sanitized fragments.
import { writeFileSync } from "node:fs";
import { loadState, gh, requireEnv } from "./lib.mjs";

const ISSUE_NUMBER = requireEnv("ISSUE_NUMBER");
const REPO = requireEnv("REPO");
const state = loadState();

const PAGE_URL = process.env.PAGE_URL || `https://${REPO.split("/")[0]}.github.io/${REPO.split("/")[1]}/`;

let body;
if (state.outcome === "shipped") {
  body = [
    "🤖 **Your change shipped through the pipeline:**",
    "",
    "`GUARD ✅ → SANITIZE ✅ → INTERPRET ✅ → VALIDATE ✅ → REVIEW ✅ SHIP → PR → CI → auto-merge`",
    "",
    `**Change:** ${state.summary ?? "scene update"}`,
    `**Pull request:** ${state.prUrl}`,
    "",
    `The PR merges automatically once CI is green, and the page redeploys itself: ${PAGE_URL}`,
    "(Give it a minute, then hard-refresh.)",
  ].join("\n");
} else if (state.outcome === "rejected") {
  body = [
    `🤖 **The pipeline declined this request at the \`${state.rejectedAt ?? "?"}\` stage.**`,
    "",
    `> ${state.publicReason ?? "No reason recorded."}`,
    "",
    "Feel free to open a new issue with a different request — small, concrete page changes work best",
    '(e.g. *"make it snow at night"* or *"add a cat on the roof"*).',
  ].join("\n");
} else {
  body = [
    "🤖 **The pipeline hit an unexpected error and stopped.**",
    "",
    "Nothing was changed. The maintainer has the logs; feel free to try again later.",
  ].join("\n");
}

writeFileSync("work/comment.md", body);
gh(["issue", "comment", ISSUE_NUMBER, "--body-file", "work/comment.md"]);

// Rejected or errored: close the issue (shipped issues close via the PR's "Closes #N").
if (state.outcome !== "shipped") {
  gh(["issue", "close", ISSUE_NUMBER, "--reason", "not planned"]);
}
console.log(`[report] commented on #${ISSUE_NUMBER} (outcome: ${state.outcome ?? "error"})`);
