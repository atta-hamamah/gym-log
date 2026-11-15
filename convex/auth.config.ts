import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

// Convex accepts the JWTs that Better Auth (convex/auth.ts) issues for a session.
export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
