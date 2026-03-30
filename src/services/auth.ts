/**
 * Clerk Token Cache for React Native (Expo)
 * Uses expo-secure-store for secure token persistence.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { type TokenCache } from '@clerk/clerk-expo';

const createTokenCache = (): TokenCache => {
  return {
    getToken: async (key: string) => {
      try {
        const item = await SecureStore.getItemAsync(key);
        return item;
      } catch (error) {
        console.warn('[Auth] SecureStore getToken error:', error);
        await SecureStore.deleteItemAsync(key);
        return null;
      }
    },
    saveToken: async (key: string, token: string) => {
      try {
        await SecureStore.setItemAsync(key, token);
      } catch (error) {
        console.warn('[Auth] SecureStore saveToken error:', error);
      }
    },
    clearToken: async (key: string) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.warn('[Auth] SecureStore clearToken error:', error);
      }
    },
  };
};

// SecureStore is not available on web
export const tokenCache = Platform.OS !== 'web' ? createTokenCache() : undefined;
