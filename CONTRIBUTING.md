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
pnpm test:workers  # bundles tests/fixtures/worker for workerd (no CF account needed)
```

After `pnpm test:peer:ai6` (or `:ai7`, or `:latest`) restore the lockfile — those scripts install peer versions over it:

```bash
git checkout package.json pnpm-lock.yaml && pnpm install --frozen-lockfile
```

## Workflows

| Workflow          | Triggers                                          | Secrets                   |
| ----------------- | ------------------------------------------------- | ------------------------- |
| `ci.yml`          | push to `main`, every `pull_request`, dispatch    | **none**                  |
| `integration.yml` | push to `main`, 1st + 15th at 14:17 UTC, dispatch | `DIFFBOT_API_TOKEN`       |
| `canary.yml`      | Mondays at 14:17 UTC, dispatch                    | **none**                  |
| `release.yml`     | `v*` tag; dispatch is a build-only rehearsal      | `NPM_TOKEN` (publish job) |

`ci.yml` runs lint + typecheck, unit tests + build on Node 20 / 22 / 24, the peer matrix (`ai@6` + `@ai-sdk/openai-compatible@2`, `ai@7` + `@3`), the empty-token live-skip guard, and the Workers bundle check. **It must stay secret-free** — that is what lets every job run on fork PRs.

`release.yml` publishes only from a `v*` tag push: it checks the tag equals `package.json`'s `version` and that `"private"` is no longer `true`, runs lint/typecheck/tests/build, then `pnpm publish --access public --provenance`, then creates the GitHub release. `workflow_dispatch` stops after `pnpm pack`; every publishing step is gated on the tag push, so a dispatch cannot ship a version. To release: bump `version`, commit, tag `vX.Y.Z`, push the tag.

## Live tests

```bash
DIFFBOT_API_TOKEN=your-token pnpm test:live
```

The live config allows 180 s per test — above the 120 s client timeout in `tests/live/helpers.ts`, so a slow request fails with the client's own abort instead of an opaque vitest timeout — and retries once, because Diffbot's RAG endpoint occasionally stalls mid-stream. Keep retries out of the unit config.

Every tool, both retrievers, `loadExtract` and the provider (`generateText` + `streamText`) have a live file; keep new ones to one request each.

Live tests consume real Diffbot quota. `.github/workflows/integration.yml` runs them on push to `main`, on a twice-monthly drift schedule (1st and 15th at 14:17 UTC), and on `workflow_dispatch` — never on `pull_request` or `pull_request_target`, which would hand the token to fork-submitted workflow code. That workflow is the only holder of the secret; keep it out of `ci.yml`. It also fails fast when the secret is missing or blank, so a misconfigured repo is red rather than silently all-skipped.

### Live-token rules (mandatory)

1. Treat the token as present only when it is a **non-empty string after trimming** — never `token ?? fallback`, never a bare `!== undefined`.
2. **Never construct a `DiffbotClient` (or anything else that validates a token) at module scope** in a live file. Build it in `beforeAll`, inside the test, or behind a lazy getter.
3. CI must prove the skip path: `DIFFBOT_API_TOKEN="" pnpm test:live` exits 0 with every live test skipped.

## Layout

- One tool factory per file under `src/tools/`; one retrieval/loader module per Diffbot API under `src/retrieve/`.
- `tests/fixtures/worker/` is a bundling fixture, not a test: it is excluded from `tsconfig.json` (Workers globals are not in this package's `lib`) and checked by wrangler instead.
- Re-export public surface from `src/index.ts` only — keep `createClientResolver` internal.
