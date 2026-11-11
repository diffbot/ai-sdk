# Changelog

## 0.1.0 — Unreleased

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
