import React, { memo, useEffect, useMemo, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { getAnimation } from '../animations';
import { AnimSpec, Prim, Role, renderScene } from '../animations/rig';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

/** Redraw interval while animating (~30 fps). */
const FRAME_MS = 1000 / 30;

type Palette = Record<Role, string>;

/** Blend two #rrggbb colors (t = 0 → a, 1 → b). */
function mix(a: string, b: string, t: number): string {
    const pa = parseInt(a.slice(1, 7), 16);
    const pb = parseInt(b.slice(1, 7), 16);
    const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
    return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** Map the rig's color roles to theme colors, tuned for the surfaceLight background. */
function makePalette(c: ThemeColors, isDark: boolean): Palette {
    const bg = c.surfaceLight;
    const body = mix(c.text, bg, isDark ? 0.06 : 0.12);
    return {
        body,
        far: mix(body, bg, 0.55),
        hl: c.primary,
        hlFar: mix(c.primary, bg, 0.5),
        equip: c.textSecondary,
        equipLight: mix(c.textMuted, bg, isDark ? 0.4 : 0.6),
        plate: body,
        hub: mix(bg, body, 0.35),
        cable: c.textMuted,
        band: c.accent,
        ground: c.border,
    };
}

const paletteCache = new WeakMap<ThemeColors, Palette>();
function paletteFor(colors: ThemeColors, isDark: boolean): Palette {
    let p = paletteCache.get(colors);
    if (!p) {
        p = makePalette(colors, isDark);
        paletteCache.set(colors, p);
    }
    return p;
}

// Still frames don't change, so list thumbnails are computed once per exercise.
const thumbCache = new Map<AnimSpec, Prim[]>();
function thumbPrims(spec: AnimSpec): Prim[] {
    let prims = thumbCache.get(spec);
    if (!prims) {
        prims = renderScene(spec, 0, spec.frames[spec.thumb ?? 0] ?? spec.frames[0]);
        thumbCache.set(spec, prims);
    }
    return prims;
}

const pts = (list: [number, number][]) => list.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

function renderPrim(p: Prim, i: number, pal: Palette) {
    const color = pal[p.r];
    switch (p.t) {
        case 'l':
            return (
                <Line key={i} x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]}
                    stroke={color} strokeWidth={p.w} strokeLinecap="round" />
            );
        case 'c':
            return p.ring
                ? <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.rad} fill="none" stroke={color} strokeWidth={p.ring} />
                : <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.rad} fill={color} />;
        case 'p':
            return <Polygon key={i} points={pts(p.pts)} fill={color} />;
        case 'pl':
            return (
                <Polyline key={i} points={pts(p.pts)} fill="none" stroke={color}
                    strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" />
            );
    }
}

/** Elapsed time in ms, updated at ~30 fps with requestAnimationFrame while `running`. */
function useAnimationClock(running: boolean): number {
    const [time, setTime] = useState(0);
    useEffect(() => {
        if (!running) return;
        let raf = 0;
        let start = -1;
        let last = -Infinity;
        const tick = (now: number) => {
            if (start < 0) start = now;
            // Small tolerance so 60 Hz displays land on every other frame.
            if (now - last >= FRAME_MS - 3) {
                last = now;
                setTime(now - start);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [running]);
    return time;
}

interface ExerciseAnimationProps {
    exerciseId?: string | null;
    /** Use this spec instead of looking one up by exerciseId. */
    spec?: AnimSpec;
    /** Width and height in points. Defaults to filling the parent's width (square). */
    size?: number;
    /** Static thumbnail: draw the spec's `thumb` frame once, no animation. */
    thumbnail?: boolean;
    paused?: boolean;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
}

/**
 * Vector stick-figure animation of an exercise (see src/animations).
 * Renders nothing when the exercise has no animation.
 */
export const ExerciseAnimation = memo(function ExerciseAnimation({
    exerciseId,
    spec: specProp,
    size,
    thumbnail = false,
    paused = false,
    style,
    accessibilityLabel,
}: ExerciseAnimationProps) {
    const { colors, isDark } = useTheme();
    const spec = specProp ?? getAnimation(exerciseId);
    const animate = !!spec && !thumbnail && !paused && spec.frames.length > 1;
    const time = useAnimationClock(animate);
    const palette = paletteFor(colors, isDark);

    const prims = useMemo(() => {
        if (!spec) return null;
        return thumbnail ? thumbPrims(spec) : renderScene(spec, time);
    }, [spec, thumbnail, time]);

    if (!spec || !prims) return null;

    const box: ViewStyle = size ? { width: size, height: size } : { width: '100%', aspectRatio: 1 };
    return (
        <View
            style={[box, style]}
            accessible={!!accessibilityLabel}
            accessibilityRole={accessibilityLabel ? 'image' : undefined}
            accessibilityLabel={accessibilityLabel}
        >
            <Svg width="100%" height="100%" viewBox="0 0 200 200">
                {prims.map((p, i) => renderPrim(p, i, palette))}
            </Svg>
        </View>
    );
});
