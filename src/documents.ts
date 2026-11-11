import type { JsonObject } from "@diffbot/typescript";

export interface DiffbotDocument {
  content: string;
  metadata: Record<string, unknown>;
}

export type DocumentMapper = (source: Record<string, unknown>) => DiffbotDocument;

export interface DiffbotDocumentOptions {
  fields?: readonly string[];
  contentFields?: readonly string[];
  documentMapper?: DocumentMapper;
}

export const DEFAULT_KG_CONTENT_FIELDS = ["description", "summary", "name"] as const;

export const DEFAULT_WEB_CONTENT_FIELDS = ["content", "snippet"] as const;

export function dictToDocument(
  source: Record<string, unknown>,
  { contentFields, fields }: { contentFields: readonly string[]; fields?: readonly string[] },
): DiffbotDocument {
  let content = "";
  let contentFieldUsed: string | undefined;

  for (const field of contentFields) {
    const value = source[field];
    if (isNonEmpty(value)) {
      content = typeof value === "string" ? value : stringify(value);
      contentFieldUsed = field;
      break;
    }
  }

  const metadata: Record<string, unknown> = {};
  const keys = fields ?? Object.keys(source);
  for (const key of keys) {
    if (key === contentFieldUsed) continue;
    if (!(key in source)) continue;
    metadata[key] = source[key];
  }

  return { content, metadata };
}

/**
 * Internal: a retrieve helper's shaping options once `contentFields` has its default.
 * Not exported from the barrel.
 */
export interface ResolvedShapeOptions extends DiffbotDocumentOptions {
  contentFields: readonly string[];
}

/** Internal: `documentMapper`, or the default `fields` / `contentFields` projection. */
export function shapeSource(
  source: Record<string, unknown>,
  { fields, contentFields, documentMapper }: ResolvedShapeOptions,
): DiffbotDocument {
  return documentMapper
    ? documentMapper(source)
    : dictToDocument(source, { contentFields, fields });
}

/** Internal: validates a retrieve helper's `k`. Not exported from the barrel. */
export function resolveK(k: number): number {
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`\`k\` must be a positive integer, got ${JSON.stringify(k)}.`);
  }
  return k;
}

export interface ShapedExtractResponse {
  content: string;
  title?: string;
  pageUrl?: string;
  resolvedPageUrl?: string;
  type?: string;
}

export function shapeExtractResponse(raw: JsonObject): ShapedExtractResponse {
  const objects = Array.isArray(raw.objects) ? (raw.objects as JsonObject[]) : [];
  const first = objects[0] ?? {};
  return {
    content: asString(first.content) ?? asString(first.text) ?? asString(raw.markdown) ?? "",
    title: asString(first.title) ?? asString(raw.title),
    pageUrl: asString(first.pageUrl) ?? asString(raw.url),
    resolvedPageUrl: asString(first.resolvedPageUrl),
    type: asString(first.type) ?? asString(raw.type),
  };
}

/*
  Mirrors Python's truthiness test: empty strings, empty arrays, empty objects,
  0, and null/undefined all fall through to the next candidate field.
*/
export function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function stringify(value: unknown): string {
  if (typeof value === "object") return JSON.stringify(value) ?? String(value);
  return String(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
