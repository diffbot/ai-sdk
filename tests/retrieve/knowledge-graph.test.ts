import { describe, expect, it } from "vitest";
import { retrieveKnowledgeGraph } from "../../src/retrieve/knowledge-graph.js";
import { createMockFetch, jsonResponse, type MockHandler } from "../helpers/mock-fetch.js";

const DQL_URL = "https://kg.diffbot.com/kg/v3/dql";

const SAMPLE_BODY = {
  data: [
    {
      score: 1000.0,
      entity: {
        id: "E1",
        type: "Organization",
        name: "Acme AI",
        description: "Boston-based AI company.",
        homepageUri: "https://acme.example",
      },
      entity_ctx: {},
    },
    {
      score: 500.0,
      entity: {
        id: "E2",
        type: "Organization",
        name: "Beta Labs",
        summary: "Robotics startup.",
      },
      entity_ctx: {},
    },
  ],
};

const FAT_BODY = {
  data: [
    {
      score: 1234.5,
      entity: {
        id: "E1",
        type: "Organization",
        name: "Acme AI",
        description: "Boston-based AI company.",
        homepageUri: "https://acme.example",
        nbEmployees: 42,
        suppliers: [{ name: "X" }, { name: "Y" }],
        industries: ["AI", "Robotics"],
        tags: Array.from({ length: 100 }, () => ({ label: "ML" })),
      },
      entity_ctx: {},
    },
  ],
};

function retrieve(
  handler: MockHandler,
  overrides: Omit<Parameters<typeof retrieveKnowledgeGraph>[0], "apiKey" | "fetch">,
) {
  return retrieveKnowledgeGraph({
    apiKey: "test-token",
    fetch: createMockFetch(handler),
    ...overrides,
  });
}

describe("retrieveKnowledgeGraph document mapping", () => {
  it("maps nested {score, entity} hits into documents", async () => {
    const docs = await retrieve(
      (req) => {
        expect(req.url).toBe(DQL_URL);
        expect(req.method).toBe("GET");
        expect(req.params.get("query")).toBe("type:Organization");
        return jsonResponse(SAMPLE_BODY);
      },
      { k: 2, query: "type:Organization" },
    );

    expect(docs).toHaveLength(2);
    expect(docs[0]!.content).toBe("Boston-based AI company.");
    expect(docs[0]!.metadata.name).toBe("Acme AI");
    expect(docs[0]!.metadata.id).toBe("E1");
    expect(docs.map((d) => d.metadata.id)).toEqual(["E1", "E2"]);
  });

  it("maps flat hits whose entity fields sit at the top level", async () => {
    const docs = await retrieve(
      () =>
        jsonResponse({
          data: [{ id: "E9", type: "Organization", name: "Flat Co", description: "x" }],
        }),
      { query: "type:Organization" },
    );

    expect(docs).toHaveLength(1);
    expect(docs[0]!.content).toBe("x");
    expect(docs[0]!.metadata.name).toBe("Flat Co");
  });

  it("puts the outer hit score into metadata", async () => {
    const docs = await retrieve(() => jsonResponse(SAMPLE_BODY), { k: 2, query: "q" });
    expect(docs[0]!.metadata.score).toBe(1000.0);
    expect(docs[1]!.metadata.score).toBe(500.0);
  });

  it("keeps the score even when a narrow fields allowlist omits it", async () => {
    const docs = await retrieve(() => jsonResponse(FAT_BODY), {
      query: "type:Organization",
      fields: ["id", "name", "homepageUri", "nbEmployees"],
    });

    expect(docs[0]!.content).toBe("Boston-based AI company.");
    expect(Object.keys(docs[0]!.metadata).sort()).toEqual([
      "homepageUri",
      "id",
      "name",
      "nbEmployees",
      "score",
    ]);
  });

  it("lets documentMapper override both fields and contentFields", async () => {
    const docs = await retrieve(() => jsonResponse(FAT_BODY), {
      query: "type:Organization",
      fields: ["nbEmployees"],
      contentFields: ["description"],
      documentMapper: (entity) => ({
        content: `${String(entity.name)} (${String(entity.id)})`,
        metadata: { id: entity.id },
      }),
    });

    expect(docs[0]!.content).toBe("Acme AI (E1)");
    expect(docs[0]!.metadata).toEqual({ id: "E1" });
  });
});

describe("retrieveKnowledgeGraph request wiring", () => {
  it("sends k as the size wire param", async () => {
    await retrieve(
      (req) => {
        expect(req.params.get("size")).toBe("3");
        return jsonResponse(SAMPLE_BODY);
      },
      { k: 3, query: "type:Organization" },
    );
  });

  it("defaults to size 10 and forwards from, filter, exportspec and extra", async () => {
    const seen: URLSearchParams[] = [];
    const handler: MockHandler = (req) => {
      seen.push(req.params);
      return jsonResponse(SAMPLE_BODY);
    };
    await retrieve(handler, { query: "q" });
    await retrieve(handler, {
      query: "q",
      from: 20,
      filter: "nbEmployees>50",
      exportspec: "name",
      extra: { nonCanonicalFacts: "true" },
    });

    expect(seen[0]!.get("size")).toBe("10");
    expect(seen[0]!.has("filter")).toBe(false);
    expect(seen[1]!.get("from")).toBe("20");
    expect(seen[1]!.get("filter")).toBe("nbEmployees>50");
    expect(seen[1]!.get("exportspec")).toBe("name");
    expect(seen[1]!.get("nonCanonicalFacts")).toBe("true");
    expect(seen[1]!.get("token")).toBe("test-token");
  });

  it("caps the documents at k even if the server returns more", async () => {
    const docs = await retrieve(() => jsonResponse(SAMPLE_BODY), { k: 1, query: "q" });
    expect(docs.map((d) => d.metadata.id)).toEqual(["E1"]);
  });

  it("returns [] when the body carries no data array", async () => {
    expect(await retrieve(() => jsonResponse({ hits: 0 }), { query: "q" })).toEqual([]);
  });

  it("rejects a non-positive k", async () => {
    await expect(
      retrieveKnowledgeGraph({
        apiKey: "t",
        fetch: createMockFetch(() => jsonResponse(SAMPLE_BODY)),
        query: "q",
        k: 0,
      }),
    ).rejects.toThrow(/`k` must be a positive integer/);
  });

  it("rejects a non-JSON format before spending a request", async () => {
    await expect(
      retrieveKnowledgeGraph({
        apiKey: "t",
        fetch: createMockFetch(() => {
          throw new Error("should not be called");
        }),
        query: "type:Organization",
        format: "csv",
      }),
    ).rejects.toThrow(/`format` must be "json"; got "csv"/);
  });

  it("accepts an explicit json format", async () => {
    const docs = await retrieve(
      (req) => {
        /* The SDK omits the param for the default format. */
        expect(req.params.has("format")).toBe(false);
        return jsonResponse(SAMPLE_BODY);
      },
      { query: "q", format: "json" },
    );
    expect(docs).toHaveLength(2);
  });
});
