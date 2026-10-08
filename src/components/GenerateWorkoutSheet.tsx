import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Typography } from './Typography';
import { borderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { getMuscleGroupName } from '../constants/exercises';
import { EQUIPMENT_PRESETS } from '../constants/exerciseCatalog';
import { AIWorkoutRequest } from '../types';

const AI_COLOR = '#8B5CF6';

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
    <TouchableOpacity
      key={key ?? label}
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Typography variant="caption" color={active ? '#fff' : colors.textSecondary} bold={active} style={{ fontSize: 12 }}>
        {label}
      </Typography>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Typography variant="h2" style={{ marginBottom: 4 }}>{t('aiWorkout.commentTitle')}</Typography>
            <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 16 }}>
              {t('aiWorkout.sheetDesc')}
            </Typography>

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
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
                <Typography variant="body" color={colors.textSecondary}>{t('common.cancel')}</Typography>
              </TouchableOpacity>
              <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} activeOpacity={0.7}>
                <Sparkles color="#fff" size={16} />
                <Typography variant="body" color="#fff" bold style={{ marginLeft: 6 }}>
                  {t('aiWorkout.generate')}
                </Typography>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    maxHeight: '88%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.l,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: AI_COLOR,
    borderColor: AI_COLOR,
  },
  input: {
    minHeight: 70,
    maxHeight: 110,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: borderRadius.m,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  generateBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.m,
    backgroundColor: AI_COLOR,
  },
});
