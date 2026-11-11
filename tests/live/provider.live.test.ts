import { generateText, streamText } from "ai";
import { createDiffbot, type DiffbotProvider } from "../../src/provider.js";
import { hasToken } from "./helpers.js";

/* `createDiffbot()` with no `apiKey` exercises the documented zero-config path:
   DIFFBOT_API_TOKEN is read lazily, on the request. */
describe.skipIf(!hasToken)("createDiffbot (live)", () => {
  let diffbot: DiffbotProvider;
  beforeAll(() => {
    diffbot = createDiffbot();
  });

  it("generateText resolves with non-empty text", async () => {
    const { text } = await generateText({
      model: diffbot("diffbot-small-xl"),
      prompt: "What is Diffbot?",
    });
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("streamText yields at least one text delta", async () => {
    const stream = streamText({
      model: diffbot("diffbot-small-xl"),
      prompt: "What is Diffbot?",
    });
    let deltas = 0;
    for await (const part of stream.textStream) {
      if (part.length > 0) deltas += 1;
    }
    expect(deltas).toBeGreaterThanOrEqual(1);
  });
});
