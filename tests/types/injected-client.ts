import { DiffbotClient } from "@diffbot/typescript";
import {
  diffbotExtract,
  diffbotKnowledgeGraph,
  diffbotTools,
  diffbotWebSearch,
} from "../../src/index.js";

const client = new DiffbotClient({ token: "injected" });

diffbotWebSearch({ client });
diffbotExtract({ client });
diffbotKnowledgeGraph({ client });
diffbotTools({ client });
