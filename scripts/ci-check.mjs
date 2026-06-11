// CI check (required branch-protection check on every PR):
//   1. SCOPE — the diff vs the base branch may touch docs/scene.json ONLY.
//      Everything else (renderer, schema, scripts, workflows) is a protected
//      path that no pipeline-produced PR may modify.
//   2. CONTENT — the new scene passes the same validate.mjs gate the pipeline ran.
import { run } from "./lib.mjs";

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
const disallowed = changed.filter((f) => f !== "docs/scene.json");
if (disallowed.length > 0) {
  console.error(`[ci] FAIL - protected paths touched:\n  ${disallowed.join("\n  ")}`);
  process.exit(1);
}
console.log("[ci] scope OK - only docs/scene.json changed");

// Re-validate the scene exactly as the pipeline did.
const { status } = await import("node:child_process").then(({ spawnSync }) =>
  spawnSync(process.execPath, ["scripts/validate.mjs", "docs/scene.json"], { stdio: "inherit" })
);
process.exit(status ?? 1);
