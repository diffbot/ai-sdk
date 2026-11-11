#!/usr/bin/env bash
# Workers-cleanliness check for the whole package (PLAN.md §6.1, §7.1e).
#
# Two steps, because the first alone proves less than it looks: with no
# `nodejs_compat` flag, `wrangler deploy --dry-run` happily leaves
# `import … from "node:fs"` in the bundle as an external, and only a real
# deploy fails on it. So the dry run is paired with a scan of its own output.
#
# Runtime-guarded dynamic lookups are allowed and must keep passing — `ai`
# calls `process.getBuiltinModule("node:dns")` behind an `isNodeRuntime()`
# check — which is why the scan matches import/require syntax, not the bare
# `node:` string.
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

if matches=$(grep -nE '(from|import|require)[[:space:]]*\(?[[:space:]]*("|'\'')node:' "$bundle"); then
  echo "Worker bundle statically imports Node builtins:" >&2
  echo "$matches" | cut -c1-200 >&2
  exit 1
fi

echo "OK: worker bundle has no static Node builtin imports."
