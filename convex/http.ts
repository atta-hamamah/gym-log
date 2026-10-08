import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

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

export default http;
