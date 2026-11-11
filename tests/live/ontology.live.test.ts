import type { DiffbotClient } from "@diffbot/typescript";
import { diffbotOntology } from "../../src/tools/ontology.js";
import { toolExecOptions } from "../helpers/tool-exec.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("diffbotOntology (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => {
    client = makeClient();
  });

  it("lists entity types including Organization", async () => {
    const tool = diffbotOntology({ client });
    const out = await tool.execute!({ op: "types" }, toolExecOptions());
    expect(Array.isArray(out)).toBe(true);
    expect(out as string[]).toContain("Organization");
  });

  it("lists fields for Organization", async () => {
    const tool = diffbotOntology({ client });
    const out = await tool.execute!({ op: "fields", name: "Organization" }, toolExecOptions());
    expect(Array.isArray(out)).toBe(true);
    expect((out as string[]).length).toBeGreaterThan(0);
  });

  it("returns {error, hint} for a type that does not exist", async () => {
    const tool = diffbotOntology({ client });
    const out = await tool.execute!(
      { op: "fields", name: "NotARealEntityType" },
      toolExecOptions(),
    );
    expect(out).toMatchObject({ error: expect.any(String), hint: expect.any(String) });
  });
});
