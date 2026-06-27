const { applyCors, handleCorsPreflight, isAllowedOrigin } = require("./_origin");

const maxSpeechChars = Number(process.env.TTS_MAX_CHARS || 1400);

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
        voice: ttsVoice(),
        response_format: "mp3",
        input: text,
        instructions: [
          "너는 사건 추리 수업을 도와주는 작은 탐정 캐릭터 '기티'다.",
          "한국어로 밝고 호기심 많은 캐릭터처럼 말한다.",
          "너무 빠르지 않게 또박또박 말하되, 중요한 순위와 점수는 살짝 강조한다.",
          "과장된 연기보다 학생들이 듣기 좋은 명확한 안내 목소리를 유지한다."
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
