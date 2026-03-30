
import './src/i18n';
import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { tokenCache } from './src/services/auth';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { WorkoutProvider } from './src/context/WorkoutContext';
import { AppNavigator } from './src/navigation/AppNavigator';

// ── Convex & Clerk Configuration ─────────────────────────
// Replace these with your actual keys from .env or config
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || 'YOUR_CLERK_PUBLISHABLE_KEY';
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || 'YOUR_CONVEX_URL';

const convex = new ConvexReactClient(CONVEX_URL);
// ─────────────────────────────────────────────────────────

export default function App() {
    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" />
            <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
                <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                    <SubscriptionProvider>
                        <WorkoutProvider>
                            <AppNavigator />
                        </WorkoutProvider>
                    </SubscriptionProvider>
                </ConvexProviderWithClerk>
            </ClerkProvider>
        </SafeAreaProvider>
    );
}
