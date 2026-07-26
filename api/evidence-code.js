const {
  areEvidenceCodesRedeemed,
  clearEvidenceGrant,
  clearEvidenceRedemptions,
  getAllCredits,
  getAllEvidenceGrants,
  getAllGrantedCredits,
  getCredits,
  getEvidenceGrant,
  getEvidenceRedemptions,
  getGrantedCredits,
  getQuestionLogs,
  grantCredits,
  hasPersistentStore,
  normalizeTeam,
  recordEvidenceRedemption,
  redeemEvidenceCode,
  requestClassId,
  setCredits,
  setEvidenceGrant,
  setGrantedCredits,
  withClassScope
} = require("./_credits");

const evidenceCodes = {
  39275: { room: "방송실", roomId: "broadcast", index: 1, evidence: "방송실 장비 점검표", person: "서하린" },
  26547: { room: "방송실", roomId: "broadcast", index: 2, evidence: "AI 자료 열람 기록", person: "서하린" },
  65927: { room: "미술실", roomId: "art", index: 1, evidence: "기말고사 유의사항 포스터 파일", person: "서하린" },
  40018: { room: "미술실", roomId: "art", index: 2, evidence: "삭제된 AI 프롬프트 기록", person: "강우진" },
  91648: { room: "교무실", roomId: "office", index: 1, evidence: "CCTV에 찍힌 강우진의 태블릿", person: "강우진" },
  11582: { room: "교무실", roomId: "office", index: 2, evidence: "책상 위 기말고사 문제지", person: "강우진" },
  79610: { room: "과학실", roomId: "science", index: 1, evidence: "실험 보고서 제출 기록", person: "최다니엘" },
  61408: { room: "과학실", roomId: "science", index: 2, evidence: "과학실 분실물함 기록", person: "최다니엘" },
  87143: { room: "체육관", roomId: "gym", index: 1, evidence: "전교 1등 전 여자친구의 메시지", person: "강우진" },
  13450: { room: "체육관", roomId: "gym", index: 2, evidence: "CCTV에 찍힌 최다니엘의 USB", person: "최다니엘" }
};
const evidenceRewardCredits = 1;
const evidenceRevisitBonusCredits = 2;

const roomCatalog = Object.entries(evidenceCodes).reduce((catalog, [code, entry]) => {
  const room = catalog[entry.roomId] || { roomId: entry.roomId, name: entry.room, options: [] };
  room.options.push({ code: cleanCode(code), index: entry.index, evidence: entry.evidence, person: entry.person });
  catalog[entry.roomId] = room;
  return catalog;
}, {});
Object.values(roomCatalog).forEach((room) => room.options.sort((a, b) => a.index - b.index));

function roomById(roomId) {
  return roomCatalog[String(roomId || "").trim()] || null;
}

function codeForRoomIndex(roomId, index) {
  const room = roomById(roomId);
  const target = Number(index);
  return room?.options.find((option) => option.index === target)?.code || "";
}

function roomOptionsFor(roomId) {
  const room = roomById(roomId);
  if (!room) return [];
  return room.options.map((option) => ({
    index: option.index,
    evidence: option.evidence,
    person: option.person
  }));
}

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

function isTeacher(request, body = {}) {
  return String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase() === "teacher";
}

function teacherAuthError(request, body = {}) {
  if (!isTeacher(request, body)) {
    return { status: 403, code: "TEACHER_ROLE_REQUIRED", error: "Teacher role is required." };
  }
  return null;
}

function evidenceCreditTotals(logs = []) {
  return logs.reduce((totals, entry) => {
    const team = normalizeTeam(entry.team);
    if (!team) return totals;
    totals[team] = (totals[team] || 0) + Math.max(0, Number(entry.added) || 0);
    return totals;
  }, {});
}

function evidenceByCode(code) {
  return evidenceCodes[cleanCode(code)] || null;
}

function publicEvidenceLog(entry = {}) {
  const catalog = evidenceByCode(entry.code);
  return {
    team: normalizeTeam(entry.team),
    user: String(entry.user || entry.team || "").trim().slice(0, 40),
    code: cleanCode(entry.code),
    room: String(catalog?.room || entry.room || "").trim().slice(0, 40),
    evidence: String(catalog?.evidence || entry.evidence || "").trim().slice(0, 80),
    person: String(catalog?.person || entry.person || "").trim().slice(0, 40),
    added: Math.max(0, Number(entry.added) || 0),
    at: entry.at || ""
  };
}

function publicEvidence(evidence = {}) {
  return {
    room: String(evidence.room || "").trim().slice(0, 40),
    roomId: String(evidence.roomId || "").trim().slice(0, 20),
    index: Math.max(0, Number(evidence.index) || 0),
    evidence: String(evidence.evidence || "").trim().slice(0, 80),
    person: String(evidence.person || "").trim().slice(0, 40)
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

async function handleEvidenceCode(request, response) {
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
        grants: await getAllEvidenceGrants(),
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
        grants: await getAllEvidenceGrants(),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "grant") {
      const authError = teacherAuthError(request, body);
      if (authError) {
        sendJson(response, authError.status, { ...authError, fallback: true });
        return;
      }

      const grantTeam = normalizeTeam(body.team);
      if (!grantTeam) {
        sendJson(response, 400, { error: "Valid team is required.", code: "INVALID_TEAM" });
        return;
      }
      const room = roomById(body.roomId);
      if (!room) {
        sendJson(response, 400, { error: "Valid roomId is required.", code: "INVALID_ROOM" });
        return;
      }

      const grant = await setEvidenceGrant(grantTeam, {
        roomId: room.roomId,
        roomName: room.name,
        at: Date.now(),
        by: decodedHeaderValue(request, "x-kit-user") || body.user || "teacher"
      });

      sendJson(response, 200, {
        ok: true,
        team: grantTeam,
        grant,
        grants: await getAllEvidenceGrants(),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "revoke") {
      const authError = teacherAuthError(request, body);
      if (authError) {
        sendJson(response, authError.status, { ...authError, fallback: true });
        return;
      }

      const revokeTeam = normalizeTeam(body.team);
      if (!revokeTeam) {
        sendJson(response, 400, { error: "Valid team is required.", code: "INVALID_TEAM" });
        return;
      }

      await clearEvidenceGrant(revokeTeam);
      sendJson(response, 200, {
        ok: true,
        team: revokeTeam,
        grants: await getAllEvidenceGrants(),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "claim") {
      const claimRole = String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase();
      const claimTeam = normalizeTeam(decodedHeaderValue(request, "x-kit-team") || body.team);
      if (claimRole !== "student") {
        sendJson(response, 403, { error: "Student role is required.", code: "STUDENT_ROLE_REQUIRED" });
        return;
      }
      if (!claimTeam) {
        sendJson(response, 400, { error: "Valid student team is required.", code: "INVALID_TEAM" });
        return;
      }

      const grant = await getEvidenceGrant(claimTeam);
      if (!grant) {
        sendJson(response, 200, { ok: true, team: claimTeam, grant: null, persistent: hasPersistentStore() });
        return;
      }

      sendJson(response, 200, {
        ok: true,
        team: claimTeam,
        grant,
        options: roomOptionsFor(grant.roomId),
        revisitBonus: evidenceRevisitBonusCredits,
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "pick") {
      const pickRole = String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase();
      const pickTeam = normalizeTeam(decodedHeaderValue(request, "x-kit-team") || body.team);
      if (pickRole !== "student") {
        sendJson(response, 403, { error: "Student role is required.", code: "STUDENT_ROLE_REQUIRED" });
        return;
      }
      if (!pickTeam) {
        sendJson(response, 400, { error: "Valid student team is required.", code: "INVALID_TEAM" });
        return;
      }

      const grant = await getEvidenceGrant(pickTeam);
      if (!grant) {
        sendJson(response, 409, { error: "승인된 조사가 없습니다.", code: "NO_GRANT" });
        return;
      }
      const roomId = String(body.roomId || "").trim();
      if (grant.roomId !== roomId) {
        sendJson(response, 403, { error: "승인된 방과 다른 방입니다.", code: "GRANT_ROOM_MISMATCH", grant });
        return;
      }

      const pickCode = codeForRoomIndex(roomId, body.index);
      const pickEvidence = pickCode ? evidenceCodes[pickCode] : null;
      if (!pickEvidence) {
        sendJson(response, 404, { error: "증거를 찾을 수 없습니다.", code: "INVALID_EVIDENCE" });
        return;
      }

      const isNew = await redeemEvidenceCode(pickTeam, pickCode);
      if (!isNew) {
        sendJson(response, 409, {
          error: "이미 획득한 증거입니다.",
          code: "ALREADY_REDEEMED",
          evidence: publicEvidence(pickEvidence),
          grant,
          options: roomOptionsFor(roomId)
        });
        return;
      }

      const result = await grantCredits(pickTeam, evidenceRewardCredits);
      const evidenceLog = await recordEvidenceRedemption({
        team: pickTeam,
        user: decodedHeaderValue(request, "x-kit-user") || body.user || pickTeam,
        code: pickCode,
        room: pickEvidence.room,
        evidence: pickEvidence.evidence,
        person: pickEvidence.person,
        added: evidenceRewardCredits,
        remaining: result.credits
      });
      await clearEvidenceGrant(pickTeam);

      sendJson(response, 200, {
        ok: true,
        picked: true,
        code: pickCode,
        evidence: publicEvidence(pickEvidence),
        evidenceLog: publicEvidenceLog(evidenceLog),
        team: pickTeam,
        added: evidenceRewardCredits,
        credits: result.credits,
        granted: result.granted,
        logs: await getQuestionLogs(pickTeam),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "revisit") {
      const revisitRole = String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase();
      const revisitTeam = normalizeTeam(decodedHeaderValue(request, "x-kit-team") || body.team);
      if (revisitRole !== "student") {
        sendJson(response, 403, { error: "Student role is required.", code: "STUDENT_ROLE_REQUIRED" });
        return;
      }
      if (!revisitTeam) {
        sendJson(response, 400, { error: "Valid student team is required.", code: "INVALID_TEAM" });
        return;
      }

      const grant = await getEvidenceGrant(revisitTeam);
      if (!grant) {
        sendJson(response, 409, { error: "승인된 조사가 없습니다.", code: "NO_GRANT" });
        return;
      }
      const roomId = String(body.roomId || "").trim();
      if (grant.roomId !== roomId) {
        sendJson(response, 403, { error: "승인된 방과 다른 방입니다.", code: "GRANT_ROOM_MISMATCH", grant });
        return;
      }

      const room = roomById(roomId);
      const codes = room ? room.options.map((option) => option.code) : [];
      const redeemedStatus = await areEvidenceCodesRedeemed(revisitTeam, codes);
      const allRedeemed = codes.length > 0 && redeemedStatus.length === codes.length && redeemedStatus.every(Boolean);
      if (!allRedeemed) {
        sendJson(response, 409, {
          error: "아직 고를 수 있는 증거가 남아 있습니다.",
          code: "EVIDENCE_REMAINING",
          grant,
          options: roomOptionsFor(roomId)
        });
        return;
      }

      const result = await grantCredits(revisitTeam, evidenceRevisitBonusCredits);
      const evidenceLog = await recordEvidenceRedemption({
        team: revisitTeam,
        user: decodedHeaderValue(request, "x-kit-user") || body.user || revisitTeam,
        code: `REVISIT-${roomId}`,
        room: room ? room.name : (grant.roomName || ""),
        evidence: "재방문 보너스",
        person: "",
        added: evidenceRevisitBonusCredits,
        remaining: result.credits
      });
      await clearEvidenceGrant(revisitTeam);

      sendJson(response, 200, {
        ok: true,
        revisitBonus: true,
        roomId,
        added: evidenceRevisitBonusCredits,
        evidenceLog: publicEvidenceLog(evidenceLog),
        team: revisitTeam,
        credits: result.credits,
        granted: result.granted,
        logs: await getQuestionLogs(revisitTeam),
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

    const result = await grantCredits(team, evidenceRewardCredits);
    const evidenceLog = await recordEvidenceRedemption({
      team,
      user: decodedHeaderValue(request, "x-kit-user") || body.user || team,
      code,
      room: evidence.room,
      evidence: evidence.evidence,
      person: evidence.person,
      added: evidenceRewardCredits,
      remaining: result.credits
    });

    sendJson(response, 200, {
      ok: true,
      code,
      evidence: publicEvidence(evidence),
      evidenceLog: publicEvidenceLog(evidenceLog),
      team,
      added: evidenceRewardCredits,
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
}

module.exports = async function handler(request, response) {
  const body = bodyFor(request);
  return withClassScope(requestClassId(request, body), () => handleEvidenceCode(request, response));
};
