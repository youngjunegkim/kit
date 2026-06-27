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
globalThis.__kitClassScope = classScope;
globalThis.__kitQuestionCreditStore = memoryStore;
globalThis.__kitQuestionGrantStore = memoryGrantStore;
globalThis.__kitQuestionCountStore = memoryCountStore;
globalThis.__kitQuestionLogStore = memoryLogStore;
globalThis.__kitPresenceStore = memoryPresenceStore;
globalThis.__kitEvidenceRedeemStore = memoryEvidenceRedeemStore;
globalThis.__kitEvidenceLogStore = memoryEvidenceLogStore;
const maxStoredLogs = 200;
const maxReturnedLogs = 60;
const maxReturnedEvidenceLogs = 100;
const presenceTtlMs = Number(process.env.KIT_PRESENCE_TTL_MS || 300000);
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

function evidenceLogKey() {
  return `kit:${storeNamespace()}:evidence-logs`;
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
  classLabelFor,
  clearEvidenceRedemptions,
  consumeCredit,
  clearQuestionLogs,
  currentClassId,
  getAllCredits,
  getAllGrantedCredits,
  getAllQuestionCounts,
  getCredits,
  getEvidenceRedemptions,
  getGrantedCredits,
  getQuestionCount,
  getQuestionLogs,
  getPresence,
  grantCredits,
  hasPersistentStore,
  logQuestion,
  normalizeClassId,
  normalizeTeam,
  recordEvidenceRedemption,
  removePresence,
  requestClassId,
  redeemEvidenceCode,
  resetCredits,
  setGrantedCredits,
  setCredits,
  touchPresence,
  withClassScope,
  teams
};
