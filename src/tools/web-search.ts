import {
  webSearch,
  type DiffbotClient,
  type JsonObject,
  type SnippetLength,
} from "@diffbot/typescript";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { type DiffbotAuth, createClientResolver } from "../client.js";

const snippetEnum = z.enum(["short", "medium", "long", "full"] as const);

export interface DiffbotWebSearchOptions extends DiffbotAuth {
  numResults?: number;
  maxTokens?: number;
  snippetLength?: SnippetLength;
}

export const diffbotWebSearchInputSchema = z.object({
  query: z.string().describe("Natural-language search query."),
  numResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Max results to return. Server default if unset."),
  snippetLength: snippetEnum
    .optional()
    .describe("Snippet length preset for each result's content."),
});

export function diffbotWebSearch(
  options?: DiffbotWebSearchOptions,
): Tool<z.infer<typeof diffbotWebSearchInputSchema>, JsonObject[]> {
  return createWebSearchTool(options, createClientResolver(options));
}

/** Internal: lets `diffbotTools()` share one resolver across the bundle. */
export function createWebSearchTool(
  options: DiffbotWebSearchOptions | undefined,
  resolveClient: () => DiffbotClient,
): Tool<z.infer<typeof diffbotWebSearchInputSchema>, JsonObject[]> {
  return tool({
    description:
      "Search the web via Diffbot. Returns a list of results, each with " +
      "title, pageUrl, score, and content.",
    inputSchema: diffbotWebSearchInputSchema,
    execute: async (input) => {
      const client = resolveClient();
      const numResults = input.numResults ?? options?.numResults;
      const snippetLength = input.snippetLength ?? options?.snippetLength;

      const body = await webSearch(client, input.query, {
        ...(numResults !== undefined ? { numResults } : {}),
        ...(options?.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
        ...(snippetLength !== undefined ? { snippetLength } : {}),
      });

      const results = body.search_results;
      return Array.isArray(results) ? (results as JsonObject[]) : [];
    },
  });
}
