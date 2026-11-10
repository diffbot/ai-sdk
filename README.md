# `@diffbot/ai-sdk`

[![CI](https://github.com/diffbot/ai-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/diffbot/ai-sdk/actions/workflows/ci.yml)

Diffbot tools for the [Vercel AI SDK](https://ai-sdk.dev/): web search, page extraction, and Knowledge Graph (DQL) queries.

**Status:** Phase 1 — three core tools and `diffbotTools()`. See [Not yet implemented](#not-yet-implemented).

## Install

```bash
pnpm add @diffbot/ai-sdk
```

You also need a compatible `ai` peer (`^6` or `^7`) and `zod` (required by `ai`).

## Authentication

Every tool factory accepts:

1. **`client`** — a `DiffbotClient` from `@diffbot/typescript` (full control of timeout, custom URLs, injected `fetch`).
2. **`apiKey`** — passed when constructing an internal client.
3. **Environment** — `DIFFBOT_API_TOKEN` (the only env var this package reads), or a Workers-style `env` bag forwarded to the SDK.

The token is resolved **inside `execute`**, not at import time. Missing credentials throw with a clear message when a tool runs, not when the process starts.

```ts
import { diffbotWebSearch } from "@diffbot/ai-sdk";

// Reads DIFFBOT_API_TOKEN on first tool call
const webSearch = diffbotWebSearch();
```

### Injected client

If you inject your own `DiffbotClient`, keep `@diffbot/typescript` on the **same minor** as this package (`^0.3.0` today). A different minor can produce a TypeScript error about a private `fetchFn` — npm dedupes a single 0.3.x copy, which is the common case.

## Quickstart

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotWebSearch, diffbotExtract } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "What does Diffbot sell?",
  tools: {
    webSearch: diffbotWebSearch(),
    extract: diffbotExtract(),
  },
  stopWhen: stepCountIs(5),
});
```

Use `stopWhen: stepCountIs(n)` — not `isStepCount`, which exists only in `ai@7`.

## Tool bundle

LangChain-style keys:

```ts
import { diffbotTools } from "@diffbot/ai-sdk";

const tools = diffbotTools(); // diffbot_web_search, diffbot_extract, diffbot_knowledge_graph
const subset = diffbotTools({ only: ["diffbot_web_search", "diffbot_extract"] });
```

## Tools

### `diffbotWebSearch`

Search the web via Diffbot. Returns raw results (`title`, `pageUrl`, `score`, `content`, …).

**Input (model):**

| Field           | Type                                    | Notes                                                                           |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `query`         | string                                  | Required. (LangChain used `text`; this package uses `query` for AI SDK parity.) |
| `numResults`    | int 1–50                                | Optional                                                                        |
| `snippetLength` | `short` \| `medium` \| `long` \| `full` | Optional                                                                        |

**Factory-only:** `numResults`, `maxTokens`, `snippetLength` can be set on the factory; model input overrides `numResults` and `snippetLength`.

### `diffbotExtract`

Extract structured content from a URL.

| Field | Type   | Default    |
| ----- | ------ | ---------- |
| `url` | string | required   |
| `api` | string | `analyze`  |
| `fmt` | string | `markdown` |

Extraction failures return `{ error, errorCode }`; auth and rate-limit errors throw.

### `diffbotKnowledgeGraph`

Run a DQL query against the Knowledge Graph. Returns the raw JSON response.

| Field    | Type      | Default        |
| -------- | --------- | -------------- |
| `query`  | string    | required (DQL) |
| `size`   | int 1–100 | `10`           |
| `from`   | int ≥ 0   | `0`            |
| `filter` | string    | optional       |

## `ai` / `@ai-sdk/openai-compatible` pairing

| Your `ai` version | Install `@ai-sdk/openai-compatible` |
| ----------------- | ----------------------------------- |
| `ai@6.x`          | `@ai-sdk/openai-compatible@2.x`     |
| `ai@7.x`          | `@ai-sdk/openai-compatible@3.x`     |

The optional peer is only needed for `createDiffbot` from `@diffbot/ai-sdk/provider` (Phase 2). Tool-only installs do not need it.

## Not yet implemented

Planned for later phases (not in this release):

- `createDiffbot` provider (`@diffbot/ai-sdk/provider`)
- `diffbotEntities`, `diffbotOntology`, `diffbotDqlProbe`, `diffbotAsk`
- Retrieval helpers (`retrieveKnowledgeGraph`, `retrieveWebSearch`, …)
- Loaders (`loadExtract`, `streamExtract`, `loadCrawl`, `streamCrawl`)
- Examples, Workers fixture, tools-registry listing

See [`PLAN.md`](./PLAN.md) for the full roadmap.

## Development

```bash
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## License

MIT
