import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from './Typography';
import { borderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { ALL_EQUIPMENT, EQUIPMENT_PRESETS } from '../constants/exerciseCatalog';
import { Equipment, ExperienceLevel, TrainingProfile } from '../types';

const LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const DAYS = [1, 2, 3, 4, 5, 6, 7];
const MINUTES = [30, 45, 60, 75, 90, 120];
type Preset = keyof typeof EQUIPMENT_PRESETS;

const sameSet = (a: Equipment[], b: Equipment[]) => a.length === b.length && a.every(x => b.includes(x));

interface Props {
  value: TrainingProfile;
  onChange: (value: TrainingProfile) => void;
}

/** Experience, schedule, equipment and limitations — what the AI coach plans around. */
export const TrainingProfileForm: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const set = (patch: Partial<TrainingProfile>) => onChange({ ...value, ...patch });

  const equipment = value.equipment;
  const activePreset = (Object.keys(EQUIPMENT_PRESETS) as Preset[]).find(
    p => equipment && sameSet(equipment, EQUIPMENT_PRESETS[p]),
  );

  const toggleEquipment = (item: Equipment) => {
    const current = equipment ?? EQUIPMENT_PRESETS.gym;
    set({ equipment: current.includes(item) ? current.filter(e => e !== item) : [...current, item] });
  };

  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Typography variant="caption" color={active ? colors.black : colors.textSecondary} bold={active} style={{ fontSize: 12 }}>
        {label}
      </Typography>
    </TouchableOpacity>
  );

  return (
    <View>
      <Typography variant="label" style={styles.label}>{t('trainingProfile.experience')}</Typography>
      <View style={styles.row}>
        {LEVELS.map(l => chip(l, t(`trainingProfile.level_${l}`), value.experience === l, () => set({ experience: l })))}
      </View>

      <Typography variant="label" style={styles.label}>{t('trainingProfile.daysPerWeek')}</Typography>
      <View style={styles.row}>
        {DAYS.map(d => chip(String(d), String(d), value.trainingDays === d, () => set({ trainingDays: d })))}
      </View>

      <Typography variant="label" style={styles.label}>{t('trainingProfile.sessionLength')}</Typography>
      <View style={styles.row}>
        {MINUTES.map(m => chip(String(m), `${m} ${t('common.min')}`, value.sessionMinutes === m, () => set({ sessionMinutes: m })))}
      </View>

      <Typography variant="label" style={styles.label}>{t('trainingProfile.equipment')}</Typography>
      <View style={styles.row}>
        {(Object.keys(EQUIPMENT_PRESETS) as Preset[]).map(p =>
          chip(p, t(`trainingProfile.preset_${p}`), activePreset === p, () => set({ equipment: [...EQUIPMENT_PRESETS[p]] })),
        )}
      </View>
      <View style={[styles.row, { marginTop: 8 }]}>
        {ALL_EQUIPMENT.map(item =>
          chip(item, t(`equipment.${item}`), (equipment ?? EQUIPMENT_PRESETS.gym).includes(item), () => toggleEquipment(item)),
        )}
      </View>

      <Typography variant="label" style={styles.label}>{t('trainingProfile.limitations')}</Typography>
      <TextInput
        style={styles.input}
        value={value.limitations ?? ''}
        onChangeText={text => set({ limitations: text })}
        placeholder={t('trainingProfile.limitationsPlaceholder')}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={300}
        textAlignVertical="top"
      />
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  label: {
    marginTop: 16,
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
  input: {
    minHeight: 64,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

/** The training profile fields of a cloud profile row. */
export function trainingProfileOf(profile: any): TrainingProfile {
  if (!profile) return {};
  return {
    experience: profile.experience,
    equipment: profile.equipment,
    trainingDays: profile.trainingDays,
    sessionMinutes: profile.sessionMinutes,
    limitations: profile.limitations,
  };
}

/** Arguments for users.updateProfile (drops unset fields). */
export function trainingProfileArgs(p: TrainingProfile) {
  return {
    ...(p.experience ? { experience: p.experience } : {}),
    ...(p.equipment ? { equipment: p.equipment } : {}),
    ...(p.trainingDays ? { trainingDays: p.trainingDays } : {}),
    ...(p.sessionMinutes ? { sessionMinutes: p.sessionMinutes } : {}),
    ...(p.limitations !== undefined ? { limitations: p.limitations.trim() } : {}),
  };
}
