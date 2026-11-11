# manual-rag

Manual RAG with the retrieve and load helpers. There is no tool and no agent loop. The script
decides what is retrieved, builds one prompt from that context, and calls `generateText` once.

1. `retrieveKnowledgeGraph` — up to three `Organization` entities whose name matches the company
   (`strict:name`), shaped down to `id`, `name`, `description`, `homepageUri`, `nbEmployees`, and
   `location`.
2. `retrieveWebSearch` — five results for `"<company> funding, products and leadership"`,
   `snippetLength: "medium"`.
3. `loadExtract` — markdown for the first two `pageUrl`s from that search. No pages are extracted
   when the search has no URLs.
4. `generateText` — one answer over that context. The system prompt tells the model to cite the
   `[kg-N]` / `[web-N]` / `[page-N]` tags and to say when the context does not contain the answer.

The question is fixed: "What does \<company\> do, and what has it been in the news for recently?"
The company name is the argument, and it defaults to `Diffbot`.

Stderr prints how many KG entities, web results, and pages were retrieved, and how many characters
of context that produced. That count is there so you can see the size of the prompt the helpers
built.

`--context-only` stops after step 3, prints the context, and exits. That path never calls a model.

## Environment

Copy [`../.env.example`](../.env.example) to `examples/.env` (gitignored).

| Variable             | Required                     | Role                                                                                                  |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DIFFBOT_API_TOKEN`  | yes                          | Read by the helpers when they run. The script exits immediately if it is unset.                       |
| `AI_GATEWAY_API_KEY` | yes, unless `--context-only` | Read by the Vercel AI Gateway, not by this file. The default model id is `anthropic/claude-sonnet-5`. |
| `EXAMPLE_MODEL`      | no                           | Replaces that model id for the `generateText` call.                                                   |
| `ANTHROPIC_API_KEY`  | no                           | Not read here. Set it only if you change the script to a direct `@ai-sdk/anthropic` model.            |

## Run

From the repo root, after `pnpm install`. Runtime imports resolve to `dist/`, so build first.
`pnpm typecheck:examples` checks this file against `src/` and does not need the build or a token.

Context only, Diffbot token and no model key:

```bash
pnpm build
node --env-file-if-exists=examples/.env examples/manual-rag/index.ts --context-only "Diffbot"
```

Full answer:

```bash
node --env-file-if-exists=examples/.env examples/manual-rag/index.ts "Diffbot"
```

With no company argument the subject is `Diffbot`. `--context-only` may sit before or after the
name. Any argument that starts with `--` is dropped from the company string.
