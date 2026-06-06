const {
  addCredits,
  clearQuestionLogs,
  getAllCredits,
  getAllQuestionCounts,
  getCredits,
  getQuestionCount,
  getQuestionLogs,
  hasPersistentStore,
  normalizeTeam,
  resetCredits,
  setCredits,
  teams
} = require("./_credits");

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

function isTeacher(request, body = {}) {
  return String(headerValue(request, "x-kit-role") || body.role || "").toLowerCase() === "teacher";
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
  return normalizeTeam(headerValue(request, "x-kit-team") || body.team || queryParam(request, "team"));
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

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const team = actorTeam(request);
      if (team) {
        sendJson(response, 200, {
          team,
          credits: await getCredits(team),
          count: await getQuestionCount(team),
          logs: await getQuestionLogs(team),
          persistent: hasPersistentStore()
        });
        return;
      }

      if (!isTeacher(request)) {
        sendJson(response, 403, { error: "Teacher role is required.", fallback: true });
        return;
      }

      sendJson(response, 200, {
        credits: await getAllCredits(),
        counts: await getAllQuestionCounts(),
        logs: await getQuestionLogs(),
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
    if (!isTeacher(request, body)) {
      sendJson(response, 403, { error: "Teacher role is required.", fallback: true });
      return;
    }

    const action = String(body.action || "set").toLowerCase();
    if (action === "reset") {
      sendJson(response, 200, {
        credits: await resetCredits(),
        counts: await getAllQuestionCounts(),
        logs: await getQuestionLogs(),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "clearlogs") {
      const result = await clearQuestionLogs();
      sendJson(response, 200, {
        credits: await getAllCredits(),
        counts: result.counts,
        logs: result.logs,
        persistent: hasPersistentStore()
      });
      return;
    }

    if (action === "setall") {
      const creditMap = body.credits && typeof body.credits === "object" ? body.credits : {};
      await Promise.all(teams.map((team) => setCredits(team, creditMap[team] || 0)));
      sendJson(response, 200, {
        credits: await getAllCredits(),
        counts: await getAllQuestionCounts(),
        logs: await getQuestionLogs(),
        persistent: hasPersistentStore()
      });
      return;
    }

    const team = normalizeTeam(body.team);
    if (!team) {
      sendJson(response, 400, { error: "Valid team is required." });
      return;
    }

    const nextCredits = action === "add"
      ? await addCredits(team, body.amount)
      : await setCredits(team, body.credits);

    sendJson(response, 200, {
      team,
      credits: nextCredits,
      allCredits: await getAllCredits(),
      counts: await getAllQuestionCounts(),
      logs: await getQuestionLogs(),
      persistent: hasPersistentStore()
    });
  } catch (error) {
    sendJson(response, 503, {
      error: error.message || "Question credit store failed.",
      fallback: true
    });
  }
};
