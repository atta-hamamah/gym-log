import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Typography } from './Typography';
import { Button } from './Button';
import { Chip } from './Chip';
import { borderRadius, ThemeColors } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { getMuscleGroupName } from '../constants/exercises';
import { EQUIPMENT_PRESETS } from '../constants/exerciseCatalog';
import { AIWorkoutRequest } from '../types';

export type GenerateWorkoutOptions = AIWorkoutRequest;

const DURATIONS = [20, 30, 45, 60, 75, 90];
const FOCUS = ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Full Body', 'Cardio'];
type Place = 'profile' | 'gym' | 'bodyweight';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onGenerate: (options: GenerateWorkoutOptions) => void;
}

/** Options for an AI-generated session: time, where, focus and a note for the coach. */
export const GenerateWorkoutSheet: React.FC<Props> = ({ visible, onCancel, onGenerate }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const profile = useQuery(api.users.me);

  const [minutes, setMinutes] = useState(60);
  const [place, setPlace] = useState<Place>('profile');
  const [focus, setFocus] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  // Reset each time the sheet opens, starting from the profile's session length.
  useEffect(() => {
    if (!visible) return;
    setMinutes(profile?.sessionMinutes ?? 60);
    setPlace('profile');
    setFocus([]);
    setComment('');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFocus = (group: string) =>
    setFocus(prev => (prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]));

  const handleGenerate = () => {
    const note = comment.trim();
    onGenerate({
      sessionMinutes: minutes,
      ...(note ? { userComment: note } : {}),
      ...(focus.length ? { focus } : {}),
      ...(place === 'gym' ? { equipment: EQUIPMENT_PRESETS.gym } : {}),
      ...(place === 'bodyweight' ? { equipment: [] } : {}),
    });
  };

  const chip = (label: string, active: boolean, onPress: () => void, key?: string) => (
    <Chip key={key ?? label} label={label} selected={active} onPress={onPress} tone="secondary" size="small" />
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.titleRow}>
              <View style={styles.titleIcon}>
                <Sparkles color={colors.secondary} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="h3">{t('aiWorkout.commentTitle')}</Typography>
                <Typography variant="caption" color={colors.textSecondary}>
                  {t('aiWorkout.sheetDesc')}
                </Typography>
              </View>
            </View>

            <Typography variant="label" style={styles.label}>{t('aiWorkout.timeAvailable')}</Typography>
            <View style={styles.row}>
              {DURATIONS.map(d => chip(`${d} ${t('common.min')}`, minutes === d, () => setMinutes(d), String(d)))}
            </View>

            <Typography variant="label" style={styles.label}>{t('aiWorkout.whereToday')}</Typography>
            <View style={styles.row}>
              {chip(t('aiWorkout.placeProfile'), place === 'profile', () => setPlace('profile'))}
              {chip(t('aiWorkout.placeGym'), place === 'gym', () => setPlace('gym'))}
              {chip(t('aiWorkout.placeBodyweight'), place === 'bodyweight', () => setPlace('bodyweight'))}
            </View>

            <Typography variant="label" style={styles.label}>{t('aiWorkout.focus')}</Typography>
            <View style={styles.row}>
              {chip(t('aiWorkout.focusAuto'), focus.length === 0, () => setFocus([]), 'auto')}
              {FOCUS.map(g => chip(getMuscleGroupName(g, t), focus.includes(g), () => toggleFocus(g), g))}
            </View>

            <Typography variant="label" style={styles.label}>{t('aiWorkout.commentDesc')}</Typography>
            <TextInput
              style={styles.input}
              placeholder={t('aiWorkout.commentPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={300}
            />

            <View style={styles.buttons}>
              <Button title={t('common.cancel')} variant="outline" onPress={onCancel} style={{ flex: 1 }} />
              <Button
                title={t('aiWorkout.generate')}
                onPress={handleGenerate}
                icon={c => <Sparkles color={c} size={17} />}
                style={{ flex: 1.6 }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 18,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  input: {
    minHeight: 72,
    maxHeight: 110,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
});
