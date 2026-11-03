import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// AI coach nudges for AI subscribers whose nudge time has come (see notifications.ts).
crons.interval("coach nudges", { minutes: 15 }, internal.notifications.dispatchDue, {});

export default crons;
