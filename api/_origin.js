function headerValue(request, name) {
  const value = request.headers?.[name.toLowerCase()] || request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function configuredOrigins() {
  return String(process.env.ALLOWED_ORIGINS || "")
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isKitVercelHost(host) {
  const normalized = String(host || "").toLowerCase();
  return normalized === "kit-six-tau.vercel.app" ||
    /^kit-[a-z0-9-]+-kit-s-projects6\.vercel\.app$/.test(normalized);
}

function originHostFor(origin) {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return "";
  }
}

function isAllowedOrigin(request) {
  const origin = headerValue(request, "origin");
  if (!origin) return true;
  if (configuredOrigins().includes(origin)) return true;

  const requestHost = String(headerValue(request, "x-forwarded-host") || headerValue(request, "host") || "").toLowerCase();
  const originHost = originHostFor(origin);
  if (!requestHost || !originHost) return false;
  if (originHost === requestHost) return true;

  return isKitVercelHost(originHost) && isKitVercelHost(requestHost);
}

function applyCors(request, response) {
  const origin = headerValue(request, "origin");
  if (!origin || !isAllowedOrigin(request)) return;

  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type,x-kit-role,x-class-code,x-teacher-code");
  response.setHeader("access-control-max-age", "86400");
  response.setHeader("vary", "Origin");
}

function handleCorsPreflight(request, response, methods) {
  if (request.method !== "OPTIONS") return false;
  applyCors(request, response);
  response.setHeader("allow", `${methods}, OPTIONS`);
  response.statusCode = isAllowedOrigin(request) ? 204 : 403;
  response.end();
  return true;
}

module.exports = {
  applyCors,
  handleCorsPreflight,
  isAllowedOrigin
};
