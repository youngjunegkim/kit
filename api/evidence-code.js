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
  grantSimilarityFreeResubmit,
  hasPersistentStore,
  normalizeTeam,
  recordEvidenceRedemption,
  redeemEvidenceCode,
  reduceCredits,
  requestClassId,
  setCredits,
  setEvidenceGrant,
  setGrantedCredits,
  withClassScope
} = require("./_credits");

// roomId·index는 room-investigation.js의 evidenceCatalog와 정확히 일치해야 한다.
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

// ── 황금열쇠 코드 표 ─────────────────────────────────────────────────────────
// 카드에는 수업에서 배운 AI 윤리 개념이 적혀 있고, 거기 적힌 코드를 입력하면 효과가 적용된다.
//
// 카드 추가 방법:
//   (1) 같은 효과의 카드를 더 만들려면 → goldenKeyCards 표에 코드 한 줄만 추가한다.
//   (2) 새로운 효과를 만들려면 → goldenKeyEffects에 { concept } 정의를 넣고, 그 효과를
//       계산하는 분기를 applyGoldenKey에 추가한 뒤, goldenKeyCards에 코드를 추가한다.
//
// 코드 형식: 증거 코드(evidenceCodes)는 전부 숫자 5자리다. 황금열쇠는 숫자 6자리로 둔다.
//   - 길이가 5 vs 6으로 달라 증거 코드와 절대 겹치지 않는다(아래 가드로 재확인).
//   - 숫자만이라 학생이 한글 입력 상태로 쳐도 그대로 입력된다(영문 코드는 ㅎㅋ 등으로 깨짐).
const goldenKeyEffects = {
  reliability: { concept: "신뢰성" },
  inclusion: { concept: "포용성" },
  accountability: { concept: "책임성" },
  hallucination: { concept: "환각" },
  deepfake: { concept: "딥페이크" },
  bias: { concept: "편향" }
};
// 6종 × 2장 = 코드 12개. 같은 효과라도 카드가 2장이면 코드도 2개(같은 코드는 팀당 한 번만).
// (주체성 카드는 "선생님께 원하는 교실을 말하고 조사" — 교사 승인으로 처리하므로 코드가 없다.)
//
// 값은 증거 코드(39275 등)처럼 규칙성 없는 무작위 6자리다. 810101·810201 식으로 패턴이
// 있으면 학생이 카드 하나만 받아도 나머지를 찍어 황금열쇠 칸에 가지 않고 효과를 얻을 수 있어,
// 서로 연관 없는 값으로 정했다(한 쌍의 두 코드끼리 첫 자리도 겹치지 않게 배정).
const goldenKeyCards = {
  906458: "reliability", 149489: "reliability",
  913561: "inclusion", 382866: "inclusion",
  392990: "accountability", 144051: "accountability",
  505132: "hallucination", 281797: "hallucination",
  244391: "deepfake", 564376: "deepfake",
  337446: "bias", 974399: "bias"
};

// 안전장치: 황금열쇠 코드가 증거 코드와 하나라도 겹치면 로드 시점에 즉시 실패시킨다.
Object.keys(goldenKeyCards).forEach((code) => {
  if (evidenceCodes[code]) {
    throw new Error(`황금열쇠 코드가 증거 코드와 겹칩니다: ${code}`);
  }
});

function goldenCardByCode(code) {
  const clean = cleanCode(code);
  const effect = goldenKeyCards[clean];
  return effect ? { code: clean, effect, concept: goldenKeyEffects[effect].concept } : null;
}

// "모든 팀"의 범위: 질문권을 받은 적 있는 팀만(question-granted > 0). 4팀만 운영하고
// 8팀이 정의돼 있어, 안 쓰는 팀까지 주면 로그만 쌓이고 교사 화면이 지저분해진다.
async function participatingTeams() {
  const granted = await getAllGrantedCredits();
  return Object.entries(granted)
    .filter(([, value]) => Number(value) > 0)
    .map(([team]) => team);
}

// 학생 화면 결과 안내(짧게 — 의미는 진행자가 붙인다).
function goldenMessage(effect, { otherCount, freeResubmits }) {
  if (effect === "reliability") {
    return { tone: "ok", text: "신뢰성! 우리 팀 질문권 +2." };
  }
  if (effect === "inclusion") {
    return otherCount > 0
      ? { tone: "ok", text: "포용성! 우리 팀 +2, 다른 팀 +1." }
      : { tone: "ok", text: "포용성! 우리 팀 +2. (다른 팀은 아직 없어요.)" };
  }
  if (effect === "accountability") {
    // 코드 입력은 게임 초중반, 사건노트 제출은 마지막이라 시간 차가 크다. 지금 무료권이
    // 몇 개인지 결과에 함께 보여줘, 나중에 "우리 무료권 있었나?" 하지 않게 한다.
    return { tone: "ok", text: `책임성 카드! 사건노트를 무료로 다시 보낼 수 있어요 (무료 ${Math.max(0, Number(freeResubmits) || 0)}개).` };
  }
  if (effect === "hallucination") {
    return {
      tone: "bad",
      text: "환각이었어요! 카드에는 +3이라고 적혀 있었지만 실제로는 질문권 2개가 줄어듭니다. 그럴듯해 보이는 게 다 사실은 아니에요."
    };
  }
  if (effect === "deepfake") {
    return { tone: "bad", text: "딥페이크! 모든 팀의 질문권이 1개씩 줄어듭니다." };
  }
  if (effect === "bias") {
    return { tone: "bad", text: "편향! 우리 팀 질문권 -2." };
  }
  return { tone: "ok", text: "황금열쇠 효과가 적용되었습니다." };
}

// 황금열쇠 효과를 팀별로 적용하고, 교사 증거 로그에 팀당 1건씩 남긴다.
// delta는 부호 있는 실제 반영량(있는 만큼만 깎이므로 페널티는 0 ~ 요청치).
async function applyGoldenKey(team, card, actor) {
  const concept = card.concept;
  const applied = [];

  async function applyDelta(targetTeam, wanted) {
    let credits;
    let delta;
    if (wanted > 0) {
      const result = await grantCredits(targetTeam, wanted); // credits+granted 둘 다 증가(증거 보상과 동일)
      credits = result.credits;
      delta = wanted;
    } else if (wanted < 0) {
      const result = await reduceCredits(targetTeam, -wanted); // 있는 만큼만, 0에서 멈춤, granted 유지
      credits = result.remaining;
      delta = -result.removed;
    } else {
      credits = Math.max(0, Number(await getCredits(targetTeam)) || 0);
      delta = 0;
    }
    await recordEvidenceRedemption({
      team: targetTeam,
      user: actor,
      code: card.code,
      room: "황금열쇠",
      evidence: `${concept} 카드`,
      person: "",
      added: delta > 0 ? delta : 0, // 교사 초기화(clear-reset) 시 양수 보너스만 되돌리도록
      delta, // 교사 화면 표시는 부호 있는 delta 사용
      remaining: credits
    });
    applied.push({ team: targetTeam, delta, credits });
    return { credits, delta };
  }

  let selfDelta = 0;
  let otherDelta = 0;
  let otherCount = 0;
  let freeResubmits = null;

  if (card.effect === "reliability") {
    ({ delta: selfDelta } = await applyDelta(team, 2)); // 본인 +2 (정액)
  } else if (card.effect === "inclusion") {
    const others = (await participatingTeams()).filter((other) => other !== team);
    ({ delta: selfDelta } = await applyDelta(team, 2));
    for (const other of others) {
      await applyDelta(other, 1);
    }
    otherDelta = 1;
    otherCount = others.length;
  } else if (card.effect === "accountability") {
    // 크레딧 변화 없음: 사건노트 재전송 무료권을 1개 지급한다(카드 2장이면 2개 누적).
    freeResubmits = await grantSimilarityFreeResubmit(team);
    await recordEvidenceRedemption({
      team,
      user: actor,
      code: card.code,
      room: "황금열쇠",
      evidence: "책임성 카드 · 재전송 무료권",
      person: "",
      added: 0,
      delta: 0,
      remaining: Math.max(0, Number(await getCredits(team)) || 0)
    });
  } else if (card.effect === "hallucination") {
    ({ delta: selfDelta } = await applyDelta(team, -2)); // 카드에는 +3, 실제로는 -2
  } else if (card.effect === "deepfake") {
    const targets = new Set(await participatingTeams());
    targets.add(team); // "본인 포함"을 보장
    for (const target of targets) {
      const result = await applyDelta(target, -1);
      if (target === team) selfDelta = result.delta;
    }
    otherDelta = -1;
    otherCount = targets.size - 1;
  } else if (card.effect === "bias") {
    ({ delta: selfDelta } = await applyDelta(team, -2)); // 본인만 -2
  }

  const selfEntry = applied.find((entry) => entry.team === team);
  const selfCredits = selfEntry ? selfEntry.credits : Math.max(0, Number(await getCredits(team)) || 0);
  const message = goldenMessage(card.effect, { otherCount, freeResubmits });

  return {
    concept,
    effect: card.effect,
    code: card.code,
    team,
    selfDelta,
    otherDelta,
    otherCount,
    freeResubmits, // 책임성 카드일 때만 숫자, 그 외 null
    credits: selfCredits,
    message: message.text,
    tone: message.tone,
    logs: await getQuestionLogs(team)
  };
}
// ─────────────────────────────────────────────────────────────────────────────

// evidenceCodes에서 방 카탈로그를 파생한다. roomId → { name, options: [{code, index, ...}] }
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

// 학생에게 보내는 방 증거 목록. 코드는 노출하지 않고 index로만 선택하게 한다.
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

      // 교사 GET에만 승인 현황을 싣는다(학생 GET에는 넣지 않음). 최초 로드·수동
      // 새로고침에서만 호출되고 폴링되지 않으므로 getAllEvidenceGrants 비용을 감당한다.
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
        persistent: hasPersistentStore()
      });
      return;
    }

    // 교사 전용: 팀에 방 조사를 승인한다. 승인/취소 모두 전체 현황을 함께 반환해
    // 교사 화면이 바로 갱신할 수 있게 한다.
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

    // 교사 전용: 잘못 승인한 팀을 되돌린다.
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

    // 학생: 자기 팀 승인을 확인한다. 승인이 없으면 grant:null로 알린다.
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
        // 재방문 보너스 액수를 상수로 내려보내 학생 화면 버튼 라벨이 서버와 어긋나지 않게 한다.
        revisitBonus: evidenceRevisitBonusCredits,
        persistent: hasPersistentStore()
      });
      return;
    }

    // 학생: 승인된 방의 증거 하나를 index로 골라 지급받는다.
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

      // 기존 코드 입력 경로와 동일한 중복 방지. 이미 획득한 증거면 grant를 유지해
      // 나머지 하나를 고를 수 있게 한다.
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
      // 지급에 성공했으므로 승인을 소거한다. 이제 pick을 다시 호출해도 NO_GRANT.
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

    // 학생: 이미 두 증거를 모두 획득한 방을 재방문하면 보너스 질문권을 받는다.
    // 승인 단위 중복 방지: 지급하면 승인이 소거되어 재승인 없이는 또 못 받는다.
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

      // 그 방의 증거 두 개를 실제로 모두 획득했는지 evidence-redeemed로 확인(SMEMBERS 1건).
      // 아직 고를 게 남아 있으면 보너스만 받고 증거를 안 고르는 것을 막기 위해 거부한다.
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
      // 지급했으므로 승인을 소거한다. 재승인 없이는 또 받지 못한다.
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

    // ── 황금열쇠 코드 (증거 코드와 코드 공간이 겹치지 않는다: 증거=숫자5자리, 황금열쇠=숫자6자리) ──
    // 증거 코드면 goldenCardByCode가 null이라 이 분기를 지나 아래 기존 증거 경로로 간다.
    const goldenCard = goldenCardByCode(code);
    if (goldenCard) {
      const actor = decodedHeaderValue(request, "x-kit-user") || body.user || team;
      // 중복 방지는 증거 코드와 동일하게 redeemEvidenceCode(SADD). 같은 코드는 팀당 한 번만.
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
      sendJson(response, 200, { ok: true, kind: "golden", ...golden, persistent: hasPersistentStore() });
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
