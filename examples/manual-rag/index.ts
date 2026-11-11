/*
  Manual RAG with the retrieval/loader helpers — no agent loop, no tools.

  The pipeline is the point: *we* decide what gets retrieved, so the prompt is
  built from Knowledge Graph rows and real page text instead of whatever a
  model chose to call.

    1. retrieveKnowledgeGraph — structured facts about the company
    2. retrieveWebSearch      — recent coverage the KG may not have yet
    3. loadExtract            — the full text of the top two pages
    4. generateText           — one answer over that context, nothing else

  `--context-only` stops after step 3, so the pipeline runs with just a Diffbot
  token and prints the context (and its size) instead of calling an LLM.
*/
import { generateText } from "ai";
import { loadExtract, retrieveKnowledgeGraph, retrieveWebSearch } from "@diffbot/ai-sdk";

const args = process.argv.slice(2);
const contextOnly = args.includes("--context-only");
const company = args.filter((arg) => !arg.startsWith("--")).join(" ") || "Diffbot";

const model = process.env.EXAMPLE_MODEL ?? "anthropic/claude-sonnet-5";

if (!process.env.DIFFBOT_API_TOKEN) {
  console.error("Set DIFFBOT_API_TOKEN first (see examples/.env.example).");
  process.exit(1);
}

/* `fields` is the cheap half of output shaping: the KG returns far more per
   entity than an answer needs, and every dropped field is a token saved. */
const entities = await retrieveKnowledgeGraph({
  query: `type:Organization strict:name(${JSON.stringify(company)})`,
  k: 3,
  fields: ["id", "name", "description", "homepageUri", "nbEmployees", "location"],
});

const web = await retrieveWebSearch({
  query: `${company} funding, products and leadership`,
  k: 5,
  snippetLength: "medium",
});

/* Snippets are often enough; the top two pages get read in full. */
const topUrls = web
  .map((doc) => doc.metadata.pageUrl)
  .filter((url): url is string => typeof url === "string")
  .slice(0, 2);

const pages = topUrls.length > 0 ? await loadExtract({ urls: topUrls, fmt: "markdown" }) : [];

function block(label: string, docs: { content: string; metadata: Record<string, unknown> }[]) {
  const body = docs
    .map((doc, i) => `[${label}-${i + 1}] ${JSON.stringify(doc.metadata)}\n${doc.content}`)
    .join("\n\n");
  return `## ${label}\n\n${body || "(no results)"}`;
}

const context = [block("kg", entities), block("web", web), block("page", pages)].join("\n\n");

console.error(
  `retrieved: ${entities.length} KG entities, ${web.length} web results, ` +
    `${pages.length} extracted pages — ${context.length} characters of context`,
);

if (contextOnly) {
  console.log(context);
  process.exit(0);
}

const { text } = await generateText({
  model,
  system:
    "Answer only from the context. Cite the bracketed source tags you used. " +
    "If the context does not contain the answer, say so.",
  prompt: `${context}\n\n---\nWhat does ${company} do, and what has it been in the news for recently?`,
});

console.log(text);
