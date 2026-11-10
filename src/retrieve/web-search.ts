import { webSearch, type JsonObject, type SnippetLength } from "@diffbot/typescript";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import {
  DEFAULT_WEB_CONTENT_FIELDS,
  dictToDocument,
  resolveK,
  type DiffbotDocument,
  type DocumentMapper,
} from "../documents.js";

export interface RetrieveWebSearchOptions extends DiffbotAuth {
  query: string;
  k?: number;
  maxTokens?: number;
  snippetLength?: SnippetLength;
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
    snippetLength,
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
    ...(snippetLength !== undefined ? { snippetLength } : {}),
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
