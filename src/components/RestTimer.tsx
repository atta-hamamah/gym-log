import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Vibration } from 'react-native';
import { Typography } from './Typography';
import { colors, borderRadius } from '../theme/colors';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';

const REST_PRESETS = [30, 60, 90, 120, 180];

interface RestTimerProps {
    visible: boolean;
    defaultDuration: number;
    onDismiss: () => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({ visible, defaultDuration, onDismiss }) => {
    const { t } = useTranslation();
    const [remaining, setRemaining] = useState(defaultDuration);
    const [totalDuration, setTotalDuration] = useState(defaultDuration);
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(100)).current;
    const soundRef = useRef<Audio.Sound | null>(null);

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

    const playAlertSound = useCallback(async () => {
        try {
            // Play alert.mp3 twice
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/alert.mp3')
            );
            soundRef.current = sound;
            await sound.playAsync();

            // Play second time after a short delay
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    // Play again
                    sound.replayAsync().then(() => {
                        sound.setOnPlaybackStatusUpdate((status2) => {
                            if (status2.isLoaded && status2.didJustFinish) {
                                sound.unloadAsync();
                            }
                        });
                    });
                }
            });
        } catch (e) {
            console.warn('Could not play alert sound:', e);
        }
    }, []);

    // Cleanup sound on unmount
    useEffect(() => {
        return () => {
            soundRef.current?.unloadAsync();
        };
    }, []);

    const handleDurationChange = (duration: number) => {
        setTotalDuration(duration);
        setRemaining(duration);
        setIsRunning(true);
        setIsFinished(false);
    };

    const handleAddTime = (seconds: number) => {
        setRemaining(prev => prev + seconds);
        setTotalDuration(prev => prev + seconds);
        if (isFinished) {
            setIsRunning(true);
            setIsFinished(false);
        }
    };

    const handleDismiss = () => {
        setIsRunning(false);
        soundRef.current?.stopAsync();
        soundRef.current?.unloadAsync();
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
                    <Typography
                        variant="h2"
                        color={isFinished ? colors.success : colors.text}
                        style={styles.timerText}
                    >
                        {isFinished ? '✓' : '⏱'}
                    </Typography>
                    <View>
                        <Typography
                            variant="number"
                            color={isFinished ? colors.success : colors.text}
                            style={styles.timeDisplay}
                        >
                            {formatTime(remaining)}
                        </Typography>
                        <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                            {isFinished ? t('restTimer.restComplete') : t('restTimer.resting')}
                        </Typography>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.actions}>
                    {/* +30s button */}
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleAddTime(30)}
                        activeOpacity={0.7}
                    >
                        <Typography variant="caption" color={colors.primary} bold style={{ fontSize: 11 }}>
                            +30s
                        </Typography>
                    </TouchableOpacity>

                    {/* Skip / Dismiss */}
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.skipBtn]}
                        onPress={handleDismiss}
                        activeOpacity={0.7}
                    >
                        <Typography variant="caption" color={colors.text} bold style={{ fontSize: 11 }}>
                            {isFinished ? t('restTimer.dismiss') : t('restTimer.skip')}
                        </Typography>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Duration presets (compact) */}
            <View style={styles.presetsRow}>
                {REST_PRESETS.map(d => (
                    <TouchableOpacity
                        key={d}
                        style={[
                            styles.presetChip,
                            totalDuration === d && !isFinished && styles.presetChipActive,
                        ]}
                        onPress={() => handleDurationChange(d)}
                        activeOpacity={0.7}
                    >
                        <Typography
                            variant="caption"
                            color={totalDuration === d && !isFinished ? colors.black : colors.textMuted}
                            style={{ fontSize: 10, fontWeight: totalDuration === d ? '700' : '500' }}
                        >
                            {d >= 60 ? `${d / 60}m` : `${d}s`}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.l,
        borderTopRightRadius: borderRadius.l,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
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
        paddingVertical: 12,
    },
    timerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    timerText: {
        fontSize: 20,
    },
    timeDisplay: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -1,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: borderRadius.s,
        backgroundColor: colors.primary + '15',
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    skipBtn: {
        backgroundColor: colors.surfaceLight,
        borderColor: colors.border,
    },
    presetsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        paddingBottom: 12,
        paddingHorizontal: 16,
    },
    presetChip: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    presetChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
});
