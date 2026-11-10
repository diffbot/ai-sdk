import { ask, type DiffbotClient } from "@diffbot/typescript";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { type DiffbotAuth, createClientResolver } from "../client.js";

/** The RAG endpoint routinely runs 15–30 s; the SDK's 30 s client default is too tight. */
export const DEFAULT_ASK_TIMEOUT_MS = 120_000;

/**
 * Internal: default `timeout` to {@link DEFAULT_ASK_TIMEOUT_MS} when this package will build
 * the client. An injected client keeps its own timeout.
 */
export function withAskTimeout<T extends DiffbotAuth>(auth: T): T {
  if (auth.client || auth.timeout !== undefined) return auth;
  return { ...auth, timeout: DEFAULT_ASK_TIMEOUT_MS };
}

export const diffbotAskInputSchema = z.object({
  question: z.string().describe("Natural-language question for Diffbot's RAG LLM."),
});

export type DiffbotAskOptions = DiffbotAuth;

export function diffbotAsk(
  options?: DiffbotAskOptions,
): Tool<z.infer<typeof diffbotAskInputSchema>, string> {
  return createAskTool(options, createClientResolver(withAskTimeout(options ?? {})));
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
