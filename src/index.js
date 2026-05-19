const ALLOWED_ORIGINS = new Set([
  "https://golyalaszlo93-cloud.github.io",
  "http://127.0.0.1:5187",
  "http://localhost:5187"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://golyalaszlo93-cloud.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}

function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(request, { ok: true, service: "missedcall-ai-intake" });
    }

    if (request.method !== "POST" || url.pathname !== "/audit-request") {
      return jsonResponse(request, { ok: false, error: "not_found" }, 404);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(request, { ok: false, error: "invalid_json" }, 400);
    }

    const lead = {
      createdAt: new Date().toISOString(),
      name: clean(payload.name, 120),
      business: clean(payload.business, 160),
      website: clean(payload.website, 240),
      phone: clean(payload.phone, 80),
      industry: clean(payload.industry, 80),
      issue: clean(payload.issue, 120),
      message: clean(payload.message, 1200),
      source: clean(payload.source || "missedcall-ai-site", 120),
      userAgent: clean(request.headers.get("User-Agent"), 300)
    };

    if (!lead.name || !lead.business) {
      return jsonResponse(request, { ok: false, error: "missing_required_fields" }, 422);
    }

    const result = await env.DB.prepare(
      "INSERT INTO audit_requests (created_at, name, business, website, phone, industry, issue, message, source, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      lead.createdAt, lead.name, lead.business, lead.website, lead.phone, lead.industry, lead.issue, lead.message, lead.source, lead.userAgent
    ).run();

    return jsonResponse(request, { ok: true, id: result.meta.last_row_id, receivedAt: lead.createdAt });
  }
};
