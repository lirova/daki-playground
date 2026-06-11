// GUARD stage — deterministic abuse/budget gates. Runs before any model call.
// Every gate here is a hard ceiling that no prompt content can influence.
import { gh, reject, requireEnv, saveState, stageDone } from "./lib.mjs";

const REPO = requireEnv("REPO");
const ISSUE_AUTHOR = requireEnv("ISSUE_AUTHOR");
const ISSUE_NUMBER = requireEnv("ISSUE_NUMBER");

const MAX_RUNS_PER_DAY = 50;       // absolute daily ceiling, ~$1/day worst case
const MAX_OPEN_PER_AUTHOR = 2;     // open playground issues per visitor
const MAX_BODY_LENGTH = 2000;      // pre-sanitize raw cap

saveState({ issue: Number(ISSUE_NUMBER), author: ISSUE_AUTHOR, outcome: "running" });

// 1. Daily run ceiling — counts today's playground workflow runs.
const today = new Date().toISOString().slice(0, 10);
const runsToday = Number(
  gh([
    "api",
    `repos/${REPO}/actions/workflows/playground.yml/runs?created=%3E%3D${today}&per_page=1`,
    "--jq", ".total_count",
  ])
);
if (runsToday > MAX_RUNS_PER_DAY) {
  reject("guard", "The playground hit its daily budget ceiling. Try again tomorrow!");
}

// 2. Per-author open-issue cap (the current issue counts toward the total).
const openByAuthor = Number(
  gh([
    "api",
    `repos/${REPO}/issues?creator=${encodeURIComponent(ISSUE_AUTHOR)}&labels=playground&state=open&per_page=10`,
    "--jq", "length",
  ])
);
if (openByAuthor > MAX_OPEN_PER_AUTHOR) {
  reject(
    "guard",
    `You already have ${MAX_OPEN_PER_AUTHOR} playground requests in flight — please wait for those to finish first.`
  );
}

// 3. Raw body length cap.
const body = process.env.ISSUE_BODY ?? "";
if (body.length > MAX_BODY_LENGTH) {
  reject("guard", "Request too long — please keep it to a sentence or two.");
}
if (body.trim().length === 0) {
  reject("guard", "The request was empty.");
}

stageDone("guard", { runsToday, openByAuthor });
console.log(`[guard] OK — runs today: ${runsToday}/${MAX_RUNS_PER_DAY}, open by author: ${openByAuthor}`);
