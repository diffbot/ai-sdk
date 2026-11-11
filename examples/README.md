# `@diffbot/ai-sdk` examples

Three programs, each runnable from a checkout of this repo. They import `@diffbot/ai-sdk`, which
resolves to `dist/` at runtime, so build once before `node` or Wrangler. `pnpm typecheck:examples`
checks them against `src/` and does not need a token or a build.

```bash
pnpm install
pnpm build
cp examples/.env.example examples/.env
```

Fill in `examples/.env`. The file is gitignored. Node 20+ can load it with `--env-file-if-exists`:

```bash
node --env-file-if-exists=examples/.env examples/company-research/index.ts
```

| Variable             | Who reads it                                                                                                     | When                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `DIFFBOT_API_TOKEN`  | This package, when a tool, retriever, or `createDiffbot` call runs                                               | Every example                                                         |
| `AI_GATEWAY_API_KEY` | The Vercel AI Gateway. The default model string `anthropic/claude-sonnet-5` routes through it                    | `company-research`, and `manual-rag` unless you pass `--context-only` |
| `EXAMPLE_MODEL`      | The two Node examples, as the `model` passed to `generateText` / `streamText`                                    | Optional. Unset means `anthropic/claude-sonnet-5`                     |
| `ANTHROPIC_API_KEY`  | Not read by these files. Present in `.env.example` for a direct `@ai-sdk/anthropic` model if you change the code | Optional                                                              |

The Worker does not use the gateway. Its token is a Wrangler secret or `examples/worker/.dev.vars`,
described in [`worker/README.md`](./worker/README.md).

| Example                                  | What it shows                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`company-research`](./company-research) | One-shot agent: ontology, Knowledge Graph, web search, and extract. Prints the answer plus citations. |
| [`manual-rag`](./manual-rag)             | You choose the retrieval. KG rows, web snippets, and two extracted pages become one prompt.           |
| [`worker`](./worker)                     | Cloudflare Workers: `env`-bag auth, `GET /search`, streamed `POST /ask` from `diffbot-small-xl`.      |

Peers `ai` and (for the Worker) `@ai-sdk/openai-compatible` are devDependencies of this repo.
Copying an example into another app means installing those peers yourself. Match
`@ai-sdk/openai-compatible` to your `ai` major: `@2` with `ai@6`, `@3` with `ai@7`.
