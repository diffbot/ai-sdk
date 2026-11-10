import type { DiffbotClient } from "@diffbot/typescript";
import { diffbotWebSearch } from "../../src/tools/web-search.js";
import { toolExecOptions } from "../helpers/tool-exec.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("diffbotWebSearch (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => {
    client = makeClient();
  });

  it("returns an array of results with pageUrl", async () => {
    const tool = diffbotWebSearch({ client, numResults: 3 });
    const out = await tool.execute!({ query: "Diffbot knowledge graph" }, toolExecOptions());
    expect(Array.isArray(out)).toBe(true);
    const rows = out as unknown[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty("pageUrl");
    }
  }, 120_000);
});
