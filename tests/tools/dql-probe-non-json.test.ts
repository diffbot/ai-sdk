import type * as Sdk from "@diffbot/typescript";
import { describe, expect, it, vi } from "vitest";
import { toolExecOptions } from "../helpers/tool-exec.js";

/*
  `dql()` only returns raw bytes for `raw: true`, which the probe never sets, so
  the non-JSON branch is reachable only by stubbing `dqlParallel` itself.
*/
vi.mock("@diffbot/typescript", async (importOriginal) => {
  const actual = await importOriginal<typeof Sdk>();
  return {
    ...actual,
    dqlParallel: vi.fn(async () => [new TextEncoder().encode("not json"), { hits: 7 }]),
  };
});

const { diffbotDqlProbe } = await import("../../src/tools/dql-probe.js");

describe("diffbotDqlProbe non-JSON bodies", () => {
  it("reports hits: null for a raw-bytes result and keeps positional order", async () => {
    const tool = diffbotDqlProbe({ apiKey: "test-token" });
    const out = await tool.execute!({ queries: ["raw", "json"] }, toolExecOptions());
    expect(out).toEqual([
      { query: "raw", hits: null },
      { query: "json", hits: 7 },
    ]);
  });
});
