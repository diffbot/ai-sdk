import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { resolveTokenFromEnv } from "@diffbot/typescript";

export const DEFAULT_DIFFBOT_BASE_URL = "https://llm.diffbot.com/rag/v1";

export type DiffbotChatModelId = "diffbot-small-xl" | "diffbot-small" | (string & {});

export const PROVIDER_NO_TOKEN_MESSAGE =
  "No Diffbot API token. Pass `apiKey` to createDiffbot(), or set DIFFBOT_API_TOKEN.";

function usableToken(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface CreateDiffbotOptions {
  /** API token. Defaults to `DIFFBOT_API_TOKEN`, resolved lazily on each request. */
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  /** Workers-style env bag for token resolution when `apiKey` is omitted. */
  env?: Record<string, string | undefined>;
}

export function createDiffbot(options?: CreateDiffbotOptions) {
  const staticKey = usableToken(options?.apiKey);
  const userFetch = options?.fetch;

  const resolveToken = (): string => {
    const token = staticKey ?? usableToken(resolveTokenFromEnv(undefined, options?.env));
    if (!token) {
      throw new Error(PROVIDER_NO_TOKEN_MESSAGE);
    }
    return token;
  };

  const underlyingFetch = userFetch ?? globalThis.fetch.bind(globalThis);

  const lazyAuthFetch: typeof globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${resolveToken()}`);
    return underlyingFetch(input, { ...init, headers });
  };

  return createOpenAICompatible<DiffbotChatModelId, string, string, string>({
    name: "diffbot",
    baseURL: options?.baseURL ?? DEFAULT_DIFFBOT_BASE_URL,
    ...(staticKey !== undefined ? { apiKey: staticKey } : {}),
    ...(options?.headers !== undefined ? { headers: options.headers } : {}),
    ...(staticKey !== undefined
      ? userFetch !== undefined
        ? { fetch: userFetch }
        : {}
      : { fetch: lazyAuthFetch }),
  });
}

/** Default provider instance — token is read lazily on the first model call. */
export const diffbot = createDiffbot();
