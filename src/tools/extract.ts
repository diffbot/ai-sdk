import { extract, ExtractionError, type DiffbotClient, type JsonObject } from "@diffbot/typescript";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import { shapeExtractResponse, type ShapedExtractResponse } from "../documents.js";

export interface DiffbotExtractOptions extends DiffbotAuth {
  api?: string;
  fmt?: string;
}

export interface DiffbotExtractToolError {
  error: string;
  errorCode: number;
}

export type DiffbotExtractToolOutput = ShapedExtractResponse | DiffbotExtractToolError;

const inputSchema = z.object({
  url: z.string().describe("URL to extract structured content from."),
  api: z
    .string()
    .optional()
    .describe("Diffbot extract API to call. Defaults to `analyze` (auto-detects content type)."),
  fmt: z
    .string()
    .optional()
    .describe("Output format. `markdown` uses Diffbot's LLM-optimized mode."),
});

export function diffbotExtract(
  options?: DiffbotExtractOptions,
): Tool<z.infer<typeof inputSchema>, DiffbotExtractToolOutput> {
  return createExtractTool(options, createClientResolver(options));
}

/** Internal: lets `diffbotTools()` share one resolver across the bundle. */
export function createExtractTool(
  options: DiffbotExtractOptions | undefined,
  resolveClient: () => DiffbotClient,
): Tool<z.infer<typeof inputSchema>, DiffbotExtractToolOutput> {
  return tool({
    description:
      "Extract structured content (title, text, type, resolved URL) from a " +
      "single web page. Use for reading the contents of a known URL.",
    inputSchema,
    execute: async (input) => {
      const client = resolveClient();
      const api = input.api ?? options?.api ?? "analyze";
      const fmt = input.fmt ?? options?.fmt ?? "markdown";

      try {
        const raw = (await extract(client, input.url, api, fmt)) as JsonObject;
        return shapeExtractResponse(raw);
      } catch (e) {
        if (e instanceof ExtractionError) {
          return { error: e.message, errorCode: e.errorCode };
        }
        throw e;
      }
    },
  });
}
