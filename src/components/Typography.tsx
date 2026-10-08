import React from 'react';
import { Text, StyleSheet, TextProps, TextStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface TypographyProps extends TextProps {
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'label' | 'number';
    color?: string;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
}

export const Typography: React.FC<TypographyProps> = ({
    children,
    variant = 'body',
    color,
    align,
    bold,
    style,
    ...props
}) => {
    const { colors } = useTheme();
    const variantStyle = styles[variant];
    const defaultColor = variant === 'caption'
        ? colors.textSecondary
        : variant === 'label'
            ? colors.textMuted
            : colors.text;

    return (
        <Text
            style={[
                variantStyle,
                { color: color || defaultColor },
                align && { textAlign: align },
                bold && { fontWeight: '700' },
                style,
            ]}
            {...props}
        >
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    h1: {
        fontSize: 28,
        fontWeight: '700',
        lineHeight: 34,
        letterSpacing: -0.6,
    },
    h2: {
        fontSize: 21,
        fontWeight: '700',
        lineHeight: 28,
        letterSpacing: -0.4,
    },
    h3: {
        fontSize: 17,
        fontWeight: '600',
        lineHeight: 24,
        letterSpacing: -0.2,
    },
    body: {
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 22,
    },
    bodySmall: {
        fontSize: 13,
        fontWeight: '400',
        lineHeight: 18,
    },
    caption: {
        fontSize: 13,
        fontWeight: '400',
        lineHeight: 18,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    number: {
        fontSize: 28,
        fontWeight: '700',
        lineHeight: 34,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums'],
    },
});
