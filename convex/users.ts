import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

// ── Auth helpers (shared by other modules) ──────────────

/**
 * The signed-in user's profile row, or null when signed out / not created yet.
 * Identity always comes from the Clerk token — never from client arguments.
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
}

export async function requireCurrentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Unauthenticated or user profile missing");
  return user;
}

/** Same as requireCurrentUser, for actions (which have no direct db access). */
export async function requireUserInAction(ctx: ActionCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user: Doc<"users"> | null = await ctx.runQuery(internal.users.getByClerkId, {
    clerkId: identity.subject,
  });
  if (!user) throw new Error("User profile missing");
  return user;
}

/** Tables that hold per-user data, children first. */
const HISTORY_TABLES = ["sets", "exerciseLogs", "workouts", "personalRecords"] as const;
const ALL_DATA_TABLES = [...HISTORY_TABLES, "customExercises", "bodyMeasurements"] as const;
type UserDataTable = (typeof ALL_DATA_TABLES)[number];

export type WipeScope = "history" | "all";

export function tablesForScope(scope: WipeScope): readonly UserDataTable[] {
  return scope === "all" ? ALL_DATA_TABLES : HISTORY_TABLES;
}

/**
 * Delete up to `budget` documents of a user's data.
 * Only documents created before `before` are removed (when given), so data
 * pushed after a wipe was requested survives.
 * Returns true when nothing is left to delete.
 */
export async function deleteUserDocs(
  ctx: MutationCtx,
  userId: Id<"users">,
  tables: readonly UserDataTable[],
  budget: number,
  before?: number,
): Promise<boolean> {
  let remaining = budget;
  for (const table of tables) {
    while (remaining > 0) {
      // Every user-data table has a by_userId index (_creationTime is implicitly appended).
      const docs = await (ctx.db.query(table) as any)
        .withIndex("by_userId", (q: any) =>
          before === undefined
            ? q.eq("userId", userId)
            : q.eq("userId", userId).lt("_creationTime", before)
        )
        .take(Math.min(remaining, 200));
      if (docs.length === 0) break;
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
      remaining -= docs.length;
    }
    if (remaining <= 0) return false;
  }
  return true;
}

export async function bumpDataVersion(ctx: MutationCtx, user: Doc<"users">) {
  await ctx.db.patch(user._id, { dataVersion: (user.dataVersion ?? 0) + 1 });
}

// ── Public API ───────────────────────────────────────────

/** The signed-in user's profile (null if signed out or not created yet). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

/**
 * Create the profile row for the signed-in Clerk user if it doesn't exist.
 * Idempotent — safe to call on every sign-in / sync.
 */
export const ensureUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    const name = (identity.name || args.name || "").trim();
    const email = (identity.email || args.email || "").trim();

    if (existing) {
      const patch: Partial<Doc<"users">> = {};
      if (!existing.name && name) patch.name = name;
      if (!existing.email && email) patch.email = email;
      if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name,
      email,
      createdAt: Date.now(),
      migrationComplete: false,
      dataVersion: 0,
    });
  },
});

/** Update the signed-in user's profile fields. */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    weight: v.optional(v.float64()),
    bodyFat: v.optional(v.float64()),
    height: v.optional(v.float64()),
    goal: v.optional(v.string()),
    unitPreference: v.optional(v.union(v.literal("metric"), v.literal("imperial"))),
    experience: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
    equipment: v.optional(v.array(v.string())),
    trainingDays: v.optional(v.float64()),
    sessionMinutes: v.optional(v.float64()),
    limitations: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (args.equipment && args.equipment.length > 40) throw new Error("Too many equipment items");
    if (args.limitations && args.limitations.length > 500) throw new Error("Limitations text too long");
    if (args.trainingDays !== undefined && (args.trainingDays < 1 || args.trainingDays > 7)) {
      throw new Error("Training days must be between 1 and 7");
    }
    if (args.sessionMinutes !== undefined && (args.sessionMinutes < 10 || args.sessionMinutes > 240)) {
      throw new Error("Session length must be between 10 and 240 minutes");
    }
    const cleaned = Object.fromEntries(
      Object.entries(args).filter(([_, value]) => value !== undefined)
    );
    if (Object.keys(cleaned).length > 0) {
      await ctx.db.patch(user._id, cleaned);
    }
  },
});

/**
 * Delete the signed-in user's profile and (asynchronously) all their data.
 * The profile row is removed immediately so the account stops resolving.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const user = await getCurrentUser(ctx);
    if (!user) return;
    await ctx.db.delete(user._id);
    await ctx.scheduler.runAfter(0, internal.users.purgeUserData, { userId: user._id });
  },
});

// ── Internal ─────────────────────────────────────────────

export const purgeUserData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    const done = await deleteUserDocs(ctx, args.userId, ALL_DATA_TABLES, 2000);
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.users.purgeUserData, { userId: args.userId });
    }
  },
});

export const getById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});
