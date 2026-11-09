import { DiffbotClient } from "@diffbot/typescript";

const raw = process.env.DIFFBOT_API_TOKEN;
export const token = typeof raw === "string" ? raw.trim() : "";
export const hasToken = token.length > 0;

/** Never call at module scope — the SDK throws on a falsy token. */
export const makeClient = () => new DiffbotClient({ token, timeout: 120_000 });
