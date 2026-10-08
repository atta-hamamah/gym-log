import { View, Modal, StyleSheet, TouchableOpacity, Pressable, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Typography } from './Typography';
import { ExerciseAnimation } from './ExerciseAnimation';
import { borderRadius } from '../theme/colors';
import { getExerciseGif } from '../assets/exercises';
import { getAnimation } from '../animations';
import { EXERCISE_BY_ID, getMuscleGroupName } from '../constants/exercises';
import { X, PlayCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

interface ExerciseInfoModalProps {
    visible: boolean;
    exerciseId: string | null;
    exerciseName: string;
    onClose: () => void;
}

export const ExerciseInfoModal: React.FC<ExerciseInfoModalProps> = ({
    visible,
    exerciseId,
    exerciseName,
    onClose,
}) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);

    // Real GIF demos win; everything else (including the still photos) uses the vector animation.
    const gifSource = getExerciseGif(exerciseId);
    const hasVector = !gifSource && !!getAnimation(exerciseId);
    const info = exerciseId ? EXERCISE_BY_ID[exerciseId] : undefined;

    const chips = (keys: string[], prefix: string, primary = false) => (
        <View style={styles.chipRow}>
            {keys.map(key => (
                <View key={key} style={[styles.chip, primary && styles.chipPrimary]}>
                    <Typography variant="caption" color={primary ? colors.primary : colors.textSecondary} style={styles.chipText}>
                        {t(`${prefix}.${key}`, { defaultValue: key.replace(/_/g, ' ') })}
                    </Typography>
                </View>
            ))}
        </View>
    );

    const row = (label: string, content: React.ReactNode) => (
        <View style={styles.detailRow}>
            <Typography variant="label">{label}</Typography>
            {content}
        </View>
    );

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Typography variant="h3" numberOfLines={2}>
                                {exerciseName}
                            </Typography>
                            {info && (
                                <Typography variant="caption" style={{ marginTop: 2 }}>
                                    {getMuscleGroupName(info.muscleGroup, t)}
                                </Typography>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={colors.textMuted} size={24} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.body} bounces={false}>
                        {gifSource ? (
                            <View style={styles.imageContainer}>
                                <Image
                                    source={gifSource}
                                    style={styles.gif}
                                    contentFit="contain"
                                />
                            </View>
                        ) : hasVector ? (
                            <View style={styles.animationContainer}>
                                <ExerciseAnimation
                                    exerciseId={exerciseId}
                                    paused={!visible}
                                    accessibilityLabel={exerciseName}
                                />
                            </View>
                        ) : (
                            <View style={styles.placeholderContainer}>
                                <PlayCircle color={colors.textMuted} size={48} />
                                <Typography variant="body" color={colors.textMuted} align="center" style={{ marginTop: 16 }}>
                                    {t('common.animationNotAvailable', 'Animation not available')}
                                </Typography>
                            </View>
                        )}

                        {info && (
                            <View style={styles.details}>
                                {!!info.primaryMuscles?.length &&
                                    row(t('exerciseInfo.primaryMuscles'), chips(info.primaryMuscles, 'muscles', true))}
                                {!!info.secondaryMuscles?.length &&
                                    row(t('exerciseInfo.secondaryMuscles'), chips(info.secondaryMuscles, 'muscles'))}
                                {row(
                                    t('exerciseInfo.equipment'),
                                    info.equipment?.length
                                        ? chips(info.equipment, 'equipment')
                                        : <Typography variant="bodySmall">{t('exerciseInfo.bodyweight')}</Typography>,
                                )}
                                {info.level &&
                                    row(t('exerciseInfo.level'), <Typography variant="bodySmall">{t(`levels.${info.level}`)}</Typography>)}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    modalContent: {
        width: '100%',
        maxHeight: '90%',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.l,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    closeBtn: {
        padding: 4,
        marginLeft: 12,
        backgroundColor: colors.background,
        borderRadius: borderRadius.full,
    },
    body: {
        padding: 20,
        alignItems: 'center',
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#fff', // White background so the GIFs look good (which have white bg usually)
        borderRadius: borderRadius.m,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gif: {
        width: '100%',
        height: '100%',
    },
    animationContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        overflow: 'hidden',
    },
    placeholderContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    details: {
        width: '100%',
        marginTop: 16,
        gap: 12,
    },
    detailRow: {
        gap: 6,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chipPrimary: {
        borderColor: colors.primary,
    },
    chipText: {
        fontSize: 12,
    },
});
