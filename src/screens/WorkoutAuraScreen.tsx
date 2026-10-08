import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Id } from "../../convex/_generated/dataModel";
import { Share2, X, BarChart3, Lock, Trophy, Sparkles, ShieldCheck, MessageCircleOff } from "lucide-react-native";
import { useSubscription } from "../context/SubscriptionContext";
import { ForceDarkTheme, useTheme } from "../context/ThemeContext";
import { useUnits } from "../context/UnitsContext";
import { Typography } from "../components/Typography";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { SegmentedControl } from "../components/SegmentedControl";
import { darkColors as C } from "../theme/colors";
import { Tone, toneColors } from "../theme/tones";
import { EXERCISES, getExerciseName } from "../constants/exercises";

// The share card is always dark (it is made to be posted to stories), so it uses the dark palette directly.
// Each voice keeps its colour: the coach in the app's blue, Chad in amber, Kevin in violet.
const CHARACTER_TONE: Record<"default" | "chad" | "kevin", Tone> = {
  default: "primary",
  chad: "accent",
  kevin: "secondary",
};

// Logged workouts store English catalog names; look up the id so the card can show the translated name.
const EXERCISE_ID_BY_NAME = new Map(EXERCISES.map((e) => [e.name, e.id]));

export default function WorkoutAuraScreen() {
  return (
    <ForceDarkTheme>
      <WorkoutAuraContent />
    </ForceDarkTheme>
  );
}

interface RouteParams {
  workoutId?: string;
  localStats?: {
    name: string;
    durationMin: number | null;
    totalSets: number;
    totalVolume: number;
    exerciseCount: number;
    exercises: { name: string; bestWeight: number; bestReps: number }[];
  };
}

function WorkoutAuraContent() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { displayWeight, weightUnit } = useUnits();
  const route = useRoute();
  const navigation = useNavigation();
  const { workoutId, localStats } = route.params as RouteParams;
  const { isAISubscriber } = useSubscription();

  const generateAura = useAction(api.ai.generateWorkoutAura);

  type AuraData = {
    auraTitle: string;
    auraDescription: string;
    durationMin?: number;
    exerciseCount?: number;
    totalVolume?: number;
    totalSets?: number;
  };

  const [aura, setAura] = useState<AuraData | null>(null);
  const [auraCache, setAuraCache] = useState<Record<string, AuraData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const [characterMode, setCharacterMode] = useState<"default" | "chad" | "kevin">("default");
  const [viewMode, setViewMode] = useState<"aura" | "stats">("stats");
  const [showAIGateModal, setShowAIGateModal] = useState(false);

  // Stats card data from Convex (only when AI subscriber + workoutId exists)
  const statsData = useQuery(
    api.workouts.getWorkoutStatsCard,
    workoutId ? { workoutId: workoutId as Id<"workouts"> } : "skip"
  );

  // Merged stats: prefer Convex data, fall back to localStats
  const mergedStats = statsData || localStats || null;

  const activeTone = toneColors(colors, CHARACTER_TONE[characterMode]);

  // Volumes are stored in kg; show them in the user's unit, shortened above 1000.
  const formatVolume = (kg: number) => {
    const v = Math.round(displayWeight(kg));
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;
  };
  const exerciseLabel = (name: string) => {
    const id = EXERCISE_ID_BY_NAME.get(name);
    return id ? getExerciseName(id, t, name) : name;
  };

  const viewShotRef = useRef<ViewShot>(null);

  // ── Animations ──
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  // Loading spinner rotation
  useEffect(() => {
    if (!loading) return;
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, [loading]);

  // When starting in stats mode, show actions immediately
  useEffect(() => {
    if (viewMode === "stats") {
      actionsOpacity.setValue(1);
    }
  }, [viewMode]);

  const spinInterpolate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Cycling loading phrases
  const loadingPhrases = [
    t("aura.consulting"),
    t("aura.analyzingRest"),
    t("aura.judgingForm"),
    t("aura.calculatingAura"),
  ];

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingPhaseIndex((prev) => (prev + 1) % loadingPhrases.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  // Card entrance animation
  const animateCardIn = () => {
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsating glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.7,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.3,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Stats fade in
    Animated.timing(statsOpacity, {
      toValue: 1,
      duration: 500,
      delay: 400,
      useNativeDriver: true,
    }).start();

    // Actions fade in
    Animated.timing(actionsOpacity, {
      toValue: 1,
      duration: 500,
      delay: 700,
      useNativeDriver: true,
    }).start();
  };

  const fetchAura = async (mode: string = "default") => {
    if (!workoutId) return; // No Convex ID = no AI aura

    // Check cache first
    if (auraCache[mode]) {
      setAura(auraCache[mode]);
      setCharacterMode(mode as any);
      setLoading(false);
      setTimeout(animateCardIn, 100);
      return;
    }

    try {
      setLoading(true);
      setError(false);
      cardScale.setValue(0.85);
      cardOpacity.setValue(0);
      statsOpacity.setValue(0);
      actionsOpacity.setValue(0);
      const result = await generateAura({
        workoutId: workoutId as Id<"workouts">,
        language: i18n.language.split('-')[0] || "en",
        characterMode: mode,
      });
      // Cache the result
      setAuraCache((prev) => ({ ...prev, [mode]: result }));
      setAura(result);
      setTimeout(animateCardIn, 100);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Gate AI features behind subscription
  const handleAuraToggle = () => {
    if (!isAISubscriber) {
      setShowAIGateModal(true);
      return;
    }
    setViewMode("aura");
    if (!aura && !loading) {
      fetchAura("default");
    }
  };

  const handleCharacterSwitch = (mode: "default" | "chad" | "kevin") => {
    if (!isAISubscriber) {
      setShowAIGateModal(true);
      return;
    }
    setCharacterMode(mode);
    setViewMode("aura");
    fetchAura(mode);
  };

  const handleGoToAI = () => {
    setShowAIGateModal(false);
    (navigation as any).navigate("Main", { screen: "AI" });
  };

  const handleShare = async () => {
    if (!viewShotRef.current?.capture) return;
    try {
      const uri = await viewShotRef.current.capture();
      await Sharing.shareAsync(uri, {
        mimeType: "image/jpeg",
        dialogTitle: t("aura.shareTitle"),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinish = () => {
    navigation.navigate("Main" as never);
  };

  // ── Loading State (only for aura view) ──
  if (loading && viewMode === "aura") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingSpinner,
              { backgroundColor: activeTone.soft, transform: [{ rotate: spinInterpolate }] },
            ]}
          >
            <Sparkles color={activeTone.fg} size={34} />
          </Animated.View>
          <Typography style={styles.loadingText}>
            {loadingPhrases[loadingPhaseIndex]}
          </Typography>
          <View style={styles.loadingDots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  loadingPhaseIndex % 3 >= i && { backgroundColor: activeTone.fg },
                ]}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error State (only for aura view) ──
  if (viewMode === "aura" && (error || !aura)) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <View style={styles.errorIcon}>
            <MessageCircleOff color={C.textSecondary} size={30} />
          </View>
          <Typography style={styles.errorText}>{t("aura.silentGods")}</Typography>
          <Button title={t("common.continue")} variant="outline" size="large" onPress={handleFinish} />
        </View>
      </SafeAreaView>
    );
  }

  const quickStats = [
    mergedStats?.durationMin ? `${mergedStats.durationMin} ${t("common.min")}` : null,
    mergedStats?.totalSets ? `${mergedStats.totalSets} ${t("common.sets")}` : null,
    mergedStats?.exerciseCount ? `${mergedStats.exerciseCount} ${t("common.exercises")}` : null,
  ].filter(Boolean) as string[];

  // ── Success State ──
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon={(c) => <X color={c} size={20} />}
          onPress={handleFinish}
          accessibilityLabel={t("common.close")}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* View Mode Toggle */}
        <SegmentedControl
          style={styles.viewToggle}
          value={viewMode}
          onChange={(mode) => (mode === "aura" ? handleAuraToggle() : setViewMode("stats"))}
          options={[
            {
              value: "aura",
              label: characterMode === "default" ? t("aura.coachTab", "Coach") : t("aura.auraTab", "Aura"),
              icon: (c) =>
                !isAISubscriber ? (
                  <Lock color={c} size={13} />
                ) : characterMode === "default" ? (
                  <Trophy color={c} size={14} />
                ) : (
                  <Sparkles color={c} size={14} />
                ),
            },
            {
              value: "stats",
              label: t("aura.statsTab", "Stats"),
              icon: (c) => <BarChart3 color={c} size={14} />,
            },
          ]}
        />

        {/* Card Area */}
        <View style={styles.shotWrapper}>
          {viewMode === "aura" ? (
            <>
              <Animated.View
                style={[
                  styles.glowWrapper,
                  {
                    opacity: glowPulse,
                    transform: [{ scale: cardScale }],
                    backgroundColor: activeTone.fill,
                    shadowColor: activeTone.fill,
                  },
                ]}
              />
              <Animated.View
                style={{
                  opacity: cardOpacity,
                  transform: [{ scale: cardScale }],
                }}
              >
                <ViewShot
                  ref={viewShotRef}
                  options={{ format: "jpg", quality: 0.95 }}
                  style={styles.cardOuter}
                >
                  <View style={styles.card}>
                    <View style={[styles.accentLine, { backgroundColor: activeTone.fg }]} />
                    <Typography variant="label" color={activeTone.fg} style={styles.label}>
                      {characterMode === "default" ? t("aura.sessionAnalysis", "Session analysis") : t("aura.todaysAura")}
                    </Typography>
                    <Typography style={styles.title}>{aura?.auraTitle}</Typography>
                    <Typography style={styles.description}>{aura?.auraDescription}</Typography>
                    {(aura?.durationMin || aura?.totalVolume || aura?.exerciseCount) && (
                      <View style={styles.statsRow}>
                        {aura.durationMin ? (
                          <View style={styles.statItem}>
                            <Typography style={styles.statValue}>{aura.durationMin}</Typography>
                            <Typography variant="label" style={styles.statLabel}>{t("common.min")}</Typography>
                          </View>
                        ) : null}
                        {aura.exerciseCount ? (
                          <View style={styles.statItem}>
                            <Typography style={styles.statValue}>{aura.exerciseCount}</Typography>
                            <Typography variant="label" style={styles.statLabel}>{t("common.exercises")}</Typography>
                          </View>
                        ) : null}
                        {aura.totalSets ? (
                          <View style={styles.statItem}>
                            <Typography style={styles.statValue}>{aura.totalSets}</Typography>
                            <Typography variant="label" style={styles.statLabel}>{t("common.sets")}</Typography>
                          </View>
                        ) : null}
                        {aura.totalVolume ? (
                          <View style={styles.statItem}>
                            <Typography style={styles.statValue}>{formatVolume(aura.totalVolume)}</Typography>
                            <Typography variant="label" style={styles.statLabel}>{weightUnit}</Typography>
                          </View>
                        ) : null}
                      </View>
                    )}
                    <View style={styles.footer}>
                      <Typography style={styles.watermark}>
                        {characterMode === "default" ? t("aura.coachAnalysis", "AI Coach analysis") : t("aura.verifiedBy")}
                      </Typography>
                      <Typography style={[styles.appName, { color: activeTone.fg }]}>RepAI</Typography>
                    </View>
                  </View>
                </ViewShot>
              </Animated.View>
            </>
          ) : (
            /* ── Stats Card ── */
            <ViewShot
              ref={viewShotRef}
              options={{ format: "jpg", quality: 0.95 }}
              style={styles.cardOuter}
            >
              <View style={styles.statsCard}>
                <View style={styles.statsAccentBar} />
                <Typography variant="label" color={C.primary} style={styles.statsCardLabel}>
                  {t("aura.workoutCompleted", "Workout completed")}
                </Typography>
                <Typography style={styles.statsCardTitle}>
                  {mergedStats?.name || aura?.auraTitle || t("aura.workoutFallback", "Workout")}
                </Typography>
                <View style={styles.statsCardVolume}>
                  <Typography style={styles.statsCardVolumeNumber}>
                    {mergedStats ? formatVolume(mergedStats.totalVolume) : "—"}
                  </Typography>
                  <Typography variant="label" style={styles.statsCardVolumeUnit}>
                    {t("aura.totalVolume", { unit: weightUnit, defaultValue: "{{unit}} total volume" })}
                  </Typography>
                </View>
                {quickStats.length > 0 && (
                  <View style={styles.statsCardQuickRow}>
                    {quickStats.map((text, i) => (
                      <React.Fragment key={text}>
                        {i > 0 && <View style={styles.statsCardQuickDot} />}
                        <Typography style={styles.statsCardQuickText}>{text}</Typography>
                      </React.Fragment>
                    ))}
                  </View>
                )}
                <View style={styles.statsCardDivider} />
                {mergedStats?.exercises.map((ex, i) => (
                  <View key={i} style={styles.statsCardExRow}>
                    <Typography style={styles.statsCardExName} numberOfLines={1}>
                      {exerciseLabel(ex.name)}
                    </Typography>
                    <Typography style={styles.statsCardExValue}>
                      {displayWeight(ex.bestWeight)} {weightUnit} × {ex.bestReps}
                    </Typography>
                  </View>
                ))}
                <View style={styles.statsCardFooter}>
                  <View style={styles.watermarkRow}>
                    <ShieldCheck color={C.success} size={13} />
                    <Typography style={styles.watermark}>
                      {t("aura.verifiedWorkout", "Verified workout")}
                    </Typography>
                  </View>
                  <Typography style={[styles.appName, { color: C.primary }]}>RepAI</Typography>
                </View>
              </View>
            </ViewShot>
          )}
        </View>

        {/* Actions */}
        <Animated.View style={[styles.actions, { opacity: actionsOpacity }]}>
          {/* Share + Finish row */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnShare, { backgroundColor: activeTone.fill }]}
              onPress={handleShare}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Share2 color={activeTone.onFill} size={18} />
              <Typography style={[styles.btnShareText, { color: activeTone.onFill }]}>
                {t("aura.shareToStory")}
              </Typography>
            </TouchableOpacity>
            <Button title={t("common.finish")} variant="outline" size="large" onPress={handleFinish} />
          </View>

          {/* Character Selector */}
          <View style={styles.characterSection}>
            <Typography variant="label" style={styles.characterSectionLabel}>
              {t("aura.tryAnotherVibe")}
            </Typography>
            <View style={styles.characterRow}>
              {(["chad", "kevin"] as const).map((mode) => {
                const tone = toneColors(colors, CHARACTER_TONE[mode]);
                const active = characterMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.characterBtn,
                      { borderColor: active ? tone.fg : C.border, backgroundColor: active ? tone.soft : C.surface },
                    ]}
                    onPress={() => handleCharacterSwitch(mode)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Typography style={[styles.characterBtnText, active && { color: tone.fg }]}>
                      {t(mode === "chad" ? "aura.chadBtn" : "aura.kevinBtn")}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* AI Gate Modal */}
      {showAIGateModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Lock color={C.secondary} size={26} />
            </View>
            <Typography style={styles.modalTitle}>{t("aura.aiRequiredTitle")}</Typography>
            <Typography style={styles.modalDesc}>{t("aura.aiRequiredDesc")}</Typography>
            <Button
              title={t("aura.goToAI")}
              variant="ai"
              size="large"
              fullWidth
              icon={(c) => <Sparkles color={c} size={17} />}
              onPress={handleGoToAI}
            />
            <Button
              title={t("common.cancel")}
              variant="ghost"
              onPress={() => setShowAIGateModal(false)}
              style={{ marginTop: 6 }}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: "flex-end",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingSpinner: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  loadingText: {
    color: C.text,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingDots: {
    flexDirection: "row",
    marginTop: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.surfaceElevated,
  },

  // ── Error ──
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: C.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  errorText: {
    color: C.textSecondary,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "600",
    marginBottom: 28,
    textAlign: "center",
  },

  // ── Card ──
  shotWrapper: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  glowWrapper: {
    position: "absolute",
    width: width * 0.86,
    height: width * 1.05,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  cardOuter: {
    borderRadius: 24,
    width: width * 0.85,
    overflow: "hidden",
  },
  card: {
    padding: 26,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  accentLine: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.4,
    marginBottom: 12,
  },
  title: {
    color: C.text,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  description: {
    color: C.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    marginBottom: 22,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: C.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 10.5,
    marginTop: 2,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
  watermarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  watermark: {
    color: C.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },
  appName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  // ── Actions ──
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnShare: {
    flexDirection: "row",
    flex: 1,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnShareText: {
    fontSize: 16,
    fontWeight: "600",
  },

  // ── Character Selector ──
  characterSection: {
    marginTop: 10,
    alignItems: "center",
  },
  characterSectionLabel: {
    color: C.textMuted,
    marginBottom: 10,
  },
  characterRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  characterBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  characterBtnText: {
    color: C.text,
    fontSize: 14.5,
    fontWeight: "600",
  },

  // ── View Mode Toggle ──
  viewToggle: {
    marginHorizontal: 20,
    marginBottom: 8,
  },

  // ── Stats Card ──
  statsCard: {
    backgroundColor: C.surface,
    padding: 26,
    borderWidth: 1,
    borderColor: C.border,
  },
  statsAccentBar: {
    width: "100%",
    height: 3,
    backgroundColor: C.primary,
    borderRadius: 2,
    marginBottom: 22,
  },
  statsCardLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  statsCardTitle: {
    color: C.text,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: 18,
  },
  statsCardVolume: {
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 16,
    backgroundColor: C.surfaceLight,
    borderRadius: 16,
  },
  statsCardVolumeNumber: {
    color: C.text,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  statsCardVolumeUnit: {
    color: C.textMuted,
    letterSpacing: 1.6,
    marginTop: 2,
  },
  statsCardQuickRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 18,
    gap: 8,
  },
  statsCardQuickText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  statsCardQuickDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.textMuted,
  },
  statsCardDivider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 6,
  },
  statsCardExRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  statsCardExName: {
    color: C.text,
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  statsCardExValue: {
    color: C.primary,
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 12,
    fontVariant: ["tabular-nums"],
  },
  statsCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },

  // ── AI Gate Modal ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: C.surfaceLight,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: C.secondarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  modalTitle: {
    color: C.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  modalDesc: {
    color: C.textSecondary,
    fontSize: 14.5,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 22,
  },
});
