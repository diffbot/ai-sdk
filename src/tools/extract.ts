import {
  extract,
  ExtractionError,
  type DiffbotClient,
  type ExtractOptions,
  type JsonObject,
} from "@diffbot/typescript";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import { shapeExtractResponse, type ShapedExtractResponse } from "../documents.js";

export interface DiffbotExtractOptions extends DiffbotAuth {
  api?: string;
  fmt?: string;
  /**
   * Extra `@diffbot/typescript` extract options (`timeout`, `mode`, `fields`, `fallback`,
   * `discussion`, `paging`, `extra`, …) applied to every call. Set by the developer, not the
   * model; the tool's input schema is unchanged.
   */
  extractOptions?: ExtractOptions;
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
        const raw = (await extract(
          client,
          input.url,
          api,
          fmt,
          // `api` is a runtime string, so the per-API option union cannot be narrowed here.
          options?.extractOptions as Parameters<typeof extract<string>>[4],
        )) as JsonObject;
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
