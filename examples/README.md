# `@diffbot/ai-sdk` examples

Each directory is self-contained and reads its credentials from the environment
(see [`.env.example`](./.env.example)). Run the Node examples from the repo root
after `pnpm build`; `pnpm typecheck:examples` typechecks them all against `src/`.

| Example                                  | What it shows                                               |
| ---------------------------------------- | ----------------------------------------------------------- |
| [`company-research`](./company-research) | `diffbotTools()` + `generateText` / `streamText` agent loop |
| [`manual-rag`](./manual-rag)             | manual RAG with the retrieve/load helpers, no tool calling  |
| [`worker`](./worker)                     | Cloudflare Workers: `env`-bag auth, streamed Diffbot RAG    |
