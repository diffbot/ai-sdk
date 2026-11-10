import { DiffbotClient, KVOntologyStore, OntologyStore, type KVLike } from "@diffbot/typescript";
import {
  diffbotAsk,
  diffbotDqlProbe,
  diffbotEntities,
  diffbotExtract,
  diffbotKnowledgeGraph,
  diffbotOntology,
  diffbotTools,
  diffbotWebSearch,
  loadCrawl,
  loadExtract,
  retrieveKnowledgeGraph,
  retrieveWebSearch,
  streamCrawl,
  streamExtract,
} from "../../src/index.js";

const client = new DiffbotClient({ token: "injected" });

diffbotWebSearch({ client });
diffbotExtract({ client });
diffbotKnowledgeGraph({ client });
diffbotEntities({ client });
diffbotOntology({ client });
diffbotDqlProbe({ client });
diffbotAsk({ client });
diffbotTools({ client });

/* The ontology store travels across the same package boundary as the client. */
const kv: KVLike = {
  get: async () => null,
  put: async () => undefined,
  delete: async () => undefined,
};

diffbotOntology({ client, ontologyStore: new OntologyStore(client) });
diffbotOntology({ client, ontologyStore: new KVOntologyStore(client, kv) });
diffbotTools({ client, ontologyStore: new KVOntologyStore(client, kv) });
diffbotTools({ client, only: ["diffbot_ontology", "diffbot_ask"] });

retrieveKnowledgeGraph({ client, query: "type:Organization" });
retrieveWebSearch({ client, query: "diffbot" });
loadExtract({ client, urls: ["https://example.com"] });
streamExtract({ client, urls: ["https://example.com"] });
loadCrawl({ client, site: "https://example.com", crawlOptions: { watch: false } });
streamCrawl({ client, site: "https://example.com", crawlOptions: { watch: false } });
