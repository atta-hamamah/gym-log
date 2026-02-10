import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

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
    return (
        <SafeAreaView style={[styles.container, style]}>
            <StatusBar barStyle="light-content" backgroundColor={colors.background} />
            <View style={[styles.content, noPadding && { paddingHorizontal: 0 }]}>
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
        paddingHorizontal: 20,
    },
});
