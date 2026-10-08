import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Typography } from './Typography';
import { useTheme } from '../context/ThemeContext';

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    /** Buttons on the right (IconButton, small Button...). */
    right?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** Large title header used at the top of the main tab screens. */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, right, style }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.header, style]}>
            <View style={styles.texts}>
                <Typography variant="h1" numberOfLines={1}>{title}</Typography>
                {subtitle ? (
                    <Typography variant="bodySmall" color={colors.textSecondary} style={styles.subtitle} numberOfLines={2}>
                        {subtitle}
                    </Typography>
                ) : null}
            </View>
            {right ? <View style={styles.right}>{right}</View> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 16,
        gap: 12,
    },
    texts: {
        flex: 1,
    },
    subtitle: {
        marginTop: 2,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
});
