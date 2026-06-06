const {
  getPresence,
  hasPersistentStore,
  removePresence,
  touchPresence
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

function decodedHeaderValue(request, name) {
  const value = headerValue(request, name);
  if (!value) return "";
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
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

function actorFrom(request, body = {}) {
  const user = String(decodedHeaderValue(request, "x-kit-user") || body.user || "").trim();
  const role = String(headerValue(request, "x-kit-role") || body.role || "").trim();
  const label = String(decodedHeaderValue(request, "x-kit-label") || body.label || user).trim();
  const team = String(decodedHeaderValue(request, "x-kit-team") || body.team || "").trim();
  return { user, role, label, team };
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

module.exports = async function handler(request, response) {
  try {
    if (!isAllowedOrigin(request)) {
      sendJson(response, 403, { error: "Origin is not allowed.", fallback: true });
      return;
    }

    if (request.method === "GET") {
      sendJson(response, 200, {
        online: await getPresence(),
        persistent: hasPersistentStore()
      });
      return;
    }

    if (request.method !== "POST" && request.method !== "DELETE") {
      response.setHeader("allow", "GET, POST, DELETE");
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const body = bodyFor(request);
    const actor = actorFrom(request, body);
    const action = request.method === "DELETE" ? "leave" : String(body.action || "touch").toLowerCase();

    if (!actor.user) {
      sendJson(response, 400, { error: "Account is required.", online: await getPresence() });
      return;
    }

    const online = action === "leave"
      ? await removePresence(actor.user)
      : await touchPresence(actor);

    sendJson(response, 200, {
      online,
      persistent: hasPersistentStore()
    });
  } catch (error) {
    sendJson(response, 503, {
      error: error.message || "Presence store failed.",
      fallback: true
    });
  }
};
