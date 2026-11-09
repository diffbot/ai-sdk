import type { Tool } from "ai";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import { createExtractTool } from "./extract.js";
import { createKnowledgeGraphTool } from "./knowledge-graph.js";
import { createWebSearchTool } from "./web-search.js";

export type DiffbotToolName = "diffbot_web_search" | "diffbot_extract" | "diffbot_knowledge_graph";

export interface DiffbotToolsOptions extends DiffbotAuth {
  only?: readonly DiffbotToolName[];
}

const TOOL_ORDER: readonly DiffbotToolName[] = [
  "diffbot_web_search",
  "diffbot_extract",
  "diffbot_knowledge_graph",
];

export function diffbotTools(options?: DiffbotToolsOptions): Record<DiffbotToolName, Tool> {
  const { only, ...auth } = options ?? {};
  // One resolver for the whole bundle, so every tool in it shares one client.
  const resolveClient = createClientResolver(auth);

  const names = only ? TOOL_ORDER.filter((name) => only.includes(name)) : TOOL_ORDER;

  const out = {} as Record<DiffbotToolName, Tool>;
  for (const name of names) {
    if (name === "diffbot_web_search") {
      out[name] = createWebSearchTool(auth, resolveClient);
    } else if (name === "diffbot_extract") {
      out[name] = createExtractTool(auth, resolveClient);
    } else {
      out[name] = createKnowledgeGraphTool(auth, resolveClient);
    }
  }
  return out;
}
