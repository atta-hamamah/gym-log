import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new user profile after Clerk signup.
 */
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    weight: v.optional(v.float64()),
    bodyFat: v.optional(v.float64()),
    height: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      dateOfBirth: args.dateOfBirth,
      gender: args.gender,
      weight: args.weight,
      bodyFat: args.bodyFat,
      height: args.height,
      createdAt: Date.now(),
      migrationComplete: false,
    });

    return userId;
  },
});

/**
 * Get user by their Clerk ID.
 */
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

/**
 * Get user by their Convex document ID.
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Update user profile fields.
 */
export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    weight: v.optional(v.float64()),
    bodyFat: v.optional(v.float64()),
    height: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    // Remove undefined values
    const cleaned = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(userId, cleaned);
  },
});

/**
 * Mark user migration as complete.
 */
export const markMigrationComplete = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { migrationComplete: true });
  },
});

/**
 * Delete a user and all their associated data
 */
export const deleteUser = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // 1. Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return;

    const userId = user._id;

    // 2. Delete all sets associated with the user
    const sets = await ctx.db
      .query("sets")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const set of sets) {
      await ctx.db.delete(set._id);
    }

    // 3. Delete all exercise logs
    const exerciseLogs = await ctx.db
      .query("exerciseLogs")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const log of exerciseLogs) {
      await ctx.db.delete(log._id);
    }

    // 4. Delete all workouts
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const workout of workouts) {
      await ctx.db.delete(workout._id);
    }

    // 5. Delete custom exercises
    const customExercises = await ctx.db
      .query("customExercises")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const ce of customExercises) {
      await ctx.db.delete(ce._id);
    }

    // 6. Delete personal records
    const prs = await ctx.db
      .query("personalRecords")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const pr of prs) {
      await ctx.db.delete(pr._id);
    }

    // 7. Delete body measurements
    const measurements = await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const m of measurements) {
      await ctx.db.delete(m._id);
    }

    // 8. Delete the user profile itself
    await ctx.db.delete(userId);
  },
});
