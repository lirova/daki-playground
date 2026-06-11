// VALIDATE stage — deterministic gate on the candidate scene. Used both by the
// pipeline (pre-PR) and by CI on every PR (the required "validate" check).
// Schema first, then rules the schema can't express. Nothing here calls a model.
import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { TEXT_RE, URLISH_RE, isSingleEmoji } from "./lib.mjs";

const file = process.argv[2] ?? "work/scene.next.json";
const schema = JSON.parse(readFileSync("schema/scene.schema.json", "utf8"));

let scene;
try {
  scene = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  fail(`unreadable JSON: ${e.message}`);
}

const ajv = new Ajv({ allErrors: true });
const valid = ajv.validate(schema, scene);
if (!valid) {
  fail(ajv.errorsText(ajv.errors, { separator: "\n  " }));
}

// Rules beyond the schema:
for (const field of ["title", "marquee"]) {
  const v = scene[field];
  if (URLISH_RE.test(v)) fail(`${field} contains URL-like or contact-like content`);
  if (!TEXT_RE.test(v)) fail(`${field} contains characters outside the whitelist`);
}
for (const [i, o] of (scene.objects ?? []).entries()) {
  if (!isSingleEmoji(o.emoji)) {
    fail(`objects[${i}].emoji must be exactly one emoji (got ${JSON.stringify(o.emoji)})`);
  }
}

console.log(`[validate] OK - ${file} conforms to schema + content rules`);

function fail(msg) {
  console.error(`[validate] FAIL - ${msg}`);
  process.exit(1);
}
