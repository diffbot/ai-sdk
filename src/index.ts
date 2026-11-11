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
  retrieveKnowledgeGraph,
  type RetrieveKnowledgeGraphOptions,
} from "./retrieve/knowledge-graph.js";
export { retrieveWebSearch, type RetrieveWebSearchOptions } from "./retrieve/web-search.js";
export {
  loadExtract,
  streamExtract,
  type ExtractDocumentMapper,
  type LoadExtractOptions,
} from "./retrieve/extract.js";
export {
  loadCrawl,
  streamCrawl,
  defaultCrawlMapper,
  type CrawlEventMapper,
  type StreamCrawlOptions,
} from "./retrieve/crawl.js";

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

/* SDK re-exports: every `@diffbot/typescript` name that appears in this package's public
   signatures, so callers never have to import it directly (it is our dependency, not a peer). */
export { CrawlEventType } from "@diffbot/typescript";
export type {
  CrawlEvent,
  CrawlOptions,
  DiffbotClient,
  JsonObject,
  KVOntologyStore,
  OntologyStore,
  SnippetLength,
} from "@diffbot/typescript";
