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
  974399: {
    effect: "biasHack",
    title: "질문권 해킹",
    concept: "편향",
    sign: "-",
    tone: "bad",
    selfDelta: -2,
    ethicsMeaning: "훈련 데이터나 알고리즘의 한계로 인해 특정 집단이나 관점에 치우친 불공정한 결과를 내는 현상",
    popup: "[편향] 편향된 데이터처럼 특정 팀에게 코인이 치우치는 현상 발생! 해당 팀의 코인 두 개가 사라집니다."
  },
  337446: {
    effect: "biasedJudgment",
    title: "편향된 판단 (편향성 검증)",
    concept: "편향",
    sign: "-",
    tone: "bad",
    selfDelta: -2,
    ethicsMeaning: "훈련 데이터나 알고리즘의 한계로 인해 특정 집단이나 관점에 치우친 불공정한 결과를 내는 현상",
    popup: "[편향] AI가 특정 정보와 관점에 치우친 답변 생성! 해당 팀은 코인 두 개를 잃습니다."
  },
  906458: {
    effect: "humanChoice",
    title: "인간의 선택 (주체성)",
    concept: "신뢰성",
    sign: "+",
    tone: "ok",
    selfDelta: 2,
    ethicsMeaning: "AI를 사용하는 목적과 의도 안에서 안전하게 사용하기",
    popup: "[신뢰성] AI를 사용하는 목적과 의도 안에서 안전하게 사용하기! 해당 팀은 코인 두 개를 획득합니다."
  },
  281797: {
    effect: "hallucinationTrap",
    title: "환각의 함정",
    concept: "환각",
    sign: "-",
    tone: "bad",
    selfDelta: -2,
    ethicsMeaning: "AI가 교묘하게 정보나 사실이 아닌 거짓된 내용을 실제인 것처럼 그럴듯하게 생성해내는 현상",
    popup: "[환각] AI는 사실이 아닌 정보를 그럴듯하게 만들어낼 수 있습니다. 신뢰를 잃어 코인 두 개가 사라집니다."
  },
  505132: {
    effect: "fakeNews",
    title: "가짜뉴스 (환각)",
    concept: "환각",
    sign: "-",
    tone: "bad",
    selfDelta: -2,
    ethicsMeaning: "AI가 교묘하게 정보나 사실이 아닌 거짓된 내용을 실제인 것처럼 그럴듯하게 생성해내는 현상",
    popup: "[환각] AI가 교묘하게 만들어낸 거짓된 내용으로 가짜뉴스가 발생했습니다! 해당 팀은 코인 두 개를 잃습니다."
  },
  149489: {
    effect: "sourceAttribution",
    title: "저작권 출처 표시",
    concept: "신뢰성",
    sign: "+",
    tone: "ok",
    selfDelta: 4,
    ethicsMeaning: "AI를 사용하는 목적과 의도 안에서 안전하게 사용하기",
    popup: "[신뢰성] AI를 올바른 목적과 의도에 맞게 안전하게 사용했습니다. 그 보상으로 코인 4개를 획득합니다."
  },
  382866: {
    effect: "aiUpgradeSweep",
    title: "AI 업그레이드",
    concept: "포용성",
    sign: "+",
    tone: "ok",
    selfDelta: 2,
    otherDelta: 2,
    ethicsMeaning: "AI가 낸 차별이나 편견을 포함하지 않고, 다양한 모습을 존중하고 있는지 살피기",
    popup: "[포용성] 우리 팀을 포함한 모든 팀에서 코인 2개씩 획득합니다.",
    affectedPopup: "[포용성] 우리 팀을 포함한 모든 팀에서 코인 2개씩 획득합니다."
  },
  144051: {
    effect: "privacyShield",
    title: "투명인간 보호막 (개인정보 보호)",
    concept: "책임성",
    sign: "+",
    tone: "ok",
    selfDelta: 0,
    ethicsMeaning: "AI의 결과에 따라 문제가 발생한다면 충분히 책임질 수 있는 범위 안에서 사용하기",
    popup: "[책임성] AI의 결과에 따라 문제가 발생한다면 충분히 책임질 수 있는 범위 안에서 사용하기! 개인정보 보호처럼 안전하게 제외됩니다. 코인 가감은 없습니다. 다음 1턴 동안 상대의 모든 공격이나 지목 대상에서 회피합니다."
  },
  913561: {
    effect: "openSource",
    title: "오픈소스 (같이 전진!)",
    concept: "포용성",
    sign: "+",
    tone: "ok",
    selfDelta: 1,
    otherDelta: 1,
    ethicsMeaning: "AI가 낸 차별이나 편견을 포함하지 않고, 다양한 모습을 존중하고 있는지 살피기 (여기서 참여 중인 팀은 부여 코인이 1개 이상 있는 팀 기준)",
    popup: "[포용성] 차별이나 편견을 포함하지 않고 다양한 모습을 존중하며 같이 전진하기! 해당 팀을 포함한 모든 팀이 코인을 한 개씩 얻습니다.",
    affectedPopup: "[포용성] 다른 팀의 오픈소스 효과로 모두 함께 전진합니다. 우리 팀 코인 1개가 추가되었습니다."
  },
  392990: {
    effect: "killSwitch",
    title: "AI 윤리 킬 스위치",
    concept: "책임성 / 통제",
    sign: "+",
    tone: "ok",
    selfDelta: 0,
    ethicsMeaning: "AI의 결과에 따라 문제가 발생한다면 충분히 책임질 수 있는 범위 안에서 사용하기",
    popup: "[책임성 / 통제] AI의 결과에 따라 문제가 발생한다면 충분히 책임질 수 있는 범위 안에서 사용하기! 너무 앞서가는 팀 1곳을 지목해 다음 턴 강제 휴식(일시정지)을 시킵니다. 코인 가감은 없습니다."
  },
  244391: {
    effect: "deepfakeEvent",
    title: "딥페이크 카드 A",
    concept: "딥페이크",
    sign: "-",
    tone: "bad",
    selfDelta: -1,
    otherDelta: -1,
    ethicsMeaning: "인공지능을 활용해 특정 인물의 얼굴이나 음성을 합성하여 진짜처럼 만드는 기술 및 결과물",
    popup: "[딥페이크 경보 발동] 인공지능 합성 가짜뉴스가 퍼져 사회적 혼란이 발생! 해당 팀을 포함한 코인 1개 이상 가진 모든 팀의 코인이 1개씩 사라집니다.",
    affectedPopup: "[딥페이크 경보 발동] 인공지능 합성 가짜뉴스가 퍼져 사회적 혼란이 발생했습니다. 우리 팀 코인 1개가 차감되었습니다."
  },
  564376: {
    effect: "deepfakeEvent",
    title: "딥페이크 카드 B",
    concept: "딥페이크",
    sign: "-",
    tone: "bad",
    selfDelta: -1,
    otherDelta: -1,
    ethicsMeaning: "인공지능을 활용해 특정 인물의 얼굴이나 음성을 합성하여 진짜처럼 만드는 기술 및 결과물",
    popup: "[딥페이크 경보 발동] 인공지능 합성 가짜뉴스가 퍼져 사회적 혼란이 발생! 해당 팀을 포함한 코인 1개 이상 가진 모든 팀의 코인이 1개씩 사라집니다.",
    affectedPopup: "[딥페이크 경보 발동] 인공지능 합성 가짜뉴스가 퍼져 사회적 혼란이 발생했습니다. 우리 팀 코인 1개가 차감되었습니다."
  }
};

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

async function participatingTeams() {
  const granted = await getAllGrantedCredits();
  return Object.entries(granted)
    .filter(([, value]) => Number(value) > 0)
    .map(([team]) => team);
}

function goldenMessage(card) {
  return { tone: card.tone || "ok", text: card.popup || "황금열쇠 효과가 적용되었습니다." };
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

async function teamsWithCredits() {
  const credits = await getAllCredits();
  return Object.entries(credits)
    .filter(([, value]) => Number(value) > 0)
    .map(([team]) => team);
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

  if (card.effect === "openSource") {
    const targets = new Set(await participatingTeams());
    targets.add(team);
    for (const target of targets) {
      const entry = await applyGoldenDelta(target, card, actor, 1);
      applied.push(entry);
      if (target === team) selfDelta = entry.delta;
    }
    otherDelta = 1;
    otherCount = Math.max(0, targets.size - 1);
    await notifyGoldenTargets(card, team, applied);
  } else if (card.effect === "aiUpgradeSweep") {
    const targets = new Set(await teamsWithCredits());
    targets.add(team);
    for (const target of targets) {
      const entry = await applyGoldenDelta(target, card, actor, 2);
      applied.push(entry);
      if (target === team) selfDelta = entry.delta;
    }
    otherDelta = 2;
    otherCount = Math.max(0, targets.size - 1);
    await notifyGoldenTargets(card, team, applied);
  } else if (card.effect === "deepfakeEvent") {
    const targets = new Set(await teamsWithCredits());
    targets.add(team);
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
