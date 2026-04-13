import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, Dimensions } from "react-native";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Id } from "../../convex/_generated/dataModel";
import { Share2, X } from "lucide-react-native";

interface RouteParams {
  workoutId: Id<"workouts">;
}

export default function WorkoutAuraScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { workoutId } = route.params as RouteParams;
  
  const generateAura = useAction(api.ai.generateWorkoutAura);
  
  const [aura, setAura] = useState<{ auraTitle: string; auraDescription: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingText, setLoadingText] = useState(t('aura.consulting'));
  
  const viewShotRef = useRef<ViewShot>(null);

  // Cycling loading phrases for effect
  useEffect(() => {
    if (!loading) return;
    const phrases = [
      t('aura.consulting'),
      t('aura.analyzingRest'),
      t('aura.judgingForm'),
      t('aura.calculatingAura'),
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % phrases.length;
      setLoadingText(phrases[i]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    async function fetchAura() {
      try {
        setLoading(true);
        const result = await generateAura({ workoutId });
        setAura(result);
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
        dialogTitle: t('aura.shareTitle'),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinish = () => {
    navigation.navigate("Home" as never);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B30" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !aura) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{t('aura.silentGods')}</Text>
          <TouchableOpacity style={styles.btnFinish} onPress={handleFinish}>
            <Text style={styles.btnFinishText}>{t('common.continue')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleFinish}>
          <X color="#fff" size={28} />
        </TouchableOpacity>
      </View>

      <View style={styles.shotWrapper}>
        <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={styles.cardGlow}>
          <View style={styles.card}>
            <Text style={styles.label}>{t('aura.todaysAura')}</Text>
            <Text style={styles.title}>{aura.auraTitle}</Text>
            <Text style={styles.description}>{aura.auraDescription}</Text>
            
            <View style={styles.footer}>
              <Text style={styles.watermark}>🤖 {t('aura.verifiedBy')}</Text>
            </View>
          </View>
        </ViewShot>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnShare} onPress={handleShare}>
          <Share2 color="#fff" size={20} />
          <Text style={styles.btnShareText}> {t('aura.shareToStory')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.btnFinish} onPress={handleFinish}>
          <Text style={styles.btnFinishText}>{t('common.finish')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.8,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  shotWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardGlow: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    width: width * 0.85,
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    padding: 30,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#333',
  },
  label: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    marginBottom: 24,
  },
  description: {
    color: '#EBEBF5',
    opacity: 0.8,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '500',
    marginBottom: 40,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 16,
  },
  watermark: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  btnShare: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnShareText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  btnFinish: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2E',
  },
  btnFinishText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
