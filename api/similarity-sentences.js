const {
  bumpSimilaritySubmitCount,
  clearSimilaritySentences,
  consumeCredits,
  getCredits,
  getSimilaritySentences,
  getSimilaritySubmitCount,
  hasPersistentStore,
  normalizeTeam,
  recordSimilaritySentence,
  requestClassId,
  withClassScope
} = require("./_credits");

const maxSentenceChars = 500;
const resubmitCost = 5;

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

function decodedHeaderValue(request, name) {
  const value = headerValue(request, name);
  if (!value) return "";
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function isAllowedOrigin(request) {
  const origin = headerValue(request, "origin");
  if (!origin) return true;

  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowedOrigins.includes(origin)) return true;

  const host = String(headerValue(request, "x-forwarded-host") || headerValue(request, "host") || "");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
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

function queryValue(request, name) {
  try {
    return new URL(request.url || "", "http://localhost").searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function publicSentence(entry = {}) {
  return {
    id: String(entry.id || ""),
    team: normalizeTeam(entry.team),
    user: String(entry.user || entry.team || "").trim().slice(0, 40),
    sentence: String(entry.sentence || "").trim().slice(0, maxSentenceChars),
    remainingCredits: Math.max(0, Math.floor(Number(entry.remainingCredits) || 0)),
    at: entry.at || ""
  };
}

async function handleSimilaritySentences(request, response) {
  try {
    if (!isAllowedOrigin(request)) {
      sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
      return;
    }

    const role = String(headerValue(request, "x-kit-role") || queryValue(request, "role") || "").toLowerCase();

    if (request.method === "GET") {
      if (role === "student") {
        const team = normalizeTeam(decodedHeaderValue(request, "x-kit-team") || queryValue(request, "team"));
        if (!team) {
          sendJson(response, 400, { error: "Valid student team is required.", code: "INVALID_TEAM" });
          return;
        }
        const submitCount = await getSimilaritySubmitCount(team);
        sendJson(response, 200, {
          ok: true,
          team,
          submitCount,
          resubmitCost,
          persistent: hasPersistentStore()
        });
        return;
      }
      if (role !== "teacher") {
        sendJson(response, 403, { error: "Teacher role is required.", code: "TEACHER_ROLE_REQUIRED" });
        return;
      }
      const sentences = await getSimilaritySentences();
      sendJson(response, 200, {
        sentences: sentences.map(publicSentence),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (request.method !== "POST" && request.method !== "DELETE") {
      response.setHeader("allow", "GET, POST, DELETE");
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const body = bodyFor(request);
    const action = request.method === "DELETE" ? "clear" : String(body.action || "").trim().toLowerCase();
    if (action === "clear") {
      if (role !== "teacher") {
        sendJson(response, 403, { error: "Teacher role is required.", code: "TEACHER_ROLE_REQUIRED" });
        return;
      }
      const removed = await clearSimilaritySentences();
      sendJson(response, 200, {
        ok: true,
        removed: removed.length,
        sentences: [],
        persistent: hasPersistentStore()
      });
      return;
    }

    const team = normalizeTeam(decodedHeaderValue(request, "x-kit-team") || body.team);
    const sentence = String(body.sentence || "").replace(/\s+/g, " ").trim();

    if (role !== "student") {
      sendJson(response, 403, { error: "Student role is required.", code: "STUDENT_ROLE_REQUIRED" });
      return;
    }
    if (!team) {
      sendJson(response, 400, { error: "Valid student team is required.", code: "INVALID_TEAM" });
      return;
    }
    if (!sentence) {
      sendJson(response, 400, { error: "Sentence is required.", code: "EMPTY_SENTENCE" });
      return;
    }
    if (sentence.length > maxSentenceChars) {
      sendJson(response, 400, { error: `Sentence must be ${maxSentenceChars} characters or fewer.`, code: "SENTENCE_TOO_LONG" });
      return;
    }

    const submitCount = await getSimilaritySubmitCount(team);
    const isResubmit = submitCount >= 1;
    let credits = Math.max(0, Number(await getCredits(team)) || 0);
    let charged = 0;
    if (isResubmit) {
      if (credits < resubmitCost) {
        sendJson(response, 409, {
          error: "코인이 부족합니다.",
          code: "INSUFFICIENT_CREDITS",
          needed: resubmitCost,
          credits,
          submitCount
        });
        return;
      }
      const spend = await consumeCredits(team, resubmitCost);
      if (!spend.ok) {
        sendJson(response, 409, {
          error: "코인이 부족합니다.",
          code: "INSUFFICIENT_CREDITS",
          needed: resubmitCost,
          credits: spend.remaining,
          submitCount
        });
        return;
      }
      credits = spend.remaining;
      charged = resubmitCost;
    }

    const entry = await recordSimilaritySentence({
      team,
      user: decodedHeaderValue(request, "x-kit-user") || body.user || team,
      sentence,
      remainingCredits: credits
    });
    if (!entry) {
      sendJson(response, 503, { error: "Similarity sentence store failed.", fallback: true });
      return;
    }

    const newSubmitCount = await bumpSimilaritySubmitCount(team);

    sendJson(response, 200, {
      ok: true,
      sentence: publicSentence(entry),
      submitCount: newSubmitCount,
      charged,
      credits,
      resubmitCost,
      persistent: hasPersistentStore()
    });
  } catch (error) {
    sendJson(response, 503, {
      error: error.message || "Similarity sentence store failed.",
      fallback: true
    });
  }
}

module.exports = async function handler(request, response) {
  const body = bodyFor(request);
  return withClassScope(requestClassId(request, body), () => handleSimilaritySentences(request, response));
};
