// This file is deliberately plain CommonJS (.cjs), which always overrides
// package.json's "type": "module" for this one file regardless of that setting.
//
// Why: server.ts and its local imports (src/data/mockData.ts, src/lib/remoteDb.ts,
// etc.) are written with extensionless relative imports, which is correct for a
// bundler (Vite handles the frontend) but breaks Node's native ESM loader, which
// requires exact ".js" extensions on every relative import.
//
// If Vercel is left to compile api/index.ts itself, it does NOT fully bundle it -
// it transpiles TypeScript to JS roughly 1:1 and lets Node's runtime ESM resolver
// handle the imports, which then fails with ERR_MODULE_NOT_FOUND on every relative
// import missing an extension.
//
// The fix: skip Vercel's TS compilation for this function entirely. `npm run build`
// (set as this project's Vercel buildCommand) already bundles server.ts and every
// local file it imports into one self-contained dist/server.cjs via esbuild - so
// there are no unresolved relative imports left for Node to choke on at runtime.
// This file's only job is to load that finished bundle and wire it into Vercel's
// expected handler shape.

const app = require('../dist/server.cjs').default || require('../dist/server.cjs');

module.exports = function handler(req, res) {
  // Ensure that /api prefix is preserved for Express router if stripped by a serverless rewrite
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/api/')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
