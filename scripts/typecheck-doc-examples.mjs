/*
  Compiles every documented code sample against this package's source
  (PLAN.md §6.1, §7.1f). Each sample becomes a module in .doc-examples/ and a
  single `tsc --noEmit` run typechecks the lot.

  The samples are left as written — no import rewriting — because a `paths`
  mapping points `@diffbot/ai-sdk` at src/. So the README and the registry
  `codeExample` are compiled with the import line a reader will actually copy,
  against the source in this commit rather than a published tarball.

  Needs no token and no network.
*/
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readDocExamples } from "./doc-examples.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, ".doc-examples");

const samples = readDocExamples();

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const sample of samples) {
  writeFileSync(resolve(OUT_DIR, `${sample.name}.ts`), sample.code, "utf8");
  console.log(`.doc-examples/${sample.name}.ts  <-  ${sample.source}`);
}

writeFileSync(
  resolve(OUT_DIR, "tsconfig.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        lib: ["ES2022"],
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        types: ["node"],
        baseUrl: "..",
        paths: {
          "@diffbot/ai-sdk": ["./src/index.ts"],
          "@diffbot/ai-sdk/provider": ["./src/provider.ts"],
        },
      },
      include: ["*.ts"],
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const tsc = spawnSync("pnpm", ["exec", "tsc", "-p", resolve(OUT_DIR, "tsconfig.json")], {
  cwd: ROOT,
  stdio: "inherit",
});

if (tsc.error) {
  console.error(tsc.error.message);
  process.exit(1);
}
if (tsc.status !== 0) {
  console.error(
    "\nA doc sample does not typecheck. Fix the doc it came from, not" +
      " .doc-examples/ — that directory is regenerated on every run.",
  );
  process.exit(tsc.status ?? 1);
}
console.log(`OK: ${samples.length} doc samples typecheck against src/.`);
