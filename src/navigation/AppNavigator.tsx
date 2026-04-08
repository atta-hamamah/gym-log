import React from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { WorkoutSessionScreen } from '../screens/WorkoutSessionScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { ExerciseListScreen } from '../screens/ExerciseListScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WorkoutDetailsScreen } from '../screens/WorkoutDetailsScreen';
import { ProgramsScreen } from '../screens/ProgramsScreen';
import { ProgramDetailScreen } from '../screens/ProgramDetailScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { AIGateScreen } from '../screens/AIGateScreen';
import { AIOnboardingScreen } from '../screens/AIOnboardingScreen';
import { AIChatScreen } from '../screens/AIChatScreen';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '@clerk/clerk-expo';
import { useTheme } from '../context/ThemeContext';
import { Home, History, TrendingUp, Settings, BookOpen, Sparkles } from 'lucide-react-native';
import { RootStackParamList, TabParamList } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const AppTheme = {
    ...DefaultTheme,
};

const TabNavigator = () => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: Platform.OS === 'ios' ? 88 + insets.bottom : 80,
                    paddingBottom: Platform.OS === 'ios' ? insets.bottom + 12 : 24,
                    paddingTop: 12,
                    elevation: 0,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 0.3,
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size - 2} />,
                    tabBarLabel: t('tabs.dashboard'),
                }}
            />
            <Tab.Screen
                name="Programs"
                component={ProgramsScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size - 2} />,
                    tabBarLabel: t('tabs.programs'),
                }}
            />
            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <History color={color} size={size - 2} />,
                    tabBarLabel: t('tabs.history'),
                }}
            />
            <Tab.Screen
                name="Progress"
                component={ProgressScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size - 2} />,
                    tabBarLabel: t('tabs.progress'),
                }}
            />
            <Tab.Screen
                name="AI"
                component={AITabScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size - 2} />,
                    tabBarLabel: t('tabs.ai'),
                }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Settings color={color} size={size - 2} />,
                    tabBarLabel: t('tabs.settings'),
                }}
            />
        </Tab.Navigator>
    );
};

// ── AI Tab: renders gate or chat inline (no modal overlay) ──
const AITabScreen = (props: any) => {
    const { isAISubscriber } = useSubscription();
    const { isSignedIn } = useAuth();

    // Subscribed + signed in → show chat directly as tab content
    if (isAISubscriber && isSignedIn) {
        return <AIChatScreen {...props} />;
    }

    // Otherwise show the gate/paywall
    return <AIGateScreen {...props} />;
};

// ── Loading Screen ────────────────────────────────────────
const LoadingScreen = () => {
    const { colors } = useTheme();
    return (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
};

export const AppNavigator = () => {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const { tier, loading } = useSubscription();
    const appTheme = {
        ...AppTheme,
        dark: isDark,
        colors: {
            ...DefaultTheme.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.border,
            notification: colors.accent,
        },
    };

    // Show loading while checking subscription state
    if (loading) {
        return (
            <NavigationContainer theme={appTheme}>
                <LoadingScreen />
            </NavigationContainer>
        );
    }

    // If trial expired and not purchased, show paywall only
    if (tier === 'expired') {
        return (
            <NavigationContainer theme={appTheme}>
                <Stack.Navigator
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.background },
                    }}
                >
                    <Stack.Screen name="Paywall" component={PaywallScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        );
    }

    // Normal app flow (trial, premium, or AI subscriber)
    return (
        <NavigationContainer theme={appTheme}>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: 'slide_from_right',
                }}
            >
                <Stack.Screen name="Main" component={TabNavigator} />
                <Stack.Screen
                    name="WorkoutSession"
                    component={WorkoutSessionScreen}
                    options={{
                        presentation: 'fullScreenModal',
                        gestureEnabled: false,
                        animation: 'slide_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="ExerciseList"
                    component={ExerciseListScreen}
                    options={{
                        presentation: 'modal',
                        headerShown: true,
                        headerTitle: t('exerciseList.selectExercise'),
                        headerStyle: { backgroundColor: colors.surface },
                        headerTintColor: colors.text,
                        headerTitleStyle: { fontWeight: '600' },
                        animation: 'slide_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="WorkoutDetails"
                    component={WorkoutDetailsScreen}
                    options={{
                        presentation: 'card',
                        headerShown: true,
                        headerTitle: t('workoutDetails.exercises'),
                        headerStyle: { backgroundColor: colors.surface },
                        headerTintColor: colors.text,
                        headerTitleStyle: { fontWeight: '600' },
                    }}
                />
                <Stack.Screen
                    name="ProgramDetail"
                    component={ProgramDetailScreen}
                    options={{
                        presentation: 'card',
                        headerShown: false,
                        animation: 'slide_from_right',
                    }}
                />
                <Stack.Screen
                    name="Paywall"
                    component={PaywallScreen}
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="AIOnboarding"
                    component={AIOnboardingScreen}
                    options={{
                        presentation: 'fullScreenModal',
                        headerShown: false,
                        animation: 'slide_from_bottom',
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
