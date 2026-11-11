# worker

A Cloudflare Worker that calls Diffbot with the request `env` bag, not `process.env`.

Two routes:

| Route                               | What it does                                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /search?q=…`                   | `retrieveWebSearch` with `k: 5` and `fields: ["title", "pageUrl", "date"]`. Responds with the shaped documents as JSON.                                                                    |
| `POST /ask` body `{"question":"…"}` | `streamText` on `createDiffbot({ env })("diffbot-small-xl")`, returned with `toTextStreamResponse()`. The abort deadline is 120 seconds, matching how long Diffbot's RAG call often takes. |

Any other path responds with 404 and the route list. An empty `q` or `question` responds with 400.

The answer is Diffbot's own RAG model, so this example does not use `AI_GATEWAY_API_KEY`,
`EXAMPLE_MODEL`, or `ANTHROPIC_API_KEY`. `diffbot-small-xl` rejects user-defined tools; this Worker
does not pass any. Streaming matters because the RAG endpoint routinely takes 15–30 seconds, and the
response can start before that finishes. The Worker's own wall-time limit still applies.

`wrangler.toml` sets `compatibility_flags = []`. The package does not need Node built-ins, and
leaving `nodejs_compat` off keeps a regression in that promise visible. The token is not a var in
that file.

## Environment

`DIFFBOT_API_TOKEN` is the only variable. The fetch handler passes `env` into `retrieveWebSearch`
and `createDiffbot`, and those read `env.DIFFBOT_API_TOKEN` when the request runs. A missing binding
fails that request. Loading the module does not.

Local dev reads `examples/worker/.dev.vars` (gitignored):

```bash
DIFFBOT_API_TOKEN=your-token
```

Deployed Workers read a secret:

```bash
pnpm dlx wrangler@4 secret put DIFFBOT_API_TOKEN
```

Wrangler prompts for the value. This repo's Workers check uses Wrangler 4 the same way
(`pnpm dlx wrangler@4`).

## Run

From the repo root, after `pnpm install`. Wrangler resolves `@diffbot/ai-sdk` through the package
`exports` to `dist/`, so build first. `pnpm typecheck:examples` checks `index.ts` against `src/` and
does not need the build, a token, or a Cloudflare account. `@ai-sdk/openai-compatible` has to be
installed because of the provider import; in this repo it is already a devDependency. Pair `@2` with
`ai@6` and `@3` with `ai@7`.

```bash
pnpm build
cd examples/worker
pnpm dlx wrangler@4 dev
```

Wrangler prints the local URL. The default port is 8787.

```bash
curl "http://127.0.0.1:8787/search?q=Diffbot"
curl -X POST http://127.0.0.1:8787/ask \
  -H "content-type: application/json" \
  -d '{"question":"Who acquired Figma?"}'
```

Deploy, after `wrangler secret put`:

```bash
pnpm dlx wrangler@4 deploy
```

Run Wrangler from `examples/worker`, so it picks up `wrangler.toml`.
