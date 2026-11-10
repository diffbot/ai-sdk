import { DiffbotClient } from "@diffbot/typescript";
import {
  diffbotAsk,
  diffbotDqlProbe,
  diffbotEntities,
  diffbotExtract,
  diffbotKnowledgeGraph,
  diffbotOntology,
  diffbotTools,
  diffbotWebSearch,
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
