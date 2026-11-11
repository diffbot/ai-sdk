/*
  One source of truth for "which code samples do the docs claim work".

  Two consumers read it: typecheck-doc-examples.mjs compiles every sample
  against src/ (ci.yml job f), and tests/readme-examples.test.ts executes the
  subset that needs no model provider against a stubbed fetch. Plain .mjs with
  a hand-written doc-examples.d.mts so both — a Node script and a TypeScript
  test — can import the same extractor.
*/
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const README_PATH = resolve(ROOT, "README.md");
export const REGISTRY_ENTRY_PATH = resolve(ROOT, "docs/registry-entry.md");

function tsBlocks(markdown) {
  return [...markdown.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1]);
}

/**
 * The `codeExample` string from the registry-entry draft, verbatim — the exact
 * string the PR to `vercel/ai` carries. Template-literal contents, so Prettier
 * never reformats it and a drifted import shows up as a compile error.
 */
export function registryCodeExample(markdown) {
  const source = markdown ?? readFileSync(REGISTRY_ENTRY_PATH, "utf8");
  // The example contains no backtick of its own, so the first one closes it.
  const match = /codeExample:\s*`([^`]*)`/.exec(source);
  if (!match) {
    throw new Error("docs/registry-entry.md has no `codeExample` template literal");
  }
  return match[1];
}

/** Every documented sample, in document order: README blocks, then the registry entry. */
export function readDocExamples() {
  const registry = readFileSync(REGISTRY_ENTRY_PATH, "utf8");
  const entryBlocks = tsBlocks(registry);
  if (entryBlocks.length !== 1) {
    throw new Error(
      `docs/registry-entry.md should hold exactly one ts block, found ${entryBlocks.length}`,
    );
  }

  return [
    ...tsBlocks(readFileSync(README_PATH, "utf8")).map((code, index) => ({
      name: `readme-${String(index + 1).padStart(2, "0")}`,
      source: "README.md",
      code,
    })),
    { name: "registry-entry", source: "docs/registry-entry.md", code: entryBlocks[0] },
    {
      name: "registry-code-example",
      source: "docs/registry-entry.md (codeExample)",
      code: registryCodeExample(registry),
    },
  ];
}

/**
 * True when a sample calls the AI SDK, which needs a model provider and a key
 * we deliberately do not have in CI. Those samples are typechecked only; the
 * rest also run against a stubbed fetch.
 */
export function needsLlm(code) {
  return /\bfrom ["']ai["']/.test(code);
}
