import {
  crawl,
  crawlDownload,
  crawlGetJob,
  CrawlEventType,
  JobError,
  type CrawlDataRecord,
  type CrawlEvent,
  type CrawlOptions,
} from "@diffbot/typescript";
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

export type CrawlRecordMapper = (record: CrawlDataRecord) => DiffbotDocument | null;

/**
 * Maps one `crawlDownload` JSON record. `content` is the extracted body (falling back to the
 * title), and metadata is picked field by field: the server echoes the caller's token in each
 * record, so the record is never spread wholesale.
 */
export function defaultCrawlRecordMapper(record: CrawlDataRecord): DiffbotDocument {
  const url = typeof record.pageUrl === "string" ? record.pageUrl : "";
  const body = typeof record.content === "string" && record.content ? record.content : undefined;
  const title = typeof record.title === "string" ? record.title : undefined;
  return {
    content: body ?? title ?? url,
    metadata: {
      url,
      title,
      type: record.type,
      parentUrl: record.parentUrl,
      id: record.id,
      crawl_timestamp: record.timestamp,
    },
  };
}

/** Options for the opt-in poll + download path (`crawlDownload`). */
export interface CrawlDownloadLoadOptions {
  /** Only the N most recently processed URLs (the SDK's `num`). */
  num?: number;
  /** Downloaded record type, passed through as the SDK's `type`. */
  type?: string;
  /** Maps each downloaded record; return `null` to drop it. */
  recordMapper?: CrawlRecordMapper;
}

export interface StreamCrawlOptions extends DiffbotAuth {
  site: string;
  crawlOptions?: CrawlOptions;
  eventMapper?: CrawlEventMapper;
  /**
   * Opt in to the non-watch path: start the job without watching, poll `crawlGetJob` until it
   * reaches a terminal status, then fetch the extracted records with `crawlDownload` (JSON).
   * Yields one document per record instead of one per crawled URL. Omit for the default
   * watch-stream behavior, where `eventMapper` applies; `eventMapper` is ignored here.
   */
  download?: true | CrawlDownloadLoadOptions;
}

function resolvedCrawlOptions(crawlOptions?: CrawlOptions): CrawlOptions {
  const opts = { ...(crawlOptions ?? {}) };
  if (opts.watch === undefined) {
    opts.watch = true;
  }
  return opts;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* streamCrawlDownload(
  options: StreamCrawlOptions,
): AsyncGenerator<DiffbotDocument, void, undefined> {
  const { site, crawlOptions, download, eventMapper: _unused, ...auth } = options;
  void _unused;
  const { num, type, recordMapper }: CrawlDownloadLoadOptions =
    download === true ? {} : (download ?? {});
  if (type === "urls") {
    // The URL report is CSV text, not records; the default watch path already covers it.
    throw new TypeError('`download.type` "urls" returns CSV, not records; omit `download` instead');
  }
  const client = createClientResolver(auth)();
  const mapper = recordMapper ?? defaultCrawlRecordMapper;
  const pollInterval = crawlOptions?.pollInterval ?? 2000;

  let jobName = crawlOptions?.jobName;
  for await (const event of crawl(client, site, { ...crawlOptions, watch: false })) {
    if (
      event.eventType === CrawlEventType.JobCreated &&
      typeof event.details.job_name === "string"
    ) {
      jobName = event.details.job_name;
    }
  }
  if (jobName === undefined) {
    throw new JobError("", "Crawl did not report a job name");
  }

  for (;;) {
    const job = await crawlGetJob(client, jobName);
    if (!job) {
      throw new JobError(jobName, "Crawler job not found while polling");
    }
    const status = job.jobStatus?.status ?? 0;
    if (status !== 0 && status !== 7) {
      const message = job.jobStatus?.message ?? "";
      if (/fail|error/i.test(message)) {
        throw new JobError(jobName, `Crawler job failed: ${message}`);
      }
      break;
    }
    await sleep(pollInterval);
  }

  const records = await crawlDownload(client, jobName, {
    ...(type !== undefined ? { type } : {}),
    ...(num !== undefined ? { num } : {}),
  });
  for (const record of records as CrawlDataRecord[]) {
    const doc = mapper(record);
    if (doc !== null) {
      yield doc;
    }
  }
}

export async function* streamCrawl(
  options: StreamCrawlOptions,
): AsyncGenerator<DiffbotDocument, void, undefined> {
  if (options.download) {
    yield* streamCrawlDownload(options);
    return;
  }
  const { site, crawlOptions, eventMapper, download: _download, ...auth } = options;
  void _download;
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
