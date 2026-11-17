// DEV-ONLY local SDK resolution.
// TODO(@diffbot/typescript 0.5.0): once 0.5.0 is on npm, delete this file, then run
// `pnpm install` to refresh pnpm-lock.yaml against the registry.
//
// While `@diffbot/typescript` ^0.5.0 is unpublished, resolve it to a sibling checkout
// (../diffbot-typescript, built to dist/) when that directory exists. Without the
// sibling this is a no-op and the production range in package.json applies.
const fs = require("node:fs");
const path = require("node:path");

// DIFFBOT_TYPESCRIPT_DIR (relative to this repo or absolute) overrides the sibling path, e.g.
// to point at a separately built copy when the sibling's dist/ is stale.
const sibling = path.resolve(__dirname, process.env.DIFFBOT_TYPESCRIPT_DIR || "../diffbot-typescript");
const hasSibling = fs.existsSync(path.join(sibling, "package.json"));
const linkTarget = "link:" + path.relative(__dirname, sibling);

module.exports = {
  hooks: {
    readPackage(pkg) {
      if (hasSibling && pkg.name === "@diffbot/ai-sdk" && pkg.dependencies?.["@diffbot/typescript"]) {
        pkg.dependencies["@diffbot/typescript"] = linkTarget;
      }
      return pkg;
    },
  },
};
