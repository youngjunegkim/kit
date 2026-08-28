const { createHash, timingSafeEqual } = require("node:crypto");
const {
  getStudentAccountConfig,
  hasPersistentStore,
  requestClassId,
  setStudentAccountConfig,
  teams,
  withClassScope
} = require("./_credits");
const { applyCors, handleCorsPreflight, isAllowedOrigin } = require("./_origin");

const defaultIds = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august"
];
const idPattern = /^[\p{L}\p{N}][\p{L}\p{N}._-]{2,23}$/u;
const passwordHashPattern = /^[a-f0-9]{64}$/;

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

function normalizeId(value) {
  return String(value || "").trim().toLowerCase();
}

function hashPassword(password) {
  return createHash("sha256").update(String(password), "utf8").digest("hex");
}

function valuesMatch(left, right) {
  const leftBuffer = Buffer.from(String(left), "utf8");
  const rightBuffer = Buffer.from(String(right), "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function defaultAccounts() {
  return teams.map((team, index) => ({
    team,
    id: defaultIds[index],
    passwordHash: hashPassword(`kit${index + 1}`)
  }));
}

function cleanStoredAccounts(records) {
  if (!Array.isArray(records) || records.length !== teams.length) return defaultAccounts();
  const defaults = defaultAccounts();
  const byTeam = new Map(records.map((record) => [String(record?.team || ""), record]));
  const cleaned = teams.map((team, index) => {
    const record = byTeam.get(team) || {};
    const id = normalizeId(record.id);
    const passwordHash = String(record.passwordHash || "").toLowerCase();
    if (!idPattern.test(id) || id === "master" || !passwordHashPattern.test(passwordHash)) {
      return defaults[index];
    }
    return { team, id, passwordHash };
  });
  const ids = cleaned.map((record) => record.id);
  return new Set(ids).size === ids.length ? cleaned : defaults;
}

async function currentAccounts() {
  return cleanStoredAccounts(await getStudentAccountConfig());
}

function publicAccounts(records) {
  return records.map((record, index) => ({
    team: record.team,
    label: String(index + 1),
    id: record.id
  }));
}

function teacherAccessCode() {
  return String(
    process.env.TEACHER_ACCESS_CODE ||
    process.env.KIT_TEACHER_ACCESS_CODE ||
    "master1"
  ).trim();
}

function isTeacherAuthorized(request) {
  const role = String(headerValue(request, "x-kit-role") || "").trim().toLowerCase();
  const suppliedCode = String(headerValue(request, "x-teacher-code") || "").trim();
  return role === "teacher" && valuesMatch(suppliedCode, teacherAccessCode());
}

async function handleLogin(body, response) {
  const id = normalizeId(body.id || body.userId);
  const password = String(body.password || "").trim();
  const records = await currentAccounts();
  const index = records.findIndex((record) => record.id === id);
  const record = index >= 0 ? records[index] : null;
  const suppliedHash = hashPassword(password);

  if (!record || !valuesMatch(suppliedHash, record.passwordHash)) {
    sendJson(response, 401, {
      ok: false,
      error: "아이디 또는 비밀번호가 올바르지 않습니다.",
      code: "INVALID_CREDENTIALS"
    });
    return;
  }

  sendJson(response, 200, {
    ok: true,
    account: {
      user: record.id,
      role: "student",
      label: String(index + 1),
      team: record.team
    }
  });
}

async function handleUpdate(request, body, response) {
  if (!isTeacherAuthorized(request)) {
    sendJson(response, 401, {
      ok: false,
      error: "관리자 비밀번호가 올바르지 않습니다.",
      code: "TEACHER_CODE_REQUIRED"
    });
    return;
  }

  const updates = Array.isArray(body.accounts) ? body.accounts : [];
  if (updates.length !== teams.length) {
    sendJson(response, 400, { ok: false, error: "8개 팀의 계정 정보를 모두 확인하세요.", code: "INVALID_ACCOUNTS" });
    return;
  }

  const current = await currentAccounts();
  const updatesByTeam = new Map(updates.map((record) => [String(record?.team || ""), record]));
  const next = [];
  for (let index = 0; index < teams.length; index += 1) {
    const team = teams[index];
    const update = updatesByTeam.get(team) || {};
    const id = normalizeId(update.id);
    const password = String(update.password || "").trim();
    if (!idPattern.test(id) || id === "master") {
      sendJson(response, 400, {
        ok: false,
        error: `${index + 1}팀 아이디는 3~24자의 문자, 숫자, 마침표, 밑줄 또는 하이픈으로 입력하세요.`,
        code: "INVALID_ID"
      });
      return;
    }
    if (password && (password.length < 4 || password.length > 64)) {
      sendJson(response, 400, {
        ok: false,
        error: `${index + 1}팀 새 비밀번호는 4~64자로 입력하세요.`,
        code: "INVALID_PASSWORD"
      });
      return;
    }
    next.push({
      team,
      id,
      passwordHash: password ? hashPassword(password) : current[index].passwordHash
    });
  }

  const ids = next.map((record) => record.id);
  if (new Set(ids).size !== ids.length) {
    sendJson(response, 400, { ok: false, error: "학생 아이디는 팀마다 서로 달라야 합니다.", code: "DUPLICATE_ID" });
    return;
  }

  await setStudentAccountConfig(next);
  sendJson(response, 200, {
    ok: true,
    accounts: publicAccounts(next),
    persistent: hasPersistentStore()
  });
}

async function handleStudentAccounts(request, response) {
  applyCors(request, response);
  if (handleCorsPreflight(request, response, "GET, POST")) return;
  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { ok: false, error: "Origin is not allowed." });
    return;
  }

  try {
    const body = bodyFor(request);
    if (request.method === "POST" && String(body.action || "login").toLowerCase() === "login") {
      await handleLogin(body, response);
      return;
    }

    if (request.method === "GET") {
      if (!isTeacherAuthorized(request) || queryValue(request, "admin") !== "1") {
        sendJson(response, 401, {
          ok: false,
          error: "관리자 인증이 필요합니다.",
          code: "TEACHER_CODE_REQUIRED"
        });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        accounts: publicAccounts(await currentAccounts()),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (request.method === "POST" && String(body.action || "").toLowerCase() === "update") {
      await handleUpdate(request, body, response);
      return;
    }

    response.setHeader("allow", "GET, POST, OPTIONS");
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      error: error.message || "학생 계정 저장소를 사용할 수 없습니다.",
      code: "ACCOUNT_STORE_UNAVAILABLE"
    });
  }
}

module.exports = async function handler(request, response) {
  const body = bodyFor(request);
  return withClassScope(requestClassId(request, body), () => handleStudentAccounts(request, response));
};
