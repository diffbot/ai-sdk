import { extract, type ExtractOptions, type JsonObject } from "@diffbot/typescript";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import { shapeExtractResponse, type DiffbotDocument } from "../documents.js";

export type ExtractDocumentMapper = (url: string, raw: JsonObject) => DiffbotDocument;

export interface LoadExtractOptions extends DiffbotAuth {
  urls: string[];
  api?: string;
  fmt?: string;
  /** Extra SDK extract options (`timeout`, `mode`, `fields`, `paging`, `extra`, …) for every URL. */
  extractOptions?: ExtractOptions;
  documentMapper?: ExtractDocumentMapper;
}

function defaultExtractMapper(url: string, raw: JsonObject): DiffbotDocument {
  const shaped = shapeExtractResponse(raw);
  return {
    content: shaped.content,
    metadata: {
      url,
      title: shaped.title,
      pageUrl: shaped.pageUrl,
      resolvedPageUrl: shaped.resolvedPageUrl,
      type: shaped.type,
    },
  };
}

export async function* streamExtract(
  options: LoadExtractOptions,
): AsyncGenerator<DiffbotDocument, void, undefined> {
  const {
    urls,
    api = "analyze",
    fmt = "markdown",
    extractOptions,
    documentMapper,
    ...auth
  } = options;
  const client = createClientResolver(auth)();
  const mapper = documentMapper ?? defaultExtractMapper;

  for (const url of urls) {
    const raw = (await extract(
      client,
      url,
      api,
      fmt,
      extractOptions as Parameters<typeof extract<string>>[4],
    )) as JsonObject;
    yield mapper(url, raw);
  }
}

export async function loadExtract(options: LoadExtractOptions): Promise<DiffbotDocument[]> {
  const docs: DiffbotDocument[] = [];
  for await (const doc of streamExtract(options)) {
    docs.push(doc);
  }
  return docs;
}
