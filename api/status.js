const { hasPersistentStore } = require("./_credits");
const { applyCors, handleCorsPreflight } = require("./_origin");

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

function uniqueKeysFrom(...values) {
  const keys = values
    .filter(Boolean)
    .join(",")
    .split(/[,\n;]/)
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

function getGeminiKeys() {
  return uniqueKeysFrom(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY);
}

function getGeminiImageKeys() {
  const imageKeys = uniqueKeysFrom(process.env.GEMINI_IMAGE_API_KEYS, process.env.GEMINI_IMAGE_API_KEY);
  if (imageKeys.length) return imageKeys;
  return getGeminiKeys();
}

function imageModelName() {
  return String(process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image")
    .trim()
    .replace(/^models\//, "");
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
    hasGeminiImageKey: getGeminiImageKeys().length > 0,
    usesSeparateImageKey: uniqueKeysFrom(process.env.GEMINI_IMAGE_API_KEYS, process.env.GEMINI_IMAGE_API_KEY).length > 0,
    requiresAccessCode: Boolean(process.env.CLASS_ACCESS_CODE),
    hasCreditStore: hasPersistentStore()
  });
};
