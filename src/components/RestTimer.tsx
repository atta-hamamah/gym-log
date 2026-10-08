import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Vibration } from 'react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { borderRadius, ThemeColors } from '../theme/colors';
import { Check, SkipForward, Timer } from 'lucide-react-native';
import { useAudioPlayer } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const REST_PRESETS = [30, 60, 90, 120, 180, 240, 300];

interface RestTimerProps {
    visible: boolean;
    defaultDuration: number;
    onDismiss: () => void;
    onTimeChange?: (remaining: number) => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({ visible, defaultDuration, onDismiss, onTimeChange }) => {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors, isDark);
    const [remaining, setRemaining] = useState(defaultDuration);
    const [totalDuration, setTotalDuration] = useState(defaultDuration);
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(100)).current;
    const player = useAudioPlayer(require('../../assets/alert.mp3'));

    // Slide in animation
    useEffect(() => {
        if (visible) {
            setRemaining(defaultDuration);
            setTotalDuration(defaultDuration);
            setIsRunning(true);
            setIsFinished(false);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 12,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 100,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, defaultDuration]);

    // Countdown logic
    useEffect(() => {
        if (!isRunning || !visible) return;

        if (remaining <= 0) {
            setIsRunning(false);
            setIsFinished(true);
            playAlertSound();
            Vibration.vibrate([0, 400, 200, 400]); // vibrate pattern
            return;
        }

        const timer = setTimeout(() => {
            setRemaining(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [remaining, isRunning, visible]);

    // Pulse animation when finished
    useEffect(() => {
        if (isFinished) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [isFinished]);

    const playAlertSound = useCallback(() => {
        try {
            // Play first time
            player.seekTo(0);
            player.play();

            // Play second time after a short delay
            setTimeout(() => {
                player.seekTo(0);
                player.play();
            }, 1000);
        } catch (e) {
            console.warn('Could not play alert sound:', e);
        }
    }, [player]);

    const handleDurationChange = (duration: number) => {
        setTotalDuration(duration);
        setRemaining(duration);
        setIsRunning(true);
        setIsFinished(false);
        onTimeChange?.(duration);
    };

    const handleAddTime = (seconds: number) => {
        setRemaining(prev => {
            const newVal = prev + seconds;
            onTimeChange?.(newVal);
            return newVal;
        });
        setTotalDuration(prev => prev + seconds);
        if (isFinished) {
            setIsRunning(true);
            setIsFinished(false);
        }
    };

    const handleDismiss = () => {
        setIsRunning(false);
        player.pause();
        onDismiss();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(Math.abs(seconds) / 60);
        const s = Math.abs(seconds) % 60;
        const sign = seconds < 0 ? '+' : '';
        return `${sign}${m}:${s.toString().padStart(2, '0')}`;
    };

    const progress = totalDuration > 0 ? Math.max(0, remaining / totalDuration) : 0;

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { translateY: slideAnim },
                        { scale: isFinished ? pulseAnim : 1 },
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
                            backgroundColor: isFinished ? colors.success : colors.primary,
                        },
                    ]}
                />
            </View>

            <View style={styles.content}>
                {/* Timer Display */}
                <View style={styles.timerSection}>
                    <View style={[styles.timerIcon, { backgroundColor: isFinished ? colors.successSoft : colors.primarySoft }]}>
                        {isFinished
                            ? <Check color={colors.success} size={20} strokeWidth={2.6} />
                            : <Timer color={colors.primary} size={20} />}
                    </View>
                    <View>
                        <Typography
                            variant="number"
                            color={isFinished ? colors.success : colors.text}
                            style={styles.timeDisplay}
                        >
                            {formatTime(remaining)}
                        </Typography>
                        <Typography variant="caption" color={colors.textMuted} style={styles.statusText}>
                            {isFinished ? t('restTimer.restComplete') : t('restTimer.resting')}
                        </Typography>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.actions}>
                    <Button
                        title="+30s"
                        variant="secondary"
                        size="small"
                        onPress={() => handleAddTime(30)}
                    />
                    <Button
                        title={isFinished ? t('restTimer.dismiss') : t('restTimer.skip')}
                        variant={isFinished ? 'primary' : 'outline'}
                        size="small"
                        onPress={handleDismiss}
                        iconRight={isFinished ? undefined : c => <SkipForward color={c} size={14} />}
                    />
                </View>
            </View>

            {/* Duration presets (compact) */}
            <View style={styles.presetsRow}>
                {REST_PRESETS.map(d => {
                    const active = totalDuration === d && !isFinished;
                    return (
                        <TouchableOpacity
                            key={d}
                            style={[styles.presetChip, active && styles.presetChipActive]}
                            onPress={() => handleDurationChange(d)}
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
