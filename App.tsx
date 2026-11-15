
import './src/i18n';
import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { authClient } from './src/services/auth';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { CloudSyncProvider } from './src/context/CloudSyncContext';
import { WorkoutProvider } from './src/context/WorkoutContext';
import { PlanProvider } from './src/context/PlanContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { UnitsProvider } from './src/context/UnitsContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { AppNavigator } from './src/navigation/AppNavigator';

// ── Convex Configuration ─────────────────────────────────
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || 'YOUR_CONVEX_URL';

const convex = new ConvexReactClient(CONVEX_URL);
// ─────────────────────────────────────────────────────────

export default function App() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}

const AppContent = () => {
    const { isDark } = useTheme();

    return (
        <SafeAreaProvider>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <ConvexBetterAuthProvider client={convex} authClient={authClient}>
                <SubscriptionProvider>
                    <CloudSyncProvider>
                        <WorkoutProvider>
                            <PlanProvider>
                                <UnitsProvider>
                                    <NotificationsProvider>
                                        <AppNavigator />
                                    </NotificationsProvider>
                                </UnitsProvider>
                            </PlanProvider>
                        </WorkoutProvider>
                    </CloudSyncProvider>
                </SubscriptionProvider>
            </ConvexBetterAuthProvider>
        </SafeAreaProvider>
    );
};
