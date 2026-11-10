import { dqlParallel, type DiffbotClient } from "@diffbot/typescript";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { type DiffbotAuth, createClientResolver } from "../client.js";

export const diffbotDqlProbeInputSchema = z.object({
  queries: z
    .array(z.string())
    .describe("DQL query variants to probe. Each is run with size=0 (hit count only)."),
  workers: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Max concurrent requests. Server default if unset."),
});

export interface DqlProbeResult {
  query: string;
  hits: unknown;
}

export interface DiffbotDqlProbeOptions extends DiffbotAuth {
  workers?: number;
}

export function diffbotDqlProbe(
  options?: DiffbotDqlProbeOptions,
): Tool<z.infer<typeof diffbotDqlProbeInputSchema>, DqlProbeResult[]> {
  return createDqlProbeTool(options, createClientResolver(options));
}

/** Internal: lets `diffbotTools()` share one resolver across the bundle. */
export function createDqlProbeTool(
  options: DiffbotDqlProbeOptions | undefined,
  resolveClient: () => DiffbotClient,
): Tool<z.infer<typeof diffbotDqlProbeInputSchema>, DqlProbeResult[]> {
  return tool({
    description:
      "Probe one or more DQL query variants in parallel and get the hit count " +
      "for each (size=0, no entity data). Use to validate that a query is " +
      "well-shaped — not matching zero results or millions — before running it.",
    inputSchema: diffbotDqlProbeInputSchema,
    execute: async (input) => {
      const queries = input.queries;
      if (queries.length === 0) {
        return [];
      }

      const client = resolveClient();
      const workers = input.workers ?? options?.workers ?? 8;

      const results = await dqlParallel(
        client,
        queries.map((query) => ({ query, size: 0 })),
        workers,
      );

      return queries.map((query, i): DqlProbeResult => {
        const result = results[i];
        const hits: unknown =
          result && typeof result === "object" && !(result instanceof Uint8Array)
            ? ((result as Record<string, unknown>).hits ?? null)
            : null;
        return { query, hits };
      });
    },
  });
}
