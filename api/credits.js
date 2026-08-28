const {
  clearQuestionLogs,
  consumeGoldenNotices,
  getAllCredits,
  getAllGrantedCredits,
  getAllQuestionCounts,
  getCredits,
  getGameResults,
  getGameSession,
  getGrantedCredits,
  getQuestionCount,
  getQuestionLogs,
  grantCredits,
  hasPersistentStore,
  normalizeTeam,
  requestClassId,
  resetCredits,
  saveCurrentGameResult,
  setGrantedCredits,
  setCredits,
  startNewGame,
  teams,
  updateGameTeamCount,
  withClassScope
} = require("./_credits");
const {
  getAccountsForAdmin,
  loginAccount,
  updateAccounts
} = require("./_student-accounts");

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

function isTeacher(request, body = {}) {
  return String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase() === "teacher";
}

function isTeacherCodeConfigured() {
  return false;
}

function teacherAuthError(request, body = {}) {
  if (!isTeacher(request, body)) {
    return { status: 403, code: "TEACHER_ROLE_REQUIRED", error: "Teacher role is required." };
  }
  return null;
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

function queryParam(request, name) {
  if (request.query?.[name]) return request.query[name];
  try {
    return new URL(request.url || "", "http://localhost").searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function actorTeam(request, body = {}) {
  return normalizeTeam(decodedHeaderValue(request, "x-kit-team") || body.team || queryParam(request, "team"));
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

async function handleCredits(request, response) {
  try {
    if (!isAllowedOrigin(request)) {
      sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
      return;
    }

    if (request.method === "GET") {
      if (queryParam(request, "studentAccounts") === "1") {
        const result = await getAccountsForAdmin(request);
        sendJson(response, result.status, result.body);
        return;
      }

      if (queryParam(request, "gameSessions") === "1") {
        const authError = teacherAuthError(request);
        if (authError) {
          sendJson(response, authError.status, { ...authError, fallback: true });
          return;
        }
        sendJson(response, 200, {
          ok: true,
          session: await getGameSession(),
          results: await getGameResults(),
          persistent: hasPersistentStore()
        });
        return;
      }

      const team = actorTeam(request);
      if (team) {
        sendJson(response, 200, {
          team,
          credits: await getCredits(team),
          granted: await getGrantedCredits(team),
          count: await getQuestionCount(team),
          logs: await getQuestionLogs(team),
          goldenNotices: await consumeGoldenNotices(team),
          session: await getGameSession(),
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
        credits: await getAllCredits(),
        granted: await getAllGrantedCredits(),
        counts: await getAllQuestionCounts(),
        logs: await getQuestionLogs(),
        persistent: hasPersistentStore(),
        teacherCodeConfigured: isTeacherCodeConfigured()
      });
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("allow", "GET, POST");
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const body = bodyFor(request);
    const action = String(body.action || "set").toLowerCase();

    if (action === "accountlogin" || action === "studentaccountlogin") {
      const result = await loginAccount(body);
      sendJson(response, result.status, result.body);
      return;
    }

    if (action === "studentaccountupdate") {
      const result = await updateAccounts(request, body);
      sendJson(response, result.status, result.body);
      return;
    }

    if (action === "resetteam") {
      const team = normalizeTeam(body.team || actorTeam(request, body));
      const role = String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase();
      if (role !== "teacher") {
        sendJson(response, 403, { error: "Teacher account is required.", code: "TEACHER_ONLY" });
        return;
      }
      if (!team) {
        sendJson(response, 400, { error: "Valid team is required." });
        return;
      }

      await setCredits(team, 0);
      await setGrantedCredits(team, 0);
      sendJson(response, 200, {
        team,
        credits: 0,
        granted: 0,
        count: await getQuestionCount(team),
        allCredits: await getAllCredits(),
        allGranted: await getAllGrantedCredits(),
        counts: await getAllQuestionCounts(),
        logs: await getQuestionLogs(team),
        persistent: hasPersistentStore(),
        teacherCodeConfigured: isTeacherCodeConfigured()
      });
      return;
    }

    const authError = teacherAuthError(request, body);
    if (authError) {
      sendJson(response, authError.status, { ...authError, fallback: true });
      return;
    }

    if (action === "gamesessionteamcount") {
      const teamCount = Math.round(Number(body.teamCount));
      if (!Number.isFinite(teamCount) || teamCount < 1 || teamCount > teams.length) {
        sendJson(response, 400, { error: `팀 수는 1~${teams.length}팀으로 설정하세요.`, code: "INVALID_TEAM_COUNT" });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        session: await updateGameTeamCount(teamCount),
        results: await getGameResults(),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "gamesessionsave") {
      const saved = await saveCurrentGameResult();
      sendJson(response, 200, {
        ok: true,
        session: await getGameSession(),
        result: saved.result,
        results: saved.history,
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "gamesessionnew") {
      const teamCount = Math.round(Number(body.teamCount));
      if (!Number.isFinite(teamCount) || teamCount < 1 || teamCount > teams.length) {
        sendJson(response, 400, { error: `팀 수는 1~${teams.length}팀으로 설정하세요.`, code: "INVALID_TEAM_COUNT" });
        return;
      }
      const next = await startNewGame(teamCount);
      sendJson(response, 200, {
        ok: true,
        ...next,
        credits: await getAllCredits(),
        granted: await getAllGrantedCredits(),
        counts: await getAllQuestionCounts(),
        logs: [],
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "reset") {
      sendJson(response, 200, {
        credits: await resetCredits(),
        granted: await getAllGrantedCredits(),
        counts: await getAllQuestionCounts(),
        logs: await getQuestionLogs(),
        persistent: hasPersistentStore(),
        teacherCodeConfigured: isTeacherCodeConfigured()
      });
      return;
    }

    if (action === "clearlogs") {
      const result = await clearQuestionLogs();
      sendJson(response, 200, {
        credits: await getAllCredits(),
        granted: await getAllGrantedCredits(),
        counts: result.counts,
        logs: result.logs,
        persistent: hasPersistentStore(),
        teacherCodeConfigured: isTeacherCodeConfigured()
      });
      return;
    }

    if (action === "addall") {
      const amountMap = body.amounts && typeof body.amounts === "object" ? body.amounts : {};
      await Promise.all(teams.map((team) => grantCredits(team, amountMap[team] || 0)));
      sendJson(response, 200, {
        credits: await getAllCredits(),
        granted: await getAllGrantedCredits(),
        counts: await getAllQuestionCounts(),
        logs: await getQuestionLogs(),
        persistent: hasPersistentStore(),
        teacherCodeConfigured: isTeacherCodeConfigured()
      });
      return;
    }

    if (action === "setall") {
      const creditMap = body.credits && typeof body.credits === "object" ? body.credits : {};
      await Promise.all(teams.map(async (team) => {
        const credits = creditMap[team] || 0;
        await setCredits(team, credits);
        await setGrantedCredits(team, credits);
      }));
      sendJson(response, 200, {
        credits: await getAllCredits(),
        granted: await getAllGrantedCredits(),
        counts: await getAllQuestionCounts(),
        logs: await getQuestionLogs(),
        persistent: hasPersistentStore(),
        teacherCodeConfigured: isTeacherCodeConfigured()
      });
      return;
    }

    const team = normalizeTeam(body.team);
    if (!team) {
      sendJson(response, 400, { error: "Valid team is required." });
      return;
    }

    const result = action === "add"
      ? await grantCredits(team, body.amount)
      : { credits: await setCredits(team, body.credits), granted: await getGrantedCredits(team) };

    sendJson(response, 200, {
      team,
      credits: result.credits,
      granted: result.granted,
      allCredits: await getAllCredits(),
      allGranted: await getAllGrantedCredits(),
      counts: await getAllQuestionCounts(),
      logs: await getQuestionLogs(),
      persistent: hasPersistentStore(),
      teacherCodeConfigured: isTeacherCodeConfigured()
    });
  } catch (error) {
    sendJson(response, 503, {
      error: error.message || "Question credit store failed.",
      fallback: true
    });
  }
}

module.exports = async function handler(request, response) {
  const body = bodyFor(request);
  return withClassScope(requestClassId(request, body), () => handleCredits(request, response));
};
