import React from 'react';
import {
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacityProps,
    View,
} from 'react-native';
import { Typography } from './Typography';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'small' | 'medium' | 'large';
    loading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    variant = 'primary',
    size = 'medium',
    loading,
    icon,
    fullWidth,
    style,
    disabled,
    ...props
}) => {
    const getBackgroundColor = () => {
        if (disabled) return colors.surfaceLight;
        switch (variant) {
            case 'primary':
                return colors.primary;
            case 'secondary':
                return colors.secondary;
            case 'outline':
                return 'transparent';
            case 'ghost':
                return 'transparent';
            case 'danger':
                return colors.error;
            default:
                return colors.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return colors.textMuted;
        switch (variant) {
            case 'primary':
                return colors.black;
            case 'secondary':
                return colors.white;
            case 'outline':
                return colors.primary;
            case 'ghost':
                return colors.textSecondary;
            case 'danger':
                return colors.white;
            default:
                return colors.black;
        }
    };

    const sizeStyles = {
        small: { height: 36, paddingHorizontal: spacing.m, minWidth: 64 },
        medium: { height: 48, paddingHorizontal: spacing.l, minWidth: 100 },
        large: { height: 56, paddingHorizontal: spacing.xl, minWidth: 140 },
    };

    const fontSizes = {
        small: 12,
        medium: 14,
        large: 16,
    };

    return (
        <TouchableOpacity
            style={[
                styles.container,
                sizeStyles[size],
                {
                    backgroundColor: getBackgroundColor(),
                    borderWidth: variant === 'outline' ? 1.5 : 0,
                    borderColor: variant === 'outline' ? colors.primary : undefined,
                },
                variant === 'primary' && !disabled && shadows.glow(colors.primary),
                fullWidth && { width: '100%' },
                style,
            ]}
            disabled={disabled || loading}
            activeOpacity={0.75}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} size="small" />
            ) : (
                <View style={styles.content}>
                    {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
                    <Typography
                        variant="label"
                        style={{
                            color: getTextColor(),
                            fontSize: fontSizes[size],
                            fontWeight: '700',
                            letterSpacing: 0.5,
                        }}
                    >
                        {title}
                    </Typography>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: borderRadius.m,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
