
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { WorkoutSessionScreen } from '../screens/WorkoutSessionScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { ExerciseListScreen } from '../screens/ExerciseListScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WorkoutDetailsScreen } from '../screens/WorkoutDetailsScreen';
import { colors } from '../theme/colors';
import { Home, History, TrendingUp, PlusCircle, Settings } from 'lucide-react-native';
import { RootStackParamList, TabParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
                    tabBarLabel: 'Dashboard'
                }}
            />
            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <History color={color} size={size} />,
                    tabBarLabel: 'History'
                }}
            />
            <Tab.Screen
                name="Progress"
                component={ProgressScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
                    tabBarLabel: 'Progress'
                }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
                    tabBarLabel: 'Settings'
                }}
            />
        </Tab.Navigator>
    );
};

export const AppNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                }}
            >
                <Stack.Screen name="Main" component={TabNavigator} />
                <Stack.Screen
                    name="WorkoutSession"
                    component={WorkoutSessionScreen}
                    options={{
                        presentation: 'fullScreenModal',
                        gestureEnabled: false,
                    }}
                />
                <Stack.Screen
                    name="ExerciseList"
                    component={ExerciseListScreen}
                    options={{
                        presentation: 'modal',
                        headerShown: true,
                        headerTitle: 'Select Exercise',
                        headerStyle: { backgroundColor: colors.surface },
                        headerTintColor: colors.text,
                    }}
                />
                <Stack.Screen
                    name="WorkoutDetails"
                    component={WorkoutDetailsScreen}
                    options={{
                        presentation: 'card',
                        headerShown: true,
                        headerTitle: 'Details',
                        headerStyle: { backgroundColor: colors.surface },
                        headerTintColor: colors.text,
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
