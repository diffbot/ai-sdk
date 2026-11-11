# Tools-registry entry (draft)

<!-- Placeholder: prose to be written in the Phase 5 docs pass. The block below
     is the live artifact — `pnpm typecheck:docs` compiles the `codeExample`
     string against `src/`, and tests/registry-entry.test.ts pins its imports
     to the barrel, so the entry cannot rot before the PR to `vercel/ai`
     (PLAN.md §7.5). Field quoting follows this repo's Prettier config;
     `vercel/ai` uses single quotes, and the `codeExample` string itself —
     template-literal contents, which Prettier leaves alone — is submitted
     verbatim. `docsUrl` is still a placeholder: the registry PR waits on the
     docs.diffbot.com integration page (§7.5, §10.15). -->

```ts
// One entry of the exported array in content/tools-registry/registry.ts.
export const diffbotRegistryEntry = {
  slug: "diffbot",
  name: "Diffbot",
  description:
    "Diffbot tools for the AI SDK: web search with full page content, structured extraction from any URL, and Knowledge Graph (DQL) queries over billions of organizations, people, places, articles and products — plus ontology introspection and query probing so agents write valid DQL instead of guessing.",
  packageName: "@diffbot/ai-sdk",
  tags: ["search", "web", "extraction", "knowledge-graph", "nlp"],
  apiKeyEnvName: "DIFFBOT_API_TOKEN",
  installCommand: {
    pnpm: "pnpm add @diffbot/ai-sdk",
    npm: "npm install @diffbot/ai-sdk",
    yarn: "yarn add @diffbot/ai-sdk",
    bun: "bun add @diffbot/ai-sdk",
  },
  codeExample: `import { generateText, stepCountIs } from 'ai';
import { diffbotWebSearch, diffbotKnowledgeGraph } from '@diffbot/ai-sdk';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-5',
  prompt: 'Which Boston AI companies raised a Series B this year?',
  tools: {
    webSearch: diffbotWebSearch(),
    knowledgeGraph: diffbotKnowledgeGraph(),
  },
  stopWhen: stepCountIs(5),
});

console.log(text);`,
  docsUrl: "https://docs.diffbot.com/<ai-sdk-integration-page>",
  apiKeyUrl: "https://app.diffbot.com/get-started/",
  websiteUrl: "https://www.diffbot.com",
  npmUrl: "https://www.npmjs.com/package/@diffbot/ai-sdk",
};
```
