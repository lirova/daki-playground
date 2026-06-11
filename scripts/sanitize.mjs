// SANITIZE stage — deterministic reduction of the raw issue body into a short
// plain-text request. This shrinks the prompt-injection surface BEFORE any
// model sees the text: markup, links, code blocks, and issue-form scaffolding
// are stripped; length is hard-capped.
import { writeFileSync, mkdirSync } from "node:fs";
import { WORK_DIR, reject, stageDone } from "./lib.mjs";

const MAX_REQUEST_CHARS = 400;

let text = process.env.ISSUE_BODY ?? "";

// Strip issue-form scaffolding (### headings GitHub inserts for form fields).
text = text.replace(/^#{1,6}\s.*$/gm, " ");
// Strip fenced code blocks and inline code entirely.
text = text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
// Strip HTML tags and HTML comments.
text = text.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ");
// Markdown links/images: keep the link text, drop the URL.
text = text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
// Drop bare URLs.
text = text.replace(/\bhttps?:\/\/\S+/gi, " ");
// Strip control chars and zero-width/bidi chars (hidden-instruction tricks).
const INVISIBLE_RE = new RegExp(
  "[\u0000-\u001f\u007f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]",
  "g"
);
text = text.replace(INVISIBLE_RE, " ");
// Collapse whitespace.
text = text.replace(/\s+/g, " ").trim();

// Hard cap: long requests are truncated, not rejected (visitor still gets a result).
if (text.length > MAX_REQUEST_CHARS) text = text.slice(0, MAX_REQUEST_CHARS);

if (text.length < 3) {
  reject("sanitize", "I couldn't find a readable request in the issue.");
}

mkdirSync(WORK_DIR, { recursive: true });
writeFileSync(`${WORK_DIR}/request.txt`, text);
stageDone("sanitize", { chars: text.length });
console.log(`[sanitize] OK - ${text.length} chars`);
