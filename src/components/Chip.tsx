import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { IconProp, Tone, renderIcon, toneColors } from '../theme/tones';

interface ChipProps {
    label: string;
    selected?: boolean;
    onPress?: () => void;
    icon?: IconProp;
    /** Color family used when selected. */
    tone?: Tone;
    size?: 'small' | 'medium';
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
}

/** Pill used for filters, suggestions and multi-select options. */
export const Chip: React.FC<ChipProps> = ({
    label,
    selected = false,
    onPress,
    icon,
    tone = 'primary',
    size = 'medium',
    disabled,
    style,
}) => {
    const { colors } = useTheme();
    const t = toneColors(colors, tone);
    const fg = selected ? t.fg : colors.textSecondary;
    const small = size === 'small';

    const body = (
        <>
            {icon ? renderIcon(icon, fg) : null}
            <Text
                style={[styles.label, { color: fg, fontSize: small ? 12.5 : 13.5, fontWeight: selected ? '600' : '500' }]}
                numberOfLines={1}
            >
                {label}
            </Text>
        </>
    );

    const chipStyle = [
        styles.chip,
        {
            height: small ? 30 : 36,
            paddingHorizontal: small ? 12 : 14,
            backgroundColor: selected ? t.soft : colors.surface,
            borderColor: selected ? t.fg : colors.border,
        },
        disabled && styles.disabled,
        style,
    ];

    if (!onPress) return <View style={chipStyle}>{body}</View>;
    return (
        <TouchableOpacity
            style={chipStyle}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected }}
        >
            {body}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
    },
    label: {
        letterSpacing: 0.1,
    },
    disabled: {
        opacity: 0.45,
    },
});
