import { View, Modal, StyleSheet, TouchableOpacity, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Typography } from './Typography';
import { colors, borderRadius } from '../theme/colors';
import { EXERCISE_GIFS } from '../assets/exercises';
import { X, PlayCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

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
    
    // Check if we have the GIF for this ID
    const gifSource = exerciseId && EXERCISE_GIFS[exerciseId];

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
                        <Typography variant="h3" style={{ flex: 1 }} numberOfLines={2}>
                            {exerciseName}
                        </Typography>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={colors.textMuted} size={24} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.body}>
                        {gifSource ? (
                            <View style={styles.imageContainer}>
                                <Image 
                                    source={gifSource} 
                                    style={styles.gif} 
                                    contentFit="contain"
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
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
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
    placeholderContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
});
