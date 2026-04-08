import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { useTheme } from '../context/ThemeContext';

interface StatBadgeProps {
    value: string | number;
    label: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
}

export const StatBadge: React.FC<StatBadgeProps> = ({
    value,
    label,
    color,
    size = 'medium',
}) => {
    const { colors } = useTheme();
    const badgeColor = color ?? colors.primary;
    const valueSizes = { small: 18, medium: 24, large: 32 };

    return (
        <View style={styles.container}>
            <Typography
                variant={size === 'large' ? 'number' : 'h2'}
                color={badgeColor}
                align="center"
                style={{ fontSize: valueSizes[size] }}
            >
                {value}
            </Typography>
            <Typography variant="caption" align="center" color={colors.textMuted} style={{ marginTop: 2 }}>
                {label}
            </Typography>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
