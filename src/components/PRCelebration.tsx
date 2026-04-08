import React, { useEffect, useRef, useMemo } from 'react';
import { View, Modal, StyleSheet, Animated, Easing, Dimensions, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { Card } from './Card';
import { borderRadius, shadows } from '../theme/colors';
import { DetectedPR, PRType } from '../types';
import { useTranslation } from 'react-i18next';
import { getExerciseName } from '../constants/exercises';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PR_TYPE_CONFIG: Record<PRType, { icon: string; color: string }> = {
    max_weight: { icon: '🏋️', color: '#FFD700' },
    best_volume: { icon: '📊', color: '#00E5FF' },
    est_1rm: { icon: '💪', color: '#FF6B6B' },
};

// ── Confetti Particle ───────────────────────────────
const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#00E5FF', '#7C4DFF', '#00E676', '#FF4081', '#FF922B', '#845EF7'];
const NUM_PARTICLES = 40;

const ConfettiParticle = ({
    delay,
    color,
    startX,
}: {
    delay: number;
    color: string;
    startX: number;
}) => {
    const translateY = useRef(new Animated.Value(-20)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    const rotate = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const drift = (Math.random() - 0.5) * 120;

        Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: SCREEN_HEIGHT * 0.6,
                    duration: 2000 + Math.random() * 1000,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(translateX, {
                    toValue: drift,
                    duration: 2000 + Math.random() * 1000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.timing(scale, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 1800,
                        delay: 800,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.timing(rotate, {
                    toValue: Math.random() * 10,
                    duration: 3000,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, []);

    const size = 6 + Math.random() * 8;
    const isSquare = Math.random() > 0.5;

    return (
        <Animated.View
            style={{
                position: 'absolute',
                top: 0,
                left: startX,
                width: size,
                height: isSquare ? size : size * 2.5,
                backgroundColor: color,
                borderRadius: isSquare ? 1 : size / 2,
                opacity,
                transform: [
                    { translateY },
                    { translateX },
                    { scale },
                    {
                        rotate: rotate.interpolate({
                            inputRange: [0, 10],
                            outputRange: ['0deg', '720deg'],
                        }),
                    },
                ],
            }}
        />
    );
};

// ── Main Component ──────────────────────────────────
interface PRCelebrationProps {
    visible: boolean;
    prs: DetectedPR[];
    onDismiss: () => void;
}

export const PRCelebration: React.FC<PRCelebrationProps> = ({ visible, prs, onDismiss }) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    // Generate confetti positions once
    const confettiParticles = useMemo(() => {
        return Array.from({ length: NUM_PARTICLES }, (_, i) => ({
            id: i,
            delay: Math.random() * 600,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            startX: Math.random() * SCREEN_WIDTH,
        }));
    }, [visible]);

    useEffect(() => {
        if (visible) {
            scaleAnim.setValue(0);
            glowAnim.setValue(0);

            Animated.sequence([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 5,
                    tension: 80,
                    useNativeDriver: true,
                }),
            ]).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 1500,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 1500,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [visible]);

    // Deduplicate: group by exercise, only show the "best" PR per exercise
    // (show max_weight preferentially, then est_1rm, then volume)
    const groupedPRs = useMemo(() => {
        const exerciseMap = new Map<string, DetectedPR[]>();
        prs.forEach(pr => {
            const key = pr.exerciseId;
            if (!exerciseMap.has(key)) exerciseMap.set(key, []);
            exerciseMap.get(key)!.push(pr);
        });

        // For display: show 1 "headline" PR per exercise (max_weight preferred)
        const headlines: DetectedPR[] = [];
        exerciseMap.forEach((prList) => {
            const best = prList.find(p => p.type === 'max_weight')
                || prList.find(p => p.type === 'est_1rm')
                || prList[0];
            headlines.push(best);
        });

        return headlines;
    }, [prs]);

    if (!visible || prs.length === 0) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                {/* Confetti layer */}
                <View style={styles.confettiContainer} pointerEvents="none">
                    {confettiParticles.map(p => (
                        <ConfettiParticle key={p.id} delay={p.delay} color={p.color} startX={p.startX} />
                    ))}
                </View>

                {/* Content */}
                <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
                    {/* Trophy Icon */}
                    <Animated.View style={[
                        styles.trophyCircle,
                        {
                            opacity: glowAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.8, 1],
                            }),
                            transform: [{
                                scale: glowAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.08],
                                }),
                            }],
                        },
                    ]}>
                        <Typography variant="h1" style={{ fontSize: 48 }}>🏆</Typography>
                    </Animated.View>

                    {/* Title */}
                    <Typography variant="h1" color="#FFD700" align="center" style={{ marginTop: 16, fontSize: 26 }}>
                        {t('pr.newPR')}
                    </Typography>
                    <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 4 }}>
                        {groupedPRs.length === 1
                            ? t('pr.singlePR')
                            : t('pr.multiplePRs', { count: groupedPRs.length })}
                    </Typography>

                    {/* PR Cards */}
                    <View style={styles.prList}>
                        {groupedPRs.map((pr, index) => {
                            const config = PR_TYPE_CONFIG[pr.type];
                            return (
                                <View key={`${pr.exerciseId}-${pr.type}-${index}`} style={styles.prCard}>
                                    <View style={[styles.prIcon, { backgroundColor: config.color + '20' }]}>
                                        <Typography variant="body" style={{ fontSize: 20 }}>{config.icon}</Typography>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Typography variant="body" bold numberOfLines={1}>{getExerciseName(pr.exerciseId, t, pr.exerciseName)}</Typography>
                                        <View style={styles.prValueRow}>
                                            <Typography variant="h3" color={config.color} style={{ fontSize: 18 }}>
                                                {pr.type === 'max_weight'
                                                    ? `${pr.newValue} ${t('common.kg')} × ${pr.reps}`
                                                    : pr.type === 'est_1rm'
                                                        ? `${pr.newValue} ${t('common.kg')}`
                                                        : `${pr.newValue} ${t('common.kg')}`}
                                            </Typography>
                                            <Typography variant="caption" color={colors.textMuted} style={{ marginLeft: 8, fontSize: 11 }}>
                                                {t(`pr.types.${pr.type}`)}
                                            </Typography>
                                        </View>
                                        {pr.previousValue != null && pr.previousValue > 0 && (
                                            <Typography variant="caption" color={colors.success} style={{ fontSize: 11, marginTop: 2 }}>
                                                ↑ +{Math.round(pr.newValue - pr.previousValue)} {t('common.kg')} {t('pr.fromPrevious')}
                                            </Typography>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Dismiss */}
                    <Button
                        title={t('pr.keepGoing')}
                        onPress={onDismiss}
                        size="large"
                        fullWidth
                        style={{ marginTop: 20 }}
                    />
                </Animated.View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confettiContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    content: {
        width: SCREEN_WIDTH - 48,
        maxHeight: SCREEN_HEIGHT * 0.7,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.xl,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFD700' + '40',
        ...shadows.large,
    },
    trophyCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#FFD700' + '15',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFD700' + '30',
    },
    prList: {
        width: '100%',
        marginTop: 20,
        maxHeight: 260,
    },
    prCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.m,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    prIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    prValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: 2,
    },
});
