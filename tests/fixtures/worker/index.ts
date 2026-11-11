/*
  Not a test and not an example: a bundling fixture. `wrangler deploy --dry-run`
  bundles it for workerd with no compatibility flags (see dry-run.sh), so the
  package fails the check if anything it pulls in needs a Node builtin.

  It imports both public entry points as namespaces and enumerates them, which
  matters: with named imports esbuild tree-shakes everything the fixture does
  not call, and a `node:*` import inside an unreached module (crawl, say) would
  never reach the bundle. `Object.keys` on the namespace keeps every export —
  and therefore every module behind the barrel — live.

  Never deployed or executed. Excluded from the root tsconfig because the
  Workers globals below are not in this package's `lib`.
*/
import * as sdk from "../../../src/index.js";
import * as provider from "../../../src/provider.js";

interface Env extends Record<string, string | undefined> {
  DIFFBOT_API_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Tools and the provider resolve the token lazily from the env bag, so
    // constructing them is safe even when the binding is unset.
    const tools = sdk.diffbotTools({ env });
    const diffbot = provider.createDiffbot({ env });

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const docs = url ? await sdk.loadExtract({ env, urls: [url] }) : [];
    const results = url ? [] : await sdk.retrieveWebSearch({ env, query: "diffbot", k: 1 });

    return Response.json({
      exports: Object.keys(sdk).concat(Object.keys(provider)),
      toolKeys: Object.keys(tools),
      model: diffbot("diffbot-small-xl").modelId,
      docs: docs.length,
      results: results.length,
    });
  },
};
