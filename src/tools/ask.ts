import { ask, type DiffbotClient } from "@diffbot/typescript";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { type DiffbotAuth, createClientResolver } from "../client.js";

export const diffbotAskInputSchema = z.object({
  question: z.string().describe("Natural-language question for Diffbot's RAG LLM."),
});

export type DiffbotAskOptions = DiffbotAuth;

export function diffbotAsk(
  options?: DiffbotAskOptions,
): Tool<z.infer<typeof diffbotAskInputSchema>, string> {
  return createAskTool(options, createClientResolver(options));
}

/** Internal: lets `diffbotTools()` share one resolver across the bundle. */
export function createAskTool(
  options: DiffbotAskOptions | undefined,
  resolveClient: () => DiffbotClient,
): Tool<z.infer<typeof diffbotAskInputSchema>, string> {
  return tool({
    description:
      "Ask Diffbot's LLM a natural-language question. It answers using " +
      "Diffbot's Knowledge Graph and a live web search, returning a synthesized " +
      "answer with sources. Use for open-ended questions you can't express as a " +
      "precise Knowledge Graph (DQL) query.",
    inputSchema: diffbotAskInputSchema,
    execute: async (input) => {
      const client = resolveClient();
      const parts: string[] = [];
      for await (const chunk of ask(client, [{ role: "user", content: input.question }])) {
        parts.push(chunk);
      }
      return parts.join("");
    },
  });
}
