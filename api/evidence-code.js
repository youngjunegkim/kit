const {
  clearEvidenceRedemptions,
  getAllCredits,
  getAllGrantedCredits,
  getCredits,
  getEvidenceRedemptions,
  getGrantedCredits,
  getQuestionLogs,
  grantCredits,
  hasPersistentStore,
  normalizeTeam,
  recordEvidenceRedemption,
  redeemEvidenceCode,
  setCredits,
  setGrantedCredits
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
  N7C3G1T: { room: "체육관", evidence: "연습 노트", person: "강우진" },
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

function queryValue(request, name) {
  try {
    return new URL(request.url || "", "http://localhost").searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function cleanCode(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function teacherAccessCode() {
  return String(process.env.TEACHER_ACCESS_CODE || process.env.KIT_TEACHER_ACCESS_CODE || "").trim();
}

function isTeacher(request, body = {}) {
  return String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase() === "teacher";
}

function teacherCodeFor(request, body = {}) {
  return String(headerValue(request, "x-teacher-code") || body.teacherCode || "").trim();
}

function teacherAuthError(request, body = {}) {
  if (!isTeacher(request, body)) {
    return { status: 403, code: "TEACHER_ROLE_REQUIRED", error: "Teacher role is required." };
  }

  const configuredCode = teacherAccessCode();
  if (!configuredCode) return null;
  if (teacherCodeFor(request, body) === configuredCode) return null;

  return {
    status: 401,
    code: "TEACHER_CODE_REQUIRED",
    error: "Teacher access code is required."
  };
}

function evidenceCreditTotals(logs = []) {
  return logs.reduce((totals, entry) => {
    const team = normalizeTeam(entry.team);
    if (!team) return totals;
    totals[team] = (totals[team] || 0) + Math.max(0, Number(entry.added) || 0);
    return totals;
  }, {});
}

function publicEvidenceLog(entry = {}) {
  return {
    team: normalizeTeam(entry.team),
    user: String(entry.user || entry.team || "").trim().slice(0, 40),
    code: cleanCode(entry.code),
    room: String(entry.room || "").trim().slice(0, 40),
    evidence: String(entry.evidence || "").trim().slice(0, 80),
    added: Math.max(0, Number(entry.added) || 0),
    at: entry.at || ""
  };
}

function publicEvidence(evidence = {}) {
  return {
    room: String(evidence.room || "").trim().slice(0, 40),
    evidence: String(evidence.evidence || "").trim().slice(0, 80)
  };
}

async function subtractEvidenceCredits(logs = []) {
  const totals = evidenceCreditTotals(logs);
  await Promise.all(Object.entries(totals).map(async ([team, amount]) => {
    const current = Math.max(0, Number(await getCredits(team)) || 0);
    const granted = Math.max(0, Number(await getGrantedCredits(team)) || 0);
    await setCredits(team, Math.max(0, current - amount));
    await setGrantedCredits(team, Math.max(0, granted - amount));
  }));
}

module.exports = async function handler(request, response) {
  try {
    if (!isAllowedOrigin(request)) {
      sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
      return;
    }

    if (request.method === "GET") {
      const role = String(headerValue(request, "x-kit-role") || queryValue(request, "role") || "").toLowerCase();
      const team = normalizeTeam(decodedHeaderValue(request, "x-kit-team") || queryValue(request, "team"));
      const logs = await getEvidenceRedemptions();

      if (role === "student") {
        if (!team) {
          sendJson(response, 400, { error: "Valid student team is required.", code: "INVALID_TEAM" });
          return;
        }
        sendJson(response, 200, {
          evidenceLogs: logs
            .filter((entry) => normalizeTeam(entry.team) === team)
            .map(publicEvidenceLog),
          persistent: hasPersistentStore()
        });
        return;
      }

      const authError = teacherAuthError(request);
      if (authError) {
        sendJson(response, authError.status, { ...authError, fallback: true });
        return;
      }

      sendJson(response, 200, {
        evidenceLogs: logs,
        credits: await getAllCredits(),
        granted: await getAllGrantedCredits(),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("allow", "GET, POST");
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const body = bodyFor(request);
    const action = String(body.action || "").toLowerCase();

    if (action === "clear") {
      const authError = teacherAuthError(request, body);
      if (authError) {
        sendJson(response, authError.status, { ...authError, fallback: true });
        return;
      }

      const logs = await getEvidenceRedemptions();
      const shouldResetCredits = body.resetCredits !== false;
      if (shouldResetCredits) await subtractEvidenceCredits(logs);
      const removed = await clearEvidenceRedemptions();

      sendJson(response, 200, {
        ok: true,
        removed: removed.length,
        resetCredits: shouldResetCredits,
        evidenceLogs: [],
        credits: await getAllCredits(),
        granted: await getAllGrantedCredits(),
        persistent: hasPersistentStore()
      });
      return;
    }

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
        evidence: publicEvidence(evidence)
      });
      return;
    }

    const result = await grantCredits(team, 3);
    const evidenceLog = await recordEvidenceRedemption({
      team,
      user: decodedHeaderValue(request, "x-kit-user") || body.user || team,
      code,
      room: evidence.room,
      evidence: evidence.evidence,
      person: evidence.person,
      added: 3,
      remaining: result.credits
    });

    sendJson(response, 200, {
      ok: true,
      code,
      evidence: publicEvidence(evidence),
      evidenceLog: publicEvidenceLog(evidenceLog),
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
