import React from 'react';
import {
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacityProps,
    View,
    Text,
} from 'react-native';
import { shadows } from '../theme/colors';
import { IconProp, renderIcon, toneColors } from '../theme/tones';
import { useTheme } from '../context/ThemeContext';

export type ButtonVariant =
    /** Filled brand color: the one main action on a screen. */
    | 'primary'
    /** Tinted brand color: secondary actions. */
    | 'secondary'
    /** Neutral hairline border. */
    | 'outline'
    /** Text only. */
    | 'ghost'
    /** Tinted red: destructive actions. */
    | 'danger'
    /** Tinted violet: AI coach actions. */
    | 'ai';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: ButtonVariant;
    size?: 'small' | 'medium' | 'large';
    loading?: boolean;
    /** Leading icon; pass a function to receive the button's text color. */
    icon?: IconProp;
    iconRight?: IconProp;
    fullWidth?: boolean;
}

const SIZES = {
    small: { height: 36, paddingHorizontal: 14, borderRadius: 10, fontSize: 13.5, gap: 6 },
    medium: { height: 46, paddingHorizontal: 20, borderRadius: 13, fontSize: 15, gap: 8 },
    large: { height: 54, paddingHorizontal: 24, borderRadius: 16, fontSize: 16, gap: 8 },
};

export const Button: React.FC<ButtonProps> = ({
    title,
    variant = 'primary',
    size = 'medium',
    loading,
    icon,
    iconRight,
    fullWidth,
    style,
    disabled,
    ...props
}) => {
    const { colors, isDark } = useTheme();
    const s = SIZES[size];

    let bg = 'transparent';
    let fg = colors.text;
    let borderColor: string | undefined;
    switch (variant) {
        case 'primary': {
            bg = colors.primary;
            fg = colors.onPrimary;
            break;
        }
        case 'secondary': {
            const t = toneColors(colors, 'primary');
            bg = t.soft;
            fg = t.fg;
            break;
        }
        case 'ai': {
            const t = toneColors(colors, 'secondary');
            bg = t.soft;
            fg = t.fg;
            break;
        }
        case 'danger': {
            const t = toneColors(colors, 'danger');
            bg = t.soft;
            fg = t.fg;
            break;
        }
        case 'outline':
            borderColor = colors.border;
            fg = colors.text;
            break;
        case 'ghost':
            fg = colors.textSecondary;
            break;
    }

    const inactive = disabled || loading;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                {
                    height: s.height,
                    paddingHorizontal: s.paddingHorizontal,
                    borderRadius: s.borderRadius,
                    backgroundColor: bg,
                    borderWidth: borderColor ? 1 : 0,
                    borderColor,
                },
                variant === 'primary' && size === 'large' && !inactive && !isDark && shadows.glow(colors.primary),
                disabled && styles.disabled,
                fullWidth && { width: '100%' },
                style,
            ]}
            disabled={inactive}
            activeOpacity={0.8}
            accessibilityRole="button"
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={fg} size="small" />
            ) : (
                <View style={[styles.content, { gap: s.gap }]}>
                    {icon ? renderIcon(icon, fg) : null}
                    <Text
                        style={[styles.label, { color: fg, fontSize: s.fontSize }]}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    {iconRight ? renderIcon(iconRight, fg) : null}
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontWeight: '600',
        letterSpacing: 0.1,
    },
    disabled: {
        opacity: 0.45,
    },
});
