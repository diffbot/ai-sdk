import { describe, expect, it } from "vitest";
import { CrawlEventType, type CrawlEvent } from "@diffbot/typescript";
import type { DiffbotDocument } from "../../src/documents.js";
import { defaultCrawlMapper, loadCrawl, streamCrawl } from "../../src/retrieve/crawl.js";
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
