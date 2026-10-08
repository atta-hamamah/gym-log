import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, TouchableOpacityProps, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { IconProp, Tone, renderIcon, toneColors } from '../theme/tones';

interface IconButtonProps extends Omit<TouchableOpacityProps, 'style'> {
    icon: IconProp;
    /** surface: neutral filled circle · tonal: tinted · filled: solid · ghost: no background */
    variant?: 'surface' | 'tonal' | 'filled' | 'ghost';
    tone?: Tone;
    size?: number;
    /** Rounded square instead of a circle. */
    square?: boolean;
    accessibilityLabel: string;
    style?: StyleProp<ViewStyle>;
}

/** Round icon-only button with a consistent hit area and colors. */
export const IconButton: React.FC<IconButtonProps> = ({
    icon,
    variant = 'surface',
    tone = 'neutral',
    size = 40,
    square,
    style,
    disabled,
    ...props
}) => {
    const { colors } = useTheme();
    const t = toneColors(colors, tone);
    let bg = 'transparent';
    let fg = t.fg;
    if (variant === 'surface') {
        bg = colors.surfaceLight;
        fg = tone === 'neutral' ? colors.textSecondary : t.fg;
    } else if (variant === 'tonal') {
        bg = t.soft;
    } else if (variant === 'filled') {
        bg = t.fill;
        fg = t.onFill;
    }

    return (
        <TouchableOpacity
            style={[
                styles.base,
                { width: size, height: size, borderRadius: square ? Math.round(size * 0.32) : size / 2, backgroundColor: bg },
                disabled && styles.disabled,
                style,
            ]}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            hitSlop={size < 40 ? { top: 6, bottom: 6, left: 6, right: 6 } : undefined}
            {...props}
        >
            {renderIcon(icon, fg)}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabled: {
        opacity: 0.4,
    },
});
