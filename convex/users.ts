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
