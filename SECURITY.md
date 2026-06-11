# Threat model & hardening

This repo lets **anonymous strangers drive an AI pipeline** with free-text input.
That is the most hostile input environment there is, so the design assumes every
issue is a prompt-injection attempt and every model output is compromised until
proven otherwise. Defense in depth, outermost layer first:

## 1. Blast radius: there is nothing here to steal

- The pipeline runs in ephemeral GitHub Actions VMs on a **public repo** — no
  route to any private infrastructure.
- The only secrets are (a) an Anthropic API key from a **dedicated workspace
  with a hard spend cap**, and (b) a **fine-grained PAT scoped to this single
  repo**. Total worst-case loss: a few dollars and a toy repo rollback.
- The PAT deliberately lacks the *Workflows* permission, and the Actions
  `GITHUB_TOKEN` is `contents: read` — **no credential in the pipeline can
  modify the pipeline.** The cage cannot rewrite itself.

## 2. The model is powerless by construction

The classic agent-injection disaster needs the model to *do* something: run a
shell command, exfiltrate an env var, fetch a URL. Here the model **has no
tools at all**. Each model stage is a single structured-output API call —
JSON in, schema-constrained JSON out — executed by deterministic harness code
that never interpolates model text into a shell. A fully successful jailbreak
earns the attacker: one ugly JSON object, which still has to pass every gate
below.

## 3. Untrusted text is contained at every hop

| Hop | Containment |
|---|---|
| Issue body → workflow | Passed via `env:` only — never `${{ }}` inside `run:` (GitHub script injection) |
| Issue body → model | `sanitize.mjs` strips markdown, HTML, links, code fences, zero-width/bidi chars; caps at 400 chars |
| Request → INTERPRET | Wrapped in `<visitor_request>` tags; system prompt treats it as data; decision may be `reject` |
| Model output → repo | Only `docs/scene.json`, written by harness code after `validate.mjs` (JSON Schema + charset whitelist + URL/contact ban + single-emoji rule) |
| Model output → PR/comments | `summary` re-sanitized against the charset whitelist; model "reasons" are logged, never echoed verbatim to visitors |
| Scene → future runs | scene.json feeds back into later INTERPRET calls, so REVIEW explicitly rejects **stored injection** (instruction-like text in scene fields); charset + length limits make payloads near-impossible anyway |
| Scene → browser | Renderer uses `createElement`/`textContent` exclusively, plus a `default-src 'none'` CSP — scene content can never become markup, script, or a network request |

## 4. Independent review before merge

A second, stronger model (Sonnet) with a separate context judges the diff:
fidelity to the request, family-friendly content, no stored injection. Verdict
is `SHIP` or `REJECT` — fail closed. Then GitHub's own machinery enforces the
last gate: branch protection requires the `validate` CI check (scope: **only**
`docs/scene.json` may differ from main) before auto-merge fires.

## 5. Rate and budget ceilings (deterministic, pre-model)

- `concurrency: playground` — one run at a time, no parallel cost amplification
- 50 runs/day hard cap (≈ $1/day worst case at Haiku+Sonnet prices)
- 2 open requests per author; 2,000-char raw body cap
- 10-minute job timeout
- API key spend cap at the Anthropic workspace level — the ceiling that holds
  even if every gate above is wrong

## 6. Kill switch & recovery

- `PLAYGROUND_ENABLED=false` repo variable freezes the pipeline instantly
- Every change is one squash commit touching one JSON file — revert is one click
- Disable the workflow file in the Actions UI for a harder stop

## Reporting

Found a hole? Open an issue with the `security` label (not a playground
request) — or break it for sport and tell us how. That's what it's for.
