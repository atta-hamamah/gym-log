/**
 * Authentication: Better Auth, served by the Convex backend (convex/auth.ts).
 *
 * Sign-in is passwordless: the user enters their email, gets a 6-digit code,
 * and enters it. The first sign-in with a new email creates the account.
 * The session is kept in expo-secure-store, and a cached copy keeps the user
 * signed in while offline.
 */

import { useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

/** HTTP actions URL of the Convex deployment (https://<name>.convex.site). */
const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || 'YOUR_CONVEX_SITE_URL';

export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL,
  plugins: [
    expoClient({
      scheme: 'repai', // app.json → expo.scheme
      storagePrefix: 'repai',
      storage: SecureStore,
    }),
    emailOTPClient(),
    convexClient(),
  ],
});

export interface AccountUser {
  /** Better Auth user ID — also the RevenueCat app user ID and the cloud data owner. */
  id: string;
  name: string;
  email: string;
}

export interface AccountState {
  /** The stored session has been read (false only briefly at launch). */
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: AccountUser | null;
}

/** The signed-in account, from the Better Auth session. */
export function useAccount(): AccountState {
  const { data, isPending } = authClient.useSession();
  const id = data?.user?.id ?? null;
  const name = data?.user?.name ?? '';
  const email = data?.user?.email ?? '';

  return useMemo(
    () => ({
      isLoaded: !isPending,
      isSignedIn: !!id,
      userId: id,
      user: id ? { id, name, email } : null,
    }),
    [isPending, id, name, email],
  );
}

/** Human-readable message from a Better Auth client error. */
export function authErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : fallback;
}
