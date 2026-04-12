import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface ScreenLayoutProps {
    children: React.ReactNode;
    style?: object;
    noPadding?: boolean;
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
    children,
    style,
    noPadding = false,
}) => {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    return (
        <SafeAreaView style={[styles.container, style]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
            <View style={[styles.content, noPadding && { paddingHorizontal: 0 }]}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const createStyles = (colors: { background: string }) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        content: {
            flex: 1,
            paddingHorizontal: 20,
        },
    });
