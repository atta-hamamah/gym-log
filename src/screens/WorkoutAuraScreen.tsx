import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Id } from "../../convex/_generated/dataModel";
import { Share2, X } from "lucide-react-native";

interface RouteParams {
  workoutId: string;
}

export default function WorkoutAuraScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { workoutId } = route.params as RouteParams;

  const generateAura = useAction(api.ai.generateWorkoutAura);

  const [aura, setAura] = useState<{
    auraTitle: string;
    auraDescription: string;
    durationMin?: number;
    exerciseCount?: number;
    totalVolume?: number;
    totalSets?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);

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

  useEffect(() => {
    async function fetchAura() {
      try {
        setLoading(true);
        const result = await generateAura({
          workoutId: workoutId as Id<"workouts">,
        });
        setAura(result);
        setTimeout(animateCardIn, 100);
      } catch (e) {
        console.error(e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAura();
  }, [workoutId]);

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

  // ── Loading State ──
  if (loading) {
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

  // ── Error State ──
  if (error || !aura) {
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

      {/* Card */}
      <View style={styles.shotWrapper}>
        <Animated.View
          style={[
            styles.glowWrapper,
            {
              opacity: glowPulse,
              transform: [{ scale: cardScale }],
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
              {/* Accent line */}
              <View style={styles.accentLine} />

              {/* Label */}
              <Text style={styles.label}>{t("aura.todaysAura")}</Text>

              {/* Title */}
              <Text style={styles.title}>{aura.auraTitle}</Text>

              {/* Description */}
              <Text style={styles.description}>{aura.auraDescription}</Text>

              {/* Stats row (if available from cloud) */}
              {(aura.durationMin || aura.totalVolume || aura.exerciseCount) && (
                <View style={styles.statsRow}>
                  {aura.durationMin ? (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{aura.durationMin}</Text>
                      <Text style={styles.statLabel}>min</Text>
                    </View>
                  ) : null}
                  {aura.exerciseCount ? (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {aura.exerciseCount}
                      </Text>
                      <Text style={styles.statLabel}>exercises</Text>
                    </View>
                  ) : null}
                  {aura.totalSets ? (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{aura.totalSets}</Text>
                      <Text style={styles.statLabel}>sets</Text>
                    </View>
                  ) : null}
                  {aura.totalVolume ? (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {aura.totalVolume >= 1000
                          ? `${(aura.totalVolume / 1000).toFixed(1)}k`
                          : aura.totalVolume}
                      </Text>
                      <Text style={styles.statLabel}>kg</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.watermark}>🤖 {t("aura.verifiedBy")}</Text>
                <Text style={styles.appName}>RepAI</Text>
              </View>
            </View>
          </ViewShot>
        </Animated.View>
      </View>

      {/* Actions */}
      <Animated.View style={[styles.actions, { opacity: actionsOpacity }]}>
        <TouchableOpacity
          style={styles.btnShare}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Share2 color="#fff" size={20} />
          <Text style={styles.btnShareText}>
            {" "}
            {t("aura.shareToStory")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnFinish}
          onPress={handleFinish}
          activeOpacity={0.8}
        >
          <Text style={styles.btnFinishText}>{t("common.finish")}</Text>
        </TouchableOpacity>
      </Animated.View>
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    paddingBottom: 40,
    gap: 12,
  },
  btnShare: {
    backgroundColor: "#FF3B30",
    flexDirection: "row",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  btnShareText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginLeft: 8,
  },
  btnFinish: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  btnFinishText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
