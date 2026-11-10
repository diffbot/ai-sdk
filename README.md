# `@diffbot/ai-sdk`

[![CI](https://github.com/diffbot/ai-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/diffbot/ai-sdk/actions/workflows/ci.yml)

Diffbot tools and an OpenAI-compatible LLM provider for the [Vercel AI SDK](https://ai-sdk.dev/): web search, extraction, Knowledge Graph (DQL), NLP entities, ontology navigation, DQL probing, and Diffbot's RAG `ask` endpoint.

**Status:** Phase 3 — seven tools, retrieval/loader helpers, `diffbotTools()`, and `createDiffbot` from `@diffbot/ai-sdk/provider`. See [Not yet implemented](#not-yet-implemented).

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

`createDiffbot()` reads `DIFFBOT_API_TOKEN` **lazily, on each model call**, not at import or factory time.

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

Every tool in one bundle shares one client. `ontologyStore` is forwarded to
`diffbot_ontology`; the other auth options (`client`, `apiKey`, `timeout`, `fetch`, `env`)
apply to all of them. When the bundle includes `diffbot_ask` and builds its own client, the
timeout defaults to 120 s (see [`diffbotAsk`](#diffbotask)).

## Tools

| Factory                 | Bundle key                | What it does                                           |
| ----------------------- | ------------------------- | ------------------------------------------------------ |
| `diffbotWebSearch`      | `diffbot_web_search`      | Web search with ranked, snippet-bearing results        |
| `diffbotExtract`        | `diffbot_extract`         | Structured content from one URL                        |
| `diffbotKnowledgeGraph` | `diffbot_knowledge_graph` | Run a DQL query against the Knowledge Graph            |
| `diffbotEntities`       | `diffbot_entities`        | Entities and sentiment in a piece of text              |
| `diffbotOntology`       | `diffbot_ontology`        | Inspect KG types, fields, taxonomies and enums for DQL |
| `diffbotDqlProbe`       | `diffbot_dql_probe`       | Hit counts for DQL variants, without fetching entities |
| `diffbotAsk`            | `diffbot_ask`             | A synthesized, sourced answer from Diffbot's RAG LLM   |

### `diffbotWebSearch`

Search the web via Diffbot. Returns raw results (`title`, `pageUrl`, `score`, `content`, …).

| Field           | Type                                    | Notes                                                                           |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `query`         | string                                  | Required. (LangChain used `text`; this package uses `query` for AI SDK parity.) |
| `numResults`    | int 1–50                                | Optional                                                                        |
| `snippetLength` | `short` \| `medium` \| `long` \| `full` | Optional                                                                        |

Factory options: `numResults` and `snippetLength` (model input overrides them) and `maxTokens` (factory-only — a cost guardrail the model cannot raise).

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

Identify entities and sentiment in text. Returns the NLP response object, including entity IDs you can look up in the KG with `id:or("id1","id2",...)`.

| Field  | Type   | Default                |
| ------ | ------ | ---------------------- |
| `text` | string | required               |
| `lang` | string | factory `lang`, `auto` |

### `diffbotOntology`

Navigate the KG ontology before writing DQL. Returns a string list, or `{ error, hint }` for a recoverable mistake (unknown op, type, taxonomy or enum name; missing `name`; invalid regex) so the model can correct itself and retry.

| Field     | Type    | Notes                                                                                             |
| --------- | ------- | ------------------------------------------------------------------------------------------------- |
| `op`      | enum    | `types`, `composites`, `enums`, `taxonomies` (list names); `fields`, `taxonomy`, `enum`, `search` |
| `name`    | string  | Target for `fields` / `taxonomy` / `enum`; the regex for `search`                                 |
| `search`  | string  | Optional case-insensitive regex filter for `fields` / `taxonomy`                                  |
| `refresh` | boolean | Optional; passed to `ontologyStore.load({ refresh })` to re-fetch                                 |

Fetching and caching the ontology is the SDK's `OntologyStore`'s job; by default each tool keeps an in-memory one. In a Worker, where isolates are recycled between requests, inject a durable store such as `KVOntologyStore`. An injected store carries its own client, so the tool resolves no token of its own:

```ts
import { DiffbotClient, KVOntologyStore, type KVLike } from "@diffbot/typescript";
import { diffbotOntology } from "@diffbot/ai-sdk";

interface Env {
  DIFFBOT_API_TOKEN: string;
  ONTOLOGY: KVLike; // a KV namespace binding
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const client = new DiffbotClient({ token: env.DIFFBOT_API_TOKEN });
    const ontology = diffbotOntology({
      client,
      ontologyStore: new KVOntologyStore(client, env.ONTOLOGY),
    });
    // …pass `ontology` in the `tools` of generateText / streamText.
    return Response.json({ tool: ontology.description });
  },
};
```

### `diffbotDqlProbe`

Run DQL variants in parallel at `size=0` and return `{ query, hits }[]` in input order (`hits: null` when a response carries no count).

| Field     | Type     | Default                |
| --------- | -------- | ---------------------- |
| `queries` | string[] | required               |
| `workers` | int ≥ 1  | factory `workers`, `8` |

### `diffbotAsk`

Ask Diffbot's RAG LLM a natural-language `question` (string, required). Aggregates the streamed answer into one string.

The RAG endpoint routinely takes 15–30 s and sometimes longer, so when this package builds the client for `diffbotAsk` it defaults the timeout to **120 s** instead of `@diffbot/typescript`'s 30 s. Set `timeout` on the factory to override it; an injected `client` always keeps its own timeout.

The SDK's timeout is per client and a bundle shares one client, so `diffbotTools()` applies the same 120 s default to every tool in the bundle whenever `diffbot_ask` is included. Without `diffbot_ask` (via `only`), and for the standalone factories, the other tools keep the SDK's 30 s default.

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

Models: `diffbot-small-xl` (70B, the one `diffbotAsk` uses) and `diffbot-small` (8B), typed as a union with a `string` fallback so a newer model id still compiles. Also `diffbot.chatModel(id)` and a ready-made `diffbot` instance exported from the same module.

`createDiffbot` options: `apiKey` (defaults to `DIFFBOT_API_TOKEN`), `env` (Workers-style bag), `baseURL` (defaults to `https://llm.diffbot.com/rag/v1`), `headers`, and `fetch`. Nothing reads the environment until a model call is made; an `Authorization` header you set yourself is left alone.

`diffbot-small-xl` is an answer-generation model with built-in retrieval (Knowledge Graph + web search). It **rejects user-defined tools** (HTTP 400), so use your own agent model for tool calling and reach Diffbot through the tools in this package, or through `diffbotAsk`.

Citations appear **inline** in the answer text as markdown links; structured citations via `providerMetadata` are a v0.2.0 item.

The RAG endpoint routinely runs 15–30 seconds and sometimes longer. `createDiffbot` uses the AI SDK's HTTP stack, not `@diffbot/typescript`'s `DiffbotClient`, so it adds no request timeout of its own — allow at least 120 s on `generateText` / `streamText` (for example `abortSignal: AbortSignal.timeout(120_000)`) and check your platform's function time limit.

## Output shaping

Knowledge Graph and web search returns can be huge. Helpers and (in a later phase) tool `toModelOutput` hooks accept the same knobs as `@diffbot/langchain`:

- `fields` — metadata allowlist
- `contentFields` — ordered priority for `content` (defaults: `DEFAULT_KG_CONTENT_FIELDS`, `DEFAULT_WEB_CONTENT_FIELDS`)
- `documentMapper` — full override

A KG hit's `score` is copied into `metadata` **after** the `fields` projection so narrowing never drops it.

## Retrieval and loader helpers

Plain async functions for manual RAG and batch ingestion — no LangChain `Retriever` / `DocumentLoader` types. Unlike `@diffbot/langchain`, **`k` is per call** on the retrieve helpers.

| Helper                          | SDK call    | Notes                                                            |
| ------------------------------- | ----------- | ---------------------------------------------------------------- |
| `retrieveKnowledgeGraph`        | `dql`       | DQL query in `query`; shaped `DiffbotDocument[]`                 |
| `retrieveWebSearch`             | `webSearch` | Natural-language `query`                                         |
| `loadExtract` / `streamExtract` | `extract`   | Serial per URL; `shapeExtractResponse` mapping                   |
| `loadCrawl` / `streamCrawl`     | `crawl`     | Default `watch: true`; `defaultCrawlMapper` skips non-URL events |

Crawl is **helpers only** — never a model-facing tool (slow, quota-heavy). Job control: call `@diffbot/typescript` directly.

```ts
import { retrieveKnowledgeGraph, loadExtract, streamCrawl } from "@diffbot/ai-sdk";

const kg = await retrieveKnowledgeGraph({
  query: 'type:Organization industries:"Artificial Intelligence"',
  k: 5,
  fields: ["id", "type", "name"],
});

const pages = await loadExtract({ urls: ["https://example.com"], fmt: "markdown" });
for await (const doc of streamCrawl({ site: "https://example.com" })) {
  /* doc.content is the crawled URL by default — chain with loadExtract for page text */
}
```

Auth matches tools: `client` → `apiKey` → `DIFFBOT_API_TOKEN`, resolved when the function runs.

## Tools and helpers

| Export                                                                           | Kind                  |
| -------------------------------------------------------------------------------- | --------------------- |
| Tool factories (`diffbotWebSearch`, …)                                           | Model-facing `tool()` |
| `diffbotTools`                                                                   | Bundle                |
| `retrieveKnowledgeGraph`, `retrieveWebSearch`                                    | Retrieval             |
| `loadExtract`, `streamExtract`, `loadCrawl`, `streamCrawl`, `defaultCrawlMapper` | Loaders               |
| `dictToDocument`, `shapeExtractResponse`, `DEFAULT_*_CONTENT_FIELDS`             | Shaping               |

## Not yet implemented

Planned for later phases:

- `toModelOutput` result shaping, `askJson` / structured-output passthrough
- Structured citations through `providerMetadata` (v0.2.0)
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

A future `integration.yml` workflow (Phase 4) will run this suite on pushes to `main`, twice a month for API drift (1st and 15th), and on manual dispatch — not on pull requests.

## License

MIT
