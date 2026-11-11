# company-research

A one-shot company-research agent. It hands an AI SDK model four Diffbot tools and lets that model
run the loop: look up the Knowledge Graph ontology, query the graph, search the web, and extract a
page it found. When the loop stops, the script prints the answer, then the entity IDs and URLs the
tools actually returned, so a claim in the answer can be traced to Diffbot data.

The tools come from `diffbotTools({ only: [...] })`, which shares one client:

- `diffbot_ontology`
- `diffbot_knowledge_graph`
- `diffbot_web_search`
- `diffbot_extract`

`generateText` runs the loop. `--stream` switches the same call to `streamText` and writes tokens as
they arrive. Either way the stop condition is `stopWhen: stepCountIs(8)`.

After the answer, a `--- tools used:` line lists the tool names that returned something. Each
citation follows: values that start with `http` are printed as-is, and other ids are printed as
`https://app.diffbot.com/entity/<id>`.

## Environment

Copy [`../.env.example`](../.env.example) to `examples/.env` (gitignored) and set:

| Variable             | Required | Role                                                                                                                   |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DIFFBOT_API_TOKEN`  | yes      | Read by this package when a tool runs. The script exits immediately if it is unset.                                    |
| `AI_GATEWAY_API_KEY` | yes      | Read by the Vercel AI Gateway, not by this file. The default model id `anthropic/claude-sonnet-5` is a gateway string. |
| `EXAMPLE_MODEL`      | no       | Replaces that model id. Any string `generateText` / `streamText` accepts.                                              |
| `ANTHROPIC_API_KEY`  | no       | Not read here. Set it only if you change the script to a direct `@ai-sdk/anthropic` model.                             |

The script checks `DIFFBOT_API_TOKEN` and nothing else. A missing gateway key fails later, inside
the AI SDK call.

## Run

From the repo root, after `pnpm install`. Runtime imports resolve to `dist/`, so build first.
`pnpm typecheck:examples` checks this file against `src/` and does not need the build or a token.

```bash
pnpm build
node --env-file-if-exists=examples/.env examples/company-research/index.ts "Who acquired Figma?"
```

With no question argument the prompt is: "Which Boston AI companies raised a Series B this year, and
from whom?"

Stream the answer:

```bash
node --env-file-if-exists=examples/.env examples/company-research/index.ts --stream "Who acquired Figma?"
```

`--stream` may sit before or after the question. Any argument that starts with `--` is dropped from
the question text.
