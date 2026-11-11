# `@diffbot/ai-sdk`

[![CI](https://github.com/diffbot/ai-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/diffbot/ai-sdk/actions/workflows/ci.yml)

Diffbot tools and an OpenAI-compatible LLM provider for the [Vercel AI SDK](https://ai-sdk.dev/):
web search, extraction, Knowledge Graph (DQL), NLP entities, ontology navigation, DQL probing, and
Diffbot's RAG `ask` endpoint.

The tools are the package root. The provider is the
[`@diffbot/ai-sdk/provider`](#diffbot-llm-provider) subpath. Runnable programs are in
[`examples/`](./examples/README.md).

## Install

Node.js 20 or newer.

```bash
pnpm add @diffbot/ai-sdk
```

```bash
npm install @diffbot/ai-sdk
yarn add @diffbot/ai-sdk
bun add @diffbot/ai-sdk
```

`@diffbot/typescript` is a dependency of this package, so that one install is the Diffbot install.
Add `@diffbot/typescript` yourself only when you construct a `DiffbotClient` to inject, and keep it
on the same minor (`^0.3.0` today).

Peers:

- `ai` `^6.0.0 || ^7.0.0`
- `zod` `^3.25.76 || ^4.1.8` (also a peer of `ai`)
- `@ai-sdk/openai-compatible` `^2.0.0 || ^3.0.0`, optional, and only if you use the provider

```bash
pnpm add @ai-sdk/openai-compatible
```

Pair the optional peer with your `ai` major. A mixed pair typechecks and fails when a request runs.

| Your `ai` version | Install `@ai-sdk/openai-compatible` |
| ----------------- | ----------------------------------- |
| `ai@6.x`          | `@ai-sdk/openai-compatible@2.x`     |
| `ai@7.x`          | `@ai-sdk/openai-compatible@3.x`     |

Tool-only apps can skip `@ai-sdk/openai-compatible`. Nothing on the package root imports it.

## Authentication

`DIFFBOT_API_TOKEN` is the only environment variable this package reads. Get a token at
[app.diffbot.com/get-started](https://app.diffbot.com/get-started/).

Every tool factory and every retrieve/load helper accepts the same auth options, and resolves them
when the call runs — importing the module and calling the factory do not read the environment:

1. **`client`** — a `DiffbotClient` you built with `@diffbot/typescript`. That client keeps its own
   timeout, base URLs, and `fetch`. Factory `timeout`, `fetch`, `apiKey`, and `env` are not applied
   on top of it.
2. **`apiKey`** — the token used when this package builds a client.
3. **Environment** — `process.env.DIFFBOT_API_TOKEN`. On Workers, pass `env`
   (`Record<string, string | undefined>`) and the SDK checks `env.DIFFBOT_API_TOKEN` first, then
   `process.env`.

When this package builds the client, `timeout` and `fetch` on the factory are forwarded to it.

A missing token throws from inside the call. The message names the three ways to supply one: a
`client`, an `apiKey`, or `DIFFBOT_API_TOKEN`.

```ts
import { diffbotWebSearch } from "@diffbot/ai-sdk";

const webSearch = diffbotWebSearch();
```

On Cloudflare Workers, pass the binding bag. Declare it with a string index signature so it is
assignable to `env`:

```ts
import { diffbotWebSearch } from "@diffbot/ai-sdk";

interface Env extends Record<string, string | undefined> {
  DIFFBOT_API_TOKEN?: string;
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const webSearch = diffbotWebSearch({ env });
    return Response.json({ tool: webSearch.description });
  },
};
```

`createDiffbot()` takes `apiKey` and `env` the same way, and reads the token on each model call. It
does not take a `DiffbotClient` — the provider uses the AI SDK HTTP stack, not
`@diffbot/typescript`.

### Injected client

Keep an injected `@diffbot/typescript` on the same minor as this package's dependency (`^0.3.0`). A
second copy from another minor fails typechecking with a private `fetchFn` error. One 0.3.x copy in
the tree is the normal npm layout.

```ts
import { DiffbotClient } from "@diffbot/typescript";
import { diffbotKnowledgeGraph } from "@diffbot/ai-sdk";

const token = process.env.DIFFBOT_API_TOKEN;
if (!token) throw new Error("Set DIFFBOT_API_TOKEN");

const knowledgeGraph = diffbotKnowledgeGraph({
  client: new DiffbotClient({ token }),
});
```

### Differences from `@diffbot/langchain`

- Factories and helpers run with no `client` argument. Pass one when you already have it.
- Results are `DiffbotDocument` values: `{ content: string; metadata: Record<string, unknown> }`.
- `k` is an argument of each `retrieveKnowledgeGraph` / `retrieveWebSearch` call.
- The web-search tool's model-facing field is `query`.
- Crawl is `loadCrawl` / `streamCrawl` only. There is no crawl tool.

## Quickstart

`stopWhen: stepCountIs(n)` is the stop condition on both `ai@6` and `ai@7`. `isStepCount` exists
only in `ai@7`.

The keys in `tools` are yours. `webSearch` below is not a name this package exports.
[`diffbotTools()`](#tool-bundle) is the path that uses the fixed `diffbot_*` names.

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotExtract, diffbotWebSearch } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "What does Diffbot sell?",
  tools: {
    webSearch: diffbotWebSearch(),
    extract: diffbotExtract(),
  },
  stopWhen: stepCountIs(5),
});

console.log(text);
```

## Tool bundle

```ts
import { diffbotTools } from "@diffbot/ai-sdk";

const tools = diffbotTools(); // all seven diffbot_* tools
const subset = diffbotTools({ only: ["diffbot_web_search", "diffbot_extract"] });
```

Every tool in one bundle shares one client. `ontologyStore` is forwarded to `diffbot_ontology`. The
other auth options (`client`, `apiKey`, `timeout`, `fetch`, `env`) apply to all of them.

When the bundle includes `diffbot_ask` and builds its own client, the timeout defaults to 120
seconds (see [`diffbotAsk`](#diffbotask)). That default covers the whole bundle, because the timeout
lives on the shared client. A subset that omits `diffbot_ask` keeps `@diffbot/typescript`'s 30
second default, and so do the standalone factories other than `diffbotAsk`.

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

Factory options: `numResults` and `snippetLength` (model input overrides them) and `maxTokens`
(factory-only — a cost guardrail the model cannot raise).

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotWebSearch } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "What has Diffbot shipped recently?",
  tools: {
    webSearch: diffbotWebSearch({
      numResults: 5,
      snippetLength: "medium",
      maxTokens: 2_000,
    }),
  },
  stopWhen: stepCountIs(3),
});

console.log(text);
```

### `diffbotExtract`

Extract structured content from a URL.

| Field | Type   | Default    |
| ----- | ------ | ---------- |
| `url` | string | required   |
| `api` | string | `analyze`  |
| `fmt` | string | `markdown` |

Extraction failures return `{ error, errorCode }`. Auth and rate-limit errors throw. `loadExtract` /
`streamExtract` are the batch form, and those throw on extraction failure instead of returning
`{ error, errorCode }`.

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotExtract } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "Summarize https://www.diffbot.com",
  tools: {
    extract: diffbotExtract({ fmt: "markdown" }),
  },
  stopWhen: stepCountIs(3),
});

console.log(text);
```

### `diffbotKnowledgeGraph`

Run a DQL query. Returns the raw JSON response.

| Field    | Type      | Default        |
| -------- | --------- | -------------- |
| `query`  | string    | required (DQL) |
| `size`   | int 1–100 | `10`           |
| `from`   | int ≥ 0   | `0`            |
| `filter` | string    | optional       |

Factory `size`, `from`, and `filter` fill in whatever the model omits. For shaped rows in your own
code, use [`retrieveKnowledgeGraph`](#retrieval-and-loader-helpers).

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotKnowledgeGraph } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "Name three AI companies headquartered in Boston.",
  tools: {
    knowledgeGraph: diffbotKnowledgeGraph({ size: 10 }),
  },
  stopWhen: stepCountIs(3),
});

console.log(text);
```

### `diffbotEntities`

Identify entities and sentiment in text. Returns the NLP response object, including entity IDs you
can look up in the KG with `id:or("id1","id2",...)`.

| Field  | Type   | Default                |
| ------ | ------ | ---------------------- |
| `text` | string | required               |
| `lang` | string | factory `lang`, `auto` |

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotEntities } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "Who is mentioned here? Diffbot opened an office in Berlin.",
  tools: {
    entities: diffbotEntities({ lang: "en" }),
  },
  stopWhen: stepCountIs(3),
});

console.log(text);
```

### `diffbotOntology`

Navigate the KG ontology before writing DQL. Returns a string list, or `{ error, hint }` for a
recoverable mistake (unknown op, type, taxonomy or enum name; missing `name`; invalid regex) so the
model can correct itself and retry.

| Field     | Type    | Notes                                                                                             |
| --------- | ------- | ------------------------------------------------------------------------------------------------- |
| `op`      | enum    | `types`, `composites`, `enums`, `taxonomies` (list names); `fields`, `taxonomy`, `enum`, `search` |
| `name`    | string  | Target for `fields` / `taxonomy` / `enum`; the regex for `search`                                 |
| `search`  | string  | Optional case-insensitive regex filter for `fields` / `taxonomy`                                  |
| `refresh` | boolean | Optional; passed to `ontologyStore.load({ refresh })` to re-fetch                                 |

A typical model call is `{ op: "fields", name: "Organization" }` after `{ op: "types" }`.

Fetching and caching the ontology is the SDK's `OntologyStore`'s job; by default each tool keeps an
in-memory one. In a Worker, where isolates are recycled between requests, inject a durable store
such as `KVOntologyStore`. An injected store carries its own client, so the tool resolves no token
of its own:

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

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotOntology } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "Which Organization fields describe headquarters and headcount?",
  tools: { ontology: diffbotOntology() },
  stopWhen: stepCountIs(4),
});

console.log(text);
```

### `diffbotDqlProbe`

Run DQL variants in parallel at `size=0` and return `{ query, hits }[]` in input order (`hits: null`
when a response carries no count).

| Field     | Type     | Default                |
| --------- | -------- | ---------------------- |
| `queries` | string[] | required               |
| `workers` | int ≥ 1  | factory `workers`, `8` |

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotDqlProbe } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "How many Boston AI companies are in the Knowledge Graph? Probe before you guess.",
  tools: {
    probe: diffbotDqlProbe({ workers: 4 }),
  },
  stopWhen: stepCountIs(3),
});

console.log(text);
```

### Writing DQL

Point an agent at the ontology, then the probe, then the graph. The ontology names the fields, the
probe reports hit counts for `size=0` variants, and the graph fetches the rows that survived.

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotDqlProbe, diffbotKnowledgeGraph, diffbotOntology } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  system: [
    "Look up fields with the ontology before writing DQL.",
    "Probe candidate queries and keep one that is neither empty nor huge.",
    "Then run that query on the Knowledge Graph.",
  ].join(" "),
  prompt: "Which Boston AI companies raised a Series B this year?",
  tools: {
    ontology: diffbotOntology(),
    probe: diffbotDqlProbe(),
    knowledgeGraph: diffbotKnowledgeGraph(),
  },
  stopWhen: stepCountIs(8),
});

console.log(text);
```

[`examples/company-research`](./examples/company-research) runs this kind of loop and also has web
search and extract.

### `diffbotAsk`

Ask Diffbot's RAG LLM a natural-language `question` (string, required). Aggregates the streamed
answer into one string.

The RAG endpoint routinely takes 15–30 seconds and sometimes longer, so when this package builds the
client for `diffbotAsk` it defaults the timeout to **120 seconds** instead of
`@diffbot/typescript`'s 30 seconds. Set `timeout` on the factory to override it; an injected
`client` always keeps its own timeout.

The same model is available directly as [`createDiffbot`](#diffbot-llm-provider) when you want the
answer yourself, with no tool call in between.

```ts
import { generateText, stepCountIs } from "ai";
import { diffbotAsk } from "@diffbot/ai-sdk";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5",
  prompt: "Who acquired Figma, and when?",
  tools: { ask: diffbotAsk() },
  stopWhen: stepCountIs(3),
});

console.log(text);
```

## Diffbot LLM provider

Import it from the subpath. The package root does not re-export it, so tool-only bundles never load
`@ai-sdk/openai-compatible`.

```ts
import { generateText } from "ai";
import { createDiffbot } from "@diffbot/ai-sdk/provider";

const diffbot = createDiffbot();
const { text } = await generateText({
  model: diffbot("diffbot-small-xl"),
  prompt: "Who acquired Figma, and when?",
});

console.log(text);
```

The same module exports a default instance, `diffbot`, created with `createDiffbot()`.
`diffbot.chatModel(id)` is the explicit form of `diffbot(id)`.

```ts
import { streamText } from "ai";
import { diffbot } from "@diffbot/ai-sdk/provider";

const result = streamText({
  model: diffbot.chatModel("diffbot-small"),
  prompt: "Who acquired Figma, and when?",
  abortSignal: AbortSignal.timeout(120_000),
});

for await (const delta of result.textStream) {
  process.stdout.write(delta);
}
```

| Export                      | Role                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `createDiffbot`             | Provider factory                                              |
| `diffbot`                   | `createDiffbot()` with default options                        |
| `DEFAULT_DIFFBOT_BASE_URL`  | `https://llm.diffbot.com/rag/v1`                              |
| `PROVIDER_NO_TOKEN_MESSAGE` | Thrown when a call has no `apiKey` and no `DIFFBOT_API_TOKEN` |

Models: `diffbot-small-xl` (70B, the one `diffbotAsk` uses) and `diffbot-small` (8B), typed as a
union with a `string` fallback so a newer model id still compiles.

`createDiffbot` options: `apiKey` (defaults to `DIFFBOT_API_TOKEN`), `env` (Workers-style bag),
`baseURL` (defaults to `https://llm.diffbot.com/rag/v1`), `headers`, and `fetch`. Nothing reads the
environment until a model call is made. An `Authorization` header you set yourself is left alone.

`diffbot-small-xl` is an answer-generation model with built-in retrieval (Knowledge Graph + web
search). It rejects user-defined tools with HTTP 400. Use your own agent model for tool calling and
reach Diffbot through the tools in this package, or through `diffbotAsk`.

Citations appear inline in the answer text as markdown links. Structured citations via
`providerMetadata` are a later increment.

The RAG endpoint routinely runs 15–30 seconds and sometimes longer. `createDiffbot` adds no request
timeout of its own. Allow at least 120 seconds on `generateText` / `streamText` (for example
`abortSignal: AbortSignal.timeout(120_000)`) and check your platform's function time limit.

## Output shaping

Knowledge Graph and web search returns can be huge. `retrieveKnowledgeGraph` and `retrieveWebSearch`
accept the same shaping knobs as the `@diffbot/langchain` retrievers. The tools return raw
responses; `toModelOutput` on those tools is still to come.

- `fields` — metadata allowlist
- `contentFields` — ordered priority for `content` (defaults: `DEFAULT_KG_CONTENT_FIELDS` =
  `description`, `summary`, `name`; `DEFAULT_WEB_CONTENT_FIELDS` = `content`, `snippet`)
- `documentMapper` — full override

A KG hit's `score` is copied into `metadata` after the `fields` projection, so narrowing never drops
it. A `documentMapper` owns the whole document: it receives the entity unshaped, and no `score` is
added behind it.

## Retrieval and loader helpers

Plain async functions for manual RAG and batch ingestion. There is no LangChain `Retriever` or
`DocumentLoader` type here, and `k` is per call.

| Helper                          | SDK call    | Notes                                                            |
| ------------------------------- | ----------- | ---------------------------------------------------------------- |
| `retrieveKnowledgeGraph`        | `dql`       | DQL query in `query`; shaped `DiffbotDocument[]`                 |
| `retrieveWebSearch`             | `webSearch` | Natural-language `query`                                         |
| `loadExtract` / `streamExtract` | `extract`   | Serial per URL; `shapeExtractResponse` mapping                   |
| `loadCrawl` / `streamCrawl`     | `crawl`     | Default `watch: true`; `defaultCrawlMapper` skips non-URL events |

Each returns (or yields) `DiffbotDocument` objects:
`{ content: string; metadata: Record<string, unknown> }`. Options beyond the auth ones:

- `retrieveKnowledgeGraph` — `query` (DQL, required), `k` (default `10`), `from`, `filter`,
  `exportspec`, `extra`, `format` (default `json`; other formats throw, since only JSON can be
  shaped), plus `fields` / `contentFields` (default `DEFAULT_KG_CONTENT_FIELDS`) / `documentMapper`.
- `retrieveWebSearch` — `query` (required), `k` (default `10`), `maxTokens`, `snippetLength`, plus
  `fields` / `contentFields` (default `DEFAULT_WEB_CONTENT_FIELDS`) / `documentMapper`.
- `loadExtract` / `streamExtract` — `urls` (required), `api` (default `analyze`), `fmt` (default
  `markdown`), `documentMapper(url, raw)`. `metadata` carries `url`, `title`, `pageUrl`,
  `resolvedPageUrl` and `type`. URLs are fetched one at a time, in order, and an extraction failure
  throws (as in `@diffbot/langchain`): `loadExtract` rejects, while `streamExtract` has already
  yielded the documents before the failing URL.
- `loadCrawl` / `streamCrawl` — `site` (required), `crawlOptions` (the SDK's `CrawlOptions`; `watch`
  defaults to `true` so URL events are emitted), `eventMapper(event)` returning a document or `null`
  to skip. The default `content` is the crawled URL itself, with `url`, `status` and
  `crawl_timestamp` in `metadata`.

`defaultCrawlMapper` drops the `job_created` event, so with `watch: false` you get no documents at
all — that combination only makes sense with an `eventMapper`. Pass `crawlOptions.jobName` if you
want to manage the job later; otherwise the SDK generates one and the default mapper never surfaces
it. `CrawlEventType` is re-exported here for writing a mapper:

```ts
import { CrawlEventType, streamCrawl } from "@diffbot/ai-sdk";

const jobs: string[] = [];
for await (const doc of streamCrawl({
  site: "https://example.com",
  crawlOptions: { watch: false, jobName: "docs-crawl" },
  eventMapper: (event) =>
    event.eventType === CrawlEventType.JobCreated
      ? { content: String(event.details.job_name), metadata: { ...event.details } }
      : null,
})) {
  jobs.push(doc.content);
}
```

Crawl is helpers only. A crawl runs for minutes and spends quota, so it is not a model-facing tool.
Job control (`crawlListJobs`, `crawlGetJob`, `crawlDeleteJob`) stays on `@diffbot/typescript`.

```ts
import { loadExtract, retrieveKnowledgeGraph, streamCrawl } from "@diffbot/ai-sdk";

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

Auth matches the tools: `client`, then `apiKey`, then `DIFFBOT_API_TOKEN` via `env` or the process
environment, resolved when the function runs. The retrieve helpers reject before any request on a
bad `k` (non-integer or `<= 0`) or a `format` other than `json`. HTTP and extraction failures
surface as the SDK's own `AuthError`, `RateLimitError`, or `ExtractionError`.

[`examples/manual-rag`](./examples/manual-rag) wires the retrievers and `loadExtract` into one
prompt.

## Cloudflare Workers

The package root and the provider subpath stay free of Node built-ins, so a Worker does not need the
`nodejs_compat` flag. Pass the request `env` into every factory. The token is resolved when that
request's call runs, which keeps a missing binding a failed request rather than a failed module
load.

`DIFFBOT_API_TOKEN` belongs in a secret (`wrangler secret put`) or in `.dev.vars` for local dev. It
does not belong in `wrangler.toml`.

Ontology caching needs a durable store across isolates; the snippet under
[`diffbotOntology`](#diffbotontology) injects `KVOntologyStore`. The in-memory store is recreated
whenever the isolate is.

`diffbot-small-xl` often takes 15–30 seconds. Stream the provider response and set an abort
deadline, and stay inside the Worker's own CPU and wall-time limits.

```ts
import { streamText } from "ai";
import { retrieveWebSearch } from "@diffbot/ai-sdk";
import { createDiffbot } from "@diffbot/ai-sdk/provider";

interface Env extends Record<string, string | undefined> {
  DIFFBOT_API_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/search") {
      const query = url.searchParams.get("q");
      if (!query) return new Response("pass ?q=", { status: 400 });
      const docs = await retrieveWebSearch({ env, query, k: 5 });
      return Response.json(docs);
    }

    const result = streamText({
      model: createDiffbot({ env })("diffbot-small-xl"),
      prompt: "Who acquired Figma, and when?",
      abortSignal: AbortSignal.timeout(120_000),
    });
    return result.toTextStreamResponse();
  },
};
```

[`examples/worker`](./examples/worker) is this pattern as a Wrangler project: `GET /search` and
`POST /ask`.

## Tools and helpers

Every runtime export of `@diffbot/ai-sdk`:

| Export                                                                                                                               | Kind                   |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `diffbotWebSearch`, `diffbotExtract`, `diffbotKnowledgeGraph`, `diffbotEntities`, `diffbotOntology`, `diffbotDqlProbe`, `diffbotAsk` | Model-facing `tool()`  |
| `diffbotTools`                                                                                                                       | Bundle                 |
| `retrieveKnowledgeGraph`, `retrieveWebSearch`                                                                                        | Retrieval              |
| `loadExtract`, `streamExtract`, `loadCrawl`, `streamCrawl`, `defaultCrawlMapper`                                                     | Loaders                |
| `dictToDocument`, `shapeExtractResponse`, `DEFAULT_KG_CONTENT_FIELDS`, `DEFAULT_WEB_CONTENT_FIELDS`                                  | Shaping                |
| `CrawlEventType`                                                                                                                     | Re-export from the SDK |

Option and result types (`DiffbotAuth`, `DiffbotDocument`, `DiffbotToolName`, the per-factory option
interfaces, and the `@diffbot/typescript` types that appear in those signatures — `DiffbotClient`,
`CrawlOptions`, `CrawlEvent`, `KVOntologyStore`, `OntologyStore`, `SnippetLength`, `JsonObject`) are
exported from the same entry. `DiffbotClient` is a type here; construct the class from
`@diffbot/typescript`.

## Examples

| Example                                           | What it shows                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| [`company-research`](./examples/company-research) | `diffbotTools()` agent loop, `generateText` or `streamText`      |
| [`manual-rag`](./examples/manual-rag)             | KG + web search + extract, assembled into one prompt             |
| [`worker`](./examples/worker)                     | Workers `env` bag, `retrieveWebSearch`, streamed `createDiffbot` |

Shared setup and the env vars are in [`examples/README.md`](./examples/README.md). Each directory's
README has its own run steps.

## Not yet implemented

- `toModelOutput` on the Knowledge Graph and web-search tools (the retrieve helpers already shape
  results)
- `askJson` / structured-output passthrough on `diffbotAsk`
- Structured citations through `providerMetadata` (citations are inline in the answer text today)
- The docs.diffbot.com integration guide, and the listing on the
  [AI SDK tools registry](https://ai-sdk.dev/resources/tools). The draft entry is
  [`docs/registry-entry.md`](./docs/registry-entry.md). Its `docsUrl` is a placeholder until that
  guide exists.

See [`PLAN.md`](./PLAN.md) for the rest of the roadmap.

## Development

```bash
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm typecheck:docs
pnpm typecheck:examples
pnpm build
```

`pnpm typecheck:docs` compiles every `ts` block in this README and the registry `codeExample`
against `src/`. `pnpm typecheck:examples` does the same for `examples/`.

Live tests (they spend quota and need a token):

```bash
DIFFBOT_API_TOKEN=your-token pnpm test:live
```

The `integration.yml` workflow runs this suite on pushes to `main`, twice a month for API drift (1st
and 15th), and on manual dispatch — never on pull requests, so the token stays out of reach of fork
code. `pnpm test:workers` bundles the Cloudflare Workers fixture with `wrangler deploy --dry-run`
and needs no Cloudflare account. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full workflow.

## Releasing

[`CONTRIBUTING.md`](./CONTRIBUTING.md) is the release process. `release.yml` publishes from a `v*`
tag that matches `package.json`'s `version`. A manual dispatch of that workflow packs a tarball and
stops there.

## License

MIT
