/*
  Pins docs/registry-entry.md — the draft of the tools-registry entry we submit
  to vercel/ai (PLAN.md §7.5) — to this package. `pnpm typecheck:docs` already
  compiles its `codeExample`; what is left is the part a compiler cannot see:
  the install commands, the env var name, and the model id, all of which are
  strings a reviewer reads and a user pastes.
*/
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REGISTRY_ENTRY_PATH, registryCodeExample } from "../scripts/doc-examples.mjs";
import * as mod from "../src/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const README = readFileSync(resolve(ROOT, "README.md"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
  name: string;
};

const ENTRY = readFileSync(REGISTRY_ENTRY_PATH, "utf8");
const CODE_EXAMPLE = registryCodeExample(ENTRY);

function field(name: string): string | undefined {
  return new RegExp(`\\b${name}:\\s*["']([^"']+)["']`).exec(ENTRY)?.[1];
}

describe("tools-registry entry", () => {
  it("installs the package these tools actually come from", () => {
    expect(field("packageName")).toBe(pkg.name);

    const installCommands = [...ENTRY.matchAll(/^\s+(pnpm|npm|yarn|bun):\s*"([^"]+)"/gm)].map(
      ([, manager, command]) => ({ manager: manager!, command: command! }),
    );
    expect(installCommands.map((entry) => entry.manager)).toEqual(["pnpm", "npm", "yarn", "bun"]);
    for (const { manager, command } of installCommands) {
      expect(command.startsWith(manager)).toBe(true);
      expect(command.endsWith(` ${pkg.name}`)).toBe(true);
    }
  });

  it("names the one env var this package reads", () => {
    expect(field("apiKeyEnvName")).toBe("DIFFBOT_API_TOKEN");
  });

  it("imports only names the barrel exports", () => {
    const imports = [...CODE_EXAMPLE.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)];
    expect(imports.length).toBeGreaterThan(0);

    for (const [, names, specifier] of imports) {
      const imported = names!.split(",").map((name) => name.trim().replace(/^type\s+/, ""));
      if (specifier === "@diffbot/ai-sdk") {
        expect(Object.keys(mod)).toEqual(expect.arrayContaining(imported));
      } else {
        /* The only other import a one-file registry example may carry: the
           peer the reader already has. Anything else would make the entry's
           single `installCommand` a lie. */
        expect(specifier).toBe("ai");
      }
    }
  });

  it("uses stepCountIs, which exists in both supported `ai` majors", () => {
    expect(CODE_EXAMPLE).toContain("stepCountIs(");
    expect(CODE_EXAMPLE).not.toMatch(/isStepCount/);
  });

  it("shows the same model id as the README, so the docs cannot disagree", () => {
    const model = /model:\s*["']([^"']+)["']/.exec(CODE_EXAMPLE)?.[1];
    expect(model).toBeTruthy();
    expect(README).toContain(model!);
  });
});
