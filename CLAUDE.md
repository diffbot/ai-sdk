# `@diffbot/ai-sdk` — agent notes

Vercel AI SDK integration for Diffbot: tools built with `tool()` from the `ai` package, calling free functions from `@diffbot/typescript` (`webSearch`, `extract`, `dql`, …).

## Auth

Precedence inside `execute` (lazy): injected `client` → `apiKey` → `resolveTokenFromEnv` / `DIFFBOT_API_TOKEN`. Never construct a client at import time or at tool factory time without an injected client.

## Peers

- `ai`: `^6.0.0 || ^7.0.0` — use `stepCountIs`, not `isStepCount`.
- `@ai-sdk/openai-compatible`: optional; pair `@2` with `ai@6`, `@3` with `ai@7`.

## Phase 2 scope (current)

Seven tools: `diffbotWebSearch`, `diffbotExtract`, `diffbotKnowledgeGraph`, `diffbotEntities`, `diffbotOntology`, `diffbotDqlProbe`, `diffbotAsk`, plus `diffbotTools()` bundle. Provider at `@diffbot/ai-sdk/provider` (`createDiffbot`). No retrieve/load helpers, no examples yet (Phase 3+).

## CI and live tests

`.github/workflows/ci.yml` is unit-only and uses no secrets (lint, typecheck, unit tests, `ai@6` peer leg, empty-token live-skip guard). Phase 4 will add `integration.yml` for `pnpm test:live`, triggered on push to `main`, a twice-monthly drift schedule (1st and 15th at 14:17 UTC), and `workflow_dispatch` — never on `pull_request`, so `DIFFBOT_API_TOKEN` is never exposed to fork PR code.
