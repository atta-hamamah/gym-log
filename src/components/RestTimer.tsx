import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { borderRadius, ThemeColors } from '../theme/colors';
import { Check, Timer } from 'lucide-react-native';
import { SkipAhead } from './DirectionalIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { formatRest, useRestTimer } from '../context/RestTimerContext';

const REST_PRESETS = [30, 60, 90, 120, 180, 240, 300];

interface RestTimerProps {
    /** Panel shown (the timer itself lives in RestTimerContext and keeps running when hidden). */
    visible: boolean;
    /** Skip / Done: stops the rest. */
    onDismiss: () => void;
}

/** Rest timer panel at the bottom of the workout screen. */
export const RestTimer: React.FC<RestTimerProps> = ({ visible, onDismiss }) => {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors, isDark);
    const { remaining, total, finished, addTime, restart } = useRestTimer();
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(100)).current;

    // Slide in / out
    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 0 : 100,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();
    }, [visible]);

    // Pulse when finished
    useEffect(() => {
        if (!finished) return;
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [finished]);

    if (!visible || remaining === null) return null;

    const progress = total > 0 ? Math.max(0, remaining / total) : 0;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { translateY: slideAnim },
                        { scale: finished ? pulseAnim : 1 },
                    ],
                },
            ]}
        >
            {/* Progress bar background */}
            <View style={styles.progressTrack}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: `${progress * 100}%`,
                            backgroundColor: finished ? colors.success : colors.primary,
                        },
                    ]}
                />
            </View>

            <View style={styles.content}>
                {/* Timer Display */}
                <View style={styles.timerSection}>
                    <View style={[styles.timerIcon, { backgroundColor: finished ? colors.successSoft : colors.primarySoft }]}>
                        {finished
                            ? <Check color={colors.success} size={20} strokeWidth={2.6} />
                            : <Timer color={colors.primary} size={20} />}
                    </View>
                    <View>
                        <Typography
                            variant="number"
                            color={finished ? colors.success : colors.text}
                            style={styles.timeDisplay}
                        >
                            {formatRest(Math.max(0, remaining))}
                        </Typography>
                        <Typography variant="caption" color={colors.textMuted} style={styles.statusText}>
                            {finished ? t('restTimer.restComplete') : t('restTimer.resting')}
                        </Typography>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.actions}>
                    <Button
                        title="+30s"
                        variant="secondary"
                        size="small"
                        onPress={() => addTime(30)}
                    />
                    <Button
                        title={finished ? t('restTimer.dismiss') : t('restTimer.skip')}
                        variant={finished ? 'primary' : 'outline'}
                        size="small"
                        onPress={onDismiss}
                        iconRight={finished ? undefined : c => <SkipAhead color={c} size={14} />}
                    />
                </View>
            </View>

            {/* Duration presets (compact) */}
            <View style={styles.presetsRow}>
                {REST_PRESETS.map(d => {
                    const active = total === d && !finished;
                    return (
                        <TouchableOpacity
                            key={d}
                            style={[styles.presetChip, active && styles.presetChipActive]}
                            onPress={() => restart(d)}
                            activeOpacity={0.7}
                        >
                            <Typography
                                variant="caption"
                                color={active ? colors.primary : colors.textSecondary}
                                style={[styles.presetText, active && styles.presetTextActive]}
                            >
                                {d >= 60 ? `${d / 60}m` : `${d}s`}
                            </Typography>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </Animated.View>
    );
};

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: isDark ? colors.surfaceLight : colors.surface,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        overflow: 'hidden',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: isDark ? 0.35 : 0.08,
        shadowRadius: 16,
    },
    progressTrack: {
        height: 3,
        backgroundColor: colors.border,
        width: '100%',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
    },
    timerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    timerIcon: {
        width: 42,
        height: 42,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeDisplay: {
        fontSize: 28,
        lineHeight: 32,
        fontWeight: '700',
        letterSpacing: -0.8,
    },
    statusText: {
        fontSize: 11.5,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    presetsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 6,
        paddingBottom: 14,
        paddingHorizontal: 16,
    },
    presetChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: isDark ? colors.surfaceElevated : colors.surfaceLight,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    presetChipActive: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primary,
    },
    presetText: {
        fontSize: 12,
        fontWeight: '500',
        fontVariant: ['tabular-nums'],
    },
    presetTextActive: {
        fontWeight: '700',
    },
});
