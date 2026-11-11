# Contributing

## Prerequisites

- Node.js >= 20
- [pnpm](https://pnpm.io/)

## Development

```bash
pnpm install
pnpm test          # unit tests (mocked fetch, no network)
pnpm typecheck
pnpm lint
pnpm build
```

CI (`.github/workflows/ci.yml`) runs lint + typecheck, unit tests + build on Node 20 / 22 / 24, an `ai@6` peer leg, and the empty-token live-skip guard. **No secrets are used in CI.**

## Live tests

```bash
DIFFBOT_API_TOKEN=your-token pnpm test:live
```

The live config allows 180 s per test — above the 120 s client timeout in `tests/live/helpers.ts`, so a slow request fails with the client's own abort instead of an opaque vitest timeout — and retries once, because Diffbot's RAG endpoint occasionally stalls mid-stream. Keep retries out of the unit config.

Live tests consume real Diffbot quota. When Phase 4 adds `.github/workflows/integration.yml`, it will run them on push to `main`, on a twice-monthly drift schedule (1st and 15th at 14:17 UTC), and on `workflow_dispatch` — never on `pull_request`. That workflow holds the secret; keep it out of `ci.yml`.

### Live-token rules (mandatory)

1. Treat the token as present only when it is a **non-empty string after trimming** — never `token ?? fallback`, never a bare `!== undefined`.
2. **Never construct a `DiffbotClient` (or anything else that validates a token) at module scope** in a live file. Build it in `beforeAll`, inside the test, or behind a lazy getter.
3. CI must prove the skip path: `DIFFBOT_API_TOKEN="" pnpm test:live` exits 0 with every live test skipped.

## Layout

- One tool factory per file under `src/tools/`; one retrieval/loader module per Diffbot API under `src/retrieve/`.
- Re-export public surface from `src/index.ts` only — keep `createClientResolver` internal.
