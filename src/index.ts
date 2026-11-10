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
export { diffbotEntities, type DiffbotEntitiesOptions } from "./tools/entities.js";
export {
  diffbotOntology,
  type DiffbotOntologyOptions,
  type OntologyLookupError,
  type OntologyLookupResult,
} from "./tools/ontology.js";
export {
  diffbotDqlProbe,
  type DiffbotDqlProbeOptions,
  type DqlProbeResult,
} from "./tools/dql-probe.js";
export { diffbotAsk, type DiffbotAskOptions } from "./tools/ask.js";
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
export type { DiffbotClient, OntologyStore, KVOntologyStore } from "@diffbot/typescript";
