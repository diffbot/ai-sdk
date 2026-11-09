import { DiffbotClient, resolveTokenFromEnv } from "@diffbot/typescript";

/** Auth surface mixed into every factory's options. */
export interface DiffbotAuth {
  /** A pre-built client. Keep `@diffbot/typescript` on the same minor as ours (see README). */
  client?: DiffbotClient;
  apiKey?: string;
  timeout?: number;
  fetch?: typeof globalThis.fetch;
  /** Workers-style env bag, forwarded to the SDK's `resolveTokenFromEnv`. */
  env?: Record<string, string | undefined>;
}

const NO_TOKEN_MESSAGE =
  "No Diffbot API token. Pass `client`, pass `apiKey`, or set DIFFBOT_API_TOKEN.";

function usableToken(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Returns a lazy, memoized resolver. Never touches the token at call time. */
export function createClientResolver(auth?: DiffbotAuth): () => DiffbotClient {
  let memo: DiffbotClient | undefined;

  return () => {
    if (memo) return memo;

    if (auth?.client) {
      // timeout and fetch on DiffbotAuth are ignored — the injected client already owns that config.
      memo = auth.client;
      return memo;
    }

    const token =
      usableToken(auth?.apiKey) ?? usableToken(resolveTokenFromEnv(undefined, auth?.env));

    if (!token) {
      throw new Error(NO_TOKEN_MESSAGE);
    }

    memo = new DiffbotClient({
      token,
      ...(auth?.timeout !== undefined ? { timeout: auth.timeout } : {}),
      ...(auth?.fetch !== undefined ? { fetch: auth.fetch } : {}),
    });
    return memo;
  };
}

export { NO_TOKEN_MESSAGE };
