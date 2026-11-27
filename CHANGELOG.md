# Changelog

## [0.1.0] - 2026-11-17

First API of `@diffbot/ai-sdk`: Diffbot tools, retrieval helpers, and an OpenAI-compatible provider
for the Vercel AI SDK (`ai` ^6 or ^7).

### Added

- Seven model-facing tools — `diffbotWebSearch`, `diffbotExtract`, `diffbotKnowledgeGraph`,
  `diffbotEntities`, `diffbotOntology`, `diffbotDqlProbe`, and `diffbotAsk` — plus `diffbotTools()`,
  which exposes them under `diffbot_*` keys and shares one client across the bundle.
- Retrieval and loaders for manual RAG and batch ingestion: `retrieveKnowledgeGraph`,
  `retrieveWebSearch`, `loadExtract`, `streamExtract`, `loadCrawl`, `streamCrawl`, and
  `defaultCrawlMapper`. Crawl stays a helper. `dictToDocument`, `shapeExtractResponse`,
  `DEFAULT_KG_CONTENT_FIELDS`, and `DEFAULT_WEB_CONTENT_FIELDS` shape the helper results. `k` is per
  call.
- `createDiffbot` and a default `diffbot` instance on `@diffbot/ai-sdk/provider`, over
  `https://llm.diffbot.com/rag/v1`, with model ids `diffbot-small-xl` and `diffbot-small`. The
  optional `@ai-sdk/openai-compatible` peer is `^2` with `ai@6` and `^3` with `ai@7`.
- Auth resolved when a call runs: an injected `DiffbotClient`, an `apiKey`, or `DIFFBOT_API_TOKEN`
  from the process environment or a Workers-style `env` bag. `diffbotAsk` uses a 120 second client
  timeout when this package builds the client; a bundle that includes `diffbot_ask` shares that
  timeout.
- Examples: `examples/company-research` (tool-calling agent), `examples/manual-rag` (retrieve
  helpers, no tool loop), and `examples/worker` (Workers `env` bag and streamed RAG).
- `extractOptions` on `diffbotExtract`, `loadExtract`, and `streamExtract` passes the SDK's
  `ExtractOptions` (`timeout`, `mode`, `fields`, `fallback`, `discussion`, `paging`, …) through to
  `extract`. The tool's model-facing input schema is unchanged, and `api`/`fmt` defaults stay.
- Opt-in `download` on `loadCrawl` / `streamCrawl`: start the job without watching, poll it, and
  map the records from `crawlDownload` to documents (`defaultCrawlRecordMapper`). The default watch
  stream is unchanged.

### Changed

- Depends on `@diffbot/typescript` `^0.6.0` (cumulative 0.4.0–0.6.0). DQL is POST with a JSON body; the token stays the query parameter. Unit-test mocks already assert that body. The dev-only `.pnpmfile.cjs` sibling link is removed. Refresh `pnpm-lock.yaml` from the registry once 0.6.0 is on npm; do not commit a `link:` or `file:` override.
- `retrieveKnowledgeGraph` takes `nonCanonicalFacts` as a named boolean. Passing that key through `extra` throws, matching the SDK.
