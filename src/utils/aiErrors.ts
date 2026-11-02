import { ConvexError } from 'convex/values';

/**
 * The message to show when the server refused an AI request because the user
 * hit a fair-use limit (convex/aiUsage.ts), or null for any other error.
 */
export function aiLimitMessage(error: unknown, t: (key: string) => string): string | null {
  if (error instanceof ConvexError && (error.data as any)?.code === 'AI_LIMIT_REACHED') {
    return t((error.data as any).period === 'month' ? 'aiLimit.month' : 'aiLimit.day');
  }
  return null;
}
