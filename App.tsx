
import './src/i18n';
import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { WorkoutProvider } from './src/context/WorkoutContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" />
            <SubscriptionProvider>
                <WorkoutProvider>
                    <AppNavigator />
                </WorkoutProvider>
            </SubscriptionProvider>
        </SafeAreaProvider>
    );
}
