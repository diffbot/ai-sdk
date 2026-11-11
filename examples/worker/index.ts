/*
  Cloudflare Workers example: Diffbot retrieval and Diffbot's own RAG model,
  with no Node builtins anywhere in the bundle.

  Two things make this Workers-shaped rather than Node-shaped:

    * the token comes from the `env` bag, not `process.env` — every factory
      here takes `env` and resolves the token per request, so an isolate with
      no binding set fails the request, never the module load;
    * the answer route streams, so the response starts before the RAG
      endpoint (routinely 15–30 s) has finished.

  Routes:
    GET  /search?q=…   → shaped web-search documents as JSON
    POST /ask  {"question":"…"} → a streamed answer from diffbot-small-xl

  Deploy:
    wrangler secret put DIFFBOT_API_TOKEN
    wrangler deploy
*/
import { streamText } from "ai";
import { retrieveWebSearch } from "@diffbot/ai-sdk";
import { createDiffbot } from "@diffbot/ai-sdk/provider";

/* Workers-style env bag. `extends Record<…>` so it can be handed straight to
   the factories, which accept any string bag. */
interface Env extends Record<string, string | undefined> {
  DIFFBOT_API_TOKEN?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/search") {
      const query = url.searchParams.get("q");
      if (!query) return json({ error: "pass ?q=" }, 400);

      const docs = await retrieveWebSearch({
        env,
        query,
        k: 5,
        fields: ["title", "pageUrl", "date"],
      });
      return json(docs);
    }

    if (url.pathname === "/ask" && request.method === "POST") {
      const body: unknown = await request.json();
      const question =
        typeof body === "object" && body !== null && "question" in body
          ? String((body as { question: unknown }).question)
          : "";
      if (!question) return json({ error: 'post {"question": "…"}' }, 400);

      const diffbot = createDiffbot({ env });
      const result = streamText({
        model: diffbot("diffbot-small-xl"),
        prompt: question,
        /* The platform's own limit still applies; this just keeps a stalled
           upstream from holding the isolate for the full invocation budget. */
        abortSignal: AbortSignal.timeout(120_000),
      });
      return result.toTextStreamResponse();
    }

    return json({ routes: ["GET /search?q=…", 'POST /ask {"question":"…"}'] }, 404);
  },
};
