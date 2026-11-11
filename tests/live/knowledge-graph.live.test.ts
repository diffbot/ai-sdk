import type { DiffbotClient, JsonObject } from "@diffbot/typescript";
import { diffbotKnowledgeGraph } from "../../src/tools/knowledge-graph.js";
import { toolExecOptions } from "../helpers/tool-exec.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("diffbotKnowledgeGraph (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => {
    client = makeClient();
  });

  it("returns a raw DQL body whose data honours the requested size", async () => {
    const tool = diffbotKnowledgeGraph({ client });
    const body = (await tool.execute!(
      { query: 'type:Organization name:"Diffbot"', size: 2 },
      toolExecOptions(),
    )) as JsonObject;

    expect(Array.isArray(body.data)).toBe(true);
    const data = body.data as JsonObject[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.length).toBeLessThanOrEqual(2);
    expect(typeof data[0]!.entity).toBe("object");
  });
});
