import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { Typography } from './Typography';
import { Button } from './Button';
import { Check } from 'lucide-react-native';

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
    requireCheckbox?: boolean;
    checkboxLabel?: string;
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
    requireCheckbox = false,
    checkboxLabel = '',
}) => {
    const [isChecked, setIsChecked] = useState(false);

    useEffect(() => {
        if (visible) {
            setIsChecked(false);
        }
    }, [visible]);

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

                        {requireCheckbox && (
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setIsChecked(!isChecked)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                                    {isChecked && <Check size={16} color="#FFF" strokeWidth={3} />}
                                </View>
                                <Typography variant="body" style={styles.checkboxLabel} color={colors.text}>
                                    {checkboxLabel}
                                </Typography>
                            </TouchableOpacity>
                        )}

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
                                style={[styles.button, (requireCheckbox && !isChecked) && styles.buttonDisabled]}
                                loading={loading}
                                disabled={loading || (requireCheckbox && !isChecked)}
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
    // Checkbox styles
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.s,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: borderRadius.s,
        borderWidth: 2,
        borderColor: colors.textSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.m,
        backgroundColor: 'transparent',
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    checkboxLabel: {
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.m,
    },
    button: {
        flex: 1,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});
