import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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
import { colors, borderRadius } from '../theme/colors';
import { Home, History, TrendingUp, Settings } from 'lucide-react-native';
import { RootStackParamList, TabParamList } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const AppTheme = {
    ...DefaultTheme,
    dark: true,
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

const TabNavigator = () => {
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

export const AppNavigator = () => {
    const { t } = useTranslation();

    return (
        <NavigationContainer theme={AppTheme}>
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
            </Stack.Navigator>
        </NavigationContainer>
    );
};
