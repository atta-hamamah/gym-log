import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
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
import WorkoutAuraScreen from '../screens/WorkoutAuraScreen';
import { AIWorkoutPreviewScreen } from '../screens/AIWorkoutPreviewScreen';
import { useSubscription } from '../context/SubscriptionContext';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { isProfileComplete } from '../utils/profile';
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
                    borderTopWidth: StyleSheet.hairlineWidth,
                    height: 64 + Math.max(insets.bottom, Platform.OS === 'ios' ? 0 : 10),
                    paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 0 : 10),
                    paddingTop: 6,
                    elevation: 0,
                },
                tabBarItemStyle: {
                    paddingVertical: 0,
                    paddingHorizontal: 0,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                // Long translations shrink to fit instead of being cut off on narrow phones.
                tabBarLabel: ({ color, position, children }) => (
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={[styles.tabLabel, position === 'beside-icon' && styles.tabLabelBeside, { color }]}
                    >
                        {children}
                    </Text>
                ),
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <Home color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />,
                    title: t('tabs.dashboard'),
                }}
            />
            <Tab.Screen
                name="Programs"
                component={ProgramsScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <BookOpen color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />,
                    title: t('tabs.programs'),
                }}
            />
            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <History color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />,
                    title: t('tabs.history'),
                }}
            />
            <Tab.Screen
                name="Progress"
                component={ProgressScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <TrendingUp color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />,
                    title: t('tabs.progress'),
                }}
            />
            <Tab.Screen
                name="AI"
                component={AITabScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <Sparkles color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />,
                    title: t('tabs.ai'),
                }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => <Settings color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />,
                    title: t('tabs.settings'),
                }}
            />
        </Tab.Navigator>
    );
};

// ── AI Tab: renders gate or chat inline (no modal overlay) ──
const AITabScreen = (props: any) => {
    const { isAISubscriber } = useSubscription();
    const { isAuthenticated } = useConvexAuth();
    // Skip until Convex is authenticated, so "not loaded" isn't mistaken for "no profile"
    const profile = useQuery(api.users.me, isAISubscriber && isAuthenticated ? {} : 'skip');

    // Active subscription linked to the signed-in account, profile complete → chat
    if (isAISubscriber && isProfileComplete(profile)) {
        return <AIChatScreen {...props} />;
    }

    // Otherwise the gate shows whatever step is missing (subscribe, account, profile)
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


    // Normal app flow — app is always accessible, features are gated per tier
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
                        headerStyle: { backgroundColor: colors.background },
                        headerShadowVisible: false,
                        headerTintColor: colors.text,
                        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
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
                        headerStyle: { backgroundColor: colors.background },
                        headerShadowVisible: false,
                        headerTintColor: colors.text,
                        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
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
                    name="AIWorkoutPreview"
                    component={AIWorkoutPreviewScreen}
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
                <Stack.Screen
                    name="WorkoutAura"
                    component={WorkoutAuraScreen}
                    options={{
                        presentation: 'fullScreenModal',
                        headerShown: false,
                        animation: 'fade',
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    tabLabel: {
        fontSize: 10,
        lineHeight: 14,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 2,
    },
    tabLabelBeside: {
        marginTop: 0,
        marginStart: 16,
        fontSize: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
