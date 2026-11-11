import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.live.test.ts"],
    /*
      Above the 120 s client timeout in tests/live/helpers.ts on purpose: when a request
      does run out of time, the client's own abort should surface the error (ETIMEDOUT,
      an abort, an API error) instead of vitest reporting an opaque "test timed out".
    */
    testTimeout: 180_000,
    /*
      Diffbot's RAG endpoint occasionally stalls mid-stream and the socket times out. One
      retry keeps a transient server stall from failing a scheduled integration run; a real
      regression still fails twice. Never add retries to the unit config.
    */
    retry: 1,
  },
});
