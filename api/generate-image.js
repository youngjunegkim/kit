const { applyCors, handleCorsPreflight, isAllowedOrigin } = require("./_origin");

const rateWindowMs = 60 * 1000;
const rateLimitPerWindow = Number(process.env.IMAGE_RATE_LIMIT_PER_MINUTE || 8);
const maxPromptChars = Number(process.env.IMAGE_MAX_PROMPT_CHARS || 900);
const maxRequestBytes = Number(process.env.IMAGE_MAX_REQUEST_BYTES || 8000);
const rateBuckets = new Map();

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

function headerValue(request, name) {
  const value = request.headers?.[name.toLowerCase()] || request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function clientIdFor(request) {
  const forwarded = headerValue(request, "x-forwarded-for");
  return String(forwarded || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function isAuthorized(request) {
  const accessCode = process.env.CLASS_ACCESS_CODE;
  if (!accessCode) return true;
  return String(headerValue(request, "x-class-code") || "") === accessCode;
}

function teacherAccessCode() {
  return String(process.env.TEACHER_ACCESS_CODE || process.env.KIT_TEACHER_ACCESS_CODE || "").trim();
}

function isTeacherAuthorized(request) {
  const accessCode = teacherAccessCode();
  if (!accessCode) return true;
  return String(headerValue(request, "x-teacher-code") || "").trim() === accessCode;
}

function isTooLargePayload(payload) {
  try {
    return Buffer.byteLength(JSON.stringify(payload || {}), "utf8") > maxRequestBytes;
  } catch {
    return true;
  }
}

function isRateLimited(request) {
  if (!rateLimitPerWindow || rateLimitPerWindow < 1) return false;

  const clientId = clientIdFor(request);
  const now = Date.now();
  const bucket = rateBuckets.get(clientId);

  if (!bucket || now - bucket.startedAt > rateWindowMs) {
    rateBuckets.set(clientId, { startedAt: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > rateLimitPerWindow;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,!?'"`~\-_/\\()[\]{}:;|]/g, "");
}

function forbiddenWordFor(prompt, card) {
  if (!card || !Array.isArray(card.forbidden)) return "";
  const compact = normalize(prompt);
  return card.forbidden.find((word) => compact.includes(normalize(word))) || "";
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

function imageModelCandidates() {
  function normalizeModelName(model) {
    if (!model) return "";
    const name = String(model).trim().replace(/^models\//, "");
    const deprecated = new Set([
      "gemini-2.0-flash-preview-image-generation",
      "gemini-2.0-flash-exp-image-generation"
    ]);
    return deprecated.has(name) ? "gemini-2.5-flash-image" : name;
  }

  return [
    normalizeModelName(process.env.GEMINI_IMAGE_MODEL),
    "gemini-3.1-flash-image",
    "gemini-2.5-flash-image",
    "gemini-3-pro-image"
  ]
    .filter(Boolean)
    .filter((model, index, models) => models.indexOf(model) === index);
}

function apiVersionFor(model) {
  return /preview|experimental/i.test(model) ? "v1beta" : "v1";
}

function buildImagePrompt(prompt, room) {
  return [
    "Create one classroom-safe image for a Korean middle school guessing game.",
    "Follow only the scene described by the student's prompt.",
    "Do not add captions, labels, watermarks, logos, UI, or readable text.",
    "Use a clear, colorful, realistic classroom-projection friendly style.",
    room ? `Game room: ${room}.` : "",
    `Student prompt: ${prompt}`
  ].filter(Boolean).join("\n");
}

function extractImage(data) {
  const parts = (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || []);
  const imagePart = parts.find((part) => {
    const inlineData = part.inlineData || part.inline_data;
    return inlineData?.data;
  });
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  const text = parts.map((part) => part.text || "").filter(Boolean).join("\n").trim();

  if (!inlineData?.data) return { text };
  return {
    text,
    mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
    data: inlineData.data
  };
}

function shouldTryNext(statusCode, message) {
  return statusCode === 400 ||
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 404 ||
    statusCode === 429 ||
    statusCode === 503 ||
    /api key|quota|rate|model|not found|high demand/i.test(message || "");
}

async function callGeminiImage(prompt, room) {
  const keys = getGeminiKeys();
  if (!keys.length) {
    return {
      statusCode: 503,
      body: { error: "GEMINI_API_KEYS or GEMINI_API_KEY is not set.", fallback: true }
    };
  }

  const models = imageModelCandidates();
  const startIndex = Math.floor(Math.random() * keys.length);
  let lastFailure = {
    statusCode: 502,
    body: { error: "Gemini image request failed.", fallback: true }
  };

  for (const model of models) {
    for (let attempt = 0; attempt < keys.length; attempt += 1) {
      const key = keys[(startIndex + attempt) % keys.length];
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersionFor(model)}/models/${encodeURIComponent(model)}:generateContent`;
      const geminiResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: buildImagePrompt(prompt, room) }]
          }]
        })
      });

      const data = await geminiResponse.json().catch(() => ({}));
      if (geminiResponse.ok) {
        const image = extractImage(data);
        if (!image.data) {
          return {
            statusCode: 502,
            body: {
              error: image.text || data.promptFeedback?.blockReason || "Gemini did not return an image.",
              fallback: true,
              model
            }
          };
        }
        return {
          statusCode: 200,
          body: {
            imageDataUrl: `data:${image.mimeType};base64,${image.data}`,
            mimeType: image.mimeType,
            text: image.text,
            model
          }
        };
      }

      const errorMessage = data.error?.message || data.promptFeedback?.blockReason || "Gemini image request failed.";
      lastFailure = {
        statusCode: geminiResponse.status,
        body: {
          error: errorMessage,
          fallback: true,
          model
        }
      };

      if (!shouldTryNext(geminiResponse.status, errorMessage)) {
        return lastFailure;
      }
    }
  }

  return lastFailure;
}

module.exports = async function handler(request, response) {
  applyCors(request, response);
  if (handleCorsPreflight(request, response, "POST")) return;

  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
    return;
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: "Class access code is required.", requiresAccessCode: true, fallback: true });
    return;
  }

  if (!isTeacherAuthorized(request)) {
    sendJson(response, 401, {
      error: "Teacher access code is required.",
      code: "TEACHER_CODE_REQUIRED",
      fallback: true
    });
    return;
  }

  if (isRateLimited(request)) {
    sendJson(response, 429, { error: "Too many image requests. Please slow down.", fallback: true });
    return;
  }

  if (isTooLargePayload(request.body)) {
    sendJson(response, 413, { error: "Request is too large.", fallback: true });
    return;
  }

  const prompt = String(request.body?.prompt || "").trim();
  const room = String(request.body?.room || "").trim().slice(0, 80);
  const card = request.body?.card || null;

  if (!prompt) {
    sendJson(response, 400, { error: "Prompt is required." });
    return;
  }

  if (prompt.length > maxPromptChars) {
    sendJson(response, 413, { error: "Prompt is too long.", fallback: true });
    return;
  }

  const forbidden = forbiddenWordFor(prompt, card);
  if (forbidden) {
    sendJson(response, 400, {
      error: `Forbidden word included: ${forbidden}`,
      code: "FORBIDDEN_WORD",
      fallback: true
    });
    return;
  }

  try {
    const result = await callGeminiImage(prompt, room);
    sendJson(response, result.statusCode, result.body);
  } catch (error) {
    sendJson(response, 502, {
      error: error.message || "Gemini image request failed.",
      fallback: true
    });
  }
};
