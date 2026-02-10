import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, borderRadius, spacing, shadows } from '../theme/colors';

interface CardProps extends ViewProps {
    variant?: 'default' | 'elevated' | 'outlined' | 'glass';
    glowColor?: string;
}

export const Card: React.FC<CardProps> = ({
    children,
    variant = 'default',
    glowColor,
    style,
    ...props
}) => {
    const variantStyles = {
        default: styles.default,
        elevated: styles.elevated,
        outlined: styles.outlined,
        glass: styles.glass,
    };

    return (
        <View
            style={[
                styles.container,
                variantStyles[variant],
                glowColor && shadows.glow(glowColor),
                style,
            ]}
            {...props}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: borderRadius.l,
        padding: spacing.m,
        marginBottom: spacing.m,
    },
    default: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.small,
    },
    elevated: {
        backgroundColor: colors.surfaceElevated,
        borderWidth: 0,
        ...shadows.medium,
    },
    outlined: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    glass: {
        backgroundColor: colors.surface + 'CC',
        borderWidth: 1,
        borderColor: colors.border + '60',
        ...shadows.small,
    },
});
