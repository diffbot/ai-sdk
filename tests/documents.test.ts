import { describe, expect, it } from "vitest";
import {
  DEFAULT_KG_CONTENT_FIELDS,
  DEFAULT_WEB_CONTENT_FIELDS,
  dictToDocument,
  isNonEmpty,
  shapeExtractResponse,
} from "../src/documents.js";

const KG = DEFAULT_KG_CONTENT_FIELDS;

describe("isNonEmpty", () => {
  it.each([null, undefined, "", 0, false, [], {}] as const)("returns false for %j", (value) => {
    expect(isNonEmpty(value)).toBe(false);
  });

  it.each(["x", 1, true, [0], { a: 1 }] as const)("returns true for %j", (value) => {
    expect(isNonEmpty(value)).toBe(true);
  });
});

describe("dictToDocument", () => {
  it("takes content from the first non-empty content field", () => {
    const doc = dictToDocument(
      { name: "Diffbot", description: "A knowledge graph company." },
      { contentFields: KG },
    );
    expect(doc.content).toBe("A knowledge graph company.");
  });

  it("falls through empty values to the next content field", () => {
    const doc = dictToDocument(
      { name: "Diffbot", description: "", summary: "Builds a knowledge graph." },
      { contentFields: KG },
    );
    expect(doc.content).toBe("Builds a knowledge graph.");
  });

  it("excludes the winning content key from metadata", () => {
    const doc = dictToDocument(
      { id: "E1", name: "Diffbot", description: "Text." },
      { contentFields: KG },
    );
    expect(doc.metadata).toEqual({ id: "E1", name: "Diffbot" });
    expect(doc.metadata).not.toHaveProperty("description");
  });

  it("keeps every remaining key when fields is undefined", () => {
    const doc = dictToDocument(
      { id: "E1", name: "Diffbot", nbEmployees: 40, description: "Text." },
      { contentFields: KG },
    );
    expect(Object.keys(doc.metadata).sort()).toEqual(["id", "name", "nbEmployees"]);
  });

  it("narrows metadata to the fields allowlist", () => {
    const doc = dictToDocument(
      { id: "E1", name: "Diffbot", nbEmployees: 40, homepageUri: "https://diffbot.com" },
      { contentFields: KG, fields: ["id", "nbEmployees"] },
    );
    expect(doc.metadata).toEqual({ id: "E1", nbEmployees: 40 });
  });

  it("ignores allowlist entries that are absent from the source", () => {
    const doc = dictToDocument({ id: "E1" }, { contentFields: KG, fields: ["id", "missing"] });
    expect(doc.metadata).toEqual({ id: "E1" });
  });

  it("stringifies a non-string content value", () => {
    const doc = dictToDocument({ description: { long: "nested" } }, { contentFields: KG });
    expect(doc.content).toBe('{"long":"nested"}');
  });

  it("honours web content field priority", () => {
    const doc = dictToDocument(
      { content: "Full page text.", snippet: "Short." },
      { contentFields: DEFAULT_WEB_CONTENT_FIELDS },
    );
    expect(doc.content).toBe("Full page text.");
  });
});

describe("shapeExtractResponse", () => {
  it("prefers objects[0] over top-level fields", () => {
    const shaped = shapeExtractResponse({
      objects: [
        {
          text: "Object text.",
          title: "Object title",
          pageUrl: "https://example.com/a",
          resolvedPageUrl: "https://example.com/b",
          type: "article",
        },
      ],
      markdown: "Top-level markdown.",
      title: "Top-level title",
      url: "https://example.com/top",
      type: "other",
    });
    expect(shaped).toEqual({
      content: "Object text.",
      title: "Object title",
      pageUrl: "https://example.com/a",
      resolvedPageUrl: "https://example.com/b",
      type: "article",
    });
  });

  it("falls back to top-level markdown, title, url and type", () => {
    const shaped = shapeExtractResponse({
      markdown: "Top-level markdown.",
      title: "Top-level title",
      url: "https://example.com/top",
      type: "article",
    });
    expect(shaped.content).toBe("Top-level markdown.");
    expect(shaped.pageUrl).toBe("https://example.com/top");
  });

  it("treats empty string fields as absent", () => {
    const shaped = shapeExtractResponse({
      objects: [{ text: "", content: "Body" }],
      title: "",
    });
    expect(shaped.content).toBe("Body");
    expect(shaped.title).toBeUndefined();
  });

  it("returns empty content when the response carries none", () => {
    expect(shapeExtractResponse({}).content).toBe("");
    expect(shapeExtractResponse({ objects: [] }).content).toBe("");
  });

  it("reads content from objects[0].content for markdown mode", () => {
    const shaped = shapeExtractResponse({
      objects: [{ content: "# Title\n\nBody.", title: "T" }],
    });
    expect(shaped.content).toBe("# Title\n\nBody.");
  });
});
