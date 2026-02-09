
import React from 'react';
import { Text, StyleSheet, TextProps } from 'react-native';
import { colors, spacing } from '../theme/colors';

interface TypographyProps extends TextProps {
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
    color?: string;
}

export const Typography: React.FC<TypographyProps> = ({
    children,
    variant = 'body',
    color = colors.text,
    style,
    ...props
}) => {
    return (
        <Text style={[styles[variant], { color }, style]} {...props}>
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    h1: {
        fontSize: 32,
        fontWeight: '700',
        lineHeight: 40,
        letterSpacing: -0.5,
    },
    h2: {
        fontSize: 24,
        fontWeight: '600',
        lineHeight: 32,
        letterSpacing: -0.3,
    },
    h3: {
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 28,
    },
    body: {
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
    },
    caption: {
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
        color: colors.textSecondary,
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
