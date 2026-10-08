import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Typography } from './Typography';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, shadows } from '../theme/colors';
import { IconProp, Tone, renderIcon, toneColors } from '../theme/tones';

interface StatTileProps {
    value: string | number;
    label: string;
    icon?: IconProp;
    tone?: Tone;
    /** Smaller tile for rows of three or four. */
    compact?: boolean;
    /** Color for the number itself (use for gains / losses). */
    valueColor?: string;
    /** Lines the value may use; text values such as durations can need two. */
    valueLines?: number;
    style?: StyleProp<ViewStyle>;
}

/** Number + label tile. Numbers stay neutral; the tone only tints the small icon. */
export const StatTile: React.FC<StatTileProps> = ({ value, label, icon, tone = 'primary', compact, valueColor, valueLines = 1, style }) => {
    const { colors, isDark } = useTheme();
    const t = toneColors(colors, tone);
    return (
        <View
            style={[
                styles.tile,
                compact && styles.compact,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !isDark && shadows.small,
                style,
            ]}
        >
            {icon ? (
                <View style={[styles.icon, compact && styles.iconCompact, { backgroundColor: t.soft }]}>
                    {renderIcon(icon, t.fg)}
                </View>
            ) : null}
            <Typography
                variant={compact ? 'h3' : 'h2'}
                color={valueColor}
                style={[styles.value, compact && { fontSize: 18, lineHeight: 24 }, valueLines > 1 && styles.valueWrap]}
                numberOfLines={valueLines}
                adjustsFontSizeToFit={valueLines === 1}
            >
                {value}
            </Typography>
            <Typography variant="caption" color={colors.textMuted} numberOfLines={1} style={compact ? { fontSize: 11.5 } : undefined}>
                {label}
            </Typography>
        </View>
    );
};

const styles = StyleSheet.create({
    tile: {
        flex: 1,
        borderRadius: borderRadius.l,
        borderWidth: 1,
        padding: 14,
        gap: 2,
    },
    compact: {
        padding: 12,
        alignItems: 'center',
    },
    icon: {
        width: 30,
        height: 30,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    iconCompact: {
        width: 26,
        height: 26,
        borderRadius: 8,
        marginBottom: 6,
    },
    value: {
        fontVariant: ['tabular-nums'],
    },
    valueWrap: {
        fontSize: 15,
        lineHeight: 19,
        textAlign: 'center',
    },
});
