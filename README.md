# `@diffbot/ai-sdk`

[![CI](https://github.com/diffbot/ai-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/diffbot/ai-sdk/actions/workflows/ci.yml)

Diffbot tools and an OpenAI-compatible LLM provider for the [Vercel AI SDK](https://ai-sdk.dev/): web search, extraction, Knowledge Graph (DQL), NLP entities, ontology navigation, DQL probing, and Diffbot's RAG `ask` endpoint.

**Status:** Phase 2 — seven tools, `diffbotTools()`, and `createDiffbot` from `@diffbot/ai-sdk/provider`. See [Not yet implemented](#not-yet-implemented).

## Install

```bash
pnpm add @diffbot/ai-sdk
```

You also need a compatible `ai` peer (`^6` or `^7`) and `zod` (required by `ai`).

For the Diffbot LLM provider:

```bash
pnpm add @ai-sdk/openai-compatible
```

Pair versions correctly (mixed pairs compile but fail at runtime):

| Your `ai` version | Install `@ai-sdk/openai-compatible` |
| ----------------- | ----------------------------------- |
| `ai@6.x`          | `@ai-sdk/openai-compatible@2.x`     |
| `ai@7.x`          | `@ai-sdk/openai-compatible@3.x`     |

## Authentication

Every tool factory accepts:

1. **`client`** — a `DiffbotClient` from `@diffbot/typescript` (full control of timeout, custom URLs, injected `fetch`).
2. **`apiKey`** — passed when constructing an internal client.
3. **Environment** — `DIFFBOT_API_TOKEN` (the only env var this package reads), or a Workers-style `env` bag forwarded to the SDK.

The token is resolved **inside `execute`**, not at import time. Missing credentials throw with a clear message when a tool runs, not when the process starts.

`createDiffbot()` reads `DIFFBOT_API_TOKEN` **lazily on the first model call**, not at import or factory time.

```ts
import { diffbotWebSearch } from "@diffbot/ai-sdk";

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

const tools = diffbotTools(); // all seven diffbot_* tools
const subset = diffbotTools({ only: ["diffbot_web_search", "diffbot_extract"] });
```

## Tools

### `diffbotWebSearch`

Search the web via Diffbot. Returns raw results (`title`, `pageUrl`, `score`, `content`, …).

| Field           | Type                                    | Notes                                                                           |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `query`         | string                                  | Required. (LangChain used `text`; this package uses `query` for AI SDK parity.) |
| `numResults`    | int 1–50                                | Optional                                                                        |
| `snippetLength` | `short` \| `medium` \| `long` \| `full` | Optional                                                                        |

Factory-only: `numResults`, `maxTokens`, `snippetLength`.

### `diffbotExtract`

Extract structured content from a URL.

| Field | Type   | Default    |
| ----- | ------ | ---------- |
| `url` | string | required   |
| `api` | string | `analyze`  |
| `fmt` | string | `markdown` |

Extraction failures return `{ error, errorCode }`; auth and rate-limit errors throw.

### `diffbotKnowledgeGraph`

Run a DQL query. Returns the raw JSON response.

| Field    | Type      | Default        |
| -------- | --------- | -------------- |
| `query`  | string    | required (DQL) |
| `size`   | int 1–100 | `10`           |
| `from`   | int ≥ 0   | `0`            |
| `filter` | string    | optional       |

### `diffbotEntities`

Identify entities and sentiment in text (`text`, optional `lang`, default `auto`). Returns the NLP response including entity IDs for KG lookup.

### `diffbotOntology`

Navigate the KG ontology before writing DQL (`op`, optional `name`, `search`, `refresh`). Returns a string list or `{ error, hint }` for recoverable mistakes. Pass `ontologyStore: new KVOntologyStore(client, kv)` in Workers.

### `diffbotDqlProbe`

Probe DQL variants at `size=0` (`queries`, optional `workers`, default 8). Returns `{ query, hits }[]` in input order (`hits: null` when absent).

### `diffbotAsk`

Ask Diffbot's RAG LLM a natural-language `question`. Aggregates the streamed answer into one string. Expect **15–120 s** latency; use a raised client `timeout` (e.g. `120_000` ms) in production.

## Diffbot LLM provider

```ts
import { generateText } from "ai";
import { createDiffbot } from "@diffbot/ai-sdk/provider";

const diffbot = createDiffbot();
const { text } = await generateText({
  model: diffbot("diffbot-small-xl"),
  prompt: "Who acquired Figma, and when?",
});
```

Models: `diffbot-small-xl` (default, 70B RAG) and `diffbot-small` (8B). Also `diffbot.chatModel(id)` and a default `diffbot` export from the same module.

`diffbot-small-xl` is an answer-generation model with built-in retrieval (Knowledge Graph + web search). It **rejects user-defined tools** (HTTP 400), so use your own agent model for tool calling and reach Diffbot through the tools in this package, or through `diffbotAsk`.

Citations appear **inline** in the answer text as markdown links; structured citations via `providerMetadata` are a v0.2.0 item.

The RAG endpoint routinely runs 15–30 seconds and sometimes longer — set client timeouts accordingly when calling `diffbotAsk` or the provider in production.

## Not yet implemented

Planned for later phases:

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

Live tests (consume quota, require a token):

```bash
DIFFBOT_API_TOKEN=your-token pnpm test:live
```

## License

MIT
