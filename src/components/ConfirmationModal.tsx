import React from 'react';
import { Modal, View, StyleSheet, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { Typography } from './Typography';
import { Button } from './Button';

interface ConfirmationModalProps {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    variant?: 'danger' | 'primary' | 'success';
    loading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    visible,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'primary',
    loading = false,
}) => {
    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onCancel}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <TouchableWithoutFeedback onPress={onCancel}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <View style={styles.modalContainer}>
                    <View style={styles.content}>
                        <Typography variant="h3" style={styles.title} color={colors.text}>
                            {title}
                        </Typography>

                        <Typography variant="body" style={styles.message} color={colors.textSecondary}>
                            {message}
                        </Typography>

                        <View style={styles.actions}>
                            {onCancel && (
                                <Button
                                    title={cancelText}
                                    onPress={onCancel}
                                    variant="ghost"
                                    style={styles.button}
                                    disabled={loading}
                                />
                            )}
                            <Button
                                title={confirmText}
                                onPress={onConfirm}
                                variant={variant === 'danger' ? 'danger' : 'primary'}
                                style={styles.button}
                                loading={loading}
                            />
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContainer: {
        width: '85%',
        maxWidth: 400,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.large,
        overflow: 'hidden',
    },
    content: {
        padding: spacing.l,
    },
    title: {
        textAlign: 'center',
        marginBottom: spacing.s,
    },
    message: {
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.m,
    },
    button: {
        flex: 1,
    },
});
