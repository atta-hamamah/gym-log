import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Helper queries for the AI chat action.
 * These must be in a separate file (not "use node") because
 * queries run in the Convex runtime, not Node.js.
 */

export const getPersonalRecords = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("personalRecords")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getBodyMeasurements = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_userId_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(5);
  },
});
