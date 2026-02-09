
import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, TouchableOpacityProps, ViewStyle } from 'react-native';
import { Typography } from './Typography';
import { colors, spacing, borderRadius } from '../theme/colors';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'text';
    loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    variant = 'primary',
    loading,
    style,
    disabled,
    ...props
}) => {
    const getBackgroundColor = () => {
        if (disabled) return colors.surfaceLight;
        switch (variant) {
            case 'primary': return colors.primary;
            case 'secondary': return colors.secondary;
            case 'outline': return 'transparent';
            case 'text': return 'transparent';
            default: return colors.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return colors.textSecondary;
        switch (variant) {
            case 'primary': return colors.black; // Text on primary should be dark for contrast if primary is bright
            case 'secondary': return colors.white;
            case 'outline': return colors.primary;
            case 'text': return colors.textSecondary;
            default: return colors.black;
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.container,
                {
                    backgroundColor: getBackgroundColor(),
                    borderWidth: variant === 'outline' ? 1 : 0,
                    borderColor: variant === 'outline' ? colors.primary : undefined,
                },
                style
            ]}
            disabled={disabled || loading}
            activeOpacity={0.8}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <Typography
                    variant="label"
                    style={{
                        color: getTextColor(),
                        fontSize: 14,
                        fontWeight: '600'
                    }}
                >
                    {title}
                </Typography>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 48,
        borderRadius: borderRadius.m,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.l,
        minWidth: 100,
    },
});
