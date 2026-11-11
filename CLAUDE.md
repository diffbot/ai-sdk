# `@diffbot/ai-sdk` — agent notes

Vercel AI SDK integration for Diffbot: tools built with `tool()` from the `ai` package, calling free functions from `@diffbot/typescript` (`webSearch`, `extract`, `dql`, …).

## Auth

Precedence inside `execute` (lazy): injected `client` → `apiKey` → `resolveTokenFromEnv` / `DIFFBOT_API_TOKEN`. Never construct a client at import time or at tool factory time without an injected client.

## Peers

- `ai`: `^6.0.0 || ^7.0.0` — use `stepCountIs`, not `isStepCount`.
- `@ai-sdk/openai-compatible`: optional; pair `@2` with `ai@6`, `@3` with `ai@7`.

## Phase 4 scope (current)

Seven tools plus retrieval/loader helpers: `retrieveKnowledgeGraph`, `retrieveWebSearch`, `loadExtract`, `streamExtract`, `loadCrawl`, `streamCrawl`, `defaultCrawlMapper` (crawl is helpers-only, never a tool). Provider at `@diffbot/ai-sdk/provider` (`createDiffbot`). `diffbotAsk` defaults to `timeout: 120_000` when this package builds the client; injected clients keep their own timeout. `diffbotTools()` still builds one shared client, so that default covers the whole bundle when `diffbot_ask` is included. No examples yet (Phase 5). Live coverage is complete: every tool, both retrievers, `loadExtract`, and the provider (`generateText` + `streamText`).

## CI and live tests

Four workflows:

- `ci.yml` — unit-only, **no secrets** (lint, typecheck, unit tests + build on Node 20/22/24, the `ai@6`/`ai@7` peer matrix, empty-token live-skip guard, Workers bundle check). Keep it secret-free so it can run on fork PRs.
- `integration.yml` — `pnpm test:live`, on push to `main`, a twice-monthly drift schedule (1st and 15th at 14:17 UTC), and `workflow_dispatch`. Never `pull_request`/`pull_request_target`, so `DIFFBOT_API_TOKEN` is never exposed to fork PR code. A guard step fails the run on a missing or blank secret rather than skipping everything green.
- `canary.yml` — weekly `ai@latest` + `@ai-sdk/openai-compatible@latest` typecheck + unit tests. No secrets.
- `release.yml` — `v*` tag only; `workflow_dispatch` is a build-only rehearsal and every publish/release step is gated on the tag push. It fails early unless the tag equals `package.json`'s version and `"private"` is no longer `true` (Phase 6 flips that flag — do not change it before then).

`pnpm test:workers` dry-run bundles `tests/fixtures/worker/` for workerd and then scans the bundle: `wrangler deploy --dry-run` alone leaves static `node:*` imports in the output as externals, so the scan is what actually enforces Workers-cleanliness.

The `test:peer:*` scripts install peer versions over the lockfile — restore with `git checkout package.json pnpm-lock.yaml && pnpm install --frozen-lockfile`.
