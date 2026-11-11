/*
  Not a test and not an example: a bundling fixture. It imports every public
  entry point of the package — the barrel and the ./provider subpath — and
  touches the paths a Worker would, so `wrangler deploy --dry-run` fails if any
  of them (or anything they pull in) needs a Node builtin. It is never deployed
  or executed, and it is excluded from the root tsconfig because the Workers
  globals it uses are not in this package's `lib`.
*/
import { diffbotTools, loadExtract, retrieveWebSearch } from "../../../src/index.js";
import { createDiffbot } from "../../../src/provider.js";

interface Env extends Record<string, string | undefined> {
  DIFFBOT_API_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Tools and the provider resolve the token lazily from the env bag, so
    // constructing them is safe even when the binding is unset.
    const tools = diffbotTools({ env });
    const diffbot = createDiffbot({ env });

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const docs = url ? await loadExtract({ env, urls: [url] }) : [];
    const results = url ? [] : await retrieveWebSearch({ env, query: "diffbot", k: 1 });

    return Response.json({
      toolKeys: Object.keys(tools),
      model: diffbot("diffbot-small-xl").modelId,
      docs: docs.length,
      results: results.length,
    });
  },
};
