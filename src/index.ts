export { diffbotWebSearch, type DiffbotWebSearchOptions } from "./tools/web-search.js";
export {
  diffbotExtract,
  type DiffbotExtractOptions,
  type DiffbotExtractToolError,
  type DiffbotExtractToolOutput,
} from "./tools/extract.js";
export {
  diffbotKnowledgeGraph,
  type DiffbotKnowledgeGraphOptions,
} from "./tools/knowledge-graph.js";
export { diffbotTools, type DiffbotToolName, type DiffbotToolsOptions } from "./tools/index.js";

export {
  dictToDocument,
  shapeExtractResponse,
  DEFAULT_KG_CONTENT_FIELDS,
  DEFAULT_WEB_CONTENT_FIELDS,
  type DiffbotDocument,
  type DiffbotDocumentOptions,
  type DocumentMapper,
  type ShapedExtractResponse,
} from "./documents.js";

export type { DiffbotAuth } from "./client.js";
export type { DiffbotClient } from "@diffbot/typescript";
