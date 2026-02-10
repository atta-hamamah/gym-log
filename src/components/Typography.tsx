import React from 'react';
import { Text, StyleSheet, TextProps, TextStyle } from 'react-native';
import { colors } from '../theme/colors';

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
    const variantStyle = styles[variant];
    const defaultColor = variant === 'caption' || variant === 'label'
        ? colors.textSecondary
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
        fontSize: 30,
        fontWeight: '800',
        lineHeight: 38,
        letterSpacing: -0.8,
    },
    h2: {
        fontSize: 22,
        fontWeight: '700',
        lineHeight: 30,
        letterSpacing: -0.4,
    },
    h3: {
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 26,
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
        letterSpacing: 0.8,
    },
    number: {
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 34,
        letterSpacing: -0.5,
    },
});
