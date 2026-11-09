import { diffbotWebSearch as diffbotWebSearchFactory } from "../../src/tools/web-search.js";

// Value reference so inferred execute options track the installed `ai` major.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type anchor only
const toolTypeAnchor = diffbotWebSearchFactory;

type ToolExecOpts = NonNullable<
  Parameters<NonNullable<ReturnType<typeof toolTypeAnchor>["execute"]>>[1]
>;

export function toolExecOptions(): ToolExecOpts {
  return {
    toolCallId: "test",
    messages: [],
    abortSignal: new AbortController().signal,
    context: {},
  } as ToolExecOpts;
}
