import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Better Auth endpoints (sign-in codes, sessions, Convex JWTs) under /api/auth/*
authComponent.registerRoutes(http, createAuth);

/**
 * RevenueCat webhook: https://<deployment>.convex.site/revenuecat/webhook
 *
 * RevenueCat recommends treating webhooks as "something changed" signals and
 * reading the current state from its REST API, rather than interpreting each
 * event type — so this only collects the user IDs and schedules a refresh.
 */
http.route({
  path: "/revenuecat/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expected) {
      console.error("[webhook] REVENUECAT_WEBHOOK_AUTH is not set");
      return new Response("Webhook not configured", { status: 500 });
    }
    if (request.headers.get("Authorization") !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const event = body?.event ?? {};
    // TRANSFER events carry transferred_from/_to instead of app_user_id.
    const candidates: unknown[] = [
      event.app_user_id,
      event.original_app_user_id,
      ...(Array.isArray(event.aliases) ? event.aliases : []),
      ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
      ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
    ];
    const appUserIds = Array.from(
      new Set(
        candidates.filter(
          (id): id is string => typeof id === "string" && !id.startsWith("$RCAnonymousID:")
        )
      )
    ).slice(0, 25);

    if (appUserIds.length > 0) {
      // Respond right away; RevenueCat retries anything slower than 60s.
      await ctx.scheduler.runAfter(0, internal.entitlements.refreshFromWebhook, { appUserIds });
    }
    return new Response("OK", { status: 200 });
  }),
});

/**
 * Landing page waitlist: https://<deployment>.convex.site/waitlist/{join,status,stats}
 *
 * Called straight from the browser, so these answer CORS. Set
 * WAITLIST_ALLOWED_ORIGINS (comma-separated, e.g. "https://repai.shop") to lock
 * them to the site; without it any origin may call them.
 */
const LOCALES = ["en", "ar", "fr", "es", "hi"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_RE = /^[A-Z0-9]{4,12}$/;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (process.env.WAITLIST_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const allowOrigin = allowed.length === 0 ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

const preflight = httpAction(async (_ctx, request) => new Response(null, { status: 204, headers: corsHeaders(request) }));

http.route({ path: "/waitlist/join", method: "OPTIONS", handler: preflight });
http.route({
  path: "/waitlist/join",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json(request, { error: "invalid_json" }, 400);
    }

    // Honeypot: a hidden field people never see; bots fill it in.
    if (typeof body?.website === "string" && body.website.trim() !== "") {
      return json(request, { error: "invalid" }, 400);
    }

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return json(request, { error: "invalid_email" }, 400);
    }
    const platform = body?.platform === "ios" ? "ios" : "android";
    const locale = LOCALES.includes(body?.locale) ? body.locale : "en";
    const ref = typeof body?.ref === "string" && CODE_RE.test(body.ref.toUpperCase()) ? body.ref.toUpperCase() : undefined;
    const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim().slice(0, 64) : undefined;

    const result = await ctx.runMutation(internal.waitlist.join, { email, platform, locale, ref, source });
    return json(request, result);
  }),
});

http.route({
  path: "/waitlist/status",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const code = (new URL(request.url).searchParams.get("code") ?? "").toUpperCase();
    if (!CODE_RE.test(code)) return json(request, { error: "invalid_code" }, 400);
    const result = await ctx.runQuery(internal.waitlist.status, { code });
    return result ? json(request, result) : json(request, { error: "not_found" }, 404);
  }),
});

http.route({
  path: "/waitlist/stats",
  method: "GET",
  handler: httpAction(async (ctx, request) => json(request, await ctx.runQuery(internal.waitlist.stats, {}))),
});

export default http;
