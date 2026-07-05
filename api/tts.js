const { applyCors, handleCorsPreflight, isAllowedOrigin } = require("./_origin");

const maxSpeechChars = Number(process.env.TTS_MAX_CHARS || 1400);
const builtInVoices = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar"
]);

function headerValue(request, name) {
  const value = request.headers?.[name.toLowerCase()] || request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

function bodyFor(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body;
}

function openAiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function ttsModel() {
  return String(process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts").trim();
}

function ttsVoice() {
  return String(process.env.OPENAI_TTS_VOICE || "shimmer").trim();
}

function requestedVoice(value) {
  const voice = String(value || "").trim().toLowerCase();
  return builtInVoices.has(voice) ? voice : ttsVoice();
}

function cleanSpeechText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Number.isFinite(maxSpeechChars) && maxSpeechChars > 0 ? maxSpeechChars : 1400);
}

module.exports = async function handler(request, response) {
  applyCors(request, response);
  if (handleCorsPreflight(request, response, "POST")) return;

  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const body = bodyFor(request);
  const role = String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase();
  if (role !== "teacher") {
    sendJson(response, 403, { error: "Teacher role is required.", code: "TEACHER_ROLE_REQUIRED" });
    return;
  }

  const text = cleanSpeechText(body.text);
  if (!text) {
    sendJson(response, 400, { error: "Speech text is required." });
    return;
  }

  const apiKey = openAiKey();
  if (!apiKey) {
    sendJson(response, 503, { error: "OPENAI_API_KEY is not set.", fallback: true });
    return;
  }

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: ttsModel(),
        voice: requestedVoice(body.voice),
        response_format: "mp3",
        input: text,
        instructions: [
          "You are 'Giti', a tiny detective mascot for a classroom mystery game.",
          "Speak in Korean with a bright, playful, highly character-like mascot voice: curious, clever, and slightly mischievous.",
          "Use expressive intonation, lively rhythm, and small dramatic pauses before ranks, scores, and evidence words.",
          "Keep the pitch a little higher, warmer, and more animated than a normal narrator, but do not sound like a baby.",
          "Sound like an energetic animated detective sidekick revealing clues to students, not like a formal announcer or newsreader.",
          "Make the evaluation feel suspenseful, friendly, and fun while keeping every Korean word clear.",
          "Do not rush, do not mumble, and do not add extra content beyond the provided text."
        ].join(" ")
      })
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text().catch(() => "");
      sendJson(response, openAiResponse.status, {
        error: errorText || "OpenAI TTS request failed.",
        fallback: true
      });
      return;
    }

    const audio = Buffer.from(await openAiResponse.arrayBuffer());
    response.statusCode = 200;
    response.setHeader("content-type", "audio/mpeg");
    response.setHeader("cache-control", "private, max-age=3600");
    response.end(audio);
  } catch (error) {
    sendJson(response, 502, {
      error: error.message || "Text to speech request failed.",
      fallback: true
    });
  }
};
