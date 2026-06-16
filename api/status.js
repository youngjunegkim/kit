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
  return uniqueKeysFrom(
    process.env.GEMINI_IMAGE_API_KEYS,
    process.env.GEMINI_IMAGE_API_KEY,
    process.env.GEMINI_API_KEYS,
    process.env.GEMINI_API_KEY
  );
}

function imageModelName() {
  return String(process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image")
    .trim()
    .replace(/^models\//, "");
}

function normalizeModelName(model) {
  return String(model || "").trim().replace(/^models\//, "");
}

function isImageGenerationModel(model) {
  const name = normalizeModelName(model.name);
  const methods = model.supportedGenerationMethods || model.supported_generation_methods || [];
  return methods.includes("generateContent") && /(^|[-_])(image|imagen)([-_]|$)/i.test(name);
}

async function availableImageModels() {
  const keys = getGeminiImageKeys();
  const seen = new Set();
  const available = [];

  for (const key of keys) {
    for (const apiVersion of ["v1", "v1beta"]) {
      try {
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models`, {
          headers: { "x-goog-api-key": key }
        });
        const data = await geminiResponse.json().catch(() => ({}));
        if (!geminiResponse.ok || !Array.isArray(data.models)) continue;

        for (const model of data.models) {
          if (!isImageGenerationModel(model)) continue;
          const name = normalizeModelName(model.name);
          const id = `${name}:${apiVersion}`;
          if (seen.has(id)) continue;
          seen.add(id);
          available.push({ model: name, apiVersion });
        }
      } catch {
        // Keep the status endpoint usable even when model discovery fails.
      }
    }
  }

  return available;
}

module.exports = async function handler(request, response) {
  applyCors(request, response);
  if (handleCorsPreflight(request, response, "GET")) return;

  if (request.method !== "GET") {
    response.setHeader("allow", "GET");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const imageModels = await availableImageModels();
  sendJson(response, 200, {
    provider: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    imageModel: imageModelName(),
    hasGeminiKey: getGeminiKeys().length > 0,
    hasGeminiImageKey: getGeminiImageKeys().length > 0,
    hasAvailableImageModel: imageModels.length > 0,
    availableImageModels: imageModels.slice(0, 8),
    usesSeparateImageKey: uniqueKeysFrom(process.env.GEMINI_IMAGE_API_KEYS, process.env.GEMINI_IMAGE_API_KEY).length > 0,
    requiresAccessCode: Boolean(process.env.CLASS_ACCESS_CODE),
    hasCreditStore: hasPersistentStore()
  });
};
