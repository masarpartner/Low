import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

/**
 * Vercel Serverless Function entrypoint.
 * Bundled into api/index.js and api/[...path].js by build.mjs.
 */
export default function handler(req: any, res: any) {
  // When Vercel rewrites /api/xxx -> /api, it provides the original URL in x-matched-path or x-forwarded-uri
  const originalUrl = req.headers?.["x-matched-path"] || req.headers?.["x-forwarded-uri"];
  if (
    typeof originalUrl === "string" &&
    originalUrl &&
    (req.url === "/api" || req.url === "/api/" || req.url === "/api/index" || req.url === "/api/index.js")
  ) {
    req.url = originalUrl;
  }

  // Vercel terminates TLS at the edge; signal this to Express
  if (!req.headers) req.headers = {};
  req.headers["x-forwarded-proto"] = "https";
  return app(req, res);
}
