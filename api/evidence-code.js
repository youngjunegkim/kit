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
  recordGoldenNotice,
  recordEvidenceRedemption,
  redeemEvidenceCode,
  reduceCredits,
  requestClassId,
  setCredits,
  setEvidenceGrant,
  setGrantedCredits,
  teams,
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

const goldenKeyCards = {
  337446: {
    effect: "biasedJudgment",
    title: "편향된 판단",
    concept: "편향",
    sign: "-",
    tone: "bad",
    selfDelta: -2,
    ethicsMeaning: "AI가 배운 정보와 한쪽으로 치우쳐 있어서, 특정 집단이나 관점에 치우친 불공정한 결과를 내는 현상",
    popup: "편향된 AI가 차별적인 결과를 내놓아 해당 팀이 피해자가 되었습니다! 해당 팀은 코인 두 개를 잃습니다. (단, 현재 가진 질문권 이하로만 차감)"
  },
  906458: {
    effect: "doubleCheck",
    title: "한번 더 확인",
    concept: "신뢰성",
    sign: "+",
    tone: "ok",
    selfDelta: 4,
    ethicsMeaning: "AI를 사용하는 목적과 의도 안에서 안전하게 사용하기",
    popup: "AI의 답을 다른 자료로 확인하여 틀린정보를 찾아냈습니다! 큰 실수를 막아 해당 팀은 코인 4개를 획득합니다."
  },
  505132: {
    effect: "fakeNews",
    title: "가짜정보",
    concept: "환각",
    sign: "-",
    tone: "bad",
    selfDelta: -2,
    ethicsMeaning: "AI가 사실이 아닌 내용을 사실인 것처럼 그럴듯하게 만들어내는 현상",
    popup: "가짜 정보 발생! AI가 지어낸 거짓 정보를 사실인 줄 알고 사용해 해당 팀이 피해를 입었습니다! 해당 팀은 코인 두 개를 잃습니다."
  },
  382867: {
    effect: "aiUpgradeSweep",
    title: "모두를 위한 AI",
    concept: "포용성",
    sign: "+",
    tone: "ok",
    selfDelta: 3,
    otherDelta: 2,
    ethicsMeaning: "AI가 낸 차별이나 편견을 포함하지 않고, 다양한 모습을 존중하고 있는지 살피기",
    popup: "우리 팀이 나이, 성별, 장애 여부를 가리지 않고 누구나 쓸 수 있는 AI를 개발했습니다! 해당 팀은 3개를 획득하고, 다른 모든 팀은 코인 2개씩 획득합니다.",
    affectedPopup: "다른 팀의 모두를 위한 AI 효과로 코인 2개를 획득합니다."
  },
  144051: {
    effect: "humanChoiceClue",
    title: "인간의 선택",
    concept: "주체성",
    sign: "+",
    tone: "ok",
    selfDelta: 0,
    ethicsMeaning: "AI에게 맡길 것과 사람이 할 것을 구분하고, 마지막 결정은 본인이 내리기",
    popup: "본 사건의 범인은 주체성이 부족하다는 단서가 나왔습니다! 사건노트를 살펴보십시오!",
    popupHighlights: ["주체성이 부족"]
  },
  495759: {
    effect: "ethicsKillSwitch",
    title: "AI 윤리 킬 스위치",
    concept: "책임성",
    sign: "+",
    tone: "ok",
    selfDelta: 4,
    ethicsMeaning: "AI는 그 결과에 대해 책임질 수 있는 범위 안에서 사용하기",
    popup: "AI가 이상한 방향으로 작동하는 것을 확인하고 작동을 멈췄습니다! 책임감 있는 사용으로 해당 팀은 코인 4개를 획득합니다."
  },
  244391: {
    effect: "deepfakeEvent",
    title: "딥페이크 경보",
    concept: "딥페이크",
    sign: "-",
    tone: "bad",
    selfDelta: -1,
    otherDelta: -1,
    ethicsMeaning: "인공지능을 활용해 특정 인물의 얼굴이나 음성을 합성하여 진짜처럼 만드는 기술 및 결과물",
    popup: "'딥페이크 경보' 발동! 인공지능 합성 가짜뉴스가 퍼져 사회적 혼란이 발생! 해당 팀을 포함한 모든 팀에서 코인 1개씩 잃습니다.",
    affectedPopup: "'딥페이크 경보' 발동! 인공지능 합성 가짜뉴스가 퍼져 사회적 혼란이 발생! 해당 팀을 포함한 모든 팀에서 코인 1개씩 잃습니다."
  },
  564376: {
    effect: "deepfakeEvent",
    title: "딥페이크 경보",
    concept: "딥페이크",
    sign: "-",
    tone: "bad",
    selfDelta: -1,
    otherDelta: -1,
    ethicsMeaning: "인공지능을 활용해 특정 인물의 얼굴이나 음성을 합성하여 진짜처럼 만드는 기술 및 결과물",
    popup: "'딥페이크 경보' 발동! 인공지능 합성 가짜뉴스가 퍼져 사회적 혼란이 발생! 해당 팀을 포함한 모든 팀에서 코인 1개씩 잃습니다.",
    affectedPopup: "'딥페이크 경보' 발동! 인공지능 합성 가짜뉴스가 퍼져 사회적 혼란이 발생! 해당 팀을 포함한 모든 팀에서 코인 1개씩 잃습니다."
  }
};

const goldenKeyAliases = {
  "472938": "337446",
  "283645": "906458",
  "192840": "505132",
  "493045": "382867",
  "019358": "144051",
  "213095": "495759"
};

Object.entries(goldenKeyAliases).forEach(([alias, source]) => {
  const card = goldenKeyCards[source];
  if (!card) {
    throw new Error(`Golden key alias target not found: ${alias} -> ${source}`);
  }
  if (goldenKeyCards[alias]) {
    throw new Error(`Golden key alias conflicts with existing card: ${alias}`);
  }
  goldenKeyCards[alias] = { ...card, aliasOf: source };
});

Object.keys(goldenKeyCards).forEach((code) => {
  if (evidenceCodes[code]) {
    throw new Error(`Golden key code conflicts with evidence code: ${code}`);
  }
});

function goldenCardByCode(code) {
  const clean = cleanCode(code);
  const card = goldenKeyCards[clean];
  return card ? { code: clean, ...card } : null;
}

function goldenMessage(card) {
  return { tone: card.tone || "ok", text: card.popup || "황금열쇠 효과가 적용되었습니다." };
}

async function participatingTeams() {
  const granted = await getAllGrantedCredits();
  return Object.entries(granted)
    .filter(([, value]) => Number(value) > 0)
    .map(([team]) => team);
}

async function applyGoldenDelta(team, card, actor, wanted) {
  let credits;
  let delta;
  if (wanted > 0) {
    const result = await grantCredits(team, wanted);
    credits = result.credits;
    delta = wanted;
  } else if (wanted < 0) {
    const result = await reduceCredits(team, -wanted);
    credits = result.remaining;
    delta = -result.removed;
  } else {
    credits = Math.max(0, Number(await getCredits(team)) || 0);
    delta = 0;
  }

  await recordEvidenceRedemption({
    team,
    user: actor,
    code: card.code,
    room: "황금열쇠",
    evidence: `${card.title} · ${card.concept}`,
    person: "",
    added: delta > 0 ? delta : 0,
    delta,
    remaining: credits
  });
  return { team, delta, credits };
}

async function notifyGoldenTargets(card, sourceTeam, applied) {
  const targets = applied.filter((entry) => entry.team !== sourceTeam && entry.delta !== 0);
  await Promise.all(targets.map((entry) => recordGoldenNotice(entry.team, {
    sourceTeam,
    code: card.code,
    title: card.title,
    concept: card.concept,
    ethicsMeaning: card.ethicsMeaning,
    popup: card.affectedPopup || card.popup,
    delta: entry.delta,
    credits: entry.credits,
    tone: entry.delta < 0 ? "bad" : "ok"
  })));
}

async function applyGoldenKey(team, card, actor) {
  const applied = [];
  let selfDelta = 0;
  let otherDelta = 0;
  let otherCount = 0;
  let freeResubmits = null;

  if (card.effect === "aiUpgradeSweep") {
    const targets = new Set(await participatingTeams());
    targets.add(team);
    for (const target of targets) {
      const wanted = target === team ? Number(card.selfDelta) || 3 : Number(card.otherDelta) || 2;
      const entry = await applyGoldenDelta(target, card, actor, wanted);
      applied.push(entry);
      if (target === team) selfDelta = entry.delta;
    }
    otherDelta = Number(card.otherDelta) || 2;
    otherCount = applied.filter((entry) => entry.team !== team && entry.delta !== 0).length;
    await notifyGoldenTargets(card, team, applied);
  } else if (card.effect === "deepfakeEvent") {
    const targets = new Set(teams);
    for (const target of targets) {
      const entry = await applyGoldenDelta(target, card, actor, -1);
      applied.push(entry);
      if (target === team) selfDelta = entry.delta;
    }
    otherDelta = -1;
    otherCount = applied.filter((entry) => entry.team !== team && entry.delta !== 0).length;
    await notifyGoldenTargets(card, team, applied);
  } else {
    const self = await applyGoldenDelta(team, card, actor, Number(card.selfDelta) || 0);
    applied.push(self);
    selfDelta = self.delta;
  }

  const selfEntry = applied.find((entry) => entry.team === team);
  const selfCredits = selfEntry ? selfEntry.credits : Math.max(0, Number(await getCredits(team)) || 0);
  const message = goldenMessage(card);

  return {
    title: card.title,
    concept: card.concept,
    effect: card.effect,
    code: card.code,
    sign: card.sign,
    ethicsMeaning: card.ethicsMeaning,
    popup: card.popup,
    popupHighlights: Array.isArray(card.popupHighlights) ? card.popupHighlights : [],
    team,
    selfDelta,
    otherDelta,
    otherCount,
    affectedTeams: applied.filter((entry) => entry.team !== team && entry.delta !== 0).map((entry) => entry.team),
    freeResubmits,
    credits: selfCredits,
    message: message.text,
    tone: message.tone,
    logs: await getQuestionLogs(team)
  };
}

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
    index: option.index
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
    delta: Number.isFinite(Number(entry.delta)) ? Math.round(Number(entry.delta)) : Math.max(0, Number(entry.added) || 0),
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
      await Promise.all(teams.map((team) => clearEvidenceGrant(team)));

      sendJson(response, 200, {
        ok: true,
        removed: removed.length,
        resetCredits: shouldResetCredits,
        evidenceLogs: [],
        credits: await getAllCredits(),
        granted: await getAllGrantedCredits(),
        grants: await getAllEvidenceGrants(),
        clearedGrants: teams.length,
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
    const goldenCard = goldenCardByCode(code);
    if (goldenCard) {
      const actor = decodedHeaderValue(request, "x-kit-user") || body.user || team;
      const isNew = await redeemEvidenceCode(team, code);
      if (!isNew) {
        sendJson(response, 409, {
          error: "이미 사용한 황금열쇠 코드입니다.",
          code: "ALREADY_REDEEMED_GOLDEN",
          kind: "golden",
          concept: goldenCard.concept
        });
        return;
      }

      const golden = await applyGoldenKey(team, goldenCard, actor);
      sendJson(response, 200, {
        ok: true,
        kind: "golden",
        ...golden,
        persistent: hasPersistentStore()
      });
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
