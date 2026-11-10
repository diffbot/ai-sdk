import { Ontology, OntologyStore, type DiffbotClient } from "@diffbot/typescript";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { type DiffbotAuth, createClientResolver } from "../client.js";

const opEnum = z.enum([
  "types",
  "composites",
  "enums",
  "taxonomies",
  "fields",
  "taxonomy",
  "enum",
  "search",
] as const);

export const diffbotOntologyInputSchema = z.object({
  op: opEnum.describe(
    "Which part of the ontology to inspect: `types`/`composites`/`enums`/" +
      "`taxonomies` list names; `fields` lists the fields of a type or " +
      "composite; `taxonomy`/`enum` list a named taxonomy's/enum's values; " +
      "`search` matches any name anywhere in the ontology by regex.",
  ),
  name: z
    .string()
    .optional()
    .describe(
      "Target name for `fields` (a type/composite), `taxonomy`, or `enum`; " +
        "the regex pattern for `search`. Unused by the list ops.",
    ),
  search: z
    .string()
    .optional()
    .describe("Optional case-insensitive regex to filter `fields` or `taxonomy` results."),
  refresh: z
    .boolean()
    .optional()
    .describe(
      "Discard the cached ontology and re-fetch it before running this op. " +
        "The ontology changes rarely; leave this unset unless a previous " +
        "answer looks stale.",
    ),
});

export interface OntologyLookupError {
  error: string;
  hint: string;
}

export type OntologyLookupResult = string[] | OntologyLookupError;

const HINT =
  "Valid ops: types, composites, enums, taxonomies, fields, " +
  "taxonomy, enum, search. List names first (e.g. op='types') " +
  "before drilling into fields/taxonomy/enum.";

function ontologyLookup(
  ont: Ontology,
  op: string,
  name: string | undefined,
  search: string | undefined,
): OntologyLookupResult {
  try {
    switch (op) {
      case "types":
        return ont.types();
      case "composites":
        return ont.composites();
      case "enums":
        return ont.enums();
      case "taxonomies":
        return ont.taxonomies();
      case "fields": {
        if (!name) {
          throw new Error("op='fields' requires `name` (the entity type or composite).");
        }
        const fields = ont.fieldsFor(name);
        return Ontology.filterFields(fields, search).map(([n, m]) => Ontology.formatField(n, m));
      }
      case "taxonomy": {
        if (!name) {
          throw new Error("op='taxonomy' requires `name` (the taxonomy).");
        }
        return ont.taxonomyValues(name, search);
      }
      case "enum": {
        if (!name) {
          throw new Error("op='enum' requires `name` (the enum).");
        }
        return ont.enumValues(name);
      }
      case "search": {
        if (!name) {
          throw new Error("op='search' requires `name` (the regex to match).");
        }
        return ont.findNamed(name);
      }
      default:
        throw new Error(`Unknown op '${op}'.`);
    }
  } catch (exc) {
    return {
      error: exc instanceof Error ? exc.message : String(exc),
      hint: HINT,
    };
  }
}

export interface DiffbotOntologyOptions extends DiffbotAuth {
  ontologyStore?: OntologyStore;
}

export function diffbotOntology(
  options?: DiffbotOntologyOptions,
): Tool<z.infer<typeof diffbotOntologyInputSchema>, OntologyLookupResult> {
  return createOntologyTool(options, createClientResolver(options));
}

/** Internal: lets `diffbotTools()` share one resolver across the bundle. */
export function createOntologyTool(
  options: DiffbotOntologyOptions | undefined,
  resolveClient: () => DiffbotClient,
): Tool<z.infer<typeof diffbotOntologyInputSchema>, OntologyLookupResult> {
  let defaultStore: OntologyStore | undefined;

  return tool({
    description:
      "Inspect the Diffbot Knowledge Graph schema to build valid DQL. Ops: " +
      "`types`/`composites`/`enums`/`taxonomies` (list names), `fields` " +
      "(fields of a type/composite — pass `name`), `taxonomy`/`enum` (values " +
      "of a named taxonomy/enum — pass `name`), `search` (regex over all " +
      "names — pass the pattern as `name`). Look fields up here before " +
      "writing a DQL query.",
    inputSchema: diffbotOntologyInputSchema,
    execute: async (input) => {
      const client = resolveClient();
      const store = options?.ontologyStore ?? (defaultStore ??= new OntologyStore(client));
      const ont = await store.load({
        ...(input.refresh !== undefined ? { refresh: input.refresh } : {}),
      });
      return ontologyLookup(ont, input.op, input.name, input.search);
    },
  });
}
