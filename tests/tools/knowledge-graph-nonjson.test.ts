import { vi } from "vitest";

const mockDql = vi.hoisted(() => vi.fn());

vi.mock("@diffbot/typescript", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return Object.assign({}, mod, { dql: mockDql });
});

import { diffbotKnowledgeGraph } from "../../src/tools/knowledge-graph.js";
import { describe, expect, it } from "vitest";
import { toolExecOptions } from "../helpers/tool-exec.js";

describe("diffbotKnowledgeGraph non-JSON body", () => {
  it("throws when the response is a Uint8Array", async () => {
    mockDql.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const tool = diffbotKnowledgeGraph({ apiKey: "test-token" });
    await expect(tool.execute!({ query: "type:Organization" }, toolExecOptions())).rejects.toThrow(
      "Unexpected non-JSON DQL response.",
    );
  });
});
