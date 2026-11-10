import { generateText, streamText } from "ai";
import { createDiffbot } from "../../src/provider.js";
import { hasToken, token } from "./helpers.js";

describe.skipIf(!hasToken)("createDiffbot (live)", () => {
  it("generateText resolves with non-empty text", async () => {
    const diffbot = createDiffbot({ apiKey: token });
    const { text } = await generateText({
      model: diffbot("diffbot-small-xl"),
      prompt: "What is Diffbot?",
    });
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  }, 120_000);

  it("streamText yields at least one text delta", async () => {
    const diffbot = createDiffbot({ apiKey: token });
    const stream = await streamText({
      model: diffbot("diffbot-small-xl"),
      prompt: "What is Diffbot?",
    });
    let deltas = 0;
    for await (const part of stream.textStream) {
      if (part.length > 0) deltas += 1;
    }
    expect(deltas).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
