// Shared helpers for the playground pipeline.
// Design rule: visitor text and model output are DATA. They are passed between
// processes via files and env vars, never interpolated into shell strings.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

export const WORK_DIR = "work";
const STATE_FILE = `${WORK_DIR}/state.json`;

// Charset whitelist shared by schema patterns and post-hoc checks.
export const TEXT_RE = /^[A-Za-z0-9 .,!?'&()+:;#%-]+$/;
// Anything URL-ish or contact-ish is banned in rendered text fields.
export const URLISH_RE = /(https?:|www\.|:\/\/|\.[a-z]{2,6}(\/|\s|$)|@[a-z0-9_]{2,})/i;

export function loadState() {
  if (!existsSync(STATE_FILE)) return { stages: [] };
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

export function saveState(patch) {
  mkdirSync(WORK_DIR, { recursive: true });
  const state = { ...loadState(), ...patch };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

export function stageDone(name, extra = {}) {
  const state = loadState();
  state.stages.push({ name, at: new Date().toISOString(), ...extra });
  saveState(state);
}

// Terminal rejection: record reason, exit 0 so the report step still runs.
export function reject(stage, publicReason) {
  saveState({ outcome: "rejected", rejectedAt: stage, publicReason });
  console.log(`[${stage}] REJECTED: ${publicReason}`);
  process.exit(0);
}

// gh/git via execFile only — argv arrays, no shell, no string interpolation.
export function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
}

export function gh(args, opts = {}) {
  return run("gh", args, opts);
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

// Count grapheme clusters (so multi-codepoint emoji count as 1).
export function graphemes(s) {
  return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s)];
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;
export function isSingleEmoji(s) {
  const g = graphemes(s);
  return g.length === 1 && EMOJI_RE.test(s) && s.length <= 16;
}
