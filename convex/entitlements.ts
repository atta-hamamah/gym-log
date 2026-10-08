import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { requireUserInAction } from "./users";

/**
 * Server-side check of the AI subscription.
 *
 * RevenueCat is the source of truth. Each user row caches the AI entitlement
 * (aiActive / aiExpiresAt), refreshed from RevenueCat's REST API:
 *   - when a RevenueCat webhook arrives for the user (purchase, renewal,
 *     cancellation, refund, transfer, ...), and
 *   - on demand, whenever the cached state says "not active" (so a renewal
 *     or a brand-new purchase is picked up even if a webhook is late).
 *
 * Environment variables (Convex dashboard → Settings → Environment Variables):
 *   REVENUECAT_API_KEY          RevenueCat key used to read subscriber status:
 *                               the app's public SDK key (goog_...) or a secret
 *                               key (sk_...). Without it, checks are disabled
 *                               and everyone is allowed.
 *   REVENUECAT_WEBHOOK_AUTH     Value RevenueCat sends in the Authorization header.
 *   REVENUECAT_AI_ENTITLEMENT   Entitlement identifier (default "RepAI AI").
 *   AI_ACCESS_EMAILS            Optional comma-separated emails that always
 *                               have access (test / admin accounts).
 */

export const AI_SUBSCRIPTION_REQUIRED = "AI_SUBSCRIPTION_REQUIRED";

/** Don't call RevenueCat for the same user more often than this. */
const REFRESH_COOLDOWN_MS = 10 * 1000;

const aiEntitlementId = () => process.env.REVENUECAT_AI_ENTITLEMENT || "RepAI AI";

export function checksEnabled(): boolean {
  return !!process.env.REVENUECAT_API_KEY;
}

let warnedDisabled = false;

function isAllowlisted(email: string | undefined): boolean {
  if (!email) return false;
  const list = String(process.env.AI_ACCESS_EMAILS || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Whether the cached state grants AI + cloud access right now. */
export function hasActiveAI(user: Doc<"users">, now: number = Date.now()): boolean {
  if (!checksEnabled()) {
    if (!warnedDisabled) {
      console.warn("[entitlements] REVENUECAT_API_KEY is not set — subscription checks are DISABLED");
      warnedDisabled = true;
    }
    return true;
  }
  if (isAllowlisted(user.email)) return true;
  return !!user.aiActive && (user.aiExpiresAt === undefined || user.aiExpiresAt > now);
}

export function subscriptionRequiredError() {
  return new ConvexError({ code: AI_SUBSCRIPTION_REQUIRED });
}

// ── RevenueCat REST API ──────────────────────────────────

interface RevenueCatEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
}

/** Current AI entitlement for a RevenueCat app user ID (= Clerk user ID). */
async function fetchAIEntitlement(appUserId: string): Promise<{ active: boolean; expiresAt?: number }> {
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${process.env.REVENUECAT_API_KEY}` } }
  );
  if (!response.ok) {
    throw new Error(`RevenueCat API returned ${response.status}`);
  }
  const body = await response.json();
  // Includes expired entitlements, so "missing" means never subscribed.
  const entitlement: RevenueCatEntitlement | undefined =
    body?.subscriber?.entitlements?.[aiEntitlementId()];
  if (!entitlement) return { active: false };
  if (entitlement.expires_date === null) return { active: true }; // non-expiring grant

  const expiresAt = Math.max(
    ...[entitlement.expires_date, entitlement.grace_period_expires_date]
      .filter((d): d is string => !!d)
      .map((d) => Date.parse(d))
      .filter((ms) => Number.isFinite(ms))
  );
  return { active: expiresAt > Date.now(), expiresAt };
}

export const store = internalMutation({
  args: {
    userId: v.id("users"),
    aiActive: v.boolean(),
    aiExpiresAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      aiActive: args.aiActive,
      aiExpiresAt: args.aiExpiresAt,
      entitlementCheckedAt: Date.now(),
    });
  },
});

/** Fetch the latest state from RevenueCat and cache it on the user row. */
export async function refreshEntitlement(
  ctx: ActionCtx,
  user: Doc<"users">,
  options: { force?: boolean } = {},
): Promise<Doc<"users">> {
  if (!checksEnabled()) return user;
  const recentlyChecked =
    user.entitlementCheckedAt !== undefined &&
    Date.now() - user.entitlementCheckedAt < REFRESH_COOLDOWN_MS;
  if (recentlyChecked && !options.force) return user;

  const { active, expiresAt } = await fetchAIEntitlement(user.clerkId);
  await ctx.runMutation(internal.entitlements.store, {
    userId: user._id,
    aiActive: active,
    aiExpiresAt: expiresAt,
  });
  return { ...user, aiActive: active, aiExpiresAt: expiresAt, entitlementCheckedAt: Date.now() };
}

/** For AI actions: throws AI_SUBSCRIPTION_REQUIRED unless the user is subscribed. */
export async function requireAIAccess(ctx: ActionCtx, user: Doc<"users">): Promise<void> {
  if (hasActiveAI(user)) return;
  const fresh = await refreshEntitlement(ctx, user);
  if (!hasActiveAI(fresh)) throw subscriptionRequiredError();
}

// ── Public API ───────────────────────────────────────────

/**
 * Called by the app before syncing: confirms the subscription with
 * RevenueCat if the cached state isn't active (e.g. right after purchase).
 */
export const ensureAccess = action({
  args: {},
  handler: async (ctx): Promise<{ active: boolean }> => {
    const user = await requireUserInAction(ctx);
    if (hasActiveAI(user)) return { active: true };
    const fresh = await refreshEntitlement(ctx, user);
    return { active: hasActiveAI(fresh) };
  },
});

// ── Webhook processing ───────────────────────────────────

/** Refresh every known user mentioned in a RevenueCat webhook event. */
export const refreshFromWebhook = internalAction({
  args: { appUserIds: v.array(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    for (const clerkId of args.appUserIds) {
      const user: Doc<"users"> | null = await ctx.runQuery(internal.users.getByClerkId, { clerkId });
      if (!user) continue; // anonymous purchase or user without a cloud profile yet
      await refreshEntitlement(ctx, user, { force: true });
    }
  },
});
