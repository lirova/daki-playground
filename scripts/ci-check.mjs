// CI check (required branch-protection check on every PR):
//   1. SCOPE — the diff vs the base branch may touch docs/scene.json and the
//      harness-written docs/status.json ONLY. Everything else (renderer, schema,
//      scripts, workflows) is a protected path no pipeline-produced PR may modify.
//      status.json carries no model-controlled markup (fixed enums + numeric id +
//      the whitelist-sanitized summary), so it is not a content-injection surface.
//   2. CONTENT — the new scene passes the same validate.mjs gate the pipeline ran.
import { run } from "./lib.mjs";

const ALLOWED_PATHS = new Set(["docs/scene.json", "docs/status.json"]);

const baseRef = process.env.BASE_REF || "main";

run("git", ["fetch", "origin", baseRef, "--depth=50"]);
const mergeBase = run("git", ["merge-base", `origin/${baseRef}`, "HEAD"]);
const changed = run("git", ["diff", "--name-only", mergeBase, "HEAD"])
  .split("\n")
  .filter(Boolean);

if (changed.length === 0) {
  console.error("[ci] FAIL - empty diff");
  process.exit(1);
}
const disallowed = changed.filter((f) => !ALLOWED_PATHS.has(f));
if (disallowed.length > 0) {
  console.error(`[ci] FAIL - protected paths touched:\n  ${disallowed.join("\n  ")}`);
  process.exit(1);
}
if (!changed.includes("docs/scene.json")) {
  console.error("[ci] FAIL - a pipeline PR must change docs/scene.json");
  process.exit(1);
}
console.log(`[ci] scope OK - only ${changed.join(", ")} changed`);

// Re-validate the scene exactly as the pipeline did.
const { status } = await import("node:child_process").then(({ spawnSync }) =>
  spawnSync(process.execPath, ["scripts/validate.mjs", "docs/scene.json"], { stdio: "inherit" })
);
process.exit(status ?? 1);
