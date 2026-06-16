const { hasPersistentStore } = require("./_credits");
const { applyCors, handleCorsPreflight } = require("./_origin");

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

function getGeminiKeys() {
  const rawKeys = [process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY]
    .filter(Boolean)
    .join(",");
  const keys = rawKeys
    .split(/[,\n;]/)
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

function imageModelName() {
  const model = String(process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image")
    .trim()
    .replace(/^models\//, "");
  const deprecated = new Set([
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-exp-image-generation"
  ]);
  return deprecated.has(model) ? "gemini-2.5-flash-image" : model;
}

module.exports = function handler(request, response) {
  applyCors(request, response);
  if (handleCorsPreflight(request, response, "GET")) return;

  if (request.method !== "GET") {
    response.setHeader("allow", "GET");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  sendJson(response, 200, {
    provider: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    imageModel: imageModelName(),
    hasGeminiKey: getGeminiKeys().length > 0,
    requiresAccessCode: Boolean(process.env.CLASS_ACCESS_CODE),
    hasCreditStore: hasPersistentStore()
  });
};
