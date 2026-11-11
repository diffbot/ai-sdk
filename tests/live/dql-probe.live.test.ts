import type { DiffbotClient } from "@diffbot/typescript";
import { diffbotDqlProbe } from "../../src/tools/dql-probe.js";
import { toolExecOptions } from "../helpers/tool-exec.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("diffbotDqlProbe (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => {
    client = makeClient();
  });

  it("returns numeric hit counts for two query variants, in input order", async () => {
    const queries = ["type:Organization", 'type:Organization name:"Diffbot"'];
    const tool = diffbotDqlProbe({ client });
    const out = (await tool.execute!({ queries }, toolExecOptions())) as {
      query: string;
      hits: unknown;
    }[];
    expect(out.map((row) => row.query)).toEqual(queries);
    for (const result of out) {
      expect(typeof result.hits).toBe("number");
    }
  });
});
