import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { borderRadius, spacing, shadows } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

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
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors, isDark);
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

const createStyles = (colors: {
    surface: string;
    border: string;
    borderLight: string;
    surfaceElevated: string;
}, isDark: boolean) => StyleSheet.create({
    container: {
        borderRadius: borderRadius.l,
        padding: spacing.m,
        marginBottom: spacing.m,
    },
    // Dark surfaces separate with hairline borders; the light theme adds a soft shadow.
    default: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        ...(isDark ? {} : shadows.small),
    },
    elevated: {
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: isDark ? colors.border : colors.borderLight,
        ...(isDark ? {} : shadows.medium),
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
