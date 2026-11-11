import { dql, type JsonObject } from "@diffbot/typescript";
import { type DiffbotAuth, createClientResolver } from "../client.js";
import {
  DEFAULT_KG_CONTENT_FIELDS,
  dictToDocument,
  resolveK,
  type DiffbotDocument,
  type DocumentMapper,
} from "../documents.js";

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface RetrieveKnowledgeGraphOptions extends DiffbotAuth {
  query: string;
  k?: number;
  from?: number;
  filter?: string;
  exportspec?: string;
  /** Only `"json"` can be shaped into documents; anything else throws before the request. */
  format?: string;
  extra?: Record<string, string>;
  fields?: readonly string[];
  contentFields?: readonly string[];
  documentMapper?: DocumentMapper;
}

export async function retrieveKnowledgeGraph(
  options: RetrieveKnowledgeGraphOptions,
): Promise<DiffbotDocument[]> {
  const {
    query,
    k: kRaw = 10,
    from = 0,
    filter,
    exportspec,
    format = "json",
    extra,
    fields,
    contentFields = DEFAULT_KG_CONTENT_FIELDS,
    documentMapper,
    ...auth
  } = options;

  /* Checked before the request: a CSV round-trip would spend KG credits only to throw. */
  if (format !== "json") {
    throw new TypeError(
      `retrieveKnowledgeGraph shapes JSON hits, so \`format\` must be "json"; got ${JSON.stringify(
        format,
      )}. Call \`dql\` from @diffbot/typescript for other formats.`,
    );
  }

  const k = resolveK(kRaw);
  const client = createClientResolver(auth)();

  const body = await dql(client, query, {
    size: k,
    from,
    format,
    ...(filter !== undefined ? { filter } : {}),
    ...(exportspec !== undefined ? { exportspec } : {}),
    ...(extra !== undefined ? { extra } : {}),
  });

  if (body instanceof Uint8Array || !isPlainObject(body)) {
    throw new TypeError("DQL returned a non-JSON body; this helper needs `format: 'json'`.");
  }

  const data = Array.isArray(body.data) ? (body.data as JsonObject[]) : [];
  return data
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
  const entity = isPlainObject(hit.entity) ? hit.entity : hit;

  if (documentMapper) {
    return documentMapper(entity as Record<string, unknown>);
  }

  const doc = dictToDocument(entity as Record<string, unknown>, {
    contentFields,
    fields,
  });

  if ("score" in hit) {
    doc.metadata.score = hit.score;
  }
  return doc;
}
