/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiHelpers from "../aiHelpers.js";
import type * as aiModels from "../aiModels.js";
import type * as aiUsage from "../aiUsage.js";
import type * as aiWorkout from "../aiWorkout.js";
import type * as auth from "../auth.js";
import type * as coachChat from "../coachChat.js";
import type * as coachData from "../coachData.js";
import type * as coachPrompt from "../coachPrompt.js";
import type * as crons from "../crons.js";
import type * as entitlements from "../entitlements.js";
import type * as http from "../http.js";
import type * as language from "../language.js";
import type * as loadGuard from "../loadGuard.js";
import type * as notifications from "../notifications.js";
import type * as nudgeAI from "../nudgeAI.js";
import type * as personas from "../personas.js";
import type * as planAI from "../planAI.js";
import type * as planner from "../planner.js";
import type * as plans from "../plans.js";
import type * as sync from "../sync.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as waitlist from "../waitlist.js";
import type * as workoutPlanner from "../workoutPlanner.js";
import type * as workouts from "../workouts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiHelpers: typeof aiHelpers;
  aiModels: typeof aiModels;
  aiUsage: typeof aiUsage;
  aiWorkout: typeof aiWorkout;
  auth: typeof auth;
  coachChat: typeof coachChat;
  coachData: typeof coachData;
  coachPrompt: typeof coachPrompt;
  crons: typeof crons;
  entitlements: typeof entitlements;
  http: typeof http;
  language: typeof language;
  loadGuard: typeof loadGuard;
  notifications: typeof notifications;
  nudgeAI: typeof nudgeAI;
  personas: typeof personas;
  planAI: typeof planAI;
  planner: typeof planner;
  plans: typeof plans;
  sync: typeof sync;
  users: typeof users;
  validators: typeof validators;
  waitlist: typeof waitlist;
  workoutPlanner: typeof workoutPlanner;
  workouts: typeof workouts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
