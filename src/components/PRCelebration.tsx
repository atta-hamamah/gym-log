import React, { useEffect, useRef, useMemo } from 'react';
import { View, Modal, StyleSheet, Animated, Easing, Dimensions, ScrollView } from 'react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { borderRadius, shadows, ThemeColors } from '../theme/colors';
import { Tone, toneColors } from '../theme/tones';
import { ArrowUp, BarChart3, Dumbbell, Trophy, Zap } from 'lucide-react-native';
import { DetectedPR, PRType } from '../types';
import { useTranslation } from 'react-i18next';
import { getExerciseName } from '../constants/exercises';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitsContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PR_TYPE_CONFIG: Record<PRType, { icon: typeof Trophy; tone: Tone }> = {
    max_weight: { icon: Dumbbell, tone: 'accent' },
    best_volume: { icon: BarChart3, tone: 'primary' },
    est_1rm: { icon: Zap, tone: 'secondary' },
};

// ── Confetti Particle ───────────────────────────────
const confettiColors = (colors: ThemeColors) => [colors.accent, colors.primary, colors.secondary, colors.success, '#FFD166'];
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
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors, isDark);
    const { weightUnit, displayWeight } = useUnits();
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    // Generate confetti positions once
    const confettiParticles = useMemo(() => {
        const palette = confettiColors(colors);
        return Array.from({ length: NUM_PARTICLES }, (_, i) => ({
            id: i,
            delay: Math.random() * 600,
            color: palette[Math.floor(Math.random() * palette.length)],
            startX: Math.random() * SCREEN_WIDTH,
        }));
    }, [visible, colors]);

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
                        <Trophy color={colors.accent} size={40} strokeWidth={2} />
                    </Animated.View>

                    {/* Title */}
                    <Typography variant="h1" align="center" style={{ marginTop: 18, fontSize: 26 }}>
                        {t('pr.newPR')}
                    </Typography>
                    <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 4 }}>
                        {groupedPRs.length === 1
                            ? t('pr.singlePR')
                            : t('pr.multiplePRs', { count: groupedPRs.length })}
                    </Typography>

                    {/* PR Cards */}
                    <ScrollView style={styles.prList} showsVerticalScrollIndicator={false}>
                        {groupedPRs.map((pr, index) => {
                            const config = PR_TYPE_CONFIG[pr.type];
                            const tone = toneColors(colors, config.tone);
                            const Icon = config.icon;
                            return (
                                <View key={`${pr.exerciseId}-${pr.type}-${index}`} style={styles.prCard}>
                                    <View style={[styles.prIcon, { backgroundColor: tone.soft }]}>
                                        <Icon color={tone.fg} size={19} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Typography variant="body" bold numberOfLines={1}>{getExerciseName(pr.exerciseId, t, pr.exerciseName)}</Typography>
                                        <View style={styles.prValueRow}>
                                            <Typography variant="h3" style={styles.prValue}>
                                                {pr.type === 'max_weight'
                                                    ? `${displayWeight(pr.newValue)} ${weightUnit} × ${pr.reps}`
                                                    : pr.type === 'est_1rm'
                                                        ? `${displayWeight(pr.newValue)} ${weightUnit}`
                                                        : `${displayWeight(pr.newValue)} ${weightUnit}`}
                                            </Typography>
                                            <Typography variant="caption" color={tone.fg} style={{ marginLeft: 8, fontSize: 11.5 }}>
                                                {t(`pr.types.${pr.type}`)}
                                            </Typography>
                                        </View>
                                        {pr.previousValue != null && pr.previousValue > 0 && (
                                            <View style={styles.deltaRow}>
                                                <ArrowUp color={colors.success} size={12} strokeWidth={2.6} />
                                                <Typography variant="caption" color={colors.success} style={{ fontSize: 11.5 }}>
                                                    +{Math.round(displayWeight(pr.newValue - pr.previousValue))} {weightUnit} {t('pr.fromPrevious')}
                                                </Typography>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Dismiss */}
                    <Button
                        title={t('pr.keepGoing')}
                        onPress={onDismiss}
                        size="large"
                        fullWidth
                        style={{ marginTop: 16 }}
                    />
                </Animated.View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 8, 16, 0.78)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confettiContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    content: {
        width: SCREEN_WIDTH - 48,
        maxHeight: SCREEN_HEIGHT * 0.8,
        backgroundColor: isDark ? colors.surfaceLight : colors.surface,
        borderRadius: 26,
        padding: 24,
        paddingTop: 28,
        alignItems: 'center',
        borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
        borderColor: colors.border,
        ...shadows.large,
    },
    trophyCircle: {
        width: 84,
        height: 84,
        borderRadius: 28,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    prList: {
        width: '100%',
        flexGrow: 0,
        marginTop: 20,
        maxHeight: 260,
    },
    prCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? colors.surfaceElevated : colors.surfaceLight,
        borderRadius: borderRadius.l,
        padding: 12,
        marginBottom: 8,
    },
    prIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    prValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: 2,
    },
    prValue: {
        fontSize: 17,
        fontVariant: ['tabular-nums'],
    },
    deltaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 3,
    },
});
