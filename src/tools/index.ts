import type { Tool } from "ai";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import { diffbotExtract } from "./extract.js";
import { diffbotKnowledgeGraph } from "./knowledge-graph.js";
import { diffbotWebSearch } from "./web-search.js";

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
  const resolveClient = createClientResolver(options);
  const { only, ...auth } = options ?? {};

  const names = only?.length
    ? TOOL_ORDER.filter((n) => (only as readonly DiffbotToolName[]).includes(n))
    : [...TOOL_ORDER];

  const out = {} as Record<DiffbotToolName, Tool>;
  for (const name of names) {
    if (name === "diffbot_web_search") {
      out[name] = diffbotWebSearch(auth, resolveClient);
    } else if (name === "diffbot_extract") {
      out[name] = diffbotExtract(auth, resolveClient);
    } else {
      out[name] = diffbotKnowledgeGraph(auth, resolveClient);
    }
  }
  return out;
}
