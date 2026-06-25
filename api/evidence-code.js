const {
  getQuestionLogs,
  grantCredits,
  hasPersistentStore,
  normalizeTeam,
  redeemEvidenceCode
} = require("./_credits");

const evidenceCodes = {
  K9F2W7V: { room: "방송실", evidence: "방송실 장비 점검표", person: "서하린" },
  R4B8X1M: { room: "방송실", evidence: "AI 자료 열람 기록", person: "서하린" },
  Z7N3P6D: { room: "미술실", evidence: "기말고사 유의사항 포스터 파일", person: "서하린" },
  L1V9T4C: { room: "미술실", evidence: "삭제된 AI 프롬프트 기록", person: "강우진" },
  H5Q2G8S: { room: "교무실", evidence: "교무실 앞 CCTV", person: "강우진" },
  B3K7J1W: { room: "교무실", evidence: "책상 위 기말고사 문제지", person: "강우진" },
  X6M4F9P: { room: "과학실", evidence: "실험 보고서 제출 기록", person: "최다니엘" },
  V2D8R5Y: { room: "과학실", evidence: "과학실 분실물함 기록", person: "최다니엘" },
  N7C3G1T: { room: "체육관", evidence: "강우진의 연습 노트", person: "강우진" },
  P5W9K2M: { room: "체육관", evidence: "AI의 USB 오인식 결과", person: "최다니엘" }
};

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

function cleanCode(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

module.exports = async function handler(request, response) {
  try {
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
    const team = normalizeTeam(decodedHeaderValue(request, "x-kit-team") || body.team);
    const code = cleanCode(body.code);
    const evidence = evidenceCodes[code];

    if (role !== "student") {
      sendJson(response, 403, { error: "Student role is required.", code: "STUDENT_ROLE_REQUIRED" });
      return;
    }
    if (!team) {
      sendJson(response, 400, { error: "Valid student team is required.", code: "INVALID_TEAM" });
      return;
    }
    if (!evidence) {
      sendJson(response, 404, { error: "증거 코드가 맞지 않습니다.", code: "INVALID_EVIDENCE_CODE" });
      return;
    }

    const isNew = await redeemEvidenceCode(team, code);
    if (!isNew) {
      sendJson(response, 409, {
        error: "이미 사용한 증거 코드입니다.",
        code: "ALREADY_REDEEMED",
        evidence
      });
      return;
    }

    const result = await grantCredits(team, 3);
    sendJson(response, 200, {
      ok: true,
      code,
      evidence,
      team,
      added: 3,
      credits: result.credits,
      granted: result.granted,
      logs: await getQuestionLogs(team),
      persistent: hasPersistentStore()
    });
  } catch (error) {
    sendJson(response, 503, {
      error: error.message || "Evidence code check failed.",
      fallback: true
    });
  }
};
