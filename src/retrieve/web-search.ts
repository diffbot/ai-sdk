import { webSearch, type JsonObject } from "@diffbot/typescript";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import {
  DEFAULT_WEB_CONTENT_FIELDS,
  dictToDocument,
  type DiffbotDocument,
  type DocumentMapper,
} from "../documents.js";

function resolveK(k: number): number {
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`\`k\` must be a positive integer, got ${JSON.stringify(k)}.`);
  }
  return k;
}

export interface RetrieveWebSearchOptions extends DiffbotAuth {
  query: string;
  k?: number;
  maxTokens?: number;
  fields?: readonly string[];
  contentFields?: readonly string[];
  documentMapper?: DocumentMapper;
}

export async function retrieveWebSearch(
  options: RetrieveWebSearchOptions,
): Promise<DiffbotDocument[]> {
  const {
    query,
    k: kRaw = 10,
    maxTokens,
    fields,
    contentFields = DEFAULT_WEB_CONTENT_FIELDS,
    documentMapper,
    ...auth
  } = options;

  const k = resolveK(kRaw);
  const client = createClientResolver(auth)();

  const body = await webSearch(client, query, {
    numResults: k,
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  });

  const results = Array.isArray(body.search_results) ? (body.search_results as JsonObject[]) : [];
  return results
    .slice(0, k)
    .map((hit) => hitToDocument(hit, { fields, contentFields, documentMapper }));
}

function hitToDocument(
  hit: JsonObject,
  {
    fields,
    contentFields,
    documentMapper,
  }: {
    fields?: readonly string[];
    contentFields: readonly string[];
    documentMapper?: DocumentMapper;
  },
): DiffbotDocument {
  if (documentMapper) {
    return documentMapper(hit as Record<string, unknown>);
  }
  return dictToDocument(hit as Record<string, unknown>, {
    contentFields,
    fields,
  });
}
