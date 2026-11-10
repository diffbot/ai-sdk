import { entities, type DiffbotClient, type JsonObject } from "@diffbot/typescript";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { type DiffbotAuth, createClientResolver } from "../client.js";

export const diffbotEntitiesInputSchema = z.object({
  text: z.string().describe("Text to extract entities and sentiment from."),
  lang: z
    .string()
    .optional()
    .describe("Language hint (`auto` to detect). Server default if unset."),
});

export interface DiffbotEntitiesOptions extends DiffbotAuth {
  lang?: string;
}

export function diffbotEntities(
  options?: DiffbotEntitiesOptions,
): Tool<z.infer<typeof diffbotEntitiesInputSchema>, JsonObject> {
  return createEntitiesTool(options, createClientResolver(options));
}

/** Internal: lets `diffbotTools()` share one resolver across the bundle. */
export function createEntitiesTool(
  options: DiffbotEntitiesOptions | undefined,
  resolveClient: () => DiffbotClient,
): Tool<z.infer<typeof diffbotEntitiesInputSchema>, JsonObject> {
  return tool({
    description:
      "Identify entities (people, organizations, places, ...) and sentiment " +
      "in a piece of text. Returns entity IDs that can be looked up in the " +
      "Diffbot Knowledge Graph.",
    inputSchema: diffbotEntitiesInputSchema,
    execute: async (input) => {
      const client = resolveClient();
      const lang = input.lang ?? options?.lang ?? "auto";
      return entities(client, input.text, lang);
    },
  });
}
