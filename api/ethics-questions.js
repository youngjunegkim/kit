const {
  addCustomEthicsQuestion,
  deleteCustomEthicsQuestion,
  getCustomEthicsQuestions,
  hasPersistentStore,
  requestClassId,
  withClassScope
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

function roleFor(request) {
  return String(headerValue(request, "x-kit-role") || queryValue(request, "role") || "").toLowerCase();
}

async function handleEthicsQuestions(request, response) {
  try {
    if (!isAllowedOrigin(request)) {
      sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
      return;
    }

    const role = roleFor(request);
    if (role && !["student", "teacher"].includes(role)) {
      sendJson(response, 403, { error: "Student or teacher role is required.", code: "ROLE_REQUIRED" });
      return;
    }

    if (request.method === "GET") {
      sendJson(response, 200, {
        questions: await getCustomEthicsQuestions(),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (request.method !== "POST" && request.method !== "DELETE") {
      response.setHeader("allow", "GET, POST, DELETE");
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    if (role !== "teacher") {
      sendJson(response, 403, { error: "Teacher role is required.", code: "TEACHER_ROLE_REQUIRED" });
      return;
    }

    const body = bodyFor(request);
    const action = String(body.action || "").trim().toLowerCase();
    if (request.method === "DELETE" || action === "delete") {
      const removed = await deleteCustomEthicsQuestion(body.id || queryValue(request, "id"));
      sendJson(response, removed ? 200 : 404, {
        ok: Boolean(removed),
        removed,
        questions: await getCustomEthicsQuestions(),
        persistent: hasPersistentStore()
      });
      return;
    }

    const question = await addCustomEthicsQuestion(body.question || body);
    if (!question) {
      sendJson(response, 400, { error: "Valid question data is required.", code: "INVALID_QUESTION" });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      question,
      questions: await getCustomEthicsQuestions(),
      persistent: hasPersistentStore()
    });
  } catch (error) {
    sendJson(response, 503, {
      error: error.message || "Ethics question update failed.",
      fallback: true
    });
  }
}

module.exports = async function handler(request, response) {
  const body = bodyFor(request);
  return withClassScope(requestClassId(request, body), () => handleEthicsQuestions(request, response));
};
