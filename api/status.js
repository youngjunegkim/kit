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

function getOpenAiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function openAiModelName() {
  return String(process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-5.5").trim();
}

function getGeminiImageKeys() {
  return uniqueKeysFrom(
    process.env.GEMINI_IMAGE_API_KEYS,
    process.env.GEMINI_IMAGE_API_KEY,
    process.env.GEMINI_API_KEYS,
    process.env.GEMINI_API_KEY
  );
}

function isEnabledSetting(value) {
  return ["1", "true", "on", "yes"].includes(String(value || "").trim().toLowerCase());
}

function isDisabledSetting(value) {
  return ["0", "false", "off", "none"].includes(String(value || "").trim().toLowerCase());
}

function geminiImageGenerationEnabled() {
  return isEnabledSetting(process.env.GEMINI_IMAGE_GENERATION || process.env.GOOGLE_IMAGE_GENERATION || "0");
}

function imagePromptTranslationEnabled() {
  return isEnabledSetting(process.env.IMAGE_PROMPT_TRANSLATION || process.env.GEMINI_IMAGE_PROMPT_TRANSLATION || "1");
}

function freeImageFallbackEnabled() {
  return !isDisabledSetting(process.env.FREE_IMAGE_FALLBACK || "1");
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

async function availableImagenModels() {
  const keys = getGeminiImageKeys();
  const seen = new Set();
  const available = [];

  for (const key of keys) {
    for (const apiVersion of ["v1beta"]) {
      try {
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models`, {
          headers: { "x-goog-api-key": key }
        });
        const data = await geminiResponse.json().catch(() => ({}));
        if (!geminiResponse.ok || !Array.isArray(data.models)) continue;

        for (const model of data.models) {
          const name = normalizeModelName(model.name);
          const methods = model.supportedGenerationMethods || model.supported_generation_methods || [];
          if (!methods.includes("predict") || !/^imagen-/i.test(name)) continue;
          const id = `${name}:${apiVersion}`;
          if (seen.has(id)) continue;
          seen.add(id);
          available.push({ model: name, apiVersion });
        }
      } catch {
        // Keep the status endpoint usable even when Imagen discovery fails.
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

  const imageGenerationEnabled = geminiImageGenerationEnabled();
  const imageModels = imageGenerationEnabled
    ? [
      ...await availableImageModels(),
      ...await availableImagenModels()
    ]
    : [];
  sendJson(response, 200, {
    provider: "openai",
    chatProvider: "openai",
    model: openAiModelName(),
    hasOpenAiKey: Boolean(getOpenAiKey()),
    imageModel: imageModelName(),
    hasGeminiKey: getGeminiKeys().length > 0,
    hasGeminiImageKey: getGeminiImageKeys().length > 0,
    hasAvailableImageModel: imageGenerationEnabled && imageModels.length > 0,
    availableImageModels: imageModels.slice(0, 8),
    geminiImageGenerationEnabled: imageGenerationEnabled,
    freeImageFallback: freeImageFallbackEnabled(),
    freeImageProvider: process.env.FREE_IMAGE_PROVIDER || "pollinations",
    translatesImagePrompts: imagePromptTranslationEnabled() && getGeminiKeys().length > 0,
    imagePromptTranslationEnabled: imagePromptTranslationEnabled(),
    translationModel: process.env.GEMINI_TRANSLATION_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash",
    usesSeparateImageKey: uniqueKeysFrom(process.env.GEMINI_IMAGE_API_KEYS, process.env.GEMINI_IMAGE_API_KEY).length > 0,
    requiresAccessCode: false,
    hasCreditStore: hasPersistentStore()
  });
};
