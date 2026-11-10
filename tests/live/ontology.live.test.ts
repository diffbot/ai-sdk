import { diffbotOntology } from "../../src/tools/ontology.js";
import { toolExecOptions } from "../helpers/tool-exec.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("diffbotOntology (live)", () => {
  it("lists entity types including Organization", async () => {
    const client = makeClient();
    const tool = diffbotOntology({ client });
    const out = await tool.execute!({ op: "types" }, toolExecOptions());
    expect(Array.isArray(out)).toBe(true);
    expect(out as string[]).toContain("Organization");
  }, 120_000);

  it("lists fields for Organization", async () => {
    const client = makeClient();
    const tool = diffbotOntology({ client });
    const out = await tool.execute!({ op: "fields", name: "Organization" }, toolExecOptions());
    expect(Array.isArray(out)).toBe(true);
    expect((out as string[]).length).toBeGreaterThan(0);
  }, 120_000);
});
