const {
  bumpSimilaritySubmitCount,
  clearSimilaritySentences,
  consumeCredits,
  consumeSimilarityFreeResubmit,
  getCredits,
  getSimilaritySentences,
  getSimilaritySubmitCount,
  getSimilarityFreeResubmits,
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
      // 학생은 자기 팀의 제출 횟수만 조회한다(팝업 열 때 버튼 문구 결정용, 1회성).
      if (role === "student") {
        const team = normalizeTeam(decodedHeaderValue(request, "x-kit-team") || queryValue(request, "team"));
        if (!team) {
          sendJson(response, 400, { error: "Valid student team is required.", code: "INVALID_TEAM" });
          return;
        }
        const submitCount = await getSimilaritySubmitCount(team);
        // 재전송 무료권 개수도 함께 내려 버튼 라벨을 "다시 보내기 (무료)"로 바꿀 수 있게 한다.
        const freeResubmits = await getSimilarityFreeResubmits(team);
        sendJson(response, 200, {
          ok: true,
          team,
          submitCount,
          resubmitCost,
          freeResubmits,
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

    // 팀당 첫 제출은 무료, 이후 재전송은 질문권 5개 차감.
    const submitCount = await getSimilaritySubmitCount(team);
    const isResubmit = submitCount >= 1;

    // 책임성(황금열쇠) 카드로 얻은 재전송 무료권이 있으면 이번 재전송은 질문권 5개 대신
    // 무료권을 1개 쓴다. 무료권이 있으면 질문권 부족(409)도 건너뛴다.
    let freeAvailable = false;
    if (isResubmit) {
      freeAvailable = (await getSimilarityFreeResubmits(team)) > 0;
    }

    // 재전송인데 무료권도 없고 질문권도 부족하면 저장도 차감도 하지 않고 거부한다.
    let credits = null;
    if (isResubmit && !freeAvailable) {
      credits = Math.max(0, Number(await getCredits(team)) || 0);
      if (credits < resubmitCost) {
        sendJson(response, 409, {
          error: "질문권이 부족합니다.",
          code: "INSUFFICIENT_CREDITS",
          needed: resubmitCost,
          credits,
          submitCount
        });
        return;
      }
    }

    // 문장을 먼저 저장하고, 그 다음에 질문권/무료권을 처리한다. (차감 먼저 하면 저장 실패 시
    // 학생이 손해를 봄. 반대 순서면 최악이 공짜 재전송이라 덜 나쁘다.)
    const entry = await recordSimilaritySentence({
      team,
      user: decodedHeaderValue(request, "x-kit-user") || body.user || team,
      sentence,
      remainingCredits: body.remainingCredits
    });
    if (!entry) {
      sendJson(response, 503, { error: "Similarity sentence store failed.", fallback: true });
      return;
    }

    // 차감: 무료권이 있으면 무료권을 1개 소진(질문권은 그대로), 없으면 심문과 같은
    // 원자적 Lua 차감으로 질문권 5개를 깎는다. 저장은 이미 끝났으므로, 혹시 경합으로
    // 차감/소진이 실패해도(공짜 재전송) 저장은 남는다.
    let charged = 0;
    let freeUsed = false;
    if (isResubmit) {
      const free = freeAvailable ? await consumeSimilarityFreeResubmit(team) : { used: false };
      if (free.used) {
        freeUsed = true;
        credits = Math.max(0, Number(await getCredits(team)) || 0); // 질문권 유지
      } else {
        // 무료권이 없거나(일반 재전송) 경합으로 사라졌으면 질문권으로 차감(폴백).
        const spend = await consumeCredits(team, resubmitCost);
        credits = spend.ok ? spend.remaining : Math.max(0, Number(await getCredits(team)) || 0);
        charged = spend.ok ? resubmitCost : 0;
      }
    } else {
      credits = Math.max(0, Number(await getCredits(team)) || 0);
    }
    const newSubmitCount = await bumpSimilaritySubmitCount(team);
    const freeResubmits = await getSimilarityFreeResubmits(team);

    sendJson(response, 200, {
      ok: true,
      sentence: publicSentence(entry),
      submitCount: newSubmitCount,
      charged,
      freeUsed,
      credits,
      resubmitCost,
      freeResubmits,
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
