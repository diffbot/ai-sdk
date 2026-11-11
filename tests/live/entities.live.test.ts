import type { DiffbotClient } from "@diffbot/typescript";
import { diffbotEntities } from "../../src/tools/entities.js";
import { toolExecOptions } from "../helpers/tool-exec.js";
import { hasToken, makeClient } from "./helpers.js";

describe.skipIf(!hasToken)("diffbotEntities (live)", () => {
  let client: DiffbotClient;
  beforeAll(() => {
    client = makeClient();
  });

  it("identifies entities in a sentence naming a well-known organization", async () => {
    const tool = diffbotEntities({ client });
    const out = (await tool.execute!(
      { text: "Diffbot is a company based in California." },
      toolExecOptions(),
    )) as { entities?: unknown[] };
    expect(Array.isArray(out.entities)).toBe(true);
    expect(out.entities!.length).toBeGreaterThan(0);
  });
});
