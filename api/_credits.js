const { AsyncLocalStorage } = require("node:async_hooks");

const teams = ["january", "february", "march", "april", "may", "june", "july", "august"];
const classScope = globalThis.__kitClassScope || new AsyncLocalStorage();
const memoryStore = globalThis.__kitQuestionCreditStore || new Map();
const memoryGrantStore = globalThis.__kitQuestionGrantStore || new Map();
const memoryCountStore = globalThis.__kitQuestionCountStore || new Map();
const memoryLogStore = globalThis.__kitQuestionLogStore || [];
const memoryPresenceStore = globalThis.__kitPresenceStore || new Map();
const memoryEvidenceRedeemStore = globalThis.__kitEvidenceRedeemStore || new Map();
const memoryEvidenceShopStore = globalThis.__kitEvidenceShopStore || new Map();
const memoryEvidenceLogStore = globalThis.__kitEvidenceLogStore || [];
const memoryEvidenceGrantStore = globalThis.__kitEvidenceGrantStore || new Map();
const memoryEvidenceApprovalStore = globalThis.__kitEvidenceApprovalStore || [];
const memoryEthicsQuizRedeemStore = globalThis.__kitEthicsQuizRedeemStore || new Map();
const memoryEthicsQuizLogStore = globalThis.__kitEthicsQuizLogStore || [];
const memoryEthicsQuestionStore = globalThis.__kitEthicsQuestionStore || new Map();
const memorySimilaritySentenceStore = globalThis.__kitSimilaritySentenceStore || [];
const memorySimilaritySubmitStore = globalThis.__kitSimilaritySubmitStore || new Map();
const memorySimilarityFreeStore = globalThis.__kitSimilarityFreeStore || new Map();
const memoryGoldenNoticeStore = globalThis.__kitGoldenNoticeStore || new Map();
const memoryStudentAccountStore = globalThis.__kitStudentAccountStore || new Map();
globalThis.__kitClassScope = classScope;
globalThis.__kitQuestionCreditStore = memoryStore;
globalThis.__kitQuestionGrantStore = memoryGrantStore;
globalThis.__kitQuestionCountStore = memoryCountStore;
globalThis.__kitQuestionLogStore = memoryLogStore;
globalThis.__kitPresenceStore = memoryPresenceStore;
globalThis.__kitEvidenceRedeemStore = memoryEvidenceRedeemStore;
globalThis.__kitEvidenceShopStore = memoryEvidenceShopStore;
globalThis.__kitEvidenceLogStore = memoryEvidenceLogStore;
globalThis.__kitEvidenceGrantStore = memoryEvidenceGrantStore;
globalThis.__kitEvidenceApprovalStore = memoryEvidenceApprovalStore;
globalThis.__kitEthicsQuizRedeemStore = memoryEthicsQuizRedeemStore;
globalThis.__kitEthicsQuizLogStore = memoryEthicsQuizLogStore;
globalThis.__kitEthicsQuestionStore = memoryEthicsQuestionStore;
globalThis.__kitSimilaritySentenceStore = memorySimilaritySentenceStore;
globalThis.__kitSimilaritySubmitStore = memorySimilaritySubmitStore;
globalThis.__kitSimilarityFreeStore = memorySimilarityFreeStore;
globalThis.__kitGoldenNoticeStore = memoryGoldenNoticeStore;
globalThis.__kitStudentAccountStore = memoryStudentAccountStore;
const maxStoredLogs = 200;
const maxReturnedLogs = 60;
const maxReturnedEvidenceLogs = 100;
const maxEthicsSourceImageLength = 300000;
const maxSimilaritySentenceLength = 500;
const presenceTtlMs = Number(process.env.KIT_PRESENCE_TTL_MS || 300000);
const evidenceGrantTtlMs = Number(process.env.KIT_EVIDENCE_GRANT_TTL_MS || 600000);
const defaultClassId = "class-a";

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

function normalizeClassId() {
  return defaultClassId;
}

function classLabelFor() {
  return "우리 반";
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

function requestClassId(request, body = {}) {
  return normalizeClassId(
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

function evidenceShopKeyFor(team) {
  return `kit:${storeNamespace()}:evidence-shop-purchases:${team}`;
}

function evidenceLogKey() {
  return `kit:${storeNamespace()}:evidence-logs`;
}

function evidenceGrantKeyFor(team) {
  return `kit:${storeNamespace()}:evidence-grant:${team}`;
}

function evidenceApprovalLogKey() {
  return `kit:${storeNamespace()}:evidence-approval-logs`;
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

function similaritySubmitKeyFor(team) {
  return `kit:${storeNamespace()}:similarity-submits:${team}`;
}

function similarityFreeResubmitKeyFor(team) {
  return `kit:${storeNamespace()}:similarity-free-resubmits:${team}`;
}

function goldenNoticeKeyFor(team) {
  return `kit:${storeNamespace()}:golden-notices:${team}`;
}

function studentAccountKey() {
  return `kit:${storeNamespace()}:student-accounts`;
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

async function getStudentAccountConfig() {
  let raw;
  if (!hasPersistentStore()) {
    raw = memoryStudentAccountStore.get(studentAccountKey()) || "";
  } else {
    raw = await redisCommand(["GET", studentAccountKey()]);
  }

  if (!raw) return [];
  try {
    const records = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

async function setStudentAccountConfig(records) {
  const cleanRecords = Array.isArray(records) ? records : [];
  const serialized = JSON.stringify(cleanRecords);
  if (!hasPersistentStore()) {
    memoryStudentAccountStore.set(studentAccountKey(), serialized);
    return cleanRecords;
  }

  await redisCommand(["SET", studentAccountKey(), serialized]);
  return cleanRecords;
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

  if (staleKeys.length) {
    await redisCommand(["DEL", ...staleKeys]);
  }
  return Object.fromEntries(entries);
}

function cleanEvidenceApprovalEntry(entry = {}) {
  const team = normalizeTeam(entry.team);
  const roomId = String(entry.roomId || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20);
  if (!team || !roomId) return null;
  return {
    id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    at: String(entry.at || new Date().toISOString()),
    team,
    roomId,
    roomName: String(entry.roomName || "").trim().slice(0, 40),
    visit: Math.max(1, cleanCredits(entry.visit) || 1),
    by: String(entry.by || "teacher").trim().slice(0, 40),
    namespace: String(entry.namespace || storeNamespace()).trim()
  };
}

async function getEvidenceApprovals(limit = maxReturnedEvidenceLogs) {
  const safeLimit = Math.min(maxReturnedEvidenceLogs, Math.max(1, cleanCredits(limit) || maxReturnedEvidenceLogs));

  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    return memoryEvidenceApprovalStore
      .filter((entry) => entry.namespace === namespace)
      .slice(0, safeLimit);
  }

  const rawLogs = await redisCommand(["LRANGE", evidenceApprovalLogKey(), "0", String(maxStoredLogs - 1)]);
  return (Array.isArray(rawLogs) ? rawLogs : [])
    .map((item) => {
      try {
        return cleanEvidenceApprovalEntry(JSON.parse(item));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(0, safeLimit);
}

async function recordEvidenceApproval(entry) {
  const baseEntry = cleanEvidenceApprovalEntry({ ...entry, visit: 1 });
  if (!baseEntry) return null;

  const existing = await getEvidenceApprovals(maxReturnedEvidenceLogs);
  const visit = existing.filter((item) => (
    item.team === baseEntry.team && item.roomId === baseEntry.roomId
  )).length + 1;
  const cleanEntry = cleanEvidenceApprovalEntry({ ...baseEntry, visit });

  if (!hasPersistentStore()) {
    memoryEvidenceApprovalStore.unshift(cleanEntry);
    memoryEvidenceApprovalStore.splice(maxStoredLogs);
    return cleanEntry;
  }

  await redisCommand(["LPUSH", evidenceApprovalLogKey(), JSON.stringify(cleanEntry)]);
  await redisCommand(["LTRIM", evidenceApprovalLogKey(), "0", String(maxStoredLogs - 1)]);
  return cleanEntry;
}

async function clearEvidenceApprovals() {
  if (!hasPersistentStore()) {
    const namespace = storeNamespace();
    const removed = [];
    for (let index = memoryEvidenceApprovalStore.length - 1; index >= 0; index -= 1) {
      if (memoryEvidenceApprovalStore[index]?.namespace === namespace) {
        removed.unshift(...memoryEvidenceApprovalStore.splice(index, 1));
      }
    }
    return removed;
  }

  const removed = await getEvidenceApprovals(maxReturnedEvidenceLogs);
  await redisCommand(["DEL", evidenceApprovalLogKey()]);
  return removed;
}

function cleanEvidenceEntry(entry = {}) {
  const team = normalizeTeam(entry.team);
  const code = String(entry.code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  if (!team || !code) return null;
  const added = cleanCredits(entry.added || 0);
  const delta = Number.isFinite(Number(entry.delta)) ? Math.round(Number(entry.delta)) : added;

  return {
    id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    at: String(entry.at || new Date().toISOString()),
    team,
    user: String(entry.user || team).trim().slice(0, 30),
    code,
    room: String(entry.room || "").trim().slice(0, 30),
    evidence: String(entry.evidence || "").trim().slice(0, 80),
    person: String(entry.person || "").trim().slice(0, 30),
    source: String(entry.source || "").trim().toLowerCase().replace(/[^a-z-]/g, "").slice(0, 20),
    added,
    delta,
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

async function getEvidenceShopPurchases(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return [];

  if (!hasPersistentStore()) {
    return [...(memoryEvidenceShopStore.get(evidenceShopKeyFor(normalized)) || new Set())];
  }

  const members = await redisCommand(["SMEMBERS", evidenceShopKeyFor(normalized)]);
  return Array.isArray(members) ? members.map((member) => String(member)) : [];
}

async function purchaseEvidenceCards(team, entries = [], unitCost = 5, maxCards = 3) {
  const normalized = normalizeTeam(team);
  const cost = Math.max(1, cleanCredits(unitCost));
  const maximum = Math.max(1, cleanCredits(maxCards));
  const cards = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      ...entry,
      code: String(entry?.code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16)
    }))
    .filter((entry) => entry.code);
  const codes = cards.map((entry) => entry.code);

  if (!normalized || !codes.length || new Set(codes).size !== codes.length || codes.length > maximum) {
    return { ok: false, team: normalized, remaining: 0, purchasedCount: 0, reason: "INVALID_SELECTION" };
  }

  const logs = cards.map((card) => cleanEvidenceEntry({
    team: normalized,
    user: card.user || normalized,
    code: card.code,
    room: card.room,
    evidence: card.evidence,
    person: card.person,
    source: "shop",
    added: 0,
    delta: -cost,
    remaining: 0
  }));
  if (logs.some((entry) => !entry)) {
    return { ok: false, team: normalized, remaining: 0, purchasedCount: 0, reason: "INVALID_SELECTION" };
  }

  const total = cost * cards.length;
  if (!hasPersistentStore()) {
    const creditKey = keyFor(normalized);
    const redeemKey = evidenceRedeemKeyFor(normalized);
    const shopKey = evidenceShopKeyFor(normalized);
    const current = cleanCredits(memoryStore.get(creditKey) || 0);
    const redeemed = memoryEvidenceRedeemStore.get(redeemKey) || new Set();
    const purchased = memoryEvidenceShopStore.get(shopKey) || new Set();

    if (purchased.size + codes.length > maximum) {
      return { ok: false, team: normalized, remaining: current, purchasedCount: purchased.size, reason: "SHOP_LIMIT" };
    }
    const ownedCode = codes.find((code) => redeemed.has(code));
    if (ownedCode) {
      return { ok: false, team: normalized, remaining: current, purchasedCount: purchased.size, reason: "ALREADY_OWNED", code: ownedCode };
    }
    if (current < total) {
      return { ok: false, team: normalized, remaining: current, purchasedCount: purchased.size, reason: "NO_CREDITS" };
    }

    const remaining = current - total;
    memoryStore.set(creditKey, remaining);
    codes.forEach((code) => {
      redeemed.add(code);
      purchased.add(code);
    });
    memoryEvidenceRedeemStore.set(redeemKey, redeemed);
    memoryEvidenceShopStore.set(shopKey, purchased);
    logs.forEach((entry, index) => {
      entry.remaining = Math.max(0, current - (cost * (index + 1)));
      memoryEvidenceLogStore.unshift(entry);
    });
    memoryEvidenceLogStore.splice(maxStoredLogs);

    return {
      ok: true,
      team: normalized,
      remaining,
      purchasedCount: purchased.size,
      charged: total,
      logs
    };
  }

  const script = [
    "local current = tonumber(redis.call('GET', KEYS[1]) or '0')",
    "local cost = tonumber(ARGV[1]) or 0",
    "local maximum = tonumber(ARGV[2]) or 0",
    "local count = tonumber(ARGV[3]) or 0",
    "local purchased = tonumber(redis.call('SCARD', KEYS[3]) or '0')",
    "if purchased + count > maximum then return {-1, current, purchased} end",
    "if current < cost * count then return {-2, current, purchased} end",
    "for i = 1, count do local code = ARGV[3 + i]; if redis.call('SISMEMBER', KEYS[2], code) == 1 then return {-3, current, purchased, code} end end",
    "local remaining = current - (cost * count)",
    "redis.call('SET', KEYS[1], remaining)",
    "for i = 1, count do local code = ARGV[3 + i]; redis.call('SADD', KEYS[2], code); redis.call('SADD', KEYS[3], code); redis.call('LPUSH', KEYS[4], ARGV[3 + count + i]) end",
    `redis.call('LTRIM', KEYS[4], 0, ${maxStoredLogs - 1})`,
    "return {1, remaining, purchased + count}"
  ].join("; ");
  const result = await redisCommand([
    "EVAL",
    script,
    "4",
    keyFor(normalized),
    evidenceRedeemKeyFor(normalized),
    evidenceShopKeyFor(normalized),
    evidenceLogKey(),
    String(cost),
    String(maximum),
    String(codes.length),
    ...codes,
    ...logs.map((entry) => JSON.stringify(entry))
  ]);
  const status = Number(Array.isArray(result) ? result[0] : 0);
  const remaining = cleanCredits(Array.isArray(result) ? result[1] : 0);
  const purchasedCount = cleanCredits(Array.isArray(result) ? result[2] : 0);

  if (status !== 1) {
    const reasons = { "-1": "SHOP_LIMIT", "-2": "NO_CREDITS", "-3": "ALREADY_OWNED" };
    return {
      ok: false,
      team: normalized,
      remaining,
      purchasedCount,
      reason: reasons[String(status)] || "PURCHASE_FAILED",
      code: status === -3 ? String(result?.[3] || "") : ""
    };
  }

  return {
    ok: true,
    team: normalized,
    remaining,
    purchasedCount,
    charged: total,
    logs
  };
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
    teams.forEach((team) => {
      memoryEvidenceRedeemStore.delete(evidenceRedeemKeyFor(team));
      memoryEvidenceShopStore.delete(evidenceShopKeyFor(team));
    });
    return removed;
  }

  const removed = await getEvidenceRedemptions("", maxReturnedEvidenceLogs);
  await Promise.all([
    redisCommand(["DEL", evidenceLogKey()]),
    ...teams.flatMap((team) => [
      redisCommand(["DEL", evidenceRedeemKeyFor(team)]),
      redisCommand(["DEL", evidenceShopKeyFor(team)])
    ])
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

function cleanGoldenNoticeEntry(entry = {}) {
  const team = normalizeTeam(entry.team);
  if (!team) return null;

  return {
    id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    at: String(entry.at || new Date().toISOString()),
    team,
    sourceTeam: normalizeTeam(entry.sourceTeam) || "",
    code: String(entry.code || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12),
    title: String(entry.title || "황금열쇠").trim().slice(0, 60),
    concept: String(entry.concept || "").trim().slice(0, 40),
    ethicsMeaning: String(entry.ethicsMeaning || "").trim().slice(0, 360),
    popup: String(entry.popup || entry.message || "").trim().slice(0, 500),
    delta: Math.round(Number(entry.delta) || 0),
    credits: cleanCredits(entry.credits),
    tone: String(entry.tone || "").trim().slice(0, 20),
    namespace: String(entry.namespace || storeNamespace()).trim()
  };
}

async function getSimilaritySubmitCount(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return 0;

  if (!hasPersistentStore()) {
    return cleanCredits(memorySimilaritySubmitStore.get(similaritySubmitKeyFor(normalized)) || 0);
  }

  return cleanCredits(await redisCommand(["GET", similaritySubmitKeyFor(normalized)]));
}

async function bumpSimilaritySubmitCount(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return 0;

  if (!hasPersistentStore()) {
    const key = similaritySubmitKeyFor(normalized);
    const next = cleanCredits(memorySimilaritySubmitStore.get(key) || 0) + 1;
    memorySimilaritySubmitStore.set(key, next);
    return next;
  }

  return cleanCredits(await redisCommand(["INCR", similaritySubmitKeyFor(normalized)]));
}

async function getSimilarityFreeResubmits(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return 0;

  if (!hasPersistentStore()) {
    return cleanCredits(memorySimilarityFreeStore.get(similarityFreeResubmitKeyFor(normalized)) || 0);
  }

  return cleanCredits(await redisCommand(["GET", similarityFreeResubmitKeyFor(normalized)]));
}

async function grantSimilarityFreeResubmit(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return 0;

  if (!hasPersistentStore()) {
    const key = similarityFreeResubmitKeyFor(normalized);
    const next = cleanCredits(memorySimilarityFreeStore.get(key) || 0) + 1;
    memorySimilarityFreeStore.set(key, next);
    return next;
  }

  return cleanCredits(await redisCommand(["INCR", similarityFreeResubmitKeyFor(normalized)]));
}

async function consumeSimilarityFreeResubmit(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return { used: false, remaining: 0 };

  if (!hasPersistentStore()) {
    const key = similarityFreeResubmitKeyFor(normalized);
    const current = cleanCredits(memorySimilarityFreeStore.get(key) || 0);
    if (current <= 0) return { used: false, remaining: 0 };
    const remaining = current - 1;
    memorySimilarityFreeStore.set(key, remaining);
    return { used: true, remaining };
  }

  const script = [
    "local current = tonumber(redis.call('GET', KEYS[1]) or '0')",
    "if current <= 0 then return -1 end",
    "current = current - 1",
    "redis.call('SET', KEYS[1], current)",
    "return current"
  ].join("; ");
  const remaining = Number(await redisCommand(["EVAL", script, "1", similarityFreeResubmitKeyFor(normalized)]));
  if (!Number.isFinite(remaining) || remaining < 0) {
    return { used: false, remaining: 0 };
  }
  return { used: true, remaining };
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

async function recordGoldenNotice(team, entry = {}) {
  const cleanEntry = cleanGoldenNoticeEntry({ ...entry, team });
  if (!cleanEntry) return null;

  if (!hasPersistentStore()) {
    const key = goldenNoticeKeyFor(cleanEntry.team);
    const notices = memoryGoldenNoticeStore.get(key) || [];
    notices.unshift(cleanEntry);
    notices.splice(12);
    memoryGoldenNoticeStore.set(key, notices);
    return cleanEntry;
  }

  const key = goldenNoticeKeyFor(cleanEntry.team);
  await redisCommand(["LPUSH", key, JSON.stringify(cleanEntry)]);
  await redisCommand(["LTRIM", key, "0", "11"]);
  return cleanEntry;
}

async function consumeGoldenNotices(team) {
  const normalized = normalizeTeam(team);
  if (!normalized) return [];

  if (!hasPersistentStore()) {
    const key = goldenNoticeKeyFor(normalized);
    const notices = (memoryGoldenNoticeStore.get(key) || [])
      .map(cleanGoldenNoticeEntry)
      .filter(Boolean)
      .reverse();
    memoryGoldenNoticeStore.delete(key);
    return notices;
  }

  const key = goldenNoticeKeyFor(normalized);
  const script = [
    "local items = redis.call('LRANGE', KEYS[1], 0, -1)",
    "redis.call('DEL', KEYS[1])",
    "return items"
  ].join("; ");
  const rawNotices = await redisCommand(["EVAL", script, "1", key]);
  return (Array.isArray(rawNotices) ? rawNotices : [])
    .map((item) => {
      try {
        return cleanGoldenNoticeEntry(JSON.parse(item));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
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
    teams.forEach((team) => memorySimilaritySubmitStore.delete(similaritySubmitKeyFor(team)));
    teams.forEach((team) => memorySimilarityFreeStore.delete(similarityFreeResubmitKeyFor(team)));
    return removed;
  }

  const removed = await getSimilaritySentences(maxReturnedEvidenceLogs);
  await redisCommand(["DEL", similaritySentenceKey()]);
  await redisCommand(["DEL", ...teams.map(similaritySubmitKeyFor)]);
  await redisCommand(["DEL", ...teams.map(similarityFreeResubmitKeyFor)]);
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

async function consumeCredits(team, amount) {
  const normalized = normalizeTeam(team);
  const spend = cleanCredits(amount);
  if (!normalized) {
    return { ok: false, team: "", remaining: 0, reason: "INVALID_TEAM" };
  }
  if (spend <= 0) {
    return { ok: true, team: normalized, remaining: cleanCredits(await getCredits(normalized)) };
  }

  if (!hasPersistentStore()) {
    const key = keyFor(normalized);
    const current = cleanCredits(memoryStore.get(key) || 0);
    if (current < spend) {
      return { ok: false, team: normalized, remaining: current, reason: "NO_CREDITS" };
    }
    const remaining = current - spend;
    memoryStore.set(key, remaining);
    return { ok: true, team: normalized, remaining };
  }

  const script = [
    "local current = tonumber(redis.call('GET', KEYS[1]) or '0')",
    "local spend = tonumber(ARGV[1]) or 0",
    "if current < spend then return -1 end",
    "current = current - spend",
    "redis.call('SET', KEYS[1], current)",
    "return current"
  ].join("; ");
  const remaining = Number(await redisCommand(["EVAL", script, "1", keyFor(normalized), String(spend)]));
  if (!Number.isFinite(remaining) || remaining < 0) {
    return { ok: false, team: normalized, remaining: cleanCredits(await getCredits(normalized)), reason: "NO_CREDITS" };
  }
  return { ok: true, team: normalized, remaining };
}

async function reduceCredits(team, amount) {
  const normalized = normalizeTeam(team);
  const spend = cleanCredits(amount);
  if (!normalized) {
    return { ok: false, team: "", removed: 0, remaining: 0, reason: "INVALID_TEAM" };
  }
  if (spend <= 0) {
    return { ok: true, team: normalized, removed: 0, remaining: cleanCredits(await getCredits(normalized)) };
  }

  if (!hasPersistentStore()) {
    const key = keyFor(normalized);
    const current = cleanCredits(memoryStore.get(key) || 0);
    const removed = Math.min(current, spend);
    const remaining = current - removed;
    memoryStore.set(key, remaining);
    return { ok: true, team: normalized, removed, remaining };
  }

  const script = [
    "local current = tonumber(redis.call('GET', KEYS[1]) or '0')",
    "if current < 0 then current = 0 end",
    "local spend = tonumber(ARGV[1]) or 0",
    "local removed = current",
    "if spend < current then removed = spend end",
    "local remaining = current - removed",
    "redis.call('SET', KEYS[1], remaining)",
    "return {removed, remaining}"
  ].join("; ");
  const result = await redisCommand(["EVAL", script, "1", keyFor(normalized), String(spend)]);
  const removed = Math.max(0, Number(Array.isArray(result) ? result[0] : 0) || 0);
  const remaining = Math.max(0, Number(Array.isArray(result) ? result[1] : 0) || 0);
  return { ok: true, team: normalized, removed, remaining };
}

module.exports = {
  addCredits,
  addCustomEthicsQuestion,
  areEvidenceCodesRedeemed,
  bumpSimilaritySubmitCount,
  classLabelFor,
  deleteCustomEthicsQuestion,
  clearEvidenceGrant,
  clearEvidenceApprovals,
  clearEvidenceRedemptions,
  clearSimilaritySentences,
  clearEthicsQuizRedemptions,
  consumeCredit,
  consumeCredits,
  consumeSimilarityFreeResubmit,
  clearQuestionLogs,
  consumeGoldenNotices,
  currentClassId,
  getAllCredits,
  getAllEvidenceGrants,
  getAllGrantedCredits,
  getAllQuestionCounts,
  getCredits,
  getCustomEthicsQuestions,
  getEvidenceGrant,
  getEvidenceApprovals,
  getEvidenceRedemptions,
  getEvidenceShopPurchases,
  getEthicsQuizRedemptions,
  getEthicsQuizSolvedQuestions,
  getGrantedCredits,
  getQuestionCount,
  getQuestionLogs,
  getSimilaritySentences,
  getSimilarityFreeResubmits,
  getSimilaritySubmitCount,
  getStudentAccountConfig,
  getPresence,
  grantCredits,
  grantSimilarityFreeResubmit,
  hasPersistentStore,
  logQuestion,
  normalizeClassId,
  normalizeTeam,
  recordEvidenceRedemption,
  recordEvidenceApproval,
  recordEthicsQuizRedemption,
  recordGoldenNotice,
  recordSimilaritySentence,
  removePresence,
  requestClassId,
  redeemEthicsQuizQuestion,
  redeemEvidenceCode,
  purchaseEvidenceCards,
  reduceCredits,
  resetCredits,
  setEvidenceGrant,
  setCustomEthicsQuestions,
  setGrantedCredits,
  setStudentAccountConfig,
  setCredits,
  touchPresence,
  withClassScope,
  teams
};
