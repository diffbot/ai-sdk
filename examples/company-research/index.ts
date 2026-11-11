/*
  One-shot company-research agent (PLAN.md §7.3).

  Gives an agent model the Diffbot tool bundle and lets it run its own loop:
  look up the ontology, query the Knowledge Graph, search the web, extract a
  page it found. Then it prints the entity IDs and URLs the tools actually
  returned, so every claim in the answer can be traced back to Diffbot data
  rather than to the model.

  Nothing here reads a secret from anywhere but the environment.
*/
import { generateText, stepCountIs, streamText } from "ai";
import { diffbotTools } from "@diffbot/ai-sdk";

const DEFAULT_QUESTION = "Which Boston AI companies raised a Series B this year, and from whom?";

const args = process.argv.slice(2);
const stream = args.includes("--stream");
const question = args.filter((arg) => !arg.startsWith("--")).join(" ") || DEFAULT_QUESTION;

/* Any AI SDK model string. The default routes through the Vercel AI Gateway,
   which reads AI_GATEWAY_API_KEY itself — this example never touches the key. */
const model = process.env.EXAMPLE_MODEL ?? "anthropic/claude-sonnet-5";

if (!process.env.DIFFBOT_API_TOKEN) {
  console.error("Set DIFFBOT_API_TOKEN first (see examples/.env.example).");
  process.exit(1);
}

/* The four tools the research loop needs: ontology to learn the schema, the KG
   for structured facts, web search for anything too recent to be in the KG,
   and extract to read one page in full. `diffbotTools()` shares one client. */
const tools = diffbotTools({
  only: ["diffbot_web_search", "diffbot_extract", "diffbot_knowledge_graph", "diffbot_ontology"],
});

const CITATION_KEYS = new Set(["id", "diffbotUri", "url", "pageUrl", "resolvedPageUrl"]);

/** Collects the citation-ish leaves of a tool result, in first-seen order. */
function collectCitations(value: unknown, into: Set<string>, depth = 0): Set<string> {
  if (depth > 6 || into.size >= 40) return into;

  if (Array.isArray(value)) {
    for (const item of value) collectCitations(item, into, depth + 1);
    return into;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (CITATION_KEYS.has(key) && typeof child === "string" && child) {
        into.add(child);
      } else {
        collectCitations(child, into, depth + 1);
      }
    }
  }
  return into;
}

function printCitations(steps: { toolResults: { toolName: string; output: unknown }[] }[]): void {
  const citations = new Set<string>();
  const used = new Set<string>();

  for (const step of steps) {
    for (const result of step.toolResults) {
      used.add(result.toolName);
      collectCitations(result.output, citations);
    }
  }

  console.log(`\n--- tools used: ${[...used].join(", ") || "none"}`);
  for (const citation of citations) {
    console.log(
      citation.startsWith("http") ? citation : `https://app.diffbot.com/entity/${citation}`,
    );
  }
}

if (stream) {
  const result = streamText({
    model,
    prompt: question,
    tools,
    stopWhen: stepCountIs(8),
  });

  for await (const delta of result.textStream) {
    process.stdout.write(delta);
  }
  printCitations(await result.steps);
} else {
  const result = await generateText({
    model,
    prompt: question,
    tools,
    stopWhen: stepCountIs(8),
  });

  console.log(result.text);
  printCitations(result.steps);
}
