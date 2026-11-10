import { diffbotAsk } from "../../src/tools/ask.js";
import { toolExecOptions } from "../helpers/tool-exec.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("diffbotAsk (live)", () => {
  it("returns a non-empty synthesized answer", async () => {
    const client = makeClient();
    const tool = diffbotAsk({ client });
    const out = (await tool.execute!(
      { question: "What is Diffbot?" },
      toolExecOptions(),
    )) as string;
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  }, 120_000);
});
