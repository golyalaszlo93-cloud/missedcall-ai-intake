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

async function parseBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text));
}

function xmlResponse(body) {
  return new Response(body, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

function scoreLead({ body = "", callStatus = "" }) {
  const text = (body + " " + callStatus).toLowerCase();
  let score = 15;
  if (/(today|tonight|tomorrow|asap|now|urgent)/.test(text)) score += 25;
  if (/(airport|lax|pickup|drop|ride|transfer|suv|sedan|sprinter|wedding|hourly)/.test(text)) score += 20;
  if (/(price|quote|available|availability|cost|book)/.test(text)) score += 15;
  if (/(beverly hills|los angeles|lax|burbank|orange county|pasadena|glendale)/.test(text)) score += 15;
  if (/(wrong number|stop|unsubscribe|outside)/.test(text)) score -= 25;
  return Math.max(0, Math.min(100, score));
}

function recoveryMessage(businessName = "Empire Executive Limo") {
  return "Hi, sorry we missed your call. This is " + businessName + ". What ride do you need help with today? Reply with pickup, drop-off, date/time, passengers, and vehicle preference.";
}

function followUpMessages(businessName = "Empire Executive Limo") {
  return [
    { minutes: 10, message: "Just checking in from " + businessName + ". Do you still need help with transportation?" },
    { minutes: 120, message: "Want us to prepare a quick quote? Send pickup, drop-off, date/time, passengers, and vehicle preference." },
    { minutes: 18 * 60, message: "Still need a ride? " + businessName + " can help with airport, hourly, event, and executive transportation." },
    { minutes: 3 * 24 * 60, message: "Closing the loop here. If you still need transportation, reply here and we can help." }
  ];
}

async function sendTwilioSms(env, to, body) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    return { ok: false, skipped: true, reason: "missing_twilio_secrets" };
  }
  const auth = btoa(env.TWILIO_ACCOUNT_SID + ":" + env.TWILIO_AUTH_TOKEN);
  const params = new URLSearchParams({ From: env.TWILIO_FROM_NUMBER, To: to, Body: body });
  const response = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + env.TWILIO_ACCOUNT_SID + "/Messages.json", {
    method: "POST",
    headers: { Authorization: "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  const result = await response.json();
  return { ok: response.ok, status: response.status, result };
}

async function saveSms(env, { direction, from, to, body, providerMessageId = "", status = "", raw = {} }) {
  await env.DB.prepare(
    "INSERT INTO sms_messages (created_at, provider, direction, from_phone, to_phone, body, provider_message_id, status, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(new Date().toISOString(), "twilio", direction, from, to, body, providerMessageId, status, JSON.stringify(raw)).run();
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

    if (request.method === "POST" && url.pathname === "/twilio/missed-call") {
      const payload = await parseBody(request);
      const from = clean(payload.From || payload.from || payload.Caller, 80);
      const to = clean(payload.To || payload.to || payload.Called, 80);
      const callStatus = clean(payload.CallStatus || payload.CallStatusCallbackEvent || payload.DialCallStatus || "missed", 80);
      const business = clean(payload.business || "Empire Executive Limo", 160);
      const createdAt = new Date().toISOString();
      if (!from) return jsonResponse(request, { ok: false, error: "missing_from_phone" }, 422);
      const eventResult = await env.DB.prepare(
        "INSERT INTO missed_call_events (created_at, provider, business, from_phone, to_phone, call_status, service_type, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(createdAt, "twilio", business, from, to, callStatus, "limo", JSON.stringify(payload)).run();
      const message = recoveryMessage(business);
      const smsResult = await sendTwilioSms(env, from, message);
      await saveSms(env, {
        direction: "outbound",
        from: env.TWILIO_FROM_NUMBER || to,
        to: from,
        body: message,
        providerMessageId: (smsResult.result && smsResult.result.sid) || "",
        status: smsResult.ok ? "sent" : smsResult.reason || "failed",
        raw: smsResult
      });
      for (const item of followUpMessages(business)) {
        await env.DB.prepare(
          "INSERT INTO follow_up_tasks (created_at, due_at, missed_call_event_id, phone, channel, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(createdAt, addMinutes(new Date(createdAt), item.minutes), eventResult.meta.last_row_id, from, "sms", item.message, "pending").run();
      }
      return jsonResponse(request, { ok: true, missedCallEventId: eventResult.meta.last_row_id, sms: { ok: smsResult.ok, skipped: smsResult.skipped || false, status: smsResult.status || null } });
    }

    if (request.method === "POST" && url.pathname === "/twilio/inbound-sms") {
      const payload = await parseBody(request);
      const from = clean(payload.From || payload.from, 80);
      const to = clean(payload.To || payload.to, 80);
      const body = clean(payload.Body || payload.body, 1600);
      const createdAt = new Date().toISOString();
      if (!from || !body) return xmlResponse("<Response></Response>");
      await saveSms(env, {
        direction: "inbound",
        from,
        to,
        body,
        providerMessageId: clean(payload.MessageSid || payload.SmsSid, 120),
        status: clean(payload.SmsStatus || "received", 80),
        raw: payload
      });
      await env.DB.prepare(
        "INSERT INTO customer_profiles (created_at, updated_at, phone, last_service, notes) VALUES (?, ?, ?, ?, ?) ON CONFLICT(phone) DO UPDATE SET updated_at = excluded.updated_at, notes = excluded.notes"
      ).bind(createdAt, createdAt, from, "limo", body).run();
      const score = scoreLead({ body });
      if (env.OWNER_ALERT_PHONE) {
        await sendTwilioSms(env, env.OWNER_ALERT_PHONE, "New MissedCall AI reply (" + score + "/100): " + from + " - " + body);
      }
      return xmlResponse("<Response><Message>Thanks. We received your details and the team will follow up shortly.</Message></Response>");
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
