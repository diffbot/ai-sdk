import { crawl, CrawlEventType, type CrawlEvent, type CrawlOptions } from "@diffbot/typescript";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import type { DiffbotDocument } from "../documents.js";

export type CrawlEventMapper = (event: CrawlEvent) => DiffbotDocument | null;

export function defaultCrawlMapper(event: CrawlEvent): DiffbotDocument | null {
  if (event.eventType !== CrawlEventType.UrlProcessed) {
    return null;
  }
  const url = typeof event.details.url === "string" ? event.details.url : "";
  return {
    content: url,
    metadata: {
      url,
      status: event.details.status,
      crawl_timestamp: event.timestamp,
    },
  };
}

export interface StreamCrawlOptions extends DiffbotAuth {
  site: string;
  crawlOptions?: CrawlOptions;
  eventMapper?: CrawlEventMapper;
}

function resolvedCrawlOptions(crawlOptions?: CrawlOptions): CrawlOptions {
  const opts = { ...(crawlOptions ?? {}) };
  if (opts.watch === undefined) {
    opts.watch = true;
  }
  return opts;
}

export async function* streamCrawl(
  options: StreamCrawlOptions,
): AsyncGenerator<DiffbotDocument, void, undefined> {
  const { site, crawlOptions, eventMapper, ...auth } = options;
  const client = createClientResolver(auth)();
  const mapper = eventMapper ?? defaultCrawlMapper;
  const opts = resolvedCrawlOptions(crawlOptions);

  for await (const event of crawl(client, site, opts)) {
    const doc = mapper(event);
    if (doc !== null) {
      yield doc;
    }
  }
}

export async function loadCrawl(options: StreamCrawlOptions): Promise<DiffbotDocument[]> {
  const docs: DiffbotDocument[] = [];
  for await (const doc of streamCrawl(options)) {
    docs.push(doc);
  }
  return docs;
}
