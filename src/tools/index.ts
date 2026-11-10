import type { OntologyStore } from "@diffbot/typescript";
import type { Tool } from "ai";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import { createAskTool } from "./ask.js";
import { createDqlProbeTool } from "./dql-probe.js";
import { createEntitiesTool } from "./entities.js";
import { createExtractTool } from "./extract.js";
import { createKnowledgeGraphTool } from "./knowledge-graph.js";
import { createOntologyTool } from "./ontology.js";
import { createWebSearchTool } from "./web-search.js";

export type DiffbotToolName =
  | "diffbot_web_search"
  | "diffbot_extract"
  | "diffbot_knowledge_graph"
  | "diffbot_entities"
  | "diffbot_ontology"
  | "diffbot_dql_probe"
  | "diffbot_ask";

export interface DiffbotToolsOptions extends DiffbotAuth {
  only?: readonly DiffbotToolName[];
  /** Forwarded to `diffbot_ontology`; pass a `KVOntologyStore` in Workers. */
  ontologyStore?: OntologyStore;
}

const TOOL_ORDER: readonly DiffbotToolName[] = [
  "diffbot_web_search",
  "diffbot_extract",
  "diffbot_knowledge_graph",
  "diffbot_entities",
  "diffbot_ontology",
  "diffbot_dql_probe",
  "diffbot_ask",
];

export function diffbotTools(options?: DiffbotToolsOptions): Record<DiffbotToolName, Tool> {
  const { only, ontologyStore, ...auth } = options ?? {};
  const resolveClient = createClientResolver(auth);

  const names = only ? TOOL_ORDER.filter((name) => only.includes(name)) : TOOL_ORDER;

  const out = {} as Record<DiffbotToolName, Tool>;
  for (const name of names) {
    switch (name) {
      case "diffbot_web_search":
        out[name] = createWebSearchTool(auth, resolveClient);
        break;
      case "diffbot_extract":
        out[name] = createExtractTool(auth, resolveClient);
        break;
      case "diffbot_knowledge_graph":
        out[name] = createKnowledgeGraphTool(auth, resolveClient);
        break;
      case "diffbot_entities":
        out[name] = createEntitiesTool(auth, resolveClient);
        break;
      case "diffbot_ontology":
        out[name] = createOntologyTool({ ...auth, ontologyStore }, resolveClient);
        break;
      case "diffbot_dql_probe":
        out[name] = createDqlProbeTool(auth, resolveClient);
        break;
      case "diffbot_ask":
        out[name] = createAskTool(auth, resolveClient);
        break;
    }
  }
  return out;
}
