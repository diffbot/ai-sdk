import { dql, type DiffbotClient, type JsonObject } from "@diffbot/typescript";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { type DiffbotAuth, createClientResolver } from "../client.js";

export interface DiffbotKnowledgeGraphOptions extends DiffbotAuth {
  size?: number;
  from?: number;
  filter?: string;
}

export const diffbotKnowledgeGraphInputSchema = z.object({
  query: z.string().describe('DQL query, e.g. `type:Organization name:"Diffbot"`.'),
  size: z.number().int().min(1).max(100).optional().describe("Max results."),
  from: z.number().int().min(0).optional().describe("Result offset."),
  filter: z.string().optional().describe("Optional DQL filter expression."),
});

export function diffbotKnowledgeGraph(
  options?: DiffbotKnowledgeGraphOptions,
  sharedResolver?: () => DiffbotClient,
): Tool<z.infer<typeof diffbotKnowledgeGraphInputSchema>, JsonObject> {
  const resolveClient = sharedResolver ?? createClientResolver(options);

  return tool({
    description:
      "Query the Diffbot Knowledge Graph with a DQL expression " +
      '(e.g. `type:Organization location.city.name:"Boston"`). ' +
      "Returns the raw response — use only if you know DQL syntax.",
    inputSchema: diffbotKnowledgeGraphInputSchema,
    execute: async (input) => {
      const client = resolveClient();
      const size = input.size ?? options?.size ?? 10;
      const from = input.from ?? options?.from ?? 0;
      const filter = input.filter ?? options?.filter;

      const body = await dql(client, input.query, {
        size,
        from,
        ...(filter !== undefined ? { filter } : {}),
      });

      if (body instanceof Uint8Array) {
        throw new Error("Unexpected non-JSON DQL response.");
      }
      if (typeof body !== "object" || body === null) {
        throw new Error("Unexpected non-JSON DQL response.");
      }
      return body as JsonObject;
    },
  });
}
