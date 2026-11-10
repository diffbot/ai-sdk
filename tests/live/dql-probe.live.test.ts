import { diffbotDqlProbe } from "../../src/tools/dql-probe.js";
import { toolExecOptions } from "../helpers/tool-exec.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("diffbotDqlProbe (live)", () => {
  it("returns numeric hit counts for two query variants", async () => {
    const client = makeClient();
    const tool = diffbotDqlProbe({ client });
    const out = (await tool.execute!(
      {
        queries: ["type:Organization", 'type:Organization name:"Diffbot"'],
      },
      toolExecOptions(),
    )) as { query: string; hits: unknown }[];
    expect(out).toHaveLength(2);
    for (const result of out) {
      expect(typeof result.query).toBe("string");
      expect(typeof result.hits).toBe("number");
    }
  }, 120_000);
});
