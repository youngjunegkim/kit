const { AsyncLocalStorage } = require("node:async_hooks");

const teams = ["승우", "연수", "은혁", "영준", "혜빈", "윤지", "가빈", "채희"];
const classScope = globalThis.__kitClassScope || new AsyncLocalStorage();
const memoryStore = globalThis.__kitQuestionCreditStore || new Map();
const memoryGrantStore = globalThis.__kitQuestionGrantStore || new Map();
const memoryCountStore = globalThis.__kitQuestionCountStore || new Map();
const memoryLogStore = globalThis.__kitQuestionLogStore || [];
const memoryPresenceStore = globalThis.__kitPresenceStore || new Map();
const memoryEvidenceRedeemStore = globalThis.__kitEvidenceRedeemStore || new Map();
const memoryEvidenceLogStore = globalThis.__kitEvidenceLogStore || [];
const memoryEvidenceGrantStore = globalThis.__kitEvidenceGrantStore || new Map();
const memoryEthicsQuizRedeemStore = globalThis.__kitEthicsQuizRedeemStore || new Map();
const memoryEthicsQuizLogStore = globalThis.__kitEthicsQuizLogStore || [];
const memoryEthicsQuestionStore = globalThis.__kitEthicsQuestionStore || new Map();
const memorySimilaritySentenceStore = globalThis.__kitSimilaritySentenceStore || [];
globalThis.__kitClassScope = classScope;
globalThis.__kitQuestionCreditStore = memoryStore;
globalThis.__kitQuestionGrantStore = memoryGrantStore;
globalThis.__kitQuestionCountStore = memoryCountStore;
globalThis.__kitQuestionLogStore = memoryLogStore;
globalThis.__kitPresenceStore = memoryPresenceStore;
globalThis.__kitEvidenceRedeemStore = memoryEvidenceRedeemStore;
globalThis.__kitEvidenceLogStore = memoryEvidenceLogStore;
globalThis.__kitEvidenceGrantStore = memoryEvidenceGrantStore;
globalThis.__kitEthicsQuizRedeemStore = memoryEthicsQuizRedeemStore;
globalThis.__kitEthicsQuizLogStore = memoryEthicsQuizLogStore;
globalThis.__kitEthicsQuestionStore = memoryEthicsQuestionStore;
globalThis.__kitSimilaritySentenceStore = memorySimilaritySentenceStore;
const maxStoredLogs = 200;
const maxReturnedLogs = 60;
const maxReturnedEvidenceLogs = 100;
const maxEthicsSourceImageLength = 300000;
const maxSimilaritySentenceLength = 500;
const presenceTtlMs = Number(process.env.KIT_PRESENCE_TTL_MS || 300000);
const evidenceGrantTtlMs = Number(process.env.KIT_EVIDENCE_GRANT_TTL_MS || 600000);
const defaultClassId = "class-a";

function decodeValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function headerValue(request, name) {
  const value = request?.headers?.[name.toLowerCase()] || request?.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function queryValue(request, name) {
  if (request?.query?.[name]) return request.query[name];
  try {
    return new URL(request?.url || "", "http://localhost").searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function normalizeClassId(value) {
  const raw = decodeValue(value).toLowerCase().replace(/\s+/g, "");
  if (!raw) return defaultClassId;
  if (["1", "1반", "반1", "class1", "class-a", "classa", "a", "a반"].includes(raw)) return "class-a";
  if (["2", "2반", "반2", "class2", "class-b", "classb", "b", "b반"].includes(raw)) return "class-b";
  return raw.replace(/[^a-z0-9_-]/g, "").slice(0, 24) || defaultClassId;
}

function classLabelFor(value) {
  const classId = normalizeClassId(value);
  if (classId === "class-b") return "2반";
  if (classId === "class-a") return "1반";
  return classId;
}

function currentClassId() {
  return normalizeClassId(
    classScope.getStore()?.classId ||
    process.env.KIT_DEFAULT_CLASS_ID ||
    process.env.KIT_DEFAULT_CLASS ||
    defaultClassId
  );
}

function requestRole(request, body = {}) {
  return String(headerValue(request, "x-kit-role") || body.role || "").trim().toLowerCase();
}

function requestUser(request, body = {}) {
  return decodeValue(headerValue(request, "x-kit-user") || body.user).toLowerCase();
}

function lockedClassIdForRequest(request, body = {}) {
  if (requestRole(request, body) !== "teacher") return "";
  const user = requestUser(request, body);
  if (user === "master") return "class-a";
  if (user === "master2") return "class-b";
  return "";
}

function requestClassId(request, body = {}) {
  return normalizeClassId(
    lockedClassIdForRequest(request, body) ||
    headerValue(request, "x-kit-class-id") ||
    headerValue(request, "x-kit-class") ||
    body.classId ||
    body.className ||
    body.classSection ||
    body.section ||
    queryValue(request, "classId") ||
    queryValue(request, "class") ||
    queryValue(request, "classSection")
  );
}

function withClassScope(classId, fn) {
  return classScope.run({ classId: normalizeClassId(classId) }, fn);
}

function normalizeTeam(team) {
  const normalized = String(team || "").trim();
  return teams.includes(normalized) ? normalized : "";
}

function cleanCredits(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}

function storeNamespace() {
  const base = String(process.env.KIT_CREDIT_NAMESPACE || "default").trim() || "default";
  return `${base}:${currentClassId()}`;
}

function keyFor(team) {
  return `kit:${storeNamespace()}:question-credits:${team}`;
}

function countKeyFor(team) {
  return `kit:${storeNamespace()}:question-count:${team}`;
}

function grantKeyFor(team) {
  return `kit:${storeNamespace()}:question-granted:${team}`;
}

function logKey() {
  return `kit:${storeNamespace()}:question-logs`;
}

function presenceKey() {
  return `kit:${storeNamespace()}:presence`;
}

function evidenceRedeemKeyFor(team) {
  return `kit:${storeNamespace()}:evidence-redeemed:${team}`;
}

function evidenceLogKey() {
  return `kit:${storeNamespace()}:evidence-logs`;
}

function evidenceGrantKeyFor(team) {
  return `kit:${storeNamespace()}:evidence-grant:${team}`;
}

function ethicsQuizRedeemKeyFor(team) {
  return `kit:${storeNamespace()}:ethics-quiz-solved:${team}`;
}

function ethicsQuizLogKey() {
  return `kit:${storeNamespace()}:ethics-quiz-logs`;
}

function ethicsQuestionKey() {
  return `kit:${storeNamespace()}:ethics-custom-questions`;
}

function similaritySentenceKey() {
  return `kit:${storeNamespace()}:similarity-sentences`;
}

function hasPersistentStore() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCommand(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Question credit store is not configured.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `Redis command failed with ${response.status}`);
  }
  return data.result;
}

async function getCredits(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return null;

  if (!hasPersistentStore()) {
    return cleanCredits(memoryStore.get(keyFor(normalized)) || 0);
  }

  return cleanCredits(await redisCommand(["GET", keyFor(normalized)]));
}

async function getAllCredits() {
  const entries = await Promise.all(teams.map(async (team) => [team, await getCredits(team)]));
  return Object.fromEntries(entries);
}

async function getGrantedCredits(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return null;

  if (!hasPersistentStore()) {
    const key = grantKeyFor(normalized);
    if (memoryGrantStore.has(key)) {
      return cleanCredits(memoryGrantStore.get(key));
    }
    return cleanCredits(await getCredits(normalized)) + cleanCredits(await getQuestionCount(normalized));
  }

  const stored = await redisCommand(["GET", grantKeyFor(normalized)]);
  if (stored !== null && stored !== undefined) {
    return cleanCredits(stored);
  }
  return cleanCredits(await getCredits(normalized)) + cleanCredits(await getQuestionCount(normalized));
}

async function getAllGrantedCredits() {
  const entries = await Promise.all(teams.map(async (team) => [team, await getGrantedCredits(team)]));
  return Object.fromEntries(entries);
}

async function setCredits(team, value) {
  const normalized = normalizeTeam(team);
  if (!normalized) return null;
  const credits = cleanCredits(value);

  if (!hasPersistentStore()) {
    memoryStore.set(keyFor(normalized), credits);
    return credits;
  }

  await redisCommand(["SET", keyFor(normalized), String(credits)]);
  return credits;
}

async function setGrantedCredits(team, value) {
  const normalized = normalizeTeam(team);
  if (!normalized) return null;
  const credits = cleanCredits(value);

  if (!hasPersistentStore()) {
    memoryGrantStore.set(grantKeyFor(normalized), credits);
    return credits;
  }

  await redisCommand(["SET", grantKeyFor(normalized), String(credits)]);
  return credits;
}

async function addCredits(team, amount) {
  const normalized = normalizeTeam(team);
  if (!normalized) return null;
  const delta = cleanCredits(amount);

  if (!hasPersistentStore()) {
    const key = keyFor(normalized);
    const next = cleanCredits(memoryStore.get(key) || 0) + delta;
    memoryStore.set(key, next);
    return next;
  }

  return cleanCredits(await redisCommand(["INCRBY", keyFor(normalized), String(delta)]));
}

async function addGrantedCredits(team, amount) {
  const normalized = normalizeTeam(team);
  if (!normalized) return null;
  const delta = cleanCredits(amount);
  const next = cleanCredits(await getGrantedCredits(normalized)) + delta;
  return setGrantedCredits(normalized, next);
}

async function grantCredits(team, amount) {
  const normalized = normalizeTeam(team);
  if (!normalized) return { credits: null, granted: null };
  const delta = cleanCredits(amount);
  const previousGranted = cleanCredits(await getGrantedCredits(normalized));
  const credits = await addCredits(normalized, delta);
  const granted = await setGrantedCredits(normalized, previousGranted + delta);
  return { credits, granted };
}

async function redeemEvidenceCode(team, code) {
  const normalized = normalizeTeam(team);
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalized || !normalizedCode) return false;

  if (!hasPersistentStore()) {
    const key = evidenceRedeemKeyFor(normalized);
    const redeemed = memoryEvidenceRedeemStore.get(key) || new Set();
    if (redeemed.has(normalizedCode)) return false;
    redeemed.add(normalizedCode);
    memoryEvidenceRedeemStore.set(key, redeemed);
    return true;
  }

  const added = Number(await redisCommand(["SADD", evidenceRedeemKeyFor(normalized), normalizedCode]));
  return added === 1;
}

// 주어진 코드들이 팀의 evidence-redeemed 셋에 있는지 codes 순서대로 boolean 배열 반환.
// SMEMBERS 한 번으로 읽는다(셋에 최대 10개라 부담 없음). SMISMEMBER 같은 최신 명령을
// 피해 호환성을 확보한다.
async function areEvidenceCodesRedeemed(team, codes = []) {
  const normalized = normalizeTeam(team);
  const list = (Array.isArray(codes) ? codes : [])
    .map((code) => String(code || "").trim().toUpperCase())
    .filter(Boolean);
  if (!normalized || !list.length) return [];

  if (!hasPersistentStore()) {
    const set = memoryEvidenceRedeemStore.get(evidenceRedeemKeyFor(normalized)) || new Set();
    return list.map((code) => set.has(code));
  }

  const members = await redisCommand(["SMEMBERS", evidenceRedeemKeyFor(normalized)]);
  const owned = new Set(Array.isArray(members) ? members.map((member) => String(member)) : []);
  return list.map((code) => owned.has(code));
}

function cleanEvidenceGrant(grant = {}) {
  const roomId = String(grant.roomId || "").trim().slice(0, 20);
  if (!roomId) return null;
  return {
    roomId,
    roomName: String(grant.roomName || "").trim().slice(0, 40),
    at: Number(grant.at || Date.now()),
    by: String(grant.by || "").trim().slice(0, 40),
    namespace: String(grant.namespace || storeNamespace()).trim()
  };
}

async function setEvidenceGrant(team, grant) {
  const normalized = normalizeTeam(team);
  const cleanGrant = cleanEvidenceGrant(grant);
  if (!normalized || !cleanGrant) return null;

  // 팀당 하나만 유지: 기존 승인이 있어도 그대로 덮어쓴다.
  if (!hasPersistentStore()) {
    memoryEvidenceGrantStore.set(evidenceGrantKeyFor(normalized), cleanGrant);
    return cleanGrant;
  }

  await redisCommand(["SET", evidenceGrantKeyFor(normalized), JSON.stringify(cleanGrant)]);
  return cleanGrant;
}

async function getEvidenceGrant(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return null;
  const now = Date.now();
  const key = evidenceGrantKeyFor(normalized);

  // presence와 동일한 방식: TTL이 지난 승인은 무시하고 정리한다.
  if (!hasPersistentStore()) {
    const grant = memoryEvidenceGrantStore.get(key);
    if (!grant) return null;
    if (now - Number(grant.at || 0) > evidenceGrantTtlMs) {
      memoryEvidenceGrantStore.delete(key);
      return null;
    }
    return grant;
  }

  const raw = await redisCommand(["GET", key]);
  if (!raw) return null;
  let grant = null;
  try {
    grant = cleanEvidenceGrant(JSON.parse(raw));
  } catch {
    grant = null;
  }
  if (!grant || now - Number(grant.at || 0) > evidenceGrantTtlMs) {
    await redisCommand(["DEL", key]);
    return null;
  }
  return grant;
}

async function clearEvidenceGrant(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return false;

  if (!hasPersistentStore()) {
    return memoryEvidenceGrantStore.delete(evidenceGrantKeyFor(normalized));
  }

  await redisCommand(["DEL", evidenceGrantKeyFor(normalized)]);
  return true;
}

async function getAllEvidenceGrants() {
  const now = Date.now();

  // getAllCredits 등은 팀별 GET을 도는데, 승인 현황은 팀당 키가 하나뿐이라
  // MGET으로 한 번에 읽어 Redis 명령을 8건에서 1건으로 줄인다.
  if (!hasPersistentStore()) {
    const entries = teams.map((team) => {
      const key = evidenceGrantKeyFor(team);
      const grant = memoryEvidenceGrantStore.get(key);
      if (grant && now - Number(grant.at || 0) > evidenceGrantTtlMs) {
        memoryEvidenceGrantStore.delete(key);
        return [team, null];
      }
      return [team, grant || null];
    });
    return Object.fromEntries(entries);
  }

  const raws = await redisCommand(["MGET", ...teams.map(evidenceGrantKeyFor)]);
  const staleKeys = [];
  const entries = teams.map((team, index) => {
    const raw = Array.isArray(raws) ? raws[index] : null;
    if (!raw) return [team, null];
    let grant = null;
    try {
      grant = cleanEvidenceGrant(JSON.parse(raw));
    } catch {
      grant = null;
    }
    if (!grant || now - Number(grant.at || 0) > evidenceGrantTtlMs) {
      staleKeys.push(evidenceGrantKeyFor(team));
      return [team, null];
    }
    return [team, grant];
  });

  // 만료·손상된 승인만 한 번에 정리 (있을 때만 명령 1건 추가).
  if (staleKeys.length) {
    await redisCommand(["DEL", ...staleKeys]);
  }
  return Object.fromEntries(entries);
}

function cleanEvidenceEntry(entry = {}) {
  const team = normalizeTeam(entry.team);
  const code = String(entry.code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  if (!team || !code) return null;

  return {
    id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    at: String(entry.at || new Date().toISOString()),
    team,
    user: String(entry.user || team).trim().slice(0, 30),
    code,
    room: String(entry.room || "").trim().slice(0, 30),
    evidence: String(entry.evidence || "").trim().slice(0, 80),
    person: String(entry.person || "").trim().slice(0, 30),
    added: cleanCredits(entry.added || 0),
    remaining: cleanCredits(entry.remaining || 0),
    namespace: String(entry.namespace || storeNamespace()).trim()
  };
}

async function recordEvidenceRedemption(entry) {
  const cleanEntry = cleanEvidenceEntry(entry);
  if (!cleanEntry) return null;

  if (!hasPersistentStore()) {
    memoryEvidenceLogStore.unshift(cleanEntry);
    memoryEvidenceLogStore.splice(maxStoredLogs);
    return cleanEntry;
  }

  await redisCommand(["LPUSH", evidenceLogKey(), JSON.stringify(cleanEntry)]);
  await redisCommand(["LTRIM", evidenceLogKey(), "0", String(maxStoredLogs - 1)]);
  return cleanEntry;
}

async function getEvidenceRedemptions(team = "", limit = maxReturnedEvidenceLogs) {
  const normalized = normalizeTeam(team);
  const safeLimit = Math.min(maxReturnedEvidenceLogs, Math.max(1, cleanCredits(limit) || maxReturnedEvidenceLogs));

  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    return memoryEvidenceLogStore
      .filter((entry) => entry.namespace === namespace && (!normalized || entry.team === normalized))
      .slice(0, safeLimit);
  }

  const rawLogs = await redisCommand(["LRANGE", evidenceLogKey(), "0", String(maxStoredLogs - 1)]);
  return (Array.isArray(rawLogs) ? rawLogs : [])
    .map((item) => {
      try {
        return cleanEvidenceEntry(JSON.parse(item));
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && (!normalized || entry.team === normalized))
    .slice(0, safeLimit);
}

async function clearEvidenceRedemptions() {
  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    const removed = [];
    for (let index = memoryEvidenceLogStore.length - 1; index >= 0; index -= 1) {
      if (memoryEvidenceLogStore[index]?.namespace === namespace) {
        removed.unshift(...memoryEvidenceLogStore.splice(index, 1));
      }
    }
    teams.forEach((team) => memoryEvidenceRedeemStore.delete(evidenceRedeemKeyFor(team)));
    return removed;
  }

  const removed = await getEvidenceRedemptions("", maxReturnedEvidenceLogs);
  await Promise.all([
    redisCommand(["DEL", evidenceLogKey()]),
    ...teams.map((team) => redisCommand(["DEL", evidenceRedeemKeyFor(team)]))
  ]);
  return removed;
}

async function redeemEthicsQuizQuestion(team, questionNumber) {
  const normalized = normalizeTeam(team);
  const number = cleanCredits(questionNumber);
  if (!normalized || number < 1 || number > 200) return false;
  const key = String(number);

  if (!hasPersistentStore()) {
    const storeKey = ethicsQuizRedeemKeyFor(normalized);
    const redeemed = memoryEthicsQuizRedeemStore.get(storeKey) || new Set();
    if (redeemed.has(key)) return false;
    redeemed.add(key);
    memoryEthicsQuizRedeemStore.set(storeKey, redeemed);
    return true;
  }

  const added = Number(await redisCommand(["SADD", ethicsQuizRedeemKeyFor(normalized), key]));
  return added === 1;
}

function cleanEthicsQuizEntry(entry = {}) {
  const team = normalizeTeam(entry.team);
  const question = cleanCredits(entry.question);
  if (!team || question < 1 || question > 200) return null;

  return {
    id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    at: String(entry.at || new Date().toISOString()),
    team,
    user: String(entry.user || team).trim().slice(0, 30),
    question,
    added: cleanCredits(entry.added || 0),
    remaining: cleanCredits(entry.remaining || 0),
    namespace: String(entry.namespace || storeNamespace()).trim()
  };
}

async function recordEthicsQuizRedemption(entry) {
  const cleanEntry = cleanEthicsQuizEntry(entry);
  if (!cleanEntry) return null;

  if (!hasPersistentStore()) {
    memoryEthicsQuizLogStore.unshift(cleanEntry);
    memoryEthicsQuizLogStore.splice(maxStoredLogs);
    return cleanEntry;
  }

  await redisCommand(["LPUSH", ethicsQuizLogKey(), JSON.stringify(cleanEntry)]);
  await redisCommand(["LTRIM", ethicsQuizLogKey(), "0", String(maxStoredLogs - 1)]);
  return cleanEntry;
}

async function getEthicsQuizRedemptions(team = "", limit = maxReturnedEvidenceLogs) {
  const normalized = normalizeTeam(team);
  const safeLimit = Math.min(maxReturnedEvidenceLogs, Math.max(1, cleanCredits(limit) || maxReturnedEvidenceLogs));

  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    return memoryEthicsQuizLogStore
      .filter((entry) => entry.namespace === namespace && (!normalized || entry.team === normalized))
      .slice(0, safeLimit);
  }

  const rawLogs = await redisCommand(["LRANGE", ethicsQuizLogKey(), "0", String(maxStoredLogs - 1)]);
  return (Array.isArray(rawLogs) ? rawLogs : [])
    .map((item) => {
      try {
        return cleanEthicsQuizEntry(JSON.parse(item));
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && (!normalized || entry.team === normalized))
    .slice(0, safeLimit);
}

async function getEthicsQuizSolvedQuestions(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return [];

  if (!hasPersistentStore()) {
    const solved = memoryEthicsQuizRedeemStore.get(ethicsQuizRedeemKeyFor(normalized)) || new Set();
    return [...solved].map((value) => cleanCredits(value)).filter(Boolean).sort((a, b) => a - b);
  }

  const solved = await redisCommand(["SMEMBERS", ethicsQuizRedeemKeyFor(normalized)]);
  return (Array.isArray(solved) ? solved : []).map((value) => cleanCredits(value)).filter(Boolean).sort((a, b) => a - b);
}

async function clearEthicsQuizRedemptions(team = "") {
  const normalized = normalizeTeam(team);
  if (!normalized) return [];

  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    memoryEthicsQuizRedeemStore.delete(ethicsQuizRedeemKeyFor(normalized));
    for (let index = memoryEthicsQuizLogStore.length - 1; index >= 0; index -= 1) {
      const entry = memoryEthicsQuizLogStore[index];
      if (entry?.namespace === namespace && entry.team === normalized) {
        memoryEthicsQuizLogStore.splice(index, 1);
      }
    }
    return [];
  }

  await redisCommand(["DEL", ethicsQuizRedeemKeyFor(normalized)]);
  return [];
}

function cleanEthicsQuestionOption(option = {}, index = 0) {
  const text = String(option.text || "").trim().slice(0, 240);
  if (!text) return null;
  return {
    id: String(option.id || index + 1).trim().slice(0, 12),
    marker: String(option.marker || `${index + 1}.`).trim().slice(0, 8),
    text
  };
}

function cleanEthicsQuestionRecord(record = {}) {
  const baseNumber = cleanCredits(record.baseNumber);
  const options = Array.isArray(record.options)
    ? record.options.map(cleanEthicsQuestionOption).filter(Boolean).slice(0, 5)
    : [];
  const answer = String(record.answer || "").trim().slice(0, 12);
  const topic = String(record.topic || "").trim().slice(0, 160);
  const prompt = String(record.prompt || "").trim().slice(0, 1000);
  const explanation = (Array.isArray(record.explanation) ? record.explanation : [record.explanation])
    .map((item) => String(item || "").trim().slice(0, 1000))
    .filter(Boolean)
    .slice(0, 8);

  if (!topic || !prompt || options.length < 2 || !options.some((option) => option.id === answer) || !explanation.length) {
    return null;
  }

  return {
    id: String(record.id || (baseNumber ? `base-${baseNumber}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)).trim().slice(0, 80),
    at: String(record.at || new Date().toISOString()),
    baseNumber: baseNumber >= 1 && baseNumber <= 200 ? baseNumber : 0,
    topic,
    type: "choice",
    background: (Array.isArray(record.background) ? record.background : [record.background])
      .map((item) => String(item || "").trim().slice(0, 1000))
      .filter(Boolean)
      .slice(0, 8),
    prompt,
    options,
    answer,
    explanation,
    sourceImage: String(record.sourceImage || "").trim().slice(0, maxEthicsSourceImageLength)
  };
}

async function getCustomEthicsQuestions() {
  if (!hasPersistentStore()) {
    return [...(memoryEthicsQuestionStore.get(ethicsQuestionKey()) || [])];
  }

  const raw = await redisCommand(["GET", ethicsQuestionKey()]);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(cleanEthicsQuestionRecord).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function setCustomEthicsQuestions(records) {
  const cleanRecords = (Array.isArray(records) ? records : [])
    .map(cleanEthicsQuestionRecord)
    .filter(Boolean)
    .slice(0, 50);

  if (!hasPersistentStore()) {
    memoryEthicsQuestionStore.set(ethicsQuestionKey(), cleanRecords);
    return cleanRecords;
  }

  await redisCommand(["SET", ethicsQuestionKey(), JSON.stringify(cleanRecords)]);
  return cleanRecords;
}

async function addCustomEthicsQuestion(record) {
  const cleanRecord = cleanEthicsQuestionRecord(record);
  if (!cleanRecord) return null;
  const records = await getCustomEthicsQuestions();
  const existingIndex = records.findIndex((item) => item.id === cleanRecord.id);
  const next = existingIndex >= 0
    ? records.map((item) => item.id === cleanRecord.id ? cleanRecord : item)
    : [...records, cleanRecord].slice(0, 50);
  await setCustomEthicsQuestions(next);
  return cleanRecord;
}

async function deleteCustomEthicsQuestion(id) {
  const target = String(id || "").trim();
  if (!target) return null;
  const records = await getCustomEthicsQuestions();
  const removed = records.find((item) => item.id === target) || null;
  if (!removed) return null;
  await setCustomEthicsQuestions(records.filter((item) => item.id !== target));
  return removed;
}

function cleanSimilaritySentenceEntry(entry = {}) {
  const team = normalizeTeam(entry.team);
  const sentence = String(entry.sentence || "").replace(/\s+/g, " ").trim().slice(0, maxSimilaritySentenceLength);
  if (!team || !sentence) return null;
  const remainingCredits = cleanCredits(entry.remainingCredits);

  return {
    id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    at: String(entry.at || new Date().toISOString()),
    team,
    user: String(entry.user || team).trim().slice(0, 40),
    sentence,
    remainingCredits,
    namespace: String(entry.namespace || storeNamespace()).trim()
  };
}

async function recordSimilaritySentence(entry) {
  const cleanEntry = cleanSimilaritySentenceEntry(entry);
  if (!cleanEntry) return null;

  if (!hasPersistentStore()) {
    memorySimilaritySentenceStore.unshift(cleanEntry);
    memorySimilaritySentenceStore.splice(maxStoredLogs);
    return cleanEntry;
  }

  await redisCommand(["LPUSH", similaritySentenceKey(), JSON.stringify(cleanEntry)]);
  await redisCommand(["LTRIM", similaritySentenceKey(), "0", String(maxStoredLogs - 1)]);
  return cleanEntry;
}

async function getSimilaritySentences(limit = maxReturnedEvidenceLogs) {
  const safeLimit = Math.min(maxReturnedEvidenceLogs, Math.max(1, cleanCredits(limit) || maxReturnedEvidenceLogs));

  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    return memorySimilaritySentenceStore
      .filter((entry) => entry.namespace === namespace)
      .slice(0, safeLimit);
  }

  const rawLogs = await redisCommand(["LRANGE", similaritySentenceKey(), "0", String(maxStoredLogs - 1)]);
  return (Array.isArray(rawLogs) ? rawLogs : [])
    .map((item) => {
      try {
        return cleanSimilaritySentenceEntry(JSON.parse(item));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(0, safeLimit);
}

async function clearSimilaritySentences() {
  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    const removed = memorySimilaritySentenceStore.filter((entry) => entry.namespace === namespace);
    for (let index = memorySimilaritySentenceStore.length - 1; index >= 0; index -= 1) {
      if (memorySimilaritySentenceStore[index]?.namespace === namespace) {
        memorySimilaritySentenceStore.splice(index, 1);
      }
    }
    return removed;
  }

  const removed = await getSimilaritySentences(maxReturnedEvidenceLogs);
  await redisCommand(["DEL", similaritySentenceKey()]);
  return removed;
}

async function resetCredits() {
  await Promise.all(teams.map(async (team) => {
    await setCredits(team, 0);
    await setGrantedCredits(team, 0);
  }));
  return getAllCredits();
}

async function getQuestionCount(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return 0;

  if (!hasPersistentStore()) {
    return cleanCredits(memoryCountStore.get(countKeyFor(normalized)) || 0);
  }

  return cleanCredits(await redisCommand(["GET", countKeyFor(normalized)]));
}

async function getAllQuestionCounts() {
  const entries = await Promise.all(teams.map(async (team) => [team, await getQuestionCount(team)]));
  return Object.fromEntries(entries);
}

function cleanLogMessage(message) {
  return String(message || "").replace(/\s+/g, " ").trim().slice(0, 140);
}

function cleanPresenceAccount(account = {}) {
  const user = String(account.user || "").trim().toLowerCase();
  if (!user) return null;

  return {
    user,
    role: String(account.role || "").trim().toLowerCase() === "teacher" ? "teacher" : "student",
    label: String(account.label || account.team || user).trim().slice(0, 30),
    team: String(account.team || "").trim().slice(0, 30),
    at: Number(account.at || Date.now()),
    namespace: String(account.namespace || storeNamespace()).trim()
  };
}

function parsePresenceResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) {
    const entries = [];
    for (let index = 0; index < result.length; index += 2) {
      entries.push([result[index], result[index + 1]]);
    }
    return entries;
  }
  if (typeof result === "object") {
    return Object.entries(result);
  }
  return [];
}

function sortPresence(a, b) {
  if (a.role !== b.role) return a.role === "teacher" ? -1 : 1;
  return String(a.label || a.user).localeCompare(String(b.label || b.user), "ko");
}

async function touchPresence(account) {
  const entry = cleanPresenceAccount(account);
  if (!entry) return getPresence();

  if (!hasPersistentStore()) {
    memoryPresenceStore.set(`${presenceKey()}:${entry.user}`, entry);
    return getPresence();
  }

  await redisCommand(["HSET", presenceKey(), entry.user, JSON.stringify(entry)]);
  return getPresence();
}

async function removePresence(user) {
  const normalized = String(user || "").trim().toLowerCase();
  if (!normalized) return getPresence();

  if (!hasPersistentStore()) {
    memoryPresenceStore.delete(`${presenceKey()}:${normalized}`);
    return getPresence();
  }

  await redisCommand(["HDEL", presenceKey(), normalized]);
  return getPresence();
}

async function getPresence() {
  const now = Date.now();

  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    [...memoryPresenceStore.entries()].forEach(([user, entry]) => {
      if (now - Number(entry.at || 0) > presenceTtlMs) {
        memoryPresenceStore.delete(user);
      }
    });
    return [...memoryPresenceStore.values()]
      .filter((entry) => entry.namespace === namespace)
      .sort(sortPresence);
  }

  const rawEntries = parsePresenceResult(await redisCommand(["HGETALL", presenceKey()]));
  const staleUsers = [];
  const online = rawEntries
    .map(([user, value]) => {
      try {
        return cleanPresenceAccount({ ...JSON.parse(value), user });
      } catch {
        staleUsers.push(user);
        return null;
      }
    })
    .filter((entry) => {
      if (!entry) return false;
      const isOnline = now - Number(entry.at || 0) <= presenceTtlMs;
      if (!isOnline) staleUsers.push(entry.user);
      return isOnline;
    })
    .sort(sortPresence);

  if (staleUsers.length) {
    await redisCommand(["HDEL", presenceKey(), ...staleUsers]);
  }

  return online;
}

async function getQuestionLogs(team = "", limit = maxReturnedLogs) {
  const normalized = normalizeTeam(team);
  const safeLimit = Math.min(maxReturnedLogs, Math.max(1, cleanCredits(limit) || maxReturnedLogs));

  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    return memoryLogStore
      .filter((entry) => entry.namespace === namespace && (!normalized || entry.team === normalized))
      .slice(0, safeLimit);
  }

  const rawLogs = await redisCommand(["LRANGE", logKey(), "0", String(maxStoredLogs - 1)]);
  return (Array.isArray(rawLogs) ? rawLogs : [])
    .map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && (!normalized || entry.team === normalized))
    .slice(0, safeLimit);
}

async function logQuestion({ team, user, suspect, message, remaining }) {
  const normalized = normalizeTeam(team);
  if (!normalized) return null;

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    team: normalized,
    user: String(user || normalized).trim() || normalized,
    suspect: String(suspect || "").trim(),
    message: cleanLogMessage(message),
    remaining: cleanCredits(remaining),
    namespace: storeNamespace()
  };

  if (!hasPersistentStore()) {
    const key = countKeyFor(normalized);
    const count = cleanCredits(memoryCountStore.get(key) || 0) + 1;
    memoryCountStore.set(key, count);
    memoryLogStore.unshift({ ...entry, count });
    memoryLogStore.splice(maxStoredLogs);
    return { entry: { ...entry, count }, count };
  }

  const count = cleanCredits(await redisCommand(["INCR", countKeyFor(normalized)]));
  const storedEntry = { ...entry, count };
  await redisCommand(["LPUSH", logKey(), JSON.stringify(storedEntry)]);
  await redisCommand(["LTRIM", logKey(), "0", String(maxStoredLogs - 1)]);
  return { entry: storedEntry, count };
}

async function clearQuestionLogs() {
  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    for (let index = memoryLogStore.length - 1; index >= 0; index -= 1) {
      if (memoryLogStore[index]?.namespace === namespace) {
        memoryLogStore.splice(index, 1);
      }
    }
    teams.forEach((team) => memoryCountStore.set(countKeyFor(team), 0));
    return {
      counts: await getAllQuestionCounts(),
      logs: []
    };
  }

  await Promise.all([
    redisCommand(["DEL", logKey()]),
    ...teams.map((team) => redisCommand(["DEL", countKeyFor(team)]))
  ]);
  return {
    counts: await getAllQuestionCounts(),
    logs: []
  };
}

async function consumeCredit(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) {
    return { ok: false, team: "", remaining: 0, reason: "INVALID_TEAM" };
  }

  if (!hasPersistentStore()) {
    const key = keyFor(normalized);
    const current = cleanCredits(memoryStore.get(key) || 0);
    if (current <= 0) {
      return { ok: false, team: normalized, remaining: 0, reason: "NO_CREDITS" };
    }
    const remaining = current - 1;
    memoryStore.set(key, remaining);
    return { ok: true, team: normalized, remaining };
  }

  const script = [
    "local current = tonumber(redis.call('GET', KEYS[1]) or '0')",
    "if current <= 0 then return -1 end",
    "current = current - 1",
    "redis.call('SET', KEYS[1], current)",
    "return current"
  ].join("; ");
  const remaining = Number(await redisCommand(["EVAL", script, "1", keyFor(normalized)]));
  if (!Number.isFinite(remaining) || remaining < 0) {
    return { ok: false, team: normalized, remaining: 0, reason: "NO_CREDITS" };
  }
  return { ok: true, team: normalized, remaining };
}

module.exports = {
  addCredits,
  addCustomEthicsQuestion,
  areEvidenceCodesRedeemed,
  classLabelFor,
  deleteCustomEthicsQuestion,
  clearEvidenceRedemptions,
  clearSimilaritySentences,
  clearEthicsQuizRedemptions,
  consumeCredit,
  clearQuestionLogs,
  currentClassId,
  getAllCredits,
  getAllGrantedCredits,
  getAllQuestionCounts,
  getAllEvidenceGrants,
  getCredits,
  getCustomEthicsQuestions,
  getEvidenceGrant,
  getEvidenceRedemptions,
  getEthicsQuizRedemptions,
  getEthicsQuizSolvedQuestions,
  getGrantedCredits,
  getQuestionCount,
  getQuestionLogs,
  getSimilaritySentences,
  getPresence,
  grantCredits,
  hasPersistentStore,
  logQuestion,
  normalizeClassId,
  normalizeTeam,
  recordEvidenceRedemption,
  recordEthicsQuizRedemption,
  recordSimilaritySentence,
  removePresence,
  requestClassId,
  redeemEthicsQuizQuestion,
  redeemEvidenceCode,
  resetCredits,
  clearEvidenceGrant,
  setEvidenceGrant,
  setCustomEthicsQuestions,
  setGrantedCredits,
  setCredits,
  touchPresence,
  withClassScope,
  teams
};
