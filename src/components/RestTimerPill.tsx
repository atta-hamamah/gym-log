import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Timer, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from './Typography';
import { useTheme } from '../context/ThemeContext';
import { formatRest, useRestTimer } from '../context/RestTimerContext';
import { ThemeColors } from '../theme/colors';

interface RestTimerPillProps {
    /** Hidden on the workout screen, which has its own timer. */
    hidden: boolean;
    /** Tap: back to the workout. */
    onPress: () => void;
}

/** The running rest timer, floating at the top of every screen. */
export const RestTimerPill: React.FC<RestTimerPillProps> = ({ hidden, onPress }) => {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { remaining, total, finished, stop } = useRestTimer();
    const pulse = useRef(new Animated.Value(1)).current;
    const styles = createStyles(colors, isDark);

    useEffect(() => {
        if (!finished) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.06, duration: 450, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [finished]);

    if (hidden || remaining === null) return null;

    const tint = finished ? colors.success : colors.primary;
    const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    const label = finished ? t('restTimer.pillDone') : t('restTimer.resting');

    return (
        <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 6 }]}>
            <Animated.View style={[styles.pill, { borderColor: tint, transform: [{ scale: finished ? pulse : 1 }] }]}>
                <TouchableOpacity
                    style={styles.main}
                    onPress={onPress}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} ${formatRest(remaining)}. ${t('restTimer.openWorkout')}`}
                >
                    {finished
                        ? <Check color={tint} size={16} strokeWidth={2.6} />
                        : <Timer color={tint} size={16} />}
                    <Typography variant="bodySmall" bold color={tint} style={styles.time}>
                        {formatRest(remaining)}
                    </Typography>
                    <Typography variant="caption" color={colors.textSecondary} numberOfLines={1} style={styles.label}>
                        {label}
                    </Typography>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.close}
                    onPress={stop}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('restTimer.stopTimer')}
                >
                    <X color={colors.textMuted} size={15} />
                </TouchableOpacity>
                {!finished && (
                    <View style={styles.track}>
                        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: tint }]} />
                    </View>
                )}
            </Animated.View>
        </View>
    );
};

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
        elevation: 1000,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: '86%',
        backgroundColor: isDark ? colors.surfaceLight : colors.surface,
        borderRadius: 999,
        borderWidth: 1.5,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.4 : 0.15,
        shadowRadius: 10,
    },
    main: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingStart: 14,
        paddingEnd: 6,
        paddingVertical: 8,
        flexShrink: 1,
    },
    time: {
        fontVariant: ['tabular-nums'],
    },
    label: {
        flexShrink: 1,
    },
    close: {
        paddingStart: 4,
        paddingEnd: 12,
        paddingVertical: 8,
    },
    track: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 2.5,
        backgroundColor: colors.border,
    },
    fill: {
        height: '100%',
    },
});
