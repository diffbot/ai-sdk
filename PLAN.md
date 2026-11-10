# `@diffbot/ai-sdk` — implementation plan

**Status:** plan only. No package code written, no repo created, no PR opened, nothing published.
**Plan date:** 2026-11-09. **Decisions locked:** 2026-11-09 (Andrew + Opus) — see §10.
**Inputs:** local read-only clones of `diffbot/langchain-diffbot-typescript` (`typescript/`), `diffbot/langchain-diffbot` (`python/`), `diffbot/diffbot-mcp` (`mcp/`); the published `@diffbot/typescript` SDK (0.3.0) unpacked from npm; current Vercel AI SDK docs and `vercel/ai` repo contents as of today; throwaway cross-major compatibility probes against `ai@5/6/7` and `@ai-sdk/openai-compatible@1/2/3` (results in Appendix A; probe directory deleted afterwards).

Goal: an npm package `@diffbot/ai-sdk` that gives Vercel AI SDK users the same Diffbot coverage the LangChain packages already ship, plus a listing in the AI SDK tools registry.

**This document contains no API tokens and never will.** Only the env var *name* `DIFFBOT_API_TOKEN` appears anywhere in it, in the clones' CI, or in the package design.

---

## 0. Executive summary

- Diffbot's LangChain surface is **12 public classes** over **7 Diffbot API endpoints**, all built as a thin layer on free functions from `@diffbot/typescript`. There is **no** graph transformer, embeddings model, vector store, or reranker anywhere in these repos — do not promise one.
- The AI SDK has a direct analogue for the 7 **tools** (`tool()` + `inputSchema`), a direct analogue for the **chat model** (`createOpenAICompatible` against Diffbot's OpenAI-shaped `https://llm.diffbot.com/rag/v1`), and **no analogue at all** for `Retriever` / `DocumentLoader` — those become plain async helper functions (and, where it makes sense, the tool we already have).
- **Decided:** one package, `@diffbot/ai-sdk`, many named tool exports — matching Tavily / Exa / Firecrawl / Perplexity and matching Diffbot's own single-package LangChain approach. The Diffbot LLM provider ships from the same package under the `./provider` subpath, **in v0.1.0**.
- **Decided:** `@diffbot/typescript` is a regular **dependency** (`^0.3.0`), not a peer, so `npm i @diffbot/ai-sdk` is the whole install — which the tools-registry `installCommand`/`codeExample` contract requires. The SDK has **zero dependencies and is 232 KB unpacked**, so a duplicate copy is cheap; the one real hazard (a cross-minor duplicate makes an injected `DiffbotClient` a type error) is documented, tested, and handled by a fast-follow version policy. Reasoning in §10.2.
- **Decided:** peer `ai: ^6.0.0 || ^7.0.0`. The exact `ai` surface we touch (`tool`, `inputSchema`, `Tool`/`ToolSet`, the `execute` options arg, async-generator `execute`, `toModelOutput`) compiles **unchanged** under both majors; `ai@5` is excluded because `toModelOutput`'s signature changed. Verified by compiling the real surface against all three. Consequence: all docs and the registry `codeExample` use **`stepCountIs`**, not `isStepCount` — the latter is `ai@7`-only.
- **Decided:** repo starts as **`shixish/diffbot-ai-sdk` (private)** and transfers to the `diffbot` org when org access exists. The npm name stays **`@diffbot/ai-sdk`**; publishing to the `@diffbot` scope needs npm org membership — a **publish prerequisite, not a scaffolding blocker**.
- **Decided:** v1 is LangChain parity. All five MCP-derived typed searches (orgs / people / deals / news / places) are deferred to v0.3.0; crawl stays helpers-only and is not a model-facing tool.
- Effort: **~11–16 engineer-days** for full LangChain parity + docs + examples + registry PR, excluding the deferred MCP-derived stretch tools (a further ~5–8 days). Phase 1 (§8.1) is ~3–4 of those days and is specified tightly enough to hand to a coding agent as-is.
- Two concrete bugs from `langchain-diffbot-typescript`'s live suite must not be repeated: `token ?? "placeholder"` does not catch `""`, and module-scope client construction defeats `describe.skipIf`. Details in §6.2. Fixing them upstream is a **separate PR, out of scope here** (§10.13).

## 1. Inventory: what Diffbot ships for LangChain today

### 1.1 TypeScript package `@diffbot/langchain` (v0.2.0)

Source of truth: `typescript/src/index.ts` (the barrel; `tests/imports.test.ts` and `tests/readme_parity.test.ts` assert against it).

| Class | Abstraction | SDK call | Diffbot endpoint | File |
| --- | --- | --- | --- | --- |
| `ChatDiffbot` | Chat model (streaming) | `ask(client, messages)` | `POST https://llm.diffbot.com/rag/v1/chat/completions` | `src/chat_models.ts` |
| `DiffbotKnowledgeGraphRetriever` | Retriever | `dql(client, query, opts)` | `GET https://kg.diffbot.com/kg/v3/dql` | `src/retrievers/knowledge-graph.ts` |
| `DiffbotWebSearchRetriever` | Retriever | `webSearch(client, text, opts)` | `GET https://llm.diffbot.com/api/v1/web_search` | `src/retrievers/web-search.ts` |
| `DiffbotExtractLoader` | Document loader | `extract(client, url, api, fmt)` | `GET https://api.diffbot.com/v3/{api}` (default `analyze`) | `src/loaders/extract.ts` |
| `DiffbotCrawlLoader` | Document loader | `crawl(client, site, opts)` | `https://api.diffbot.com/v3/crawl` (+ `/data`) | `src/loaders/crawl.ts` |
| `DiffbotExtractTool` | Tool `diffbot_extract` | `extract(...)` | same as Extract loader | `src/tools/extract.ts` |
| `DiffbotWebSearchTool` | Tool `diffbot_web_search` | `webSearch(...)` | web search | `src/tools/web-search.ts` |
| `DiffbotKnowledgeGraphTool` | Tool `diffbot_knowledge_graph` | `dql(...)` | DQL | `src/tools/knowledge-graph.ts` |
| `DiffbotEntitiesTool` | Tool `diffbot_entities` | `entities(client, text, lang)` | `POST https://nl.diffbot.com/v1/` | `src/tools/entities.ts` |
| `DiffbotOntologyTool` | Tool `diffbot_ontology` | `OntologyStore.load()` → `Ontology` | `GET https://kg.diffbot.com/kg/ontology` | `src/tools/ontology.ts` |
| `DiffbotDQLProbeTool` | Tool `diffbot_dql_probe` | `dqlParallel(..., size: 0)` | DQL | `src/tools/dql-probe.ts` |
| `DiffbotAskTool` | Tool `diffbot_ask` | `ask(...)` (stream drained to string) | RAG chat completions | `src/tools/ask.ts` |

Other public surface in the barrel (helpers, not components):

- `assertClient`, `dictToDocument`, `resolveK`, `shapeExtractResponse`, `defaultCrawlMapper`
- `DEFAULT_KG_CONTENT_FIELDS` = `["description","summary","name"]`, `DEFAULT_WEB_CONTENT_FIELDS` = `["content","snippet"]`
- a `*Fields` options interface per class; `DictToDocumentOptions`, `DiffbotComponentFields`, `DocumentMapper`, `ExtractDocumentMapper`, `CrawlEventMapper`, `ShapedExtractResponse`, `DQLProbeResult`, `OntologyLookupResult`/`OntologyLookupError`, `DiffbotExtractToolOutput`/`DiffbotExtractToolError`
- re-exported SDK **types** only: `OntologyStore`, `KVOntologyStore`

Deliberately **not** wrapped (stated in `typescript/CLAUDE.md` and README): `crawlListJobs`, `crawlGetJob`, `crawlDeleteJob` — "they aren't retrievers, loaders, tools, or chat models". Every component exposes `.client` so users call them directly.

Also present in `@diffbot/typescript` 0.3.0 but **not** wrapped by LangChain: `askJson`, `jsonSchemaFormat`, `extractJson`, `ANY_OBJECT_SCHEMA`, `dqlFetchOntologyText`, `webSearch`'s `snippetLength`, and the client's new `dqlUrl` / `ontologyUrl` overrides. These are parity *opportunities* for the AI SDK package, not existing LangChain features.

### 1.2 Output-shaping contract (worth porting)

Both retrievers take `fields` (metadata allowlist), `contentFields` (ordered `pageContent` priority), `documentMapper` (full override); `dictToDocument` in `src/base.ts` mirrors Python's truthiness rules so both packages pick the same content field. The stated reason is token bloat: "a single entity routinely runs into the thousands of tokens". A KG hit's `score` is copied into metadata **after** the `fields` projection so narrowing never drops it. This matters *more* in the AI SDK, where results go straight back to the model as a tool result.

### 1.3 Python package `langchain-diffbot` (v0.2.0) — parity reference

Same 12 classes, same names (`python/langchain_diffbot/__init__.py`). Divergences documented in `typescript/CLAUDE.md` / README:

1. Python allows a per-call `k` (`retriever.invoke(q, k=3)`); TS fixes `k` at construction because `_getRelevantDocuments(query, runManager)` has no kwargs channel.
2. Python carries both `client` and `async_client` (sync + async httpx transports); TS has one promise-based client.
3. `DiffbotOntologyTool.refresh: true` is real in TS, unimplemented in Python.
4. TS note "KG and ontology URLs are not overridable" is **stale** against SDK 0.3.0, which added `dqlUrl` / `ontologyUrl` to `DiffbotClientOptions`.

Python deps: `langchain-core>=1.0,<2.0`, `httpx`, `diffbot>=3.0.0`. Nothing in the Python package exists that the TS package lacks.

### 1.4 Auth model (important — the AI SDK package deviates here deliberately)

- **Client injection only.** `src/base.ts`: `DiffbotComponentFields` contributes exactly one field, `client: DiffbotClient`. Components never construct a client, never close one, expose no `token` or `timeout`. `assertClient()` guards JS callers.
- Users build the client: `new DiffbotClient({ token: resolveTokenFromEnv() })`.
- `resolveTokenFromEnv(token?, env?)` resolves explicit arg → Workers-style `env` object → `process.env.DIFFBOT_API_TOKEN`. Returns `""` when nothing is found; it does not throw.
- `DiffbotClient`'s constructor throws `ValidationError("token is required")` on a falsy token (verified in the published `dist/index.js`).
- Node-only credentials-file fallback (`~/.diffbot/credentials`, key `DIFFBOT_API_TOKEN`) lives behind `@diffbot/typescript/node`'s `resolveToken`.
- Auth on the wire: `Authorization: Bearer <token>` for `ask` and `webSearch` (both on `llm.diffbot.com`); `?token=` query param for Extract, NLP, Crawl, DQL, ontology.

**Env var names actually used in the clones:**

| Name | Where | Notes |
| --- | --- | --- |
| `DIFFBOT_API_TOKEN` | every live test (`typescript/tests/live/*.live.test.ts`), both `integration.yml` workflows' secret, `examples/.env.example`, example READMEs/servers, `fixtures/worker`, the SDK's `resolveTokenFromEnv`, the credentials-file key, `python/tests/integration_tests/*` | **the canonical name** |
| `DIFFBOT_TOKEN` | `mcp/diffbot_mcp/api.py` only (`TOKEN_ENV_VARS = ("DIFFBOT_TOKEN", "DIFFBOT_API_TOKEN")`) | "this server's historical name" |
| `ANTHROPIC_API_KEY`, `LANGSMITH_*` | examples only | third-party |

`DIFFBOT_API_KEY` appears **nowhere** in any of the three clones. Do not introduce it.

### 1.5 Test strategy in the clones

- **Unit (TS):** vitest, `tests/**/*.test.ts`, network stubbed by injecting a fake `fetch` into `DiffbotClient` (`tests/helpers/mock-fetch.ts` — `createMockFetch`, `jsonResponse`, `sseResponse`; copied from the SDK repo, which doesn't publish it). Assertions are on the outbound URL, method, query params and body. Mocks target the real upstream URLs.
- **Docs-honesty suites:** `tests/readme_parity.test.ts` (README components table == barrel; every class appears in a code block; every block constructing a component also constructs a client) and `tests/readme_examples.test.ts` (every ` ```ts ` block is extracted, its import rewritten to `src/index.ts`, and executed against a stubbed global `fetch`; crawl blocks and blocks importing `@langchain/anthropic` are skipped). Shared helpers in `tests/readme.ts`.
- **Imports suite:** `tests/imports.test.ts` asserts the exact exported component list and that each `lc_name()` matches its export name.
- **Live/integration:** `vitest.live.config.ts`, `tests/**/*.live.test.ts`, 60s timeout, shape-based assertions only (never a specific company or page), gated on `DIFFBOT_API_TOKEN`. `DiffbotCrawlLoader` is deliberately untested live (slow, quota-expensive).
- **Workers fixture:** `fixtures/worker/` proves a Cloudflare Worker build needs no compatibility flags, via `wrangler deploy --dry-run` (no CF credentials, so it runs on fork PRs). Its vitest run is disabled pending vitejs/vite#18340.
- **Python:** pytest + `respx`, `pytest.mark.skipif(not os.environ.get("DIFFBOT_API_TOKEN"))` at module level — note this *does* handle `""` correctly, because Python's truthiness check is on the value, and no client is built at import time.

### 1.6 Package layout, deps, CI, release (TS)

- ESM-first, `"type": "module"`, dual ESM/CJS + d.ts via `tsup`, `platform: "neutral"`, `external: ["@langchain/core", "@diffbot/typescript", "zod"]`. Node >= 20. pnpm only.
- `dependencies`: `zod ^3.25.76 || ^4`. `peerDependencies`: `@diffbot/typescript ^0.2.0`, `@langchain/core ^1.0.0` (both peers to keep exactly one copy in the tree; `@langchain/core` because LangChain does cross-package `instanceof`).
- Tool schemas import `zod/v3` so they work under both zod 3 and 4.
- `ci.yml`: push to main / PR / dispatch → lint + typecheck once, then `pnpm test` + `pnpm build` on Node 20/22/24, plus the worker dry-run job.
- `integration.yml`: `schedule` (nightly 06:00) + `workflow_dispatch` **only**, with a header comment explicitly forbidding `pull_request`/`push` triggers so the `DIFFBOT_API_TOKEN` secret is never exposed to fork code.
- `release.yml`: tag `v*` → verify tag matches `package.json` version → build → publish with `--provenance` (`id-token: write`) → create GitHub release. No local publish path.
- Examples: `examples/company-research` (one-shot CLI agent combining KG search + web search + extract, citing entity IDs and URLs) and `examples/dql-explorer` (Hono + React: agent-authored DQL builder, M&A/IPO dashboard, Ask tab streaming `ChatDiffbot`). Both need `ANTHROPIC_API_KEY` as the agent model.

### 1.7 MCP surface (`diffbot-mcp`) — overlap and stretch

Registered tools (`mcp/diffbot_mcp/server.py`): `extract`, `search_web`, `news`, `organizations`, `people`, `places`, `deals`, `crawl`, `resolve_entities`, `dql`, `dql_ontology`, `dql_probe`.

Already covered by LangChain (so already in our parity scope): `extract`, `search_web`, `dql`, `dql_ontology`, `dql_probe`, `resolve_entities` (≈ `DiffbotEntitiesTool`), `crawl` (partially — LangChain only wraps the crawl *loader*, not job control).

**Stretch only — in MCP, NOT in LangChain today.** Label as such anywhere this plan is quoted:

| MCP tool | What it adds | Port cost signal |
| --- | --- | --- |
| `search_organizations` | Typed firmographic search: industry, location, headcount, revenue, founding date, public status, founder/investor/acquirer/parent, `near`+radius, sort, facets | 191 LOC Python + shares a 223-LOC DQL builder |
| `search_people` | Titles (with expansion), employer + employer firmographics, school/major, skills, residence, nationality, net worth | 254 LOC |
| `search_deals` | Funding rounds / acquisitions by company, investor, acquirer, series, amount, date, industry; `newest`/`largest` sorts; facets | 234 LOC |
| `search_news` | `type:Article` search by mentions/topic/text/title/publisher/language/country/quoted speaker/date/sentiment | 121 LOC |
| `search_places` | Cities/regions/countries/POIs by name, population, container, proximity | 109 LOC |
| `crawl` job control | start / status / list / delete / fetch URLs / fetch JSON data | 140 LOC |
| `extract` extras | `page_type` override, `format: json` typed records | small |
| `search_web` extras | `snippetLength` (incl. `url:<URL>` full-page lookups, which force `rerank=none`) | small — and the SDK already supports it |
| `dql` extras | `format: csv`, `fields` column spec (`path,Label;…`), `hits_only`, facet aggregations, CSV export URL pattern | medium |
| `resolve_entities` shaping | Slimmed entity records + a ready-made `dql_filter` (`id:or(...)`) | small |

Note the reverse gap: MCP has **no** `ask`/chat tool, so `ChatDiffbot` / `DiffbotAskTool` have no MCP analogue. That is provenance, not a problem.

### 1.8 Explicitly absent — do not invent

Not present in any of the three clones: graph transformer / `DiffbotGraphTransformer`-style entity-graph extraction, embeddings model, vector store, reranker, document compressor, memory/store integration, image or speech models, an async/sync client split in TS, per-call `k` in TS, and any `DIFFBOT_API_KEY` env var.

---

## 2. Vercel AI SDK, as of 2026-11-09

Versions pulled from npm today:

| Package | Version | Peer deps |
| --- | --- | --- |
| `ai` | **7.0.166** | `zod ^3.25.76 \|\| ^4.1.8` |
| `@ai-sdk/provider` | 4.0.37 | — |
| `@ai-sdk/provider-utils` | 5.0.76 | `zod ^3.25.76 \|\| ^4.1.8` |
| `@ai-sdk/openai-compatible` | 3.0.87 | `zod ^3.25.76 \|\| ^4.1.8` |

So "v5+" in the brief is now **v7**. Provider interfaces are `LanguageModelV4` / `EmbeddingModelV4` / `ImageModelV4` from `@ai-sdk/provider` 4.x.

### 2.1 Tools

```ts
import { tool, generateText, stepCountIs } from 'ai';
import { z } from 'zod';

const myTool = tool({
  description: 'what the model should know',
  inputSchema: z.object({ query: z.string().describe('…') }),
  execute: async ({ query }, { toolCallId, messages, abortSignal }) => result,
});
```

- `tool()` is an identity helper for inference. The **tool name is the key** in the `tools` record passed to `generateText`/`streamText` — not a field on the tool. Packages therefore export factories and let the caller name them (or export a bundle helper that supplies the keys).
- `inputSchema` accepts a Zod schema or `jsonSchema(...)`. Optional: `outputSchema`, `toModelOutput` (shape the result for the model), `strict`, `inputExamples`, `onInputStart`/`onInputDelta`/`onInputAvailable`.
- `execute` may return an `AsyncIterable` to stream intermediate status, with the final value as the result.
- Agent loops: `stopWhen: stepCountIs(3)` (also `hasToolCall(...)`, `isLoopFinished()`). **Name check, measured against the published tarballs:** `isStepCount` is the `ai@7` name and does **not** exist in `ai@6` or `ai@5`; `stepCountIs` is exported by all three. Because this package peers `^6 || ^7` (§10.3), every snippet, example and registry `codeExample` here uses **`stepCountIs`**.
- `toModelOutput` is the result-shaping hook, and its signature changed between majors: `ai@5` passes the output directly, `ai@6`/`ai@7` pass `{ toolCallId, input, output }`. That single difference is why `ai@5` is out of our peer range (§10.3).
- Errors: `NoSuchToolError`, `InvalidToolInputError`, `ToolCallRepairError`, `ToolChoiceViolationError`. In multi-step runs, an error thrown inside `execute` becomes a `tool-error` content part the model can recover from — which maps neatly onto LangChain's "recoverable failures become data" convention (`DiffbotExtractTool`'s `{error, errorCode}`, `DiffbotOntologyTool`'s `{error, hint}`).
- `dynamicTool()` exists for runtime-unknown schemas; we don't need it.

### 2.2 OpenAI-compatible provider (for the Diffbot LLM)

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const diffbot = createOpenAICompatible<'diffbot-small-xl' | 'diffbot-small' | (string & {})>({
  name: 'diffbot',
  baseURL: 'https://llm.diffbot.com/rag/v1',
  apiKey: process.env.DIFFBOT_API_TOKEN,
});
```

Options: `name`, `apiKey` (string | promise | function), `baseURL`, `headers`, `queryParams`, `includeUsage`, `supportsStructuredOutputs`, `supportsMultiPartToolContent`, `transformRequestBody`, `fetch`. Factory methods: `provider(id)`, `.chatModel`, `.languageModel`, `.completionModel`, `.embeddingModel`, `.imageModel`.

Diffbot's RAG endpoint is a drop-in OpenAI Chat Completions surface — `https://llm.diffbot.com/rag/v1` + `Authorization: Bearer <token>`, models `diffbot-small-xl` (70B, Llama 3.3) and `diffbot-small` (8B, Llama 3.1). The SDK's `ask()` posts `{model: "diffbot-small-xl", messages, stream: true}` to `…/rag/v1/chat/completions` and parses standard `choices[].delta.content` SSE (see `typescript/tests/chat_models.test.ts`), so the wire format is confirmed OpenAI-shaped in both directions.

**Version pairing (measured):** `@ai-sdk/openai-compatible` tracks `ai`'s majors — dist-tags `ai-v5 → 1.x`, `ai-v6 → 2.x`, `latest (ai-v7) → 3.x`. A model from `@2` reports `specificationVersion: "v3"`; from `@3`, `"v4"`. Mixed pairs (e.g. `ai@7` + `@2`) **typecheck clean and break at runtime**, so the pairing is a docs-and-CI problem, not a types problem (§5.2).

For a *published* provider package, `content/providers/04-openai-compatible-providers/01-custom-providers.mdx` documents the expected structure (`*-chat-settings.ts` with a `(string & {})`-widened model-id union, `*-provider.ts` using `OpenAICompatibleChatLanguageModel` + `loadApiKey`/`withoutTrailingSlash` from `@ai-sdk/provider-utils`, `tsdown` build, tests, README).

### 2.3 Registry and listings

- Tools registry page: `https://ai-sdk.dev/tools-registry` **308-redirects to** `https://ai-sdk.dev/resources/tools`. Use the latter in docs.
- Contributing guide: `contributing/add-new-tool-to-registry.md`. Entry goes in `content/tools-registry/registry.ts`, interface:

```ts
interface Tool {
  slug: string; name: string; description: string; packageName: string;
  tags?: string[]; apiKeyEnvName?: string;
  installCommand: { pnpm: string; npm: string; yarn: string; bun: string };
  codeExample: string;
  docsUrl?: string; apiKeyUrl?: string; websiteUrl?: string; npmUrl?: string;
}
```

Stated prerequisites: package **published to npm**, integration **tested against the current AI SDK**, and **documentation published on your own site** explaining the AI SDK integration — `docsUrl` must point at that integration guide, "rather than to a homepage or generic API documentation". PR title format: `feat(tools-registry): add <tool-name>`.

- Provider listings are plain MDX pages in the same repo: `content/providers/04-openai-compatible-providers/NN-<name>.mdx` (where a Diffbot LLM page belongs) or `content/providers/05-community-providers/NN-<name>.mdx` (for a hand-written provider package). The community-providers index page documents no formal process beyond "write your own provider"; in practice the listing is a PR adding the MDX file. ~25 openai-compatible/community pages follow the same short template (frontmatter, setup, `createOpenAICompatible` snippet, `generateText` + `streamText` examples).

### 2.4 Competitor package shapes (export conventions)

| Package | Version | `ai` peer | zod | Exports |
| --- | --- | --- | --- | --- |
| `@tavily/ai-sdk` | 0.5.0 | `^5 \|\| ^6` | peer `^4` | ESM only; `tavilySearch`, `tavilyExtract`, `tavilyCrawl`, `tavilyMap` |
| `@exalabs/ai-sdk` | 2.1.0 | `^6` | dep `^3.22` | dual ESM/CJS; `webSearch` |
| `firecrawl-aisdk` | 0.13.1 | `^6 \|\| ^7` | dep `^3.25.76` | ESM only; `scrapeTool`, … |
| `@perplexity-ai/ai-sdk` | 0.1.3 | `^5 \|\| ^6` | peer `^4` | ESM only; `perplexitySearch` |

Canonical shape (Tavily):

```ts
export const tavilySearch = (options: TavilySearchOptions = {}) => {
  const client = tavily({ ...options, clientSource: 'ai-sdk' });
  return tool({ description: '…', inputSchema, execute: async (input) => client.search(...) });
};
```

Two conventions worth copying: the **factory takes config, the schema takes model-visible params**; and the vendor's own HTTP SDK is a **regular dependency**, not a peer, so `npm i @vendor/ai-sdk` alone works (which the registry's one-line `codeExample` requires). Exa reads `apiKey = process.env.EXA_API_KEY` in the factory but only throws **inside `execute`** — importing the module with no env var set never fails. Copy that laziness.

---

## 3. Feature mapping: LangChain → AI SDK

Markers: **direct port** = clear analogue; **adaptation** = needs a different shape; **n/a** = LangChain-only abstraction.

| LangChain (today) | AI SDK equivalent in `@diffbot/ai-sdk` | Kind | Notes |
| --- | --- | --- | --- |
| `DiffbotWebSearchTool` | `diffbotWebSearch()` → `tool()` | **direct port** | Add `snippetLength` (SDK 0.3.0) to the call schema; new vs LangChain. |
| `DiffbotExtractTool` | `diffbotExtract()` | **direct port** | Keep `shapeExtractResponse` shaping and the `{error, errorCode}` data-not-throw behaviour; `ExtractionError` → tool result, `AuthError`/`RateLimitError` → throw. |
| `DiffbotKnowledgeGraphTool` | `diffbotKnowledgeGraph()` | **direct port** | `query`/`size`/`from`/`filter` in `inputSchema`. |
| `DiffbotEntitiesTool` | `diffbotEntities()` | **direct port** | `text`, `lang`. Consider MCP's `dql_filter` convenience (stretch). |
| `DiffbotOntologyTool` | `diffbotOntology()` | **direct port** | Factory takes `ontologyStore?` (default `new OntologyStore(client)`, `KVOntologyStore` for Workers); `{error, hint}` stays data. |
| `DiffbotDQLProbeTool` | `diffbotDqlProbe()` | **direct port** | `queries`, `workers`; `size: 0`, order-preserving. |
| `DiffbotAskTool` | `diffbotAsk()` | **direct port** | Drain `ask()` to a string; optionally return an `AsyncIterable` so the AI SDK streams partial status. |
| `ChatDiffbot` | `createDiffbot()` provider → `diffbot('diffbot-small-xl')` | **direct port**, ships in v0.1.0 | `createOpenAICompatible` over `https://llm.diffbot.com/rag/v1`; streaming is native to the endpoint. Gated only on the §5.5 **V1** non-streaming check; items 2–3 are README wording (§10.6). |
| `DiffbotKnowledgeGraphRetriever` | `diffbotKnowledgeGraph()` tool **+** `retrieveKnowledgeGraph(opts)` helper returning `DiffbotDocument[]` | **adaptation** | AI SDK has no `Retriever` interface. Keep `fields` / `contentFields` / `documentMapper` shaping — it matters more here, since the output goes straight into the model context. `k` has no kwargs problem in the AI SDK, so allow it per call. |
| `DiffbotWebSearchRetriever` | `diffbotWebSearch()` tool **+** `retrieveWebSearch(opts)` helper | **adaptation** | Same reasoning. Shaped `{content, metadata}` objects, not LangChain `Document` instances (no `@langchain/core` dependency). |
| `DiffbotExtractLoader` | `loadExtract({ client, urls })` → `Promise<DiffbotDocument[]>` / `streamExtract()` async generator | **adaptation** | A loader is just "fetch N URLs and shape them"; a plain async helper is the idiomatic AI SDK form. |
| `DiffbotCrawlLoader` | `streamCrawl({ client, site })` async generator (+ `loadCrawl()`) | **adaptation** | **Decided: never a model-facing tool** — a crawl runs for minutes and burns quota (§10.9). Helpers only; job control stays a direct SDK call. |
| `Document` / `BaseDocumentLoader` / `BaseRetriever` / `StructuredTool` base classes, `lc_name()`, `lc_namespace` | — | **n/a** | LangChain-specific serialization/identity. Do not emulate. |
| `assertClient` | internal `createClientResolver()` (client → apiKey → env) | **adaptation** | The AI SDK package constructs a client when given an `apiKey`/env, so the helper resolves lazily rather than merely asserts. Internal, not exported (§8.1.4). |
| `dictToDocument`, `DEFAULT_*_CONTENT_FIELDS`, `shapeExtractResponse`, `defaultCrawlMapper` | exported as-is (adapted to `DiffbotDocument`) | **direct port** | Keep Python's truthiness rules so all three packages pick the same content field. |
| `resolveK` | keep as an internal validator | **adaptation** | Zod `.int().positive()` in the tool schema covers the model-facing path. |
| `OntologyStore` / `KVOntologyStore` type re-exports | same re-exports | **direct port** | So users configuring a durable ontology cache need only one import. |
| `crawlListJobs` / `crawlGetJob` / `crawlDeleteJob` | not wrapped; document calling the SDK directly | **n/a** (by choice) | Same rationale as LangChain. MCP exposes crawl job control — stretch. |
| — (new) | `diffbotTools({ client })` → `ToolSet` bundle with `diffbot_*` keys | new convenience | Mirrors LangChain tool names (§10.11) and makes the registry `codeExample` a two-liner. Phase 1 ships it with the three core tools; later phases extend the union. |
| — (new) | `askJson` / `jsonSchemaFormat` passthrough for structured RAG answers | optional, new | Exists in SDK 0.3.0, unwrapped by LangChain. Good fit for `generateObject`-style use. |

---

## 4. One package or many?

**Decided (§10.7): one package, `@diffbot/ai-sdk`, with named exports.**

- Every comparable vendor ships exactly one package with several named tool exports (Tavily 4 tools, Firecrawl several, Exa 1, Perplexity 1). The registry's `packageName` field is singular — one entry per package.
- Diffbot's own LangChain packages are single-package; splitting would diverge from both precedents at once.
- The Diffbot LLM provider *could* live in `@diffbot/ai-sdk-provider`, but at ~60 lines of `createOpenAICompatible` wrapper it does not justify a second release train. It ships from the same package under the `./provider` subpath export, with `@ai-sdk/openai-compatible` as an **optional** peer, so tool-only users never pull it into their bundle.

---

## 5. Package design

### 5.1 Name, layout, build

Name: **`@diffbot/ai-sdk`** (§10.1). Repo: **`shixish/diffbot-ai-sdk`**, private, moving to the `diffbot` org later (§10.8) — the repo name and the npm name are independent, and only the npm name is a public contract. Alternatives considered: `@diffbot/ai` (too broad, invites confusion with the LLM product), `diffbot-aisdk` (Firecrawl-style, but Diffbot already owns the `@diffbot` scope on npm and uses it for `@diffbot/typescript` / `@diffbot/langchain`).

```
src/
├── index.ts                  # barrel: tools, helpers, types (no provider)
├── provider.ts               # createDiffbot (subpath export "./provider")
├── client.ts                 # DiffbotToolOptions, resolveClient(), token resolution
├── documents.ts              # DiffbotDocument, dictToDocument, DEFAULT_*_CONTENT_FIELDS, shapeExtractResponse
├── tools/
│   ├── web-search.ts         # diffbotWebSearch
│   ├── extract.ts            # diffbotExtract
│   ├── knowledge-graph.ts    # diffbotKnowledgeGraph
│   ├── entities.ts           # diffbotEntities
│   ├── ontology.ts           # diffbotOntology
│   ├── dql-probe.ts          # diffbotDqlProbe
│   ├── ask.ts                # diffbotAsk
│   └── index.ts              # diffbotTools() bundle
└── retrieve/
    ├── knowledge-graph.ts    # retrieveKnowledgeGraph
    ├── web-search.ts         # retrieveWebSearch
    ├── extract.ts            # loadExtract / streamExtract
    └── crawl.ts              # loadCrawl / streamCrawl, defaultCrawlMapper
tests/        unit (mocked fetch) + live/ + registry-example check
examples/     company-research (CLI), dql-explorer (web)  [ports of the LangChain examples]
fixtures/worker/   Cloudflare Workers dry-run fixture (port from the LangChain repo)
```

Build/tooling: copy the LangChain repo's stack — pnpm, `tsup` (dual ESM/CJS + d.ts, `platform: "neutral"`, `target: es2022`), vitest, eslint + prettier (100 cols, double quotes), Node >= 20, `"sideEffects": false`. `external: ["ai", "zod", "@ai-sdk/openai-compatible", "@ai-sdk/provider-utils", "@diffbot/typescript"]` — the Diffbot SDK is external despite being a dependency, so it still dedupes with a user's own copy. The AI SDK's own provider docs use `tsdown`; `tsup` is fine and keeps us consistent with `@diffbot/langchain`.

`exports`: `"."` (tools + helpers), `"./provider"` (createDiffbot), `"./package.json"`. The `"./provider"` entry is added in Phase 2 together with the file behind it — never before (§8.1.3).

The tree above is the v0.1.0 end state. Phase 1 builds a strict subset of it, enumerated file by file in §8.1.2.

### 5.2 Dependencies — final policy

```jsonc
{
  "name": "@diffbot/ai-sdk",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@10.x",
  "dependencies": {
    "@diffbot/typescript": "^0.3.0"
  },
  "peerDependencies": {
    "ai": "^6.0.0 || ^7.0.0",
    "zod": "^3.25.76 || ^4.1.8",
    "@ai-sdk/openai-compatible": "^2.0.0 || ^3.0.0"
  },
  "peerDependenciesMeta": {
    "@ai-sdk/openai-compatible": { "optional": true }
  },
  "devDependencies": {
    "ai": "^7.0.0",
    "zod": "^4.1.8",
    "@ai-sdk/openai-compatible": "^3.0.0",
    "typescript": "^5.x", "tsup": "^8.x", "vitest": "^3.x",
    "eslint": "^9.x", "prettier": "^3.x", "@types/node": "^22.x"
  },
  "publishConfig": { "access": "public", "provenance": true }
}
```

Every line above is a locked decision (§10.2, §10.3). The reasoning and the verification behind each:

**`@diffbot/typescript` → `dependencies`, `^0.3.0`.** This deviates from `@diffbot/langchain`, which peers it. See §10.2 for the full argument; the short form is that the registry's contract is one install command plus one import, which cannot ask the user to install and wire an HTTP SDK first, and that every comparable vendor package (Tavily, Exa, Firecrawl, Perplexity) makes its own HTTP SDK a regular dependency for exactly this reason. The SDK is **232 KB unpacked with zero dependencies**, so the duplicate-copy cost is disk, not dependency hell.

The one real hazard, verified rather than assumed: `DiffbotClient` exposes `http: HttpClient`, and `HttpClient` declares `private readonly fetchFn`. TypeScript compares classes with private members by *declaration identity*, so if a user installs a **different minor** of `@diffbot/typescript` alongside ours, their `new DiffbotClient(...)` is not assignable to the `DiffbotClient` our SDK copy's functions expect — a probe with 0.2.0 beside 0.3.0 produced exactly `Types have separate declarations of a private property 'fetchFn'`. Two copies of the **same** version are fine. Mitigations, all of which are Phase-1 deliverables:

1. The injected-client option is typed as the **nominal `DiffbotClient`** from our dependency. A structural `DiffbotClientLike` interface would *not* help — we have to hand the client to the SDK's own free functions, which demand the nominal class — so don't bother writing one.
2. Dep range stays caret-wide (`^0.3.0`), so npm/pnpm/yarn dedupe to a single copy for any user on 0.3.x, which is the overwhelmingly likely case.
3. **Fast-follow policy:** when `@diffbot/typescript` ships a new minor, `@diffbot/ai-sdk` ships a patch widening/moving the range within one week. A stale range is the only way this hazard reaches a user.
4. README has a short "injecting your own client" note stating the version-alignment rule, and a unit test typechecks the injected-client path (§6.1).

Rejected: listing the SDK in both `dependencies` and `peerDependencies` (the "optional peer with a bundled fallback" trick). npm, pnpm and yarn resolve that combination differently, and the failure mode is invisible to us.

**`ai` → `peerDependencies`, `^6.0.0 || ^7.0.0`.** Peer because `tool()`/`ToolSet` types must come from the user's copy — unanimous competitor convention. The range was decided by compiling the exact surface we use, not by reading changelogs. A probe containing `tool()` with `inputSchema`, a destructured `execute` options arg (`toolCallId`, `abortSignal`, `messages`), an async-generator `execute`, `toModelOutput`, and both the `Tool` and `ToolSet` types compiled **clean under `ai@7.0.166` and `ai@6.0.326` with zero source changes**, and failed under `ai@5.0.287` on one thing only: `toModelOutput` receives the output directly in v5 but `{ toolCallId, input, output }` in v6+. Since `toModelOutput` is our main lever for keeping tool results small (§5.4), v5 is not a zero-change target and is **out**. v6 is, so per the "latest major, plus older majors only if free" rule, v6 is **in**.

One consequence to carry into every doc, example and the registry entry: **`isStepCount` does not exist in `ai@6`** — it is the v7 name. `stepCountIs` is exported by v5, v6 and v7. All agent-loop examples in this package use `stopWhen: stepCountIs(n)`.

**`zod` → `peerDependencies`, `^3.25.76 || ^4.1.8`.** Mirrors `ai`'s own peer range character-for-character, so there is exactly one zod in the tree and no v3/v4 split-brain over schema instances. This does not break the one-install story: `zod` is a **required (non-optional) peer of `ai` itself** in both 6 and 7 — `ai` declares no `peerDependenciesMeta` — so anyone who can use this package already has a compatible zod. Unlike `@diffbot/langchain` we do **not** import `zod/v3`; plain `import { z } from "zod"` compiled fine against both majors in the probe. Do not use zod-4-only syntax (no `z.interface`, no `z.strictObject` niceties that v3 lacks); stick to the `z.object` / `z.string().describe()` / `z.number().int().positive()` / `z.enum` subset, which is identical in both.

**`@ai-sdk/openai-compatible` → optional peer, `^2.0.0 || ^3.0.0`.** Only `@diffbot/ai-sdk/provider` imports it, so tool-only users never pull it into their bundle. The range is two majors because this package is versioned *in lockstep with `ai`'s majors*: `ai@6` pairs with `@ai-sdk/openai-compatible@2` (which produces `specificationVersion: "v3"` models), and `ai@7` pairs with `@3` (`"v4"` models). Our `createDiffbot` wrapper compiled unchanged against both pairs, and `generateText({ model: diffbot("diffbot-small-xl") })` typechecked in both. **Mixed pairs are a runtime hazard TypeScript does not catch** — `ai@7` + `@ai-sdk/openai-compatible@2` compiled clean while handing a `v3` model to a `v4` runtime. So: README states the pairing rule in a table, and CI runs the provider tests against both matched pairs (§7.1). We never inspect `specificationVersion` ourselves.

**Build/externals.** `tsup`, dual ESM/CJS + d.ts, `platform: "neutral"`, `target: "es2022"`, `external: ["ai", "zod", "@ai-sdk/openai-compatible", "@ai-sdk/provider-utils", "@diffbot/typescript"]`. `@diffbot/typescript` is external despite being a dependency — bundling it would defeat deduping and double its bytes for anyone who also has it.

### 5.3 Auth / env — decided

Support **both** client injection and env-based construction, in this precedence order, resolved lazily (§10.4):

1. `client: DiffbotClient` — a pre-built `@diffbot/typescript` client. Full parity with LangChain, and the only way to set `timeout`, custom endpoint URLs (`analyzeUrl`, `llmUrl`, `crawlerUrl`, `webSearchUrl`, `nlpUrl`, and — new in SDK 0.3.0 — `dqlUrl`, `ontologyUrl`), or an injected `fetch`.
2. `apiKey: string` + optional `timeout`, `fetch`, `env` — we construct the client.
3. `process.env.DIFFBOT_API_TOKEN`, via the SDK's `resolveTokenFromEnv(undefined, env)`, which also reads a Workers-style `env` object.

**`DIFFBOT_API_TOKEN` is the only env var this package reads.** No `DIFFBOT_API_KEY` (it appears nowhere in any of the three clones). No `DIFFBOT_TOKEN` fallback either — that name exists only inside `diffbot-mcp` as its own historical alias, the registry's `apiKeyEnvName` field holds exactly one name, and three Diffbot packages reading three different variables is how a support burden starts. Decision and rationale: §10.5.

Rules, all of them load-bearing:

- **Resolve inside `execute`, never at factory time.** `import`ing the package, or building a tool in a process with no token, must not throw; a missing token must surface as a tool error the agent can report and the model can recover from. `new DiffbotClient({ token: "" })` throws `ValidationError("token is required")`, so eager construction is exactly the trap to avoid — the same root cause as the live-test bug in §6.2.
- **Memoize the constructed client per factory call**, so one agent run reuses one connection pool, the way LangChain users share one client across components. `diffbotTools({...})` constructs at most one client for the whole bundle.
- Every factory accepts a `fetch` passthrough even when it constructs its own client, so env-configured tools are unit-testable without an injected client (§6.1).
- When the user injects a client, keep `@diffbot/typescript` on the same minor as our dependency range (`^0.3.0`). The README says so explicitly, because the failure mode is a confusing TypeScript error about a private `fetchFn`, not a runtime one (§5.2).
- Registry `apiKeyEnvName`: **`DIFFBOT_API_TOKEN`**.

### 5.4 API sketches

Zero-config, registry-example style:

```ts
import { generateText, stepCountIs } from 'ai';
import { diffbotWebSearch, diffbotExtract } from '@diffbot/ai-sdk';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-5',
  prompt: 'What does Diffbot sell, and who are its competitors?',
  tools: {
    webSearch: diffbotWebSearch(),          // reads DIFFBOT_API_TOKEN lazily
    extract: diffbotExtract(),
  },
  stopWhen: stepCountIs(5),
});
```

Explicit client (LangChain parity) + the DQL authoring loop:

```ts
import { DiffbotClient, resolveTokenFromEnv, KVOntologyStore } from '@diffbot/typescript';
import { streamText, stepCountIs } from 'ai';
import { diffbotOntology, diffbotDqlProbe, diffbotKnowledgeGraph } from '@diffbot/ai-sdk';

const client = new DiffbotClient({ token: resolveTokenFromEnv(), timeout: 120_000 });

const result = streamText({
  model: 'anthropic/claude-sonnet-5',
  system: 'Introspect the ontology, probe variants, then run the query.',
  prompt: 'Boston AI companies with more than 50 employees',
  tools: {
    diffbot_ontology: diffbotOntology({ client }),
    diffbot_dql_probe: diffbotDqlProbe({ client }),
    diffbot_knowledge_graph: diffbotKnowledgeGraph({ client, fields: ['id', 'type', 'name', 'nbEmployees'] }),
  },
  stopWhen: stepCountIs(12),
});
```

Whole-toolset bundle (keys match the LangChain tool names):

```ts
import { diffbotTools } from '@diffbot/ai-sdk';

const tools = diffbotTools({ client });               // all 7
const some = diffbotTools({ client, only: ['diffbot_web_search', 'diffbot_extract'] });
```

Retriever adaptation — shaped documents for manual RAG:

```ts
import { retrieveKnowledgeGraph } from '@diffbot/ai-sdk';

const docs = await retrieveKnowledgeGraph({
  client,
  query: 'type:Organization industries:"Artificial Intelligence"',
  k: 5,
  fields: ['id', 'type', 'name', 'homepageUri'],        // metadata allowlist
  contentFields: ['description', 'summary', 'name'],    // pageContent priority
});
// docs: Array<{ content: string; metadata: Record<string, unknown> }>
```

Loader adaptation:

```ts
import { loadExtract, streamCrawl } from '@diffbot/ai-sdk';

const pages = await loadExtract({ client, urls: ['https://example.com'], fmt: 'markdown' });
for await (const doc of streamCrawl({ client, site: 'https://example.com' })) { /* … */ }
```

Diffbot LLM provider:

```ts
import { generateText } from 'ai';
import { createDiffbot } from '@diffbot/ai-sdk/provider';

const diffbot = createDiffbot();                       // apiKey defaults to DIFFBOT_API_TOKEN
const { text } = await generateText({
  model: diffbot('diffbot-small-xl'),
  prompt: 'Who acquired Figma, and when?',
});
```

Tool-result shaping stays a first-class concern: every tool factory accepts the `fields` / `contentFields` / `documentMapper` knobs where the LangChain equivalent does, and `diffbotKnowledgeGraph` / `diffbotWebSearch` default to the same content-field priorities. `toModelOutput` can render results as compact text instead of raw JSON; it is deliberately **not** in Phase 1 — measure real token counts in Phase 5 before adding it (§8.1.9).

### 5.5 Provider: what shipping it in v0.1.0 means, and the one blocking check

**Decided: the provider ships in v0.1.0** from `@diffbot/ai-sdk/provider` (§10.6). In plain words, that means a user does this:

```bash
npm install @diffbot/ai-sdk @ai-sdk/openai-compatible
```

```ts
import { generateText } from 'ai';
import { createDiffbot } from '@diffbot/ai-sdk/provider';

const diffbot = createDiffbot();                    // reads DIFFBOT_API_TOKEN
const { text } = await generateText({
  model: diffbot('diffbot-small-xl'),
  prompt: 'Who acquired Figma, and when?',
});
```

…and gets a cited, retrieval-grounded answer from Diffbot's own RAG model, usable anywhere in the AI SDK that takes a `model` — `generateText`, `streamText`, `generateObject`, inside an agent as a sub-model. They can also name the model explicitly (`diffbot('diffbot-small')` for the 8B, `diffbot.chatModel(...)`), point `baseURL` elsewhere, and pass their own `headers`/`fetch`. It is **not** a replacement for their agent model: see item 2 below.

The implementation is a ~60-line `createOpenAICompatible` wrapper. Diffbot's RAG endpoint is a drop-in OpenAI Chat Completions surface (`https://llm.diffbot.com/rag/v1`, `Authorization: Bearer`, standard `choices[].delta.content` SSE — confirmed in `typescript/tests/chat_models.test.ts`), so there is no hand-written `LanguageModelV4` to maintain and no reason to hold v0.1.0 for it.

What it depends on verifying. The SDK's `ask()` hardcodes `stream: true`, so nothing in the clones exercises the non-streaming path. Three things were unknown; the decision splits them into **one blocker and two documentation items**:

1. **Non-streaming `doGenerate` — BLOCKING, and it is a 30-minute task, not a research project.** `createOpenAICompatible`'s `doGenerate` posts `stream: false`. If `/rag/v1/chat/completions` only honours streaming, then `generateText` — the single most common call in the AI SDK — returns nothing, which is not a caveat, it is a broken export. Phase 2 task **V1** (§8.2) is: one `curl` with `"stream": false`, then branch deterministically.
   - **If it returns a normal OpenAI completion object:** plain `createOpenAICompatible`, no middleware, done.
   - **If it errors or returns empty content:** wrap the model with `wrapLanguageModel` + a `wrapGenerate` that drains `doStream` and assembles `{ text, usage, finishReason }`. Still inside `createDiffbot`, still the same public API, ~25 extra lines. The README notes that non-streaming is emulated.
   
   Either branch satisfies the same acceptance criterion: a live test asserting `generateText({ model: diffbot('diffbot-small-xl'), prompt })` resolves with non-empty text. There is no third branch and nothing for an implementer to decide.
2. **Tool calling — documentation, not a blocker.** The Diffbot LLM is itself a tool user (KG + web search at inference time). If it ignores or rejects a `tools` payload, the README says so plainly: *"`diffbot-small-xl` is an answer-generation model with built-in retrieval. Use your own agent model for tool calling and reach Diffbot through the tools in this package, or through `diffbotAsk`."* Note what it does when passed `tools` during V1 and write whichever sentence is true. This never blocks a release, because nobody's `generateText` call breaks either way.
3. **Citations and `response_format` — documentation, not a blocker.** `ask()` supports `response_format` (`text` / `json_object` / `json_schema` via `jsonSchemaFormat`), so structured output likely works. Record where citations arrive — inline in the content, or as structured fields. If they are structured fields, surfacing them through `providerMetadata` needs a hand-written provider; that is a **v0.2.0 enhancement**, explicitly not a v0.1.0 requirement, and the README documents the v0.1.0 behaviour as "citations appear in the answer text".

Also for the docs, from the clones: `ChatDiffbot`'s live tests raise the client timeout to 120 s because the RAG endpoint "routinely runs 15–30 s and sometimes longer". `createDiffbot` therefore documents a timeout warning and the examples set a non-default timeout.

## 6. Testing

### 6.1 Unit tests (always run, no network, no token)

- vitest; `tests/**/*.test.ts`, excluding `*.live.test.ts` — same two-config split as the LangChain repo (`vitest.config.ts` + `vitest.live.config.ts`).
- Mock at the `fetch` boundary by injecting `fetch` into `DiffbotClient`. Port `tests/helpers/mock-fetch.ts` (`createMockFetch` / `jsonResponse` / `sseResponse`) from `langchain-diffbot-typescript`; the SDK still doesn't publish it. Assert outbound URL, method, query params, headers (`Authorization: Bearer …` for ask/web-search; `?token=` for extract/NLP/crawl/DQL) and body — never a real host.
- Because the package can construct its own client, every factory must accept a `fetch` passthrough so env-configured tools are testable without an injected client. That is a design requirement, not just a test detail.
- A vitest setup file replaces `globalThis.fetch` with a throwing stub, so a test that forgets to inject a fake fetch fails loudly instead of silently hitting the network.
- **Injected-client typecheck.** A `tests/types/*.ts` file (compiled by `pnpm typecheck`, never executed) constructs a real `DiffbotClient` and passes it as `client` to every factory. This is the guard for the duplicate-copy hazard in §5.2 — a type error there means our dependency range has drifted from what users install.
- **Peer matrix.** `pnpm test:peer:ai6` reinstalls `ai@6` + `@ai-sdk/openai-compatible@2` and re-runs typecheck + unit tests against the same source, proving the `^6 || ^7` claim in §10.3 keeps holding. Provider tests run once per matched pair and never cross-pair.
- Coverage to carry over from the clones:
  - each tool's `inputSchema` defaults and validation;
  - `diffbotExtract` returning `{error, errorCode}` on `ExtractionError` while re-throwing `AuthError` / `RateLimitError`;
  - `diffbotOntology` returning `{error, hint}` for unknown ops/names, and `refresh: true` reaching `ontologyStore.load({refresh})`;
  - `diffbotDqlProbe` preserving input order and reporting `hits: null` for non-JSON bodies;
  - document shaping (`fields`, `contentFields`, `documentMapper`, `score` surviving the projection);
  - `shapeExtractResponse`'s `content` → `text` → top-level `markdown` fallback chain;
  - crawl mapper skipping non-`url_processed` events and defaulting `watch: true`.
- **Barrel/doc honesty suites** (worth porting; they are why the LangChain READMEs stay true): an imports test asserting the exact export list, a README-parity test asserting the tools table matches the barrel, and a README-examples test that extracts every ` ```ts ` block, rewrites the `@diffbot/ai-sdk` import to `src/index.ts`, and executes it against a stubbed global `fetch`. Add one more: **execute the exact `codeExample` string we submit to the registry**, so the registry entry can't rot.
- **Skip-path guard:** a CI step that runs the live config with the token explicitly empty (`DIFFBOT_API_TOKEN="" pnpm test:live`) and must exit 0 with everything skipped. This is the regression test for §6.2.
- Port the Cloudflare Workers fixture (`wrangler deploy --dry-run` against empty `compatibility_flags`). It needs no CF credentials, so it runs on fork PRs, and it keeps the package Workers-clean — the property comes from `@diffbot/typescript` having no node builtins in its main entry.

### 6.2 Live suite — and the two failure modes we must not repeat

Gate on `DIFFBOT_API_TOKEN`, shape-based assertions only, 60–120s timeouts, no crawl coverage (slow + quota).

**Bug 1 — `??` doesn't catch the empty string.** Every live file in `langchain-diffbot-typescript` does:

```ts
// typescript/tests/live/tools.live.test.ts (and chat_models / loaders / retrievers)
const token = process.env.DIFFBOT_API_TOKEN;
const client = new DiffbotClient({ token: token ?? "unused-token-suite-skipped", timeout: 120_000 });
describe.skipIf(!token)("… (live)", () => { … });
```

`??` only substitutes for `null` / `undefined`. A **missing GitHub Actions secret arrives as the empty string**, not as unset — so `token === ""`, the placeholder is never applied, and `""` is passed straight to the client.

**Bug 2 — module-scope construction defeats `describe.skipIf`.** `DiffbotClient`'s constructor is `if (!options.token) throw new ValidationError("token is required")` (verified in the published `dist/index.js` of `@diffbot/typescript` 0.3.0). That throw happens at **import time**, before vitest ever evaluates `describe.skipIf(!token)`. The result is a file-level collection error — the job *fails* where it should have *skipped*. `skipIf` was the right idea; it just never gets a chance to run.

Required pattern for `@diffbot/ai-sdk`:

```ts
// tests/live/helpers.ts
const raw = process.env.DIFFBOT_API_TOKEN;
export const token = typeof raw === "string" ? raw.trim() : "";   // "" and "  " both → ""
export const hasToken = token.length > 0;

/* Never called at module scope: the SDK throws on a falsy token. */
export const makeClient = () => new DiffbotClient({ token, timeout: 120_000 });
```

```ts
// tests/live/tools.live.test.ts
describe.skipIf(!hasToken)("diffbot tools (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => { client = makeClient(); });   // only runs when the suite isn't skipped
  it("…", async () => { /* use client */ });
});
```

Three rules, stated in the repo's CONTRIBUTING and enforced by the guard step in §6.1:

1. Treat the token as present only when it is a **non-empty string after trimming** — never `token ?? fallback`, never a bare `!== undefined`.
2. **Never construct a `DiffbotClient` (or anything else that validates a token) at module scope** in a live file. Build it in `beforeAll`, inside the test, or behind a lazy getter.
3. CI must prove the skip path, by running the live config with `DIFFBOT_API_TOKEN=""` in the token-less job.

The same trap applies to the package itself, not just its tests — hence "resolve inside `execute`" in §5.3. A tool built in a process with an empty `DIFFBOT_API_TOKEN` must fail with a clear "no Diffbot token" tool error when called, not explode at import.

---

## 7. CI, docs, examples, publishing, registry

### 7.1 CI (mirror the LangChain repo)

- `ci.yml` — triggers: `push: [main]`, `pull_request`, `workflow_dispatch`. Jobs: (a) lint + typecheck; (b) unit tests + build on Node 20/22/24; (c) the **peer matrix** leg (`ai@6` + `@ai-sdk/openai-compatible@2`, and `ai@7` + `@3`) running typecheck + unit tests against the same source; (d) the empty-token live-skip guard; (e) Workers `wrangler deploy --dry-run`; (f) registry `codeExample` typecheck. **No secrets anywhere in this workflow** — which is what lets every job run while the repo is private and, later, on fork PRs. Jobs (a)–(d) land in Phase 1; (e) and (f) in Phases 4–5.
- `integration.yml` — triggers: `schedule` (nightly) + `workflow_dispatch` **only**, with the same explicit comment forbidding `pull_request` / `push`, so `secrets.DIFFBOT_API_TOKEN` is never handed to fork-submitted workflow code. One job, `pnpm test:live`.
- `release.yml` — tag `v*` (plus `workflow_dispatch` for build-only dry runs); verify the tag matches `package.json`, build, assemble a publish dir, `pnpm publish --access public --provenance` with `id-token: write`, then create the GitHub release. No local publish path.
- Add an AI-SDK-version canary (weekly `workflow_dispatch`/schedule installing `ai@latest`) so a breaking v8 shows up as a failing scheduled job rather than a user bug report.

### 7.2 Docs

- `README.md` as the complete reference, structured like `@diffbot/langchain`'s: install, auth & clients, quickstart, output shaping, per-tool sections, the ontology→probe→run agent loop, the provider, retrieval/loader helpers, Cloudflare Workers, a tools reference table, examples, development, releasing. Keep prose aligned with the LangChain READMEs where behaviour matches, and say so explicitly where it diverges (client-optional auth, no `Document` class, per-call `k`).
- `CLAUDE.md` + `CONTRIBUTING.md` carrying the architectural decisions, the live-token rules from §6.2, and the release process.
- **A page on docs.diffbot.com** covering the AI SDK integration. This is a hard prerequisite for the registry PR (`docsUrl` must point at an AI-SDK-specific integration guide, not a homepage). Owner needed — see §10.
- A `content/providers/04-openai-compatible-providers/NN-diffbot.mdx` page for the vercel/ai docs (template: frontmatter, setup, `createOpenAICompatible` snippet, `generateText` + `streamText` examples). The provider ships in v0.1.0 (§10.6), so this page is a definite deliverable — a separate, later PR from the tools-registry entry, not bundled with it.

### 7.3 Examples

Port both LangChain examples so the three integrations demo the same things:

- `examples/company-research` — one-shot CLI agent: `generateText` + `stopWhen: stepCountIs(…)`, tools = KG search + web search + extract, prints cited entity IDs and URLs. Direct analogue of the LangChain example's agent loop, minus LangGraph.
- `examples/dql-explorer` — the web app (DQL builder where the agent only *authors* the query, dashboard from fixed DQL templates, Ask tab). Swap the LangChain agent for `streamText`, and `ChatDiffbot` for `createDiffbot()` on the Ask tab. Keep the "server runs the query, so rows are always real KG data" property.
- Env: `examples/.env.example` with `DIFFBOT_API_TOKEN` + `ANTHROPIC_API_KEY` (same as LangChain). Drop the LangSmith vars; add AI SDK telemetry only if someone asks.

### 7.4 Publishing

0. **Publish prerequisites — none of which block Phases 1–5.** (a) npm membership in the `@diffbot` org with publish rights for a new package; (b) an `NPM_TOKEN` repo secret — the first secret this repo will hold, readable only by `release.yml`; (c) `"private": true` flipped to `false` in `package.json`; (d) ideally the GitHub transfer to the `diffbot` org first (§10.8), so provenance attests to an org repo — if the transfer lags, publish from `shixish/diffbot-ai-sdk` and let the provenance URL change at the next release. Everything through Phase 5 runs in a private repo with no secrets at all.
1. Confirm `@diffbot/ai-sdk` is free on npm before the first tag.
2. `0.1.0` first release, `"publishConfig": {"access": "public"}`, provenance on.
3. Bump `version`, commit, tag `vX.Y.Z` exactly matching, push the tag; the workflow does the rest. Mismatched tag fails before anything is published.
4. Keep the `@diffbot/typescript` range moving with the SDK: because it is a regular dependency here, a stale range is the only way a user ends up with two copies and the private-`fetchFn` type error from §5.2. Policy: **a patch release widening or moving the range within one week of any `@diffbot/typescript` minor.** (`^0.3.0` today; the LangChain TS package is still on `^0.2.0`.)

### 7.5 Tools-registry submission

Prerequisites, in order: package on npm → integration tested against current `ai` → Diffbot-hosted AI SDK docs page live. Then one PR to `vercel/ai`:

- Branch `feat/add-tool-diffbot`, single file touched: `content/tools-registry/registry.ts`, PR title `feat(tools-registry): add diffbot`.
- Timing is decided (§10.15): the npm publish does **not** wait for the registry, but the registry PR **does** wait for the docs.diffbot.com integration page, because `docsUrl` must point at an AI-SDK integration guide. That page is the only external dependency on the critical path to a listing and still needs an owner.
- `stepCountIs`, not `isStepCount`, in the `codeExample` — the entry must work for readers on `ai@6` as well as `ai@7` (§10.3).
- Draft entry (final `codeExample` must be the exact string our CI executes):

```ts
{
  slug: 'diffbot',
  name: 'Diffbot',
  description:
    'Diffbot tools for the AI SDK: web search with full page content, structured extraction from any URL, and Knowledge Graph (DQL) queries over billions of organizations, people, places, articles and products — plus ontology introspection and query probing so agents write valid DQL instead of guessing.',
  packageName: '@diffbot/ai-sdk',
  tags: ['search', 'web', 'extraction', 'knowledge-graph', 'nlp'],
  apiKeyEnvName: 'DIFFBOT_API_TOKEN',
  installCommand: {
    pnpm: 'pnpm add @diffbot/ai-sdk',
    npm: 'npm install @diffbot/ai-sdk',
    yarn: 'yarn add @diffbot/ai-sdk',
    bun: 'bun add @diffbot/ai-sdk',
  },
  codeExample: `import { generateText, stepCountIs } from 'ai';
import { diffbotWebSearch, diffbotKnowledgeGraph } from '@diffbot/ai-sdk';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-5',
  prompt: 'Which Boston AI companies raised a Series B this year?',
  tools: {
    webSearch: diffbotWebSearch(),
    knowledgeGraph: diffbotKnowledgeGraph(),
  },
  stopWhen: stepCountIs(5),
});

console.log(text);`,
  docsUrl: 'https://docs.diffbot.com/<ai-sdk-integration-page>',
  apiKeyUrl: 'https://app.diffbot.com/get-started/',
  websiteUrl: 'https://www.diffbot.com',
  npmUrl: 'https://www.npmjs.com/package/@diffbot/ai-sdk',
}
```

Pick the `model` string in the example to match whatever the neighbouring entries use at submission time (they currently use gateway strings like `'openai/gpt-5.1-codex'`, `'google/gemini-3.1-pro-preview'`); reviewers notice stale model ids. Separate, later PR for the provider MDX page — don't bundle the two.

---

## 8. Phases, effort, and the first implementation round

Assumes one engineer (or coding agent) familiar with TypeScript and the Diffbot APIs. A working `DIFFBOT_API_TOKEN` is needed from Phase 2 onward; **Phase 1 needs no token at all**.

| Phase | Scope | Days |
| --- | --- | --- |
| **1. Skeleton + core tools** | Private repo `shixish/diffbot-ai-sdk`, build/test/lint toolchain, `client.ts` auth resolution, `documents.ts` shaping, `diffbotWebSearch` / `diffbotExtract` / `diffbotKnowledgeGraph` / `diffbotTools()`, full unit suite, live-skip guard, `ci.yml`. **Fully specified in §8.1.** | 3–4 |
| **2. Provider + remaining tools** | §5.5 check **V1** then `createDiffbot` on the `./provider` subpath; `diffbotEntities`, `diffbotOntology` (incl. `KVOntologyStore`), `diffbotDqlProbe`, `diffbotAsk`; unit tests | 2.5–3.5 |
| **3. Retrieval + loader helpers** | `retrieveKnowledgeGraph`, `retrieveWebSearch`, `loadExtract`/`streamExtract`, `loadCrawl`/`streamCrawl` + `defaultCrawlMapper`; unit tests | 1.5–2 |
| **4. Live suite + CI + release** | Live tests for every tool and the provider, `integration.yml`, `release.yml`, Workers `wrangler deploy --dry-run` fixture, AI-SDK version canary, `ai@6` matrix leg | 1.5–2 |
| **5. Docs + examples** | Full README, `CLAUDE.md`, `CONTRIBUTING.md`, README-parity + README-examples + registry-`codeExample` suites, both ported examples, the docs.diffbot.com integration page | 2.5–3.5 |
| **6. Publish + list** | npm `0.1.0` (needs `@diffbot` org access — §10.8), tools-registry PR, provider MDX PR, review turnaround | 0.5–1 |
| | **Total (LangChain parity, v0.1.0)** | **~11–16** |
| **S. Deferred (v0.3.0, MCP-derived)** | Typed searches (`search_organizations` / `search_people` / `search_deals` / `search_news` / `search_places`) need ~1,100 lines of Python DQL-builder logic ported with its own tests; crawl job control; `dql` CSV/`fields`/facets; `resolve_entities` shaping | 5–8 |

Sequencing note: the §5.5 **V1** curl check is the first task of Phase 2 and takes about half an hour. Do not let it drift later — its outcome decides whether `createDiffbot` needs the `wrapGenerate` branch, and it changes one sentence of the README.

---

### 8.1 Phase 1 — first implementation round (executable spec)

**Goal:** a private, buildable, fully unit-tested repo containing the three highest-value Diffbot tools and the bundle helper. No token required to build, test, or lint. Everything below is decided; there is nothing in this section for the implementer to choose.

#### 8.1.1 Repo

- GitHub: **`shixish/diffbot-ai-sdk`**, **private**, default branch `main`, MIT `LICENSE` (matching Diffbot's other SDKs). No npm publish in this round.
- Commit the existing `PLAN.md`, `README.md` stub and `.gitignore` already drafted in `/tmp/aisdk-plan` as the first commit, then build on top.
- pnpm only (`packageManager` field pinned, `pnpm-lock.yaml` committed). Node >= 20.

#### 8.1.2 Exact files to create

```
package.json                      tsconfig.json              tsup.config.ts
vitest.config.ts                  vitest.live.config.ts      eslint.config.ts
.prettierrc.json                  .gitignore                 LICENSE
README.md                         CLAUDE.md                  CONTRIBUTING.md
.github/workflows/ci.yml
src/index.ts
src/client.ts
src/documents.ts
src/tools/web-search.ts
src/tools/extract.ts
src/tools/knowledge-graph.ts
src/tools/index.ts
tests/helpers/mock-fetch.ts
tests/client.test.ts              tests/documents.test.ts    tests/imports.test.ts
tests/tools/web-search.test.ts    tests/tools/extract.test.ts
tests/tools/knowledge-graph.test.ts
tests/tools/bundle.test.ts
tests/types/injected-client.ts
tests/live/helpers.ts             tests/live/web-search.live.test.ts
```

`src/provider.ts`, `src/retrieve/**`, the other four tools, `examples/`, and `fixtures/worker/` are **not** created in this round (§8.1.9).

#### 8.1.3 `package.json`

Exactly the manifest in §5.2, with `"version": "0.1.0-dev.0"`, `"private": true` (flipped to `false` in Phase 6 when npm access exists), and:

```jsonc
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . && prettier --check .",
    "test": "vitest run",
    "test:live": "vitest run --config vitest.live.config.ts",
    "test:peer:ai6": "pnpm add -D ai@6 @ai-sdk/openai-compatible@2 && pnpm typecheck && pnpm test"
  }
}
```

The `./provider` subpath is **not** declared yet — adding an export entry with no file behind it breaks consumers' resolvers.

#### 8.1.4 `src/client.ts`

```ts
import { DiffbotClient, resolveTokenFromEnv } from "@diffbot/typescript";

/** Auth surface mixed into every factory's options. */
export interface DiffbotAuth {
  /** A pre-built client. Keep `@diffbot/typescript` on the same minor as ours (see README). */
  client?: DiffbotClient;
  apiKey?: string;
  timeout?: number;
  fetch?: typeof globalThis.fetch;
  /** Workers-style env bag, forwarded to the SDK's `resolveTokenFromEnv`. */
  env?: Record<string, string | undefined>;
}

/** Returns a lazy, memoized resolver. Never touches the token at call time. */
export function createClientResolver(auth?: DiffbotAuth): () => DiffbotClient;
```

Rules, each one tested:

1. `createClientResolver` **must not** read env, construct a client, or throw. All of that happens on the first call of the returned function.
2. Precedence: `auth.client` → `new DiffbotClient({ token: auth.apiKey, ... })` → `new DiffbotClient({ token: resolveTokenFromEnv(undefined, auth.env), ... })`.
3. The token is accepted only when it is a **non-empty string after `.trim()`**. Never `??`, never a bare `!== undefined` — this is the §6.2 bug, in library form.
4. When no usable token exists, throw `Error` with this exact message:
   `No Diffbot API token. Pass \`client\`, pass \`apiKey\`, or set DIFFBOT_API_TOKEN.`
   A plain `Error` on purpose: the AI SDK converts a throw inside `execute` into a `tool-error` content part the model can report, and a bespoke error class would be public surface to maintain for no gain.
5. The result is memoized — one client per factory call (and one per `diffbotTools()` call), so an agent run reuses one connection pool.
6. `timeout` and `fetch` are forwarded only when constructing; they are ignored (not merged) when `auth.client` is given, because the injected client already owns that configuration. Document that in a code comment.

#### 8.1.5 `src/documents.ts`

Port `typescript/src/base.ts` with `Document` replaced by a plain object. Exports:

```ts
export interface DiffbotDocument { content: string; metadata: Record<string, unknown>; }
export type DocumentMapper = (source: Record<string, unknown>) => DiffbotDocument;
export interface DiffbotDocumentOptions {
  fields?: readonly string[];
  contentFields?: readonly string[];
  documentMapper?: DocumentMapper;
}
export const DEFAULT_KG_CONTENT_FIELDS: readonly ["description", "summary", "name"];
export const DEFAULT_WEB_CONTENT_FIELDS: readonly ["content", "snippet"];
export function dictToDocument(source: Record<string, unknown>, options: { contentFields: readonly string[]; fields?: readonly string[] }): DiffbotDocument;
export interface ShapedExtractResponse { content: string; title?: string; pageUrl?: string; resolvedPageUrl?: string; type?: string; }
export function shapeExtractResponse(raw: JsonObject): ShapedExtractResponse;
```

Carry over **verbatim semantics** from `base.ts`, because all three Diffbot integrations must pick the same content field:

- `isNonEmpty` truthiness mirrors Python: `null`/`undefined` false; `""` false; `0` false; `false` false; empty array false; empty object false; everything else true.
- The winning content key is **excluded** from `metadata` so the same text is not carried twice.
- `fields` is a top-level allowlist; `undefined` keeps every key; keys absent from the source are skipped.
- `shapeExtractResponse` fallback chain is `objects[0].content` → `objects[0].text` → top-level `markdown` → `""`, with `title`/`pageUrl`/`type` each falling back to the top level and `asString` treating `""` as absent.

`resolveK` is **not** ported — the AI SDK path validates counts in the zod schema instead.

#### 8.1.6 The three tools

Shared conventions for all three:

- Factory, not instance: `diffbotX(options?) => Tool`. The **caller owns the key** in the `tools` record; our factory never names itself.
- Options interface extends `DiffbotAuth`, so every factory accepts `client` / `apiKey` / `timeout` / `fetch` / `env`.
- **One precedence rule for every parameter that appears in both places: model input → factory option → built-in default.** No other rule, anywhere.
- `inputSchema` is a `z.object` using only the v3∩v4 subset (`z.string`, `z.number().int().min().max()`, `z.enum`, `.optional()`, `.default()`, `.describe()`). Import is plain `import { z } from "zod"` — not `zod/v3`.
- Every `.describe()` string is written for a model, and the `description` text is copied from the LangChain tool where one exists, so the three integrations present Diffbot identically.
- The client is resolved **inside `execute`** via the memoized resolver.
- Only recoverable, per-call API failures become data. Infrastructure failures (`AuthError`, `RateLimitError`) propagate.

**`src/tools/web-search.ts`**

```ts
export interface DiffbotWebSearchOptions extends DiffbotAuth {
  numResults?: number; maxTokens?: number; snippetLength?: "short" | "medium" | "long" | "full";
}
export function diffbotWebSearch(options?: DiffbotWebSearchOptions): Tool<{...}, JsonObject[]>;
```

- `inputSchema`: `query` (string, required), `numResults` (int 1–50, optional), `snippetLength` (enum of the SDK's `SNIPPET_LENGTHS`, optional). `maxTokens` is factory-only — it is a cost guardrail, not something a model should raise.
- Model-facing field is **`query`**, not LangChain's `text`: it is what every competitor tool calls it and what models predict most reliably. Record it in the README's divergence list.
- Calls `webSearch(client, query, { numResults, maxTokens, snippetLength })`, omitting undefined keys, and returns `body.search_results` when it is an array, else `[]` — identical to `DiffbotWebSearchTool`.
- `description`: `"Search the web via Diffbot. Returns a list of results, each with title, pageUrl, score, and content."`

**`src/tools/extract.ts`**

```ts
export interface DiffbotExtractOptions extends DiffbotAuth { api?: string; fmt?: string; }
export interface DiffbotExtractToolError { error: string; errorCode: number; }
export type DiffbotExtractToolOutput = ShapedExtractResponse | DiffbotExtractToolError;
export function diffbotExtract(options?: DiffbotExtractOptions): Tool<{...}, DiffbotExtractToolOutput>;
```

- `inputSchema`: `url` (string, required), `api` (string, optional, default `"analyze"`), `fmt` (string, optional, default `"markdown"`). Kept as free strings rather than enums, exactly as `DiffbotExtractTool` does, so new Diffbot page types work without a package release.
- Calls `extract(client, url, api, fmt)`, returns `shapeExtractResponse(raw)`.
- `catch`: `ExtractionError` → `{ error: e.message, errorCode: e.errorCode }`; everything else rethrown.
- `description`: `"Extract structured content (title, text, type, resolved URL) from a single web page. Use for reading the contents of a known URL."`

**`src/tools/knowledge-graph.ts`**

```ts
export interface DiffbotKnowledgeGraphOptions extends DiffbotAuth { size?: number; from?: number; filter?: string; }
export function diffbotKnowledgeGraph(options?: DiffbotKnowledgeGraphOptions): Tool<{...}, JsonObject>;
```

- `inputSchema`: `query` (string, required, described as DQL with the example `type:Organization name:"Diffbot"`), `size` (int 1–100, optional, default 10), `from` (int >= 0, optional, default 0), `filter` (string, optional).
- Calls `dql(client, query, { size, from, filter })` and returns the raw response object, matching `DiffbotKnowledgeGraphTool`. `format` is **not** exposed in this round; if the SDK ever returns a `Uint8Array` here, throw `Error("Unexpected non-JSON DQL response.")` — tested, so the `JsonObject | Uint8Array` union never leaks into the public type.
- `description`: `"Query the Diffbot Knowledge Graph with a DQL expression (e.g. type:Organization location.city.name:\"Boston\"). Returns the raw response — use only if you know DQL syntax."`

**`src/tools/index.ts`**

```ts
export type DiffbotToolName = "diffbot_web_search" | "diffbot_extract" | "diffbot_knowledge_graph";
export interface DiffbotToolsOptions extends DiffbotAuth { only?: readonly DiffbotToolName[]; }
export function diffbotTools(options?: DiffbotToolsOptions): Record<DiffbotToolName, Tool>;
```

- Keys are the `diffbot_*` names, matching the LangChain tool names (§10.11).
- **One shared resolver for the whole bundle**, so all tools in it use one client.
- `only` filters the result and preserves the declaration order above; an unknown name is a TypeScript error and, at runtime, simply matches nothing.
- Return type is `ToolSet`-compatible without importing `ToolSet` as a value.

#### 8.1.7 `src/index.ts` — the exact barrel

Value exports (nothing else): `diffbotWebSearch`, `diffbotExtract`, `diffbotKnowledgeGraph`, `diffbotTools`, `dictToDocument`, `shapeExtractResponse`, `DEFAULT_KG_CONTENT_FIELDS`, `DEFAULT_WEB_CONTENT_FIELDS`.

Type-only exports: `DiffbotAuth`, `DiffbotDocument`, `DiffbotDocumentOptions`, `DocumentMapper`, `ShapedExtractResponse`, `DiffbotWebSearchOptions`, `DiffbotExtractOptions`, `DiffbotExtractToolError`, `DiffbotExtractToolOutput`, `DiffbotKnowledgeGraphOptions`, `DiffbotToolName`, `DiffbotToolsOptions`, and `type DiffbotClient` re-exported from `@diffbot/typescript` (so users can type an injected client without a second import).

`createClientResolver` is **internal** — not exported from the barrel.

#### 8.1.8 Tests that must pass

Harness: port `typescript/tests/helpers/mock-fetch.ts` (`createMockFetch`, `jsonResponse`, `sseResponse`) — the SDK still does not publish it. Inject the fake `fetch` through each factory's `fetch` option, which is why that passthrough exists (§5.3). Mocks assert against the real upstream URLs; no test may reach the network.

| File | Must assert |
| --- | --- |
| `tests/client.test.ts` | resolver does not read env / construct / throw until called; precedence `client` > `apiKey` > env; `DIFFBOT_API_TOKEN=""` and `"   "` both produce the exact no-token message; memoization returns the same instance across calls; `timeout`/`fetch` forwarded when constructing and ignored when `client` is injected |
| `tests/documents.test.ts` | `isNonEmpty` table (`null`, `undefined`, `""`, `0`, `false`, `[]`, `{}` fall through; `"x"`, `1`, `true`, `[0]`, `{a:1}` win); winning content key excluded from `metadata`; `fields` allowlist narrows and skips absent keys; `undefined` fields keeps everything; non-string content stringified; `shapeExtractResponse` full fallback chain incl. top-level `markdown` and `""` treated as absent |
| `tests/tools/web-search.test.ts` | outbound URL is `llm.diffbot.com/api/v1/web_search` with `Authorization: Bearer` header and no `?token=`; `numResults`/`snippetLength` from model input override factory options; `maxTokens` comes only from factory options; `search_results` returned, non-array → `[]`; schema rejects `numResults: 0` and `numResults: 51` |
| `tests/tools/extract.test.ts` | outbound URL is `api.diffbot.com/v3/analyze` with `?token=`; `api`/`fmt` precedence (model → factory → `analyze`/`markdown`); response shaped; `ExtractionError` becomes `{error, errorCode}`; `AuthError` and `RateLimitError` rethrow |
| `tests/tools/knowledge-graph.test.ts` | DQL URL + `?token=`; `size`/`from`/`filter` reach the query string; defaults 10/0; raw body returned unchanged; `Uint8Array` response throws the specified message; schema rejects `from: -1` |
| `tests/tools/bundle.test.ts` | `diffbotTools()` keys are exactly the three `diffbot_*` names in declaration order; `only` filters and preserves order; all tools in one bundle share one client instance (observed via a single injected `fetch` spy); each entry is a valid AI SDK tool (`description` + `inputSchema` + `execute` present) |
| `tests/imports.test.ts` | the barrel's runtime export list equals the §8.1.7 value list, sorted — the regression test for accidental surface growth |
| `tests/types/injected-client.ts` | typecheck-only (compiled by `pnpm typecheck`, never run): constructs a `DiffbotClient` from `@diffbot/typescript` and passes it as `client` to all three factories and to `diffbotTools`. Guards the §5.2 duplicate-copy hazard |
| `tests/live/helpers.ts` + `tests/live/web-search.live.test.ts` | the §6.2 pattern: trim-then-check `hasToken`, `describe.skipIf(!hasToken)`, client built in `beforeAll` and **never** at module scope. One shape-based test (results array, each entry has `pageUrl`), 120 s timeout |

Commands that must all exit 0 on a clean checkout **with no `DIFFBOT_API_TOKEN` set**:

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
DIFFBOT_API_TOKEN="" pnpm test:live      # everything skipped, exit 0 — the §6.2 regression guard
pnpm test:peer:ai6                       # same source, ai@6 + @ai-sdk/openai-compatible@2
```

#### 8.1.9 Acceptance criteria

Phase 1 is done when **all** of these hold:

1. `shixish/diffbot-ai-sdk` exists, is private, and `main` contains every file in §8.1.2.
2. All seven commands in §8.1.8 exit 0 on a clean clone with no Diffbot token in the environment.
3. `dist/` after `pnpm build` contains ESM, CJS and `.d.ts` for the single `.` entry, and `node -e "require('./dist/index.cjs')"` plus an ESM `import()` of `dist/index.js` both succeed **without** a token present (proves nothing resolves auth at import time).
4. `pnpm test` reports coverage of every row in the §8.1.8 table, and no test performs real network I/O (enforced by a vitest setup file that replaces `globalThis.fetch` with a throwing stub).
5. `tests/imports.test.ts` passes against the §8.1.7 list verbatim.
6. `ci.yml` runs on `push: [main]`, `pull_request`, `workflow_dispatch` with jobs: lint+typecheck; test+build on Node 20/22/24; the `ai@6` peer leg; the empty-token live-skip guard. **No secrets are referenced anywhere in this workflow.**
7. `README.md` covers, and nothing more: install (`pnpm add @diffbot/ai-sdk`), the three auth modes with `DIFFBOT_API_TOKEN`, a `generateText` quickstart using `stopWhen: stepCountIs(5)`, one section per tool with its input schema, the `diffbotTools()` bundle, the `ai` / `@ai-sdk/openai-compatible` pairing table from §5.2, the injected-client version-alignment note, and a "not yet implemented" list naming the Phase 2–3 items.
8. `CONTRIBUTING.md` states the three live-token rules from §6.2 as rules, not prose.

**Explicitly out of scope for Phase 1** — do not build these, do not stub them, do not add their export entries:

`src/provider.ts` and the `./provider` subpath; `diffbotEntities`, `diffbotOntology`, `diffbotDqlProbe`, `diffbotAsk`; all retrieval and loader helpers (`retrieveKnowledgeGraph`, `retrieveWebSearch`, `loadExtract`, `streamExtract`, `loadCrawl`, `streamCrawl`, `defaultCrawlMapper`); any crawl surface at all; `toModelOutput` result shaping (measure in Phase 5 before adding it); `askJson`/`jsonSchemaFormat` passthrough; the five MCP typed searches; `examples/`; `fixtures/worker/`; the README-parity, README-examples and registry-`codeExample` suites; `integration.yml` and `release.yml`; the npm publish; the tools-registry entry; the docs.diffbot.com page; and any change to the three read-only clones.

---

### 8.2 Phase 2 — task V1 first (the one provider unknown)

**V1 result (2026-11-10, live, `https://llm.diffbot.com/rag/v1/chat/completions`):** With `stream: false`, the endpoint returns a normal OpenAI `chat.completion` (HTTP 200) with non-empty `choices[0].message.content`, `finish_reason: "stop"`, and `usage` `{prompt_tokens, completion_tokens, total_tokens}` — so `createDiffbot` is a plain `createOpenAICompatible` wrapper with no `wrapGenerate` middleware. Adding a `tools` array is **rejected** (HTTP 400: `diffbot-small-xl does not currently support user-defined tools`). Citations arrive **inline** in the answer text as markdown links (including `https://app.diffbot.com/entity/...` KG links); `message` has no structured citation fields (`reasoning_content` / `tool_calls` null).

Phase 2 opens with a single verification, before any provider code is written. It needs a `DIFFBOT_API_TOKEN` in the environment and takes about half an hour.

**V1.** POST to `https://llm.diffbot.com/rag/v1/chat/completions` with `Authorization: Bearer $DIFFBOT_API_TOKEN` and a body of `{"model":"diffbot-small-xl","messages":[{"role":"user","content":"Who founded Diffbot?"}],"stream":false}`. Record three things: (a) whether a normal non-streaming OpenAI completion object comes back with non-empty `choices[0].message.content`; (b) what happens when a `tools` array is added to the same request — accepted, ignored, or rejected; (c) where citations appear — inline in the content, or as structured fields.

Then act, with no further judgement calls:

- **(a) succeeds** → `createDiffbot` is a plain `createOpenAICompatible` wrapper. **(a) fails** → the same `createDiffbot`, with the model wrapped by `wrapLanguageModel` + a `wrapGenerate` that drains `doStream` and assembles `{ text, usage, finishReason }`; the README notes that non-streaming is emulated. Nothing else changes, and the public API is identical either way.
- **(b)** decides one README sentence about tool calling (§5.5 item 2). It never blocks the release.
- **(c)** decides one README sentence about citations (§5.5 item 3). Structured-field plumbing through `providerMetadata` is a v0.2.0 item, not a v0.1.0 one.

Acceptance criterion for the provider, identical in every branch: a live test asserting that `generateText({ model: diffbot('diffbot-small-xl'), prompt })` resolves with non-empty text, and a live test asserting `streamText` yields at least one text delta. Both run only when a token is present, using the §6.2 pattern, with a 120 s timeout.

The rest of Phase 2 adds `diffbotEntities`, `diffbotOntology` (including the `KVOntologyStore` path and `refresh: true`), `diffbotDqlProbe` and `diffbotAsk`, each following the §8.1.6 conventions verbatim, each extending `DiffbotToolName` and the `tests/imports.test.ts` list, and each with the unit coverage listed in §6.1.

---

## 9. What this plan deliberately does not include

- Any graph-transformer / entity-graph-extraction feature. Not in any of the three clones.
- Embeddings, vector stores, rerankers, image/speech models. Diffbot ships none.
- A `Document` class. The AI SDK has no document abstraction; `DiffbotDocument` is a plain `{content, metadata}` object, and the package stays free of `@langchain/core`.
- Wrapping `crawlListJobs` / `crawlGetJob` / `crawlDeleteJob` as tools, matching the LangChain decision (MCP exposes them; deferred — §10.10).
- A **model-facing crawl tool**. Crawl runs for minutes and burns quota, which is the wrong shape for a tool call; `loadCrawl`/`streamCrawl` helpers only (§10.9).
- The five MCP-derived typed searches (orgs / people / deals / news / places) in v1. Deferred to v0.3.0 (§10.10).
- `ai@5` support. It is not a zero-code-change target (§5.2), and v6/v7 cover current users.
- A second package. No `@diffbot/ai-sdk-provider`, no monorepo with the LangChain packages (§10.7, §10.12).
- A `DIFFBOT_API_KEY` or `DIFFBOT_TOKEN` env var. One name, `DIFFBOT_API_TOKEN` (§10.5).
- Fixing the live-test bug in `langchain-diffbot-typescript`. Real, worth doing, **separate PR** (§10.13).
- Framework glue (Next.js route handlers, `useChat` wrappers). Users get that from `ai` itself.
- Any code, repo, PR, publish, or outbound message produced by *this* document. It is a plan; `/tmp/aisdk-plan/PLAN.md` is its only artifact, and it contains **no API tokens** — only the env var name `DIFFBOT_API_TOKEN`.

---

## 10. Decisions

**Locked 2026-11-09** by Andrew + Opus. These replace the former "open questions" section; every downstream section of this plan has been updated to match. Where a decision rests on something I measured rather than assumed, the evidence is in Appendix A.

### 10.1 Package name — `@diffbot/ai-sdk`
**Confirmed.** Parallels `@diffbot/langchain` in a scope Diffbot already owns and publishes from; `@diffbot/ai` would read as the LLM product and an unscoped `diffbot-aisdk` throws away the scope.

### 10.2 `@diffbot/typescript` — regular `dependency`, range `^0.3.0`
**Decided: dependency, not peer.** This is the one place where the AI SDK package deliberately diverges from `@diffbot/langchain`.

The deciding factor is the delivery channel. The tools registry entry is a single `installCommand` plus a `codeExample` that must run after it — `npm install @diffbot/ai-sdk` then `import { diffbotWebSearch } from '@diffbot/ai-sdk'` and go. A peer dependency turns that into a two-package install plus "now construct a `DiffbotClient` and pass it in", which is the shape of the LangChain package precisely because LangChain components *require* an injected client. Here injection is optional, so requiring the install is all cost. Every comparable vendor agrees: Tavily, Exa, Firecrawl and Perplexity all make their own HTTP SDK a regular dependency and expose a zero-config factory.

The duplicate-SDK worry turns out to be small and, more importantly, *bounded*: `@diffbot/typescript@0.3.0` is **232 KB unpacked with zero dependencies**, so a second copy costs disk and nothing else — no transitive version conflicts, no native bits, no singleton state. The sharp edge is typing, and I measured it rather than guessing: because `DiffbotClient.http` is an `HttpClient` with a `private readonly fetchFn`, TypeScript compares the class by declaration identity, so a user on a *different minor* who injects their own client gets `Types have separate declarations of a private property 'fetchFn'`. Same version, no problem. That is handled by the caret range (npm dedupes all 0.3.x), a one-week fast-follow policy when the SDK ships a minor, a README note, and a typecheck-only test of the injected-client path (§8.1.8). A structural `DiffbotClientLike` interface would *not* fix it — we have to hand the client to the SDK's own free functions, which demand the nominal class — so we don't write one.

`@diffbot/langchain` keeping its peer is still correct for that package: LangChain does cross-package `instanceof`, and client injection there is mandatory. The two packages differ because their contracts differ, and the README says so.

### 10.3 `ai` peer range — `^6.0.0 || ^7.0.0`
**Decided by compiling, not by reading changelogs.** A probe containing exactly the surface we use — `tool()`, `inputSchema`, the destructured `execute` options arg (`toolCallId`, `abortSignal`, `messages`), an async-generator `execute`, `toModelOutput`, and the `Tool` and `ToolSet` types — compiled clean and **unchanged** under `ai@7.0.166` and `ai@6.0.326`. Under `ai@5.0.287` it failed on exactly one thing: `toModelOutput` receives the output directly in v5 but `{ toolCallId, input, output }` in v6+. Since `toModelOutput` is our lever for keeping tool results small, v5 is not a zero-change target and is excluded. v6 is free, so the rule "latest major, plus older majors only if that costs no code changes" admits it — and it matches what Firecrawl ships (`^6 || ^7`).

Two consequences, both already applied to this plan: the optional `@ai-sdk/openai-compatible` peer becomes `^2.0.0 || ^3.0.0` because that package is versioned in lockstep with `ai`'s majors (v2 emits `specificationVersion: "v3"` models, v3 emits `"v4"`), with a README pairing table and a CI leg per matched pair — mismatched pairs typecheck clean and fail at runtime, so docs and CI are the only defence. And **every example, README snippet and the registry `codeExample` uses `stopWhen: stepCountIs(n)`**, because `isStepCount` is the `ai@7`-only name while `stepCountIs` exists in v5, v6 and v7.

### 10.4 Client injection *and* env — both, env-first in docs
Support `client` → `apiKey` → `DIFFBOT_API_TOKEN`, resolved lazily inside `execute` and memoized; env-first in docs because that is the registry's one-install story, injection documented for anyone who needs `timeout`, custom endpoint URLs or an injected `fetch`.

### 10.5 Env var — `DIFFBOT_API_TOKEN` only, no aliases
One canonical name: it is the only Diffbot token name in the LangChain clones, the registry's `apiKeyEnvName` field holds exactly one value, and `DIFFBOT_TOKEN` (MCP's historical alias) or `DIFFBOT_API_KEY` (which appears in none of the three clones) would make three Diffbot packages read three different variables.

### 10.6 Diffbot LLM provider — **ships in v0.1.0**, from `@diffbot/ai-sdk/provider`
**Decided: yes, ship it.** In plain words, a user installs `@diffbot/ai-sdk` plus `@ai-sdk/openai-compatible`, writes `const diffbot = createDiffbot()` and passes `diffbot('diffbot-small-xl')` as the `model` to `generateText` / `streamText` / `generateObject`, and gets Diffbot's retrieval-grounded, cited answer. That is the whole feature; it is a ~60-line `createOpenAICompatible` wrapper over an endpoint whose wire format is already confirmed OpenAI-shaped in both directions by the LangChain unit tests.

Holding v0.1.0 for it would be the wrong trade. The three §5.5 unknowns are not equally important, and treating them as one gate was the mistake in the earlier draft. Only **one** of them can break a user's code: if `/rag/v1/chat/completions` refuses `stream: false`, then `generateText` — the most common call in the AI SDK — returns nothing. That is a 30-minute `curl` to settle, it is the first task of Phase 2, and both outcomes are already specified (plain wrapper, or the same wrapper plus a `wrapGenerate` that drains `doStream`), so no implementer has a decision to make. The other two — whether the model accepts a `tools` payload, and whether citations arrive inline or as structured fields — change a **sentence of the README**, not an API. Shipping with an honest sentence ("this is an answer-generation model with built-in retrieval; use your own agent model for tool calling", "citations appear in the answer text") is more useful to users than withholding the export, and a structured-citation `providerMetadata` path can arrive in v0.2.0 without breaking anyone.

It lives behind the `./provider` subpath with `@ai-sdk/openai-compatible` as an **optional** peer, so tool-only users never pull it into their bundle — which is also why a separate `@diffbot/ai-sdk-provider` package is unnecessary.

### 10.7 One package, not many — `@diffbot/ai-sdk` with named exports
Every comparable vendor ships one package with several named tool exports, the registry's `packageName` field is singular, Diffbot's own LangChain packages are single-package, and the subpath export already solves the only real reason to split (bundle weight).

### 10.8 Repo location — `shixish/diffbot-ai-sdk`, private, transferring later (done 2026-11-10: now public at `diffbot/ai-sdk`)
Start as a **private repo under the personal `shixish` account**, default branch `main`; **transfer to the `diffbot` org** when org repo-creation access exists (a GitHub transfer preserves history, issues and stars, so nothing is lost by starting personal). The npm name stays `@diffbot/ai-sdk` regardless of where the repo lives. Publishing to the `@diffbot` scope needs npm org membership and an `NPM_TOKEN` repo secret — a **Phase 6 publish prerequisite, not a blocker for Phases 1–5**, all of which run fine in a private repo with no secrets at all.

### 10.9 Crawl — helpers only, never a model-facing tool
A crawl runs for minutes and burns quota, so it is the wrong shape for a tool call the model can fire at will; `loadCrawl` / `streamCrawl` cover the real use case and job control stays a direct SDK call, matching the LangChain decision.

### 10.10 MCP stretch tools — none in v1; all five deferred to v0.3.0
Parity first: the typed searches are ~1,100 lines of Python DQL-builder logic to port, and an agent armed with `diffbotOntology` + `diffbotDqlProbe` + `diffbotKnowledgeGraph` can already reach the same data — so they are a differentiator to ship *after* the registry listing, starting with `search_organizations`.

### 10.11 Tool key naming — `diffbot_*` in the bundle, short keys in docs
`diffbotTools()` keys stay `diffbot_web_search` / `diffbot_extract` / `diffbot_knowledge_graph` so the model-visible names match LangChain and MCP across all three integrations, while hand-written README and registry examples use short keys (`webSearch`, `extract`) because the caller owns the key and short reads better in a snippet.

### 10.12 No monorepo with the LangChain packages
Sharing the mock-fetch harness and README-parity tooling is real but small; folding a new package into an existing repo's release train before it has shipped once is the larger risk — revisit consolidation after v0.1.0.

### 10.13 Upstream `langchain-diffbot-typescript` live-test bug — separate PR, out of scope here
The `token ?? "placeholder"` + module-scope-client bug in four `tests/live/*.live.test.ts` files is real and should be fixed with the §6.2 pattern plus the empty-token CI guard, but it is a small independent PR against a different repo and bundling it would stall this package; §6.2 records the exact fix so it is not lost.

### 10.14 SDK version alignment — target `^0.3.0`
`@diffbot/typescript` 0.3.0 is needed for `snippetLength`, `askJson`/`jsonSchemaFormat` and `dqlUrl`/`ontologyUrl`; separately, the LangChain repo's claim that "KG and ontology URLs are not overridable" is now stale and deserves a one-line doc fix there (same separate-PR bucket as §10.13).

### 10.15 Registry timing — publish npm first, list second
`0.1.0` goes to npm as soon as org access allows, but the tools-registry PR waits for the Diffbot-hosted AI SDK integration page, because `docsUrl` must point at an integration guide rather than a homepage and reviewers check it; **owner for that page is still needed** — it is the only external dependency on the critical path to a listing.


---

## Appendix A — evidence index

| Claim | Evidence |
| --- | --- |
| 12 public LangChain classes + helper exports | `typescript/src/index.ts`; `python/langchain_diffbot/__init__.py` |
| Client-only auth, one field `client` | `typescript/src/base.ts` (`DiffbotComponentFields`, `assertClient`); `typescript/CLAUDE.md` §"Client-only" |
| Endpoint URLs | `@diffbot/typescript` 0.3.0 `dist/index.js` consts: `EXTRACT_BASE`, `CRAWL_BASE`, `DIFFBOT_LLM_BASE`, `WEB_SEARCH_BASE`, `NLP_BASE`, `KG_DQL_ENDPOINT`; `mcp/diffbot_mcp/dql.py`, `mcp/diffbot_mcp/tools/*.py`; `python/CLAUDE.md` |
| RAG endpoint is OpenAI-shaped, model `diffbot-small-xl` | `typescript/tests/chat_models.test.ts` (`ASK_URL`, `choices[].delta.content` SSE); SDK `ask()` payload `{model, messages, stream: true}`; Diffbot docs/changelog |
| Bearer vs query-param auth | SDK `dist/index.js` — `Authorization: Bearer` in `ask` and `webSearch`; `?token=` elsewhere |
| `DIFFBOT_API_TOKEN` is the only Diffbot env var in the clones | grep across all three repos (live tests, both `integration.yml`s, `examples/.env.example`, worker fixture, SDK `resolveTokenFromEnv`); `DIFFBOT_TOKEN` only in `mcp/diffbot_mcp/api.py` |
| Live-suite bug | `typescript/tests/live/{tools,chat_models,loaders,retrievers}.live.test.ts` + SDK constructor `if (!options.token) throw new ValidationError("token is required")` |
| Live CI never runs on PRs | `typescript/.github/workflows/integration.yml`; `python/.github/workflows/integration.yml` |
| Crawl admin functions unwrapped by choice | `typescript/README.md` §Components reference; `typescript/CLAUDE.md` §"Admin / utility SDK functions are not wrapped" |
| AI SDK versions and peers | npm registry metadata for `ai`, `@ai-sdk/provider`, `@ai-sdk/openai-compatible` (2026-11-09) |
| `tool()` / `stepCountIs` in every major; `isStepCount` only in v7 | runtime export check of the published `ai@5.0.287`, `ai@6.0.326`, `ai@7.0.166` tarballs: `stepCountIs` present in all three, `isStepCount` present only in 7 |
| Our `ai` surface compiles unchanged on v6 and v7, fails on v5 | throwaway probe (`tool()` + `inputSchema` + `execute` options arg + async-generator `execute` + `toModelOutput` + `Tool`/`ToolSet`) typechecked with `tsc --strict` against all three majors; only v5 failed, on `toModelOutput`'s argument shape |
| `zod` is a **required** peer of `ai` (so a zod peer keeps one-install UX) | `npm view ai@6.0.326 peerDependenciesMeta` and `ai@7.0.166` both empty, with `zod: ^3.25.76 \|\| ^4.1.8` in `peerDependencies` |
| `@ai-sdk/openai-compatible` majors pair with `ai` majors | dist-tags `ai-v5 → 1.0.62`, `ai-v6 → 2.0.92`, `latest → 3.0.87`; instantiated models report `specificationVersion` `"v3"` (@2) and `"v4"` (@3); a `createDiffbot` probe compiled unchanged against all three pairs, and the mismatched `ai@7` + `@2` pair also compiled — hence the runtime-hazard warning in §5.2 |
| `@diffbot/typescript` is cheap to duplicate | published `0.3.0` metadata: `dependencies: {}`, `peerDependencies: {}`, `dist.unpackedSize` 231,691 bytes |
| Cross-minor duplicate SDK copies break injected clients | probe with `@diffbot/typescript@0.3.0` and an aliased `0.2.0` side by side: `Types have separate declarations of a private property 'fetchFn'` (two copies of the *same* version are assignable) |
| Registry entry fields + prerequisites | `vercel/ai` `contributing/add-new-tool-to-registry.md`; `content/tools-registry/registry.ts` |
| Provider listing is an MDX PR | `vercel/ai` `content/providers/04-openai-compatible-providers/*`, `.../05-community-providers/*` |
| Competitor export shapes and deps | npm metadata + `tavily-ai/ai-sdk` `src/index.ts` / `src/tools/tavily-search.ts`, `exa-labs/ai-sdk` `src/index.ts` |
| MCP stretch tool inventory and size | `mcp/diffbot_mcp/server.py`; `wc -l` over `mcp/diffbot_mcp/**` |

---

## Appendix B — post-Opus sanity check (executor)

**Decisions locked 2026-11-09** from Andrew + Opus and written into §10; §0 and §§3–9 were rewritten to match, while §1 (inventory) and §2 (AI SDK research) are unchanged except where a measurement corrected them (the `isStepCount` / `stepCountIs` naming in §2.1 and the `@ai-sdk/openai-compatible` major-pairing note in §2.2). The sanity check below predates the decisions and still holds for the inventory it covers.

Checked 2026-11-09 against the three local clones plus the published `@diffbot/typescript@0.3.0` tarball. No invented LangChain features or phantom Diffbot endpoints found. Confirmed:

- All **12** public LangChain classes in §1.1 match `typescript/src/index.ts` / `python/langchain_diffbot/__init__.py`.
- Endpoint URLs in §1.1 match the unit-test URL constants (`ASK_URL`, `WEB_SEARCH_URL`, `DQL_URL`, `ONTOLOGY_URL`, `NLP_URL`, `EXTRACT_PREFIX`, `CRAWL_URL`).
- Live-suite `token ?? "unused-token-suite-skipped"` + module-scope `new DiffbotClient(...)` pattern is present in all four `typescript/tests/live/*.live.test.ts` files; SDK constructor really is `if (!options.token) throw new ValidationError("token is required")`.
- `DIFFBOT_API_TOKEN` is the only Diffbot token env name in the LangChain clones; `DIFFBOT_TOKEN` only in MCP; no `DIFFBOT_API_KEY` in any of the three clones.
- No graph transformer / embeddings / vector store anywhere in the clones.
- MCP stretch tool names (`search_organizations`, `search_people`, `search_deals`, `search_news`, `search_places`, etc.) match `@mcp.tool(name=...)` registrations.

**Flags (not wrong, but worth noting):**

1. §1.7's "resolve_entities ≈ DiffbotEntitiesTool" is correct at the endpoint level (both hit `POST https://nl.diffbot.com/v1/`), but MCP returns a *slimmed* entity list plus a ready-made `dql_filter`; LangChain returns the SDK payload as-is. The plan already lists MCP shaping as stretch — keep that distinction when implementing `diffbotEntities()`.
2. The box/agent secret store historically uses the name `DIFFBOT_API_KEY`, but Diffbot's published packages and live CI all use `DIFFBOT_API_TOKEN`. **Resolved by §10.5:** the package reads `DIFFBOT_API_TOKEN` and nothing else; anyone whose environment holds the secret under another name maps it at the call site (`apiKey: process.env.WHATEVER`) rather than the package growing aliases.
3. AI SDK npm versions (`ai@7.0.166`, `ai@6.0.326`, `@ai-sdk/openai-compatible@3.0.87`/`2.0.92`, `@ai-sdk/provider@4.0.37`, `@ai-sdk/provider-utils@5.0.76`) were current as of plan authorship; re-check at implementation time. The `^6 || ^7` peer decision (§10.3) rests on a compile check against those exact versions — re-run `pnpm test:peer:ai6` rather than trusting it indefinitely.
4. The compatibility probes behind §10.2/§10.3 were throwaway scratch files outside the plan directory and were deleted after measurement. Nothing was written into the three read-only clones, no repo was created, nothing was published, and this document contains no API tokens — only the env var name `DIFFBOT_API_TOKEN`.

**Follow-up (2026-11-09):** Open questions were replaced by §10 Decisions (Andrew answers + Opus). Phase 1 (§8.1) is the executable first-round spec. Initial GitHub scaffold is `shixish/diffbot-ai-sdk` (private) with PLAN.md + README + .gitignore only; implementation commits follow.
