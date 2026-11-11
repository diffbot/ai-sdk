# Tools-registry entry (draft)

Draft of the single object to add to `content/tools-registry/registry.ts` in
[vercel/ai](https://github.com/vercel/ai). The listing page is
[ai-sdk.dev/resources/tools](https://ai-sdk.dev/resources/tools) (`/tools-registry` redirects
there). Copy this object into that pull request. Opening the pull request comes after the
prerequisites below.

Submission, when the prerequisites below are true:

- Branch `feat/add-tool-diffbot`.
- One file changes: `content/tools-registry/registry.ts`.
- PR title `feat(tools-registry): add diffbot`.
- The provider page (`content/providers/04-openai-compatible-providers/`) is a separate, later PR.
  Do not bundle it with this entry.

Prerequisites, in order. The npm publish does not wait on the docs page. The registry PR does.

1. `@diffbot/ai-sdk` is published to npm.
2. The integration is tested against the current AI SDK.
3. An AI SDK integration guide is live on docs.diffbot.com. `docsUrl` has to be that guide. A
   homepage or a generic API page does not qualify.

`docsUrl` below is still the placeholder `https://docs.diffbot.com/<ai-sdk-integration-page>`.
Replace that string when the guide has a real URL, and not before. The guide itself is not part of
this repo.

`apiKeyEnvName` is `DIFFBOT_API_TOKEN`, the only environment variable this package reads.
`installCommand` installs `@diffbot/ai-sdk` alone. `@diffbot/typescript` is a dependency of that
package, and `ai` is the peer the reader already has. The `codeExample` imports from those two and
nowhere else, and it calls `stepCountIs` so the snippet works on `ai@6` and on `ai@7`.

The `codeExample` template literal is the string CI compiles (`pnpm typecheck:docs`) and the string
to paste into `registry.ts` verbatim. This repo's Prettier writes the surrounding object with double
quotes. `vercel/ai` uses single quotes, and the literal's contents are already in that style.
Prettier does not reformat the inside of the literal.

The model id in the snippet is `anthropic/claude-sonnet-5`, the same gateway string the README
quickstart uses. At submission time, check it against the ids in the neighboring entries and update
both places together if those ids have moved.

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
  // Placeholder until the docs.diffbot.com AI SDK integration guide exists.
  // Point this at that guide, not at a homepage or the generic API docs.
  docsUrl: "https://docs.diffbot.com/<ai-sdk-integration-page>",
  apiKeyUrl: "https://app.diffbot.com/get-started/",
  websiteUrl: "https://www.diffbot.com",
  npmUrl: "https://www.npmjs.com/package/@diffbot/ai-sdk",
};
```
