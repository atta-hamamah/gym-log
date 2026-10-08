import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { shadows } from '../theme/colors';
import { IconProp, renderIcon } from '../theme/tones';

export interface SegmentOption<T extends string> {
    value: T;
    label: string;
    icon?: IconProp;
}

interface SegmentedControlProps<T extends string> {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    style?: StyleProp<ViewStyle>;
}

/** iOS-style segmented control: a tinted track with a raised selected segment. */
export function SegmentedControl<T extends string>({ options, value, onChange, style }: SegmentedControlProps<T>) {
    const { colors, isDark } = useTheme();
    return (
        <View style={[styles.track, { backgroundColor: colors.surfaceLight }, style]}>
            {options.map(option => {
                const active = option.value === value;
                const fg = active ? colors.text : colors.textSecondary;
                return (
                    <TouchableOpacity
                        key={option.value}
                        style={[
                            styles.segment,
                            active && [{ backgroundColor: isDark ? colors.surfaceElevated : colors.surface }, !isDark && shadows.small],
                        ]}
                        onPress={() => onChange(option.value)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                    >
                        {option.icon ? renderIcon(option.icon, active ? colors.primary : fg) : null}
                        <Text style={[styles.label, { color: fg, fontWeight: active ? '600' : '500' }]} numberOfLines={1}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 3,
    },
    segment: {
        flex: 1,
        height: 36,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    label: {
        fontSize: 13.5,
    },
});
