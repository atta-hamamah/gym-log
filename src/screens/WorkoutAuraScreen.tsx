import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Id } from "../../convex/_generated/dataModel";
import { Share2, X, BarChart3, Lock } from "lucide-react-native";
import { useSubscription } from "../context/SubscriptionContext";

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

export default function WorkoutAuraScreen() {
  const { t, i18n } = useTranslation();
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

  const CHARACTER_COLORS = {
    default: { glow: "#FF3B30", accent: "#FF3B30" },
    chad: { glow: "#FF6B00", accent: "#FF6B00" },
    kevin: { glow: "#8B5CF6", accent: "#8B5CF6" },
  };
  const activeColors = CHARACTER_COLORS[characterMode];

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
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingSpinner,
              { transform: [{ rotate: spinInterpolate }] },
            ]}
          >
            <Text style={styles.loadingEmoji}>🔮</Text>
          </Animated.View>
          <Text style={styles.loadingText}>
            {loadingPhrases[loadingPhaseIndex]}
          </Text>
          <View style={styles.loadingDots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  loadingPhaseIndex % 3 >= i && styles.dotActive,
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
        <View style={styles.loadingContainer}>
          <Text style={styles.errorEmoji}>🤐</Text>
          <Text style={styles.errorText}>{t("aura.silentGods")}</Text>
          <TouchableOpacity style={styles.btnFinish} onPress={handleFinish}>
            <Text style={styles.btnFinishText}>{t("common.continue")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success State ──
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleFinish}
          style={styles.closeBtn}
          activeOpacity={0.7}
        >
          <X color="#8E8E93" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* View Mode Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === "aura" && styles.viewToggleBtnActive]}
            onPress={handleAuraToggle}
            activeOpacity={0.7}
          >
            {!isAISubscriber && <Lock color="#8E8E93" size={12} style={{ marginRight: 4 }} />}
            <Text style={[styles.viewToggleText, viewMode === "aura" && styles.viewToggleTextActive]}>✨ Aura</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === "stats" && styles.viewToggleBtnActive]}
            onPress={() => setViewMode("stats")}
            activeOpacity={0.7}
          >
            <BarChart3 color={viewMode === "stats" ? "#000" : "#8E8E93"} size={14} />
            <Text style={[styles.viewToggleText, viewMode === "stats" && styles.viewToggleTextActive, { marginLeft: 4 }]}>Stats</Text>
          </TouchableOpacity>
        </View>

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
                    backgroundColor: activeColors.glow,
                    shadowColor: activeColors.glow,
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
                    <View style={[styles.accentLine, { backgroundColor: activeColors.accent }]} />
                    <Text style={[styles.label, { color: activeColors.accent }]}>{t("aura.todaysAura")}</Text>
                    <Text style={styles.title}>{aura?.auraTitle}</Text>
                    <Text style={styles.description}>{aura?.auraDescription}</Text>
                    {(aura?.durationMin || aura?.totalVolume || aura?.exerciseCount) && (
                      <View style={styles.statsRow}>
                        {aura.durationMin ? (<View style={styles.statItem}><Text style={styles.statValue}>{aura.durationMin}</Text><Text style={styles.statLabel}>min</Text></View>) : null}
                        {aura.exerciseCount ? (<View style={styles.statItem}><Text style={styles.statValue}>{aura.exerciseCount}</Text><Text style={styles.statLabel}>exercises</Text></View>) : null}
                        {aura.totalSets ? (<View style={styles.statItem}><Text style={styles.statValue}>{aura.totalSets}</Text><Text style={styles.statLabel}>sets</Text></View>) : null}
                        {aura.totalVolume ? (<View style={styles.statItem}><Text style={styles.statValue}>{aura.totalVolume >= 1000 ? `${(aura.totalVolume / 1000).toFixed(1)}k` : aura.totalVolume}</Text><Text style={styles.statLabel}>kg</Text></View>) : null}
                      </View>
                    )}
                    <View style={styles.footer}>
                      <Text style={styles.watermark}>🤖 {t("aura.verifiedBy")}</Text>
                      <Text style={[styles.appName, { color: activeColors.accent }]}>RepAI</Text>
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
                <Text style={styles.statsCardLabel}>WORKOUT COMPLETED</Text>
                <Text style={styles.statsCardTitle}>
                  {mergedStats?.name || aura?.auraTitle || "Workout"}
                </Text>
                <View style={styles.statsCardVolume}>
                  <Text style={styles.statsCardVolumeNumber}>
                    {mergedStats
                      ? mergedStats.totalVolume >= 1000
                        ? `${(mergedStats.totalVolume / 1000).toFixed(1)}k`
                        : mergedStats.totalVolume
                      : "—"}
                  </Text>
                  <Text style={styles.statsCardVolumeUnit}>KG TOTAL VOLUME</Text>
                </View>
                <View style={styles.statsCardQuickRow}>
                  {mergedStats?.durationMin ? (
                    <Text style={styles.statsCardQuickText}>{mergedStats.durationMin} MIN</Text>
                  ) : null}
                  {mergedStats?.durationMin && mergedStats?.totalSets ? (
                    <Text style={styles.statsCardQuickDot}>•</Text>
                  ) : null}
                  {mergedStats?.totalSets ? (
                    <Text style={styles.statsCardQuickText}>{mergedStats.totalSets} SETS</Text>
                  ) : null}
                  {mergedStats?.totalSets && mergedStats?.exerciseCount ? (
                    <Text style={styles.statsCardQuickDot}>•</Text>
                  ) : null}
                  {mergedStats?.exerciseCount ? (
                    <Text style={styles.statsCardQuickText}>{mergedStats.exerciseCount} EXERCISES</Text>
                  ) : null}
                </View>
                <View style={styles.statsCardDivider} />
                {mergedStats?.exercises.map((ex, i) => (
                  <View key={i} style={styles.statsCardExRow}>
                    <Text style={styles.statsCardExName}>{ex.name}</Text>
                    <Text style={styles.statsCardExValue}>
                      {ex.bestWeight}kg × {ex.bestReps}
                    </Text>
                  </View>
                ))}
                <View style={styles.statsCardFooter}>
                  <Text style={styles.statsCardWatermark}>✅ RepAI Verified Workout</Text>
                  <Text style={styles.statsCardAppName}>RepAI</Text>
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
              style={[styles.btnShare, { backgroundColor: activeColors.accent }]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Share2 color="#fff" size={18} />
              <Text style={styles.btnShareText}>{t("aura.shareToStory")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnFinish}
              onPress={handleFinish}
              activeOpacity={0.8}
            >
              <Text style={styles.btnFinishText}>{t("common.finish")}</Text>
            </TouchableOpacity>
          </View>

          {/* Character Selector */}
          <View style={styles.characterSection}>
            <Text style={styles.characterSectionLabel}>{t("aura.tryAnotherVibe")}</Text>
            <View style={styles.characterRow}>
              <TouchableOpacity
                style={[
                  styles.characterBtn,
                  styles.characterBtnChad,
                  characterMode === "chad" && styles.characterBtnActive,
                ]}
                onPress={() => handleCharacterSwitch("chad")}
                activeOpacity={0.7}
              >
                <Text style={styles.characterBtnText}>{t("aura.chadBtn")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.characterBtn,
                  styles.characterBtnKevin,
                  characterMode === "kevin" && styles.characterBtnActive,
                ]}
                onPress={() => handleCharacterSwitch("kevin")}
                activeOpacity={0.7}
              >
                <Text style={styles.characterBtnText}>{t("aura.kevinBtn")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* AI Gate Modal */}
      {showAIGateModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Lock color="#fff" size={28} />
            </View>
            <Text style={styles.modalTitle}>{t("aura.aiRequiredTitle")}</Text>
            <Text style={styles.modalDesc}>{t("aura.aiRequiredDesc")}</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={handleGoToAI}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnText}>{t("aura.goToAI")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowAIGateModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalDismiss}>{t("common.cancel")}</Text>
            </TouchableOpacity>
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
    backgroundColor: "#000",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: "flex-end",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
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
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  loadingEmoji: {
    fontSize: 48,
  },
  loadingText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    opacity: 0.9,
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
    backgroundColor: "#333",
  },
  dotActive: {
    backgroundColor: "#FF3B30",
  },

  // ── Error ──
  errorEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  errorText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 32,
    textAlign: "center",
    opacity: 0.8,
  },

  // ── Card ──
  shotWrapper: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  glowWrapper: {
    position: "absolute",
    width: width * 0.88,
    height: width * 1.1,
    borderRadius: 28,
    backgroundColor: "#FF3B30",
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  cardOuter: {
    borderRadius: 24,
    width: width * 0.85,
    overflow: "hidden",
  },
  card: {
    padding: 28,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  accentLine: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FF3B30",
    marginBottom: 20,
  },
  label: {
    color: "#FF3B30",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    marginBottom: 16,
  },
  description: {
    color: "#EBEBF5",
    opacity: 0.85,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    marginBottom: 24,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2E",
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
  watermark: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "700",
  },
  appName: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
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
    backgroundColor: "#FF3B30",
    flexDirection: "row",
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnShareText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  btnFinish: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    paddingHorizontal: 24,
  },
  btnFinishText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  // ── Character Selector ──
  characterSection: {
    marginTop: 8,
    alignItems: "center",
  },
  characterSectionLabel: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
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
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 1.5,
    borderColor: "#2C2C2E",
  },
  characterBtnChad: {
    borderColor: "#FF6B00",
  },
  characterBtnKevin: {
    borderColor: "#8B5CF6",
  },
  characterBtnActive: {
    borderWidth: 2,
    backgroundColor: "#2C2C2E",
  },
  characterBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // ── View Mode Toggle ──
  viewToggle: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 3,
  },
  viewToggleBtn: {
    flex: 1,
    height: 36,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggleBtnActive: {
    backgroundColor: "#fff",
  },
  viewToggleText: {
    color: "#8E8E93",
    fontSize: 13,
    fontWeight: "700",
  },
  viewToggleTextActive: {
    color: "#000",
  },

  // ── Stats Card ──
  statsCard: {
    backgroundColor: "#111113",
    padding: 28,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  statsAccentBar: {
    width: "100%",
    height: 3,
    backgroundColor: "#10B981",
    borderRadius: 2,
    marginBottom: 24,
  },
  statsCardLabel: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 6,
  },
  statsCardTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
    marginBottom: 20,
  },
  statsCardVolume: {
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 16,
    backgroundColor: "#1A1A1D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  statsCardVolumeNumber: {
    color: "#fff",
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1,
  },
  statsCardVolumeUnit: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 4,
  },
  statsCardQuickRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    gap: 6,
  },
  statsCardQuickText: {
    color: "#EBEBF5",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statsCardQuickDot: {
    color: "#3A3A3C",
    fontSize: 13,
    fontWeight: "900",
  },
  statsCardDivider: {
    height: 1,
    backgroundColor: "#2C2C2E",
    marginBottom: 16,
  },
  statsCardExRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1C1C1E",
  },
  statsCardExName: {
    color: "#EBEBF5",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  statsCardExValue: {
    color: "#10B981",
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 12,
  },
  statsCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
  },
  statsCardWatermark: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "700",
  },
  statsCardAppName: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },

  // ── AI Gate Modal ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  modalDesc: {
    color: "#8E8E93",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalBtn: {
    backgroundColor: "#8B5CF6",
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 12,
  },
  modalBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalDismiss: {
    color: "#8E8E93",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 8,
  },
});
