/** Hand-written types for doc-examples.mjs (see the header comment there). */
export interface DocExample {
  /** Stable, filename-safe id, e.g. `readme-03`. */
  name: string;
  /** Where it came from, for failure messages. */
  source: string;
  code: string;
}

export declare const README_PATH: string;
export declare const REGISTRY_ENTRY_PATH: string;
export declare function registryCodeExample(markdown?: string): string;
export declare function readDocExamples(): DocExample[];
export declare function needsLlm(code: string): boolean;
