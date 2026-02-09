
import React from 'react';
import { View, StyleSheet, StatusBar, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface ScreenLayoutProps {
    children: React.ReactNode;
    style?: ViewStyle;
    edges?: ['top' | 'right' | 'bottom' | 'left'];
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({ children, style }) => {
    return (
        <SafeAreaView style={[styles.container, style]}>
            <StatusBar barStyle="light-content" backgroundColor={colors.background} />
            <View style={styles.content}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
});
