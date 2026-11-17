import { describe, expect, it } from "vitest";
import { CrawlEventType, type CrawlEvent } from "@diffbot/typescript";
import type { DiffbotDocument } from "../../src/documents.js";
import {
  defaultCrawlMapper,
  defaultCrawlRecordMapper,
  loadCrawl,
  streamCrawl,
} from "../../src/retrieve/crawl.js";
import { createMockFetch, jsonResponse } from "../helpers/mock-fetch.js";

const CRAWL_URL = "https://api.diffbot.com/v3/crawl";

describe("defaultCrawlMapper", () => {
  const jobEvent: CrawlEvent = {
    eventType: CrawlEventType.JobCreated,
    timestamp: "now",
    details: { job_name: "j1" },
  };
  const urlEvent: CrawlEvent = {
    eventType: CrawlEventType.UrlProcessed,
    timestamp: "2026-01-01T00:00:00Z",
    details: { url: "https://example.com/page", status: "ok" },
  };

  it("drops non-url_processed events", () => {
    expect(defaultCrawlMapper(jobEvent)).toBeNull();
  });

  it("maps a url_processed event keyed on the URL", () => {
    const doc = defaultCrawlMapper(urlEvent);
    expect(doc).not.toBeNull();
    expect(doc!.content).toBe("https://example.com/page");
    expect(doc!.metadata).toEqual({
      url: "https://example.com/page",
      status: "ok",
      crawl_timestamp: "2026-01-01T00:00:00Z",
    });
  });
});

describe("streamCrawl watch defaulting", () => {
  it("watch: false reaches the wire as a single job-creation request with no polling", async () => {
    const requests: Array<{ url: string; params: URLSearchParams }> = [];
    const docs = await loadCrawl({
      apiKey: "test-token",
      fetch: createMockFetch((req) => {
        requests.push({ url: req.url, params: req.params });
        return jsonResponse({ jobs: [{ name: "test-job" }] });
      }),
      site: "https://example.com",
      crawlOptions: { watch: false, hops: 3, jobName: "test-job" },
    });

    expect(docs).toEqual([]);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe(CRAWL_URL);
    expect(requests[0]!.params.get("maxHops")).toBe("3");
    expect(requests[0]!.params.get("token")).toBe("test-token");
    expect(requests[0]!.params.get("seeds")).toBe("https://example.com");
  });

  it("defaults watch without mutating the caller's crawlOptions", async () => {
    const crawlOptions = { jobName: "test-job", pollInterval: 0 };
    await loadCrawl({
      apiKey: "t",
      fetch: createMockFetch((req) =>
        req.url.endsWith("/data")
          ? new Response("", { status: 200 })
          : jsonResponse({ jobs: [{ name: "test-job", jobStatus: { status: 2 } }] }),
      ),
      site: "https://example.com",
      crawlOptions,
    });
    expect(crawlOptions).toEqual({ jobName: "test-job", pollInterval: 0 });
  });

  it("polls the job and yields a document per crawled URL when watch defaults true", async () => {
    const csv =
      "Url,Crawled Time,Crawl Status\n" +
      '"https://example.com/page1",2026-01-01T00:00:00Z,200\n' +
      '"https://example.com/page2",2026-01-01T00:00:01Z,200\n';

    const requestKinds: string[] = [];
    const docs = await loadCrawl({
      apiKey: "test-token",
      fetch: createMockFetch((req) => {
        if (req.url.endsWith("/data")) {
          requestKinds.push("data");
          expect(req.params.get("type")).toBe("urls");
          return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv" } });
        }
        if (req.params.get("seeds")) {
          requestKinds.push("create");
          return jsonResponse({ jobs: [{ name: "test-job" }] });
        }
        requestKinds.push("status");
        return jsonResponse({
          jobs: [{ jobStatus: { status: 2, message: "Job complete." } }],
        });
      }),
      site: "https://example.com",
      crawlOptions: { jobName: "test-job", pollInterval: 0 },
    });

    expect(requestKinds).toEqual(["create", "status", "data"]);
    expect(docs).toHaveLength(2);
    expect(docs[0]!.content).toBe("https://example.com/page1");
  });

  it("uses a custom eventMapper", async () => {
    const docs: DiffbotDocument[] = [];
    for await (const doc of streamCrawl({
      apiKey: "t",
      fetch: createMockFetch(() => jsonResponse({ jobs: [{ name: "test-job" }] })),
      site: "https://example.com",
      crawlOptions: { jobName: "test-job", watch: false },
      eventMapper: (event) => ({
        content: event.eventType,
        metadata: { ...event.details },
      }),
    })) {
      docs.push(doc);
    }
    expect(docs).toHaveLength(1);
    expect(docs[0]!.content).toBe(CrawlEventType.JobCreated);
  });
});

describe("loadCrawl download path", () => {
  const RECORDS = [
    {
      pageUrl: "https://example.com/a",
      title: "A",
      content: "Body A",
      type: "article",
      id: 1,
      token: "secret-echoed-by-server",
      timestamp: "2026-01-01T00:00:00Z",
    },
    { pageUrl: "https://example.com/b", title: "B" },
  ];

  function crawlFetch(statuses: number[], log: Array<{ kind: string; params: URLSearchParams }>) {
    let polls = 0;
    return createMockFetch((req) => {
      if (req.url.endsWith("/data")) {
        log.push({ kind: "data", params: req.params });
        return jsonResponse(RECORDS);
      }
      if (req.params.get("seeds")) {
        log.push({ kind: "create", params: req.params });
        return jsonResponse({ jobs: [{ name: "test-job" }] });
      }
      log.push({ kind: "status", params: req.params });
      const status = statuses[Math.min(polls++, statuses.length - 1)]!;
      return jsonResponse({ jobs: [{ name: "test-job", jobStatus: { status, message: "m" } }] });
    });
  }

  it("creates without watching, polls until terminal, then downloads JSON records", async () => {
    const log: Array<{ kind: string; params: URLSearchParams }> = [];
    const docs = await loadCrawl({
      apiKey: "test-token",
      fetch: crawlFetch([0, 7, 9], log),
      site: "https://example.com",
      crawlOptions: { jobName: "test-job", pollInterval: 0 },
      download: { num: 5 },
    });

    expect(log.map((l) => l.kind)).toEqual(["create", "status", "status", "status", "data"]);
    const data = log.at(-1)!.params;
    expect(data.get("name")).toBe("test-job");
    expect(data.get("num")).toBe("5");
    expect(data.has("format")).toBe(false);
    expect(data.has("type")).toBe(false);

    expect(docs).toHaveLength(2);
    expect(docs[0]).toEqual({
      content: "Body A",
      metadata: {
        url: "https://example.com/a",
        title: "A",
        type: "article",
        parentUrl: undefined,
        id: 1,
        crawl_timestamp: "2026-01-01T00:00:00Z",
      },
    });
    expect(docs[1]!.content).toBe("B");
    expect(JSON.stringify(docs)).not.toContain("secret-echoed-by-server");
  });

  it("accepts `download: true` and a custom recordMapper that can drop records", async () => {
    const log: Array<{ kind: string; params: URLSearchParams }> = [];
    const all = await loadCrawl({
      apiKey: "t",
      fetch: crawlFetch([2], log),
      site: "https://example.com",
      crawlOptions: { jobName: "test-job", pollInterval: 0 },
      download: true,
    });
    expect(all).toHaveLength(2);

    const some = await loadCrawl({
      apiKey: "t",
      fetch: crawlFetch([2], []),
      site: "https://example.com",
      crawlOptions: { jobName: "test-job", pollInterval: 0 },
      download: { recordMapper: (r) => (r.title === "B" ? defaultCrawlRecordMapper(r) : null) },
    });
    expect(some.map((d) => d.metadata.title)).toEqual(["B"]);
  });

  it("throws a JobError when the job ends in failure, without downloading", async () => {
    const log: Array<{ kind: string; params: URLSearchParams }> = [];
    const fetch = createMockFetch((req) => {
      log.push({ kind: req.url.endsWith("/data") ? "data" : "other", params: req.params });
      return req.params.get("seeds")
        ? jsonResponse({ jobs: [{ name: "test-job" }] })
        : jsonResponse({ jobs: [{ jobStatus: { status: 4, message: "Job failed: bad seed" } }] });
    });
    await expect(
      loadCrawl({
        apiKey: "t",
        fetch,
        site: "https://example.com",
        crawlOptions: { jobName: "test-job", pollInterval: 0 },
        download: true,
      }),
    ).rejects.toThrow(/Crawler job failed/);
    expect(log.some((l) => l.kind === "data")).toBe(false);
  });

  it("rejects type: urls, which is CSV rather than records", async () => {
    await expect(
      loadCrawl({
        apiKey: "t",
        fetch: createMockFetch(() => jsonResponse({})),
        site: "https://example.com",
        download: { type: "urls" },
      }),
    ).rejects.toThrow(/returns CSV/);
  });

  it("falls back to title, then URL, for content", () => {
    expect(defaultCrawlRecordMapper({ pageUrl: "u", title: "T" }).content).toBe("T");
    expect(defaultCrawlRecordMapper({ pageUrl: "u" }).content).toBe("u");
  });
});
