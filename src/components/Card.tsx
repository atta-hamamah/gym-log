
import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, borderRadius, spacing } from '../theme/colors';

interface CardProps extends ViewProps {
    variant?: 'default' | 'elevated';
}

export const Card: React.FC<CardProps> = ({
    children,
    variant = 'default',
    style,
    ...props
}) => {
    return (
        <View style={[styles.container, style]} {...props}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.m,
        padding: spacing.m,
        marginBottom: spacing.m,
        // Add subtle shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: colors.border,
    },
});
