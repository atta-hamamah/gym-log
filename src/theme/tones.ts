import type React from 'react';
import { ThemeColors } from './colors';

/** Semantic color families used by buttons, chips, icon buttons and list rows. */
export type Tone = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export interface ToneColors {
    /** Solid fill. */
    fill: string;
    /** Text / icons on the solid fill. */
    onFill: string;
    /** Text / icons on neutral surfaces. */
    fg: string;
    /** Subtle tinted background. */
    soft: string;
}

export function toneColors(colors: ThemeColors, tone: Tone): ToneColors {
    switch (tone) {
        case 'primary':
            return { fill: colors.primary, onFill: colors.onPrimary, fg: colors.primary, soft: colors.primarySoft };
        case 'secondary':
            return { fill: colors.secondary, onFill: colors.onSecondary, fg: colors.secondary, soft: colors.secondarySoft };
        case 'accent':
            return { fill: colors.accent, onFill: colors.onPrimary, fg: colors.accent, soft: colors.accentSoft };
        case 'success':
            return { fill: colors.success, onFill: colors.white, fg: colors.success, soft: colors.successSoft };
        case 'warning':
            return { fill: colors.warning, onFill: colors.black, fg: colors.warning, soft: colors.warningSoft };
        case 'danger':
            return { fill: colors.error, onFill: colors.white, fg: colors.error, soft: colors.errorSoft };
        case 'neutral':
        default:
            return { fill: colors.text, onFill: colors.background, fg: colors.textSecondary, soft: colors.surfaceLight };
    }
}

/** Icons can be passed as a node, or as a function that receives the right color. */
export type IconProp = React.ReactNode | ((color: string) => React.ReactNode);

export const renderIcon = (icon: IconProp, color: string): React.ReactNode =>
    typeof icon === 'function' ? (icon as (c: string) => React.ReactNode)(color) : icon;
