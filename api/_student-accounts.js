const { createHash, timingSafeEqual } = require("node:crypto");
const {
  getStudentAccountConfig,
  getGameSession,
  hasPersistentStore,
  setStudentAccountConfig,
  teams
} = require("./_credits");

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

function result(status, body) {
  return { status, body };
}

function defaultTeacherAccount() {
  return { id: "master", passwordHash: hashPassword("master1") };
}

function defaultStudentAccounts() {
  return teams.map((team, index) => ({
    team,
    id: defaultIds[index],
    passwordHash: hashPassword(`kit${index + 1}`)
  }));
}

function cleanTeacherAccount(record) {
  const fallback = defaultTeacherAccount();
  const id = normalizeId(record?.id);
  const passwordHash = String(record?.passwordHash || "").toLowerCase();
  if (!idPattern.test(id) || !passwordHashPattern.test(passwordHash)) return fallback;
  return { id, passwordHash };
}

function cleanStudentAccounts(records) {
  if (!Array.isArray(records) || records.length !== teams.length) return defaultStudentAccounts();
  const defaults = defaultStudentAccounts();
  const byTeam = new Map(records.map((record) => [String(record?.team || ""), record]));
  const cleaned = teams.map((team, index) => {
    const record = byTeam.get(team) || {};
    const id = normalizeId(record.id);
    const passwordHash = String(record.passwordHash || "").toLowerCase();
    if (!idPattern.test(id) || !passwordHashPattern.test(passwordHash)) return defaults[index];
    return { team, id, passwordHash };
  });
  const ids = cleaned.map((record) => record.id);
  return new Set(ids).size === ids.length ? cleaned : defaults;
}

function cleanAccountConfig(stored) {
  const legacyStudents = Array.isArray(stored) ? stored : null;
  const teacher = cleanTeacherAccount(legacyStudents ? null : stored?.teacher);
  const students = cleanStudentAccounts(legacyStudents || stored?.students);
  const allIds = [teacher.id, ...students.map((record) => record.id)];
  if (new Set(allIds).size !== allIds.length) {
    return { teacher: defaultTeacherAccount(), students: defaultStudentAccounts() };
  }
  return { teacher, students };
}

async function currentAccountConfig() {
  return cleanAccountConfig(await getStudentAccountConfig());
}

function publicAccounts(config) {
  return [
    { role: "teacher", label: "선생님", id: config.teacher.id },
    ...config.students.map((record, index) => ({
      role: "student",
      team: record.team,
      label: String(index + 1),
      id: record.id
    }))
  ];
}

function passwordMatches(record, password) {
  return valuesMatch(hashPassword(String(password || "").trim()), record.passwordHash);
}

async function loginAccount(body) {
  const id = normalizeId(body.id || body.userId);
  const password = String(body.password || "").trim();
  const config = await currentAccountConfig();

  if (config.teacher.id === id && passwordMatches(config.teacher, password)) {
    return result(200, {
      ok: true,
      account: { user: config.teacher.id, role: "teacher", label: "선생님" }
    });
  }

  const index = config.students.findIndex((record) => record.id === id);
  const record = index >= 0 ? config.students[index] : null;
  if (!record || !passwordMatches(record, password)) {
    return result(401, {
      ok: false,
      error: "아이디 또는 비밀번호가 올바르지 않습니다.",
      code: "INVALID_CREDENTIALS"
    });
  }

  const session = await getGameSession();
  if (index >= session.teamCount) {
    return result(403, {
      ok: false,
      error: `현재 게임은 ${session.teamCount}팀까지만 참여할 수 있습니다.`,
      code: "INACTIVE_TEAM"
    });
  }

  return result(200, {
    ok: true,
    account: {
      user: record.id,
      role: "student",
      label: String(index + 1),
      team: record.team
    }
  });
}

async function isTeacherAuthorized(request) {
  const role = String(headerValue(request, "x-kit-role") || "").trim().toLowerCase();
  const id = normalizeId(decodedHeaderValue(request, "x-kit-user"));
  const password = String(headerValue(request, "x-teacher-code") || "").trim();
  if (role !== "teacher" || !id || !password) return false;
  const config = await currentAccountConfig();
  return config.teacher.id === id && passwordMatches(config.teacher, password);
}

async function getAccountsForAdmin(request) {
  if (!await isTeacherAuthorized(request)) {
    return result(401, {
      ok: false,
      error: "관리자 아이디 또는 비밀번호가 올바르지 않습니다.",
      code: "TEACHER_CODE_REQUIRED"
    });
  }

  return result(200, {
    ok: true,
    accounts: publicAccounts(await currentAccountConfig()),
    persistent: hasPersistentStore()
  });
}

async function updateAccounts(request, body) {
  if (!await isTeacherAuthorized(request)) {
    return result(401, {
      ok: false,
      error: "관리자 아이디 또는 비밀번호가 올바르지 않습니다.",
      code: "TEACHER_CODE_REQUIRED"
    });
  }

  const updates = Array.isArray(body.accounts) ? body.accounts : [];
  const teacherUpdate = updates.find((record) => record?.role === "teacher") || {};
  const studentUpdates = updates.filter((record) => record?.role === "student");
  if (updates.length !== teams.length + 1 || studentUpdates.length !== teams.length) {
    return result(400, { ok: false, error: "선생님과 8개 팀의 계정 정보를 모두 확인하세요.", code: "INVALID_ACCOUNTS" });
  }

  const current = await currentAccountConfig();
  const teacherId = normalizeId(teacherUpdate.id);
  const teacherPassword = String(teacherUpdate.password || "").trim();
  if (!idPattern.test(teacherId)) {
    return result(400, { ok: false, error: "선생님 아이디는 3~24자로 입력하세요.", code: "INVALID_ID" });
  }
  if (teacherPassword && (teacherPassword.length < 4 || teacherPassword.length > 64)) {
    return result(400, { ok: false, error: "선생님 새 비밀번호는 4~64자로 입력하세요.", code: "INVALID_PASSWORD" });
  }

  const nextTeacher = {
    id: teacherId,
    passwordHash: teacherPassword ? hashPassword(teacherPassword) : current.teacher.passwordHash
  };
  const updatesByTeam = new Map(studentUpdates.map((record) => [String(record?.team || ""), record]));
  const nextStudents = [];
  for (let index = 0; index < teams.length; index += 1) {
    const team = teams[index];
    const update = updatesByTeam.get(team) || {};
    const id = normalizeId(update.id);
    const password = String(update.password || "").trim();
    if (!idPattern.test(id)) {
      return result(400, {
        ok: false,
        error: `${index + 1}팀 아이디는 3~24자로 입력하세요.`,
        code: "INVALID_ID"
      });
    }
    if (password && (password.length < 4 || password.length > 64)) {
      return result(400, {
        ok: false,
        error: `${index + 1}팀 새 비밀번호는 4~64자로 입력하세요.`,
        code: "INVALID_PASSWORD"
      });
    }
    nextStudents.push({
      team,
      id,
      passwordHash: password ? hashPassword(password) : current.students[index].passwordHash
    });
  }

  const ids = [nextTeacher.id, ...nextStudents.map((record) => record.id)];
  if (new Set(ids).size !== ids.length) {
    return result(400, { ok: false, error: "선생님과 학생 아이디는 모두 서로 달라야 합니다.", code: "DUPLICATE_ID" });
  }

  const next = { teacher: nextTeacher, students: nextStudents };
  await setStudentAccountConfig(next);
  return result(200, {
    ok: true,
    accounts: publicAccounts(next),
    persistent: hasPersistentStore()
  });
}

module.exports = {
  getAccountsForAdmin,
  loginAccount,
  updateAccounts
};
