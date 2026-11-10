import {
  DiffbotClient,
  KVOntologyStore,
  Ontology,
  type OntologyStore,
  type KVLike,
} from "@diffbot/typescript";
import { diffbotOntology, diffbotOntologyInputSchema } from "../../src/tools/ontology.js";
import { describe, expect, it } from "vitest";
import { createMockFetch, jsonResponse } from "../helpers/mock-fetch.js";
import { toolExecOptions } from "../helpers/tool-exec.js";

const ONTOLOGY_URL = "https://kg.diffbot.com/kg/ontology";

const FIXTURE_ONTOLOGY = {
  types: {
    Organization: {
      fields: {
        name: { type: "String" },
        location: { type: "Location", isComposite: true },
      },
    },
    Person: { fields: { name: { type: "String" } } },
  },
  composites: {
    Location: { fields: { city: { type: "City", isComposite: true } } },
  },
  enums: { Language: { values: ["EN", "FR"] } },
  taxonomies: {
    OrganizationCategory: {
      categories: [
        {
          name: "Technology",
          children: [{ name: "Semiconductor Companies" }],
        },
      ],
    },
  },
};

function makeTool(): {
  tool: ReturnType<typeof diffbotOntology>;
  calls: () => number;
} {
  let count = 0;
  const tool = diffbotOntology({
    apiKey: "test-token",
    fetch: createMockFetch((req) => {
      expect(req.url).toBe(ONTOLOGY_URL);
      expect(req.method).toBe("GET");
      count += 1;
      return jsonResponse(FIXTURE_ONTOLOGY);
    }),
  });
  return { tool, calls: () => count };
}

async function run(
  harness: ReturnType<typeof makeTool>,
  input: Parameters<NonNullable<ReturnType<typeof diffbotOntology>["execute"]>>[0],
) {
  return harness.tool.execute!(input, toolExecOptions());
}

describe("diffbotOntology caching", () => {
  it("fetches the ontology once across two different ops", async () => {
    const harness = makeTool();
    expect(await run(harness, { op: "types" })).toEqual(["Organization", "Person"]);
    expect(await run(harness, { op: "enums" })).toEqual(["Language"]);
    expect(harness.calls()).toBe(1);
  });

  it("re-fetches when refresh is true", async () => {
    const harness = makeTool();
    await run(harness, { op: "types" });
    expect(harness.calls()).toBe(1);
    expect(await run(harness, { op: "types", refresh: true })).toEqual(["Organization", "Person"]);
    expect(harness.calls()).toBe(2);
    await run(harness, { op: "types" });
    expect(harness.calls()).toBe(2);
  });
});

function mapStore(): KVLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    put: async (key, value) => {
      data.set(key, value);
    },
    delete: async (key) => {
      data.delete(key);
    },
  };
}

describe("diffbotOntology with KVOntologyStore", () => {
  it("serves a freshly constructed tool from the store with zero extra fetches", async () => {
    let fetches = 0;
    const fetch = createMockFetch(() => {
      fetches += 1;
      return jsonResponse(FIXTURE_ONTOLOGY);
    });
    const kv = mapStore();
    const client = new DiffbotClient({ token: "test-token", fetch });
    const store = new KVOntologyStore(client, kv);

    const toolA = diffbotOntology({ client, ontologyStore: store });
    expect(await toolA.execute!({ op: "types" }, toolExecOptions())).toEqual([
      "Organization",
      "Person",
    ]);
    expect(fetches).toBe(1);

    const toolB = diffbotOntology({ client, ontologyStore: store });
    expect(await toolB.execute!({ op: "types" }, toolExecOptions())).toEqual([
      "Organization",
      "Person",
    ]);
    expect(fetches).toBe(1);
  });

  it("refresh refetches and rewrites the store", async () => {
    let fetches = 0;
    const fetch = createMockFetch(() => {
      fetches += 1;
      return jsonResponse(FIXTURE_ONTOLOGY);
    });
    const client = new DiffbotClient({ token: "test-token", fetch });
    const tool = diffbotOntology({
      client,
      ontologyStore: new KVOntologyStore(client, mapStore()),
    });

    await tool.execute!({ op: "types" }, toolExecOptions());
    expect(fetches).toBe(1);

    await tool.execute!({ op: "types", refresh: true }, toolExecOptions());
    expect(fetches).toBe(2);
  });
});

describe("diffbotOntology list ops", () => {
  it("lists types, composites, enums, and taxonomies", async () => {
    const harness = makeTool();
    expect(await run(harness, { op: "types" })).toEqual(["Organization", "Person"]);
    expect(await run(harness, { op: "composites" })).toEqual(["Location"]);
    expect(await run(harness, { op: "enums" })).toEqual(["Language"]);
    expect(await run(harness, { op: "taxonomies" })).toEqual(["OrganizationCategory"]);
  });
});

describe("diffbotOntology drill-down ops", () => {
  it("formats fields of a type", async () => {
    const harness = makeTool();
    const fields = await run(harness, { op: "fields", name: "Organization" });
    expect(fields).toEqual(["name: [String]", "location: [Location] [isComposite]"]);
  });

  it("filters fields by regex", async () => {
    const harness = makeTool();
    expect(await run(harness, { op: "fields", name: "Organization", search: "^loc" })).toEqual([
      "location: [Location] [isComposite]",
    ]);
  });

  it("walks nested taxonomy children", async () => {
    const harness = makeTool();
    expect(await run(harness, { op: "taxonomy", name: "OrganizationCategory" })).toEqual([
      "Technology",
      "Semiconductor Companies",
    ]);
  });

  it("lists enum values", async () => {
    const harness = makeTool();
    expect(await run(harness, { op: "enum", name: "Language" })).toEqual(["EN", "FR"]);
  });

  it("searches names by regex", async () => {
    const harness = makeTool();
    expect(await run(harness, { op: "search", name: "^tech" })).toEqual(["Technology"]);
  });
});

describe("diffbotOntology recoverable errors", () => {
  const HINT =
    "Valid ops: types, composites, enums, taxonomies, fields, " +
    "taxonomy, enum, search. List names first (e.g. op='types') " +
    "before drilling into fields/taxonomy/enum.";

  it("returns {error, hint} for an unknown entity type", async () => {
    const harness = makeTool();
    const out = await run(harness, { op: "fields", name: "Nope" });
    expect(out).toEqual({
      error: "Nope is not a known entity type or composite",
      hint: HINT,
    });
  });

  it("returns {error, hint} when name is missing", async () => {
    const harness = makeTool();
    expect(await run(harness, { op: "fields" })).toEqual({
      error: "op='fields' requires `name` (the entity type or composite).",
      hint: HINT,
    });
  });
});

describe("diffbotOntology injected store", () => {
  /* A store that records `load()` calls and never touches the network. */
  function spyStore(): { store: OntologyStore; calls: ({ refresh?: boolean } | undefined)[] } {
    const calls: ({ refresh?: boolean } | undefined)[] = [];
    const ont = Ontology.fromJson(JSON.stringify(FIXTURE_ONTOLOGY));
    const store = {
      load: (options?: { refresh?: boolean }) => {
        calls.push(options);
        return Promise.resolve(ont);
      },
    } as unknown as OntologyStore;
    return { store, calls };
  }

  it("passes refresh straight through to ontologyStore.load", async () => {
    const { store, calls } = spyStore();
    const tool = diffbotOntology({ apiKey: "test-token", ontologyStore: store });

    await tool.execute!({ op: "types" }, toolExecOptions());
    await tool.execute!({ op: "types", refresh: true }, toolExecOptions());

    expect(calls).toHaveLength(2);
    expect(calls[0]?.refresh).toBeUndefined();
    expect(calls[1]?.refresh).toBe(true);
  });

  it("needs no token of its own when a store is injected", async () => {
    const saved = process.env.DIFFBOT_API_TOKEN;
    delete process.env.DIFFBOT_API_TOKEN;
    try {
      const { store } = spyStore();
      const tool = diffbotOntology({ ontologyStore: store });
      expect(await tool.execute!({ op: "types" }, toolExecOptions())).toEqual([
        "Organization",
        "Person",
      ]);
    } finally {
      if (saved === undefined) delete process.env.DIFFBOT_API_TOKEN;
      else process.env.DIFFBOT_API_TOKEN = saved;
    }
  });
});

describe("diffbotOntology input schema", () => {
  it("requires a known op", () => {
    expect(diffbotOntologyInputSchema.safeParse({}).success).toBe(false);
    expect(diffbotOntologyInputSchema.safeParse({ op: "nope" }).success).toBe(false);
    expect(diffbotOntologyInputSchema.safeParse({ op: "types" }).success).toBe(true);
    expect(diffbotOntologyInputSchema.safeParse({ op: "fields", name: "Org" }).success).toBe(true);
    expect(diffbotOntologyInputSchema.safeParse({ op: "types", refresh: "yes" }).success).toBe(
      false,
    );
  });
});
