#!/usr/bin/env bash
# Workers-cleanliness check for the whole package (PLAN.md §6.1, §7.1e).
#
# Two steps, because the first alone proves less than it looks: with no
# `nodejs_compat` flag, `wrangler deploy --dry-run` happily leaves
# `import … from "node:fs"` in the bundle as an external, and only a real
# deploy fails on it. So the dry run is paired with a scan of its own output.
#
# The scan drives its alternation off `module.builtinModules`, so it catches
# both the prefixed form (`node:fs`) and the bare one (`fs`, `events`,
# `stream`) — the latter is still common in transitive dependencies and also
# survives wrangler's dry run untouched.
#
# Runtime-guarded dynamic lookups are allowed and must keep passing — `ai`
# calls `process.getBuiltinModule("node:dns")` behind an `isNodeRuntime()`
# check — which is why the scan matches import/require syntax rather than the
# module names on their own.
#
# Needs no Cloudflare account or credentials. `cd`s first because wrangler
# resolves `main` and `--outdir` relative to the config file.
set -euo pipefail

cd "$(dirname "$0")"
outdir=".wrangler/dry-run"
bundle="$outdir/index.js"

rm -rf "$outdir"
pnpm dlx wrangler@4 deploy --dry-run --outdir "$outdir"

if [ ! -f "$bundle" ]; then
  echo "wrangler produced no bundle at $(pwd)/$bundle" >&2
  exit 1
fi

# An unreadable bundle throws out of readFileSync and fails the check, rather
# than being mistaken for "no matches" the way `if grep …` was.
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { builtinModules } from "node:module";
  const src = readFileSync(process.argv[1], "utf8");
  const names = builtinModules.filter((n) => !n.startsWith("_")).map((n) => n.replace(/\//g, "\\/"));
  const re = new RegExp(
    String.raw`(?:\bfrom|\bimport|\brequire)\s*\(?\s*("|'"'"')(node:[\w/]+|(?:${names.join("|")})(?:\/[\w/]+)?)\1`,
    "g",
  );
  const hits = [...new Set([...src.matchAll(re)].map((m) => m[2]))];
  if (hits.length) {
    console.error("Worker bundle statically imports Node builtins: " + hits.join(", "));
    process.exit(1);
  }
  console.log("OK: worker bundle has no static Node builtin imports.");
' "$bundle"
