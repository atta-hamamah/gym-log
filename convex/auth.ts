import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import type { GenericMutationCtx } from "convex/server";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

/**
 * Authentication: Better Auth running inside Convex (the betterAuth component
 * stores its users, sessions and one-time codes). Sign-in is passwordless —
 * a 6-digit code is emailed through Resend, and the first sign-in with a new
 * email creates the account.
 *
 * The Better Auth user ID is `identity.subject` in Convex functions; the app's
 * own profile row (users table) links to it through `authId`.
 *
 * Deployment env vars: BETTER_AUTH_SECRET, RESEND_API_KEY, AUTH_EMAIL_FROM.
 */

/** The app's deep-link scheme (app.json → expo.scheme). */
const APP_SCHEME = "repai://";
const DAY_SECONDS = 60 * 60 * 24;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [APP_SCHEME],
    database: authComponent.adapter(ctx),
    session: {
      // Phones stay signed in; each day of use extends the session.
      expiresIn: 60 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
    },
    plugins: [
      expo(),
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 5,
        async sendVerificationOTP({ email, otp }) {
          await sendCodeEmail(email, otp);
        },
      }),
      convex({ authConfig }),
    ],
  });

/** Remove a Better Auth user with its sessions and accounts (account deletion). */
export async function deleteAuthUser(ctx: GenericMutationCtx<DataModel>, authId: string): Promise<void> {
  for (const model of ["session", "account"] as const) {
    let cursor: string | null = null;
    do {
      const result: { continueCursor: string; isDone: boolean } = await ctx.runMutation(
        components.betterAuth.adapter.deleteMany,
        {
          input: { model, where: [{ field: "userId", value: authId }] },
          paginationOpts: { numItems: 100, cursor },
        },
      );
      cursor = result.isDone ? null : result.continueCursor;
    } while (cursor);
  }
  await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
    input: { model: "user", where: [{ field: "_id", value: authId }] },
  });
}

// ── Email ────────────────────────────────────────────────

async function sendCodeEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    console.error("[auth] RESEND_API_KEY or AUTH_EMAIL_FROM is not set");
    throw new Error("Email sign-in is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${code} is your RepAI code`,
      text: `Your RepAI sign-in code is ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
      html: codeEmailHtml(code),
    }),
  });

  if (!response.ok) {
    console.error("[auth] Resend returned", response.status, await response.text());
    throw new Error("Could not send the sign-in email");
  }
}

function codeEmailHtml(code: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <p style="margin:0 0 8px;font-size:16px;">Your RepAI sign-in code:</p>
      <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:6px;">${code}</p>
      <p style="margin:0;font-size:13px;color:#71717a;">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>
    </div>
  </body>
</html>`;
}
