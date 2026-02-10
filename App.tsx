
import './src/i18n';
import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WorkoutProvider } from './src/context/WorkoutContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" />
            <WorkoutProvider>
                <AppNavigator />
            </WorkoutProvider>
        </SafeAreaProvider>
    );
}
