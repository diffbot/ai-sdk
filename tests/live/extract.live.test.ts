import type { DiffbotClient } from "@diffbot/typescript";
import { diffbotExtract } from "../../src/tools/extract.js";
import type { ShapedExtractResponse } from "../../src/documents.js";
import { toolExecOptions } from "../helpers/tool-exec.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("diffbotExtract (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => {
    client = makeClient();
  });

  it("returns shaped content for an article URL", async () => {
    const url = "https://en.wikipedia.org/wiki/Knowledge_graph";
    const tool = diffbotExtract({ client });
    const out = (await tool.execute!({ url }, toolExecOptions())) as ShapedExtractResponse;

    expect(out).not.toHaveProperty("errorCode");
    expect(typeof out.content).toBe("string");
    expect(out.content.length).toBeGreaterThan(0);
    expect(typeof out.title).toBe("string");
    expect(typeof out.type).toBe("string");
  });
});
