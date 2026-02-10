import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
    Path,
    Circle,
    Line,
    Text as SvgText,
    Defs,
    LinearGradient,
    Stop,
} from 'react-native-svg';
import { colors, borderRadius } from '../theme/colors';
import { Typography } from './Typography';

interface DataPoint {
    label: string;
    value: number;
}

interface ProgressChartProps {
    data: DataPoint[];
    width: number;
    height?: number;
    unit?: string;
    color?: string;
    gradientTo?: string;
}

export const ProgressChart: React.FC<ProgressChartProps> = ({
    data,
    width,
    height = 200,
    unit = 'kg',
    color = colors.primary,
    gradientTo = colors.secondary,
}) => {
    if (data.length === 0) {
        return (
            <View style={[styles.empty, { width, height }]}>
                <Typography variant="body" color={colors.textMuted} align="center">
                    No data to display yet.{'\n'}Log some workouts first!
                </Typography>
            </View>
        );
    }

    const paddingLeft = 48;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 36;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const yMin = Math.max(0, minVal - range * 0.15);
    const yMax = maxVal + range * 0.15;
    const yRange = yMax - yMin || 1;

    const getX = (index: number) => {
        if (data.length === 1) return paddingLeft + chartWidth / 2;
        return paddingLeft + (index / (data.length - 1)) * chartWidth;
    };

    const getY = (value: number) => {
        return paddingTop + chartHeight - ((value - yMin) / yRange) * chartHeight;
    };

    const points = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));

    // Build smooth bezier path
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const tension = 0.35;
        const cpx1 = prev.x + (curr.x - prev.x) * tension;
        const cpx2 = curr.x - (curr.x - prev.x) * tension;
        linePath += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    // Area fill
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight
        } L ${points[0].x} ${paddingTop + chartHeight} Z`;

    // Grid lines
    const gridCount = 4;
    const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
        const val = yMin + (i / gridCount) * yRange;
        return { y: getY(val), label: Math.round(val).toString() };
    });

    return (
        <View style={[styles.container, { width, height }]}>
            <Svg width={width} height={height}>
                <Defs>
                    <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity="0.25" />
                        <Stop offset="0.7" stopColor={color} stopOpacity="0.05" />
                        <Stop offset="1" stopColor={color} stopOpacity="0" />
                    </LinearGradient>
                    <LinearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={color} stopOpacity="1" />
                        <Stop offset="1" stopColor={gradientTo} stopOpacity="1" />
                    </LinearGradient>
                </Defs>

                {/* Horizontal grid */}
                {gridLines.map((line, i) => (
                    <React.Fragment key={`grid-${i}`}>
                        <Line
                            x1={paddingLeft}
                            y1={line.y}
                            x2={width - paddingRight}
                            y2={line.y}
                            stroke={colors.border}
                            strokeWidth={0.5}
                            opacity={0.5}
                        />
                        <SvgText
                            x={paddingLeft - 10}
                            y={line.y + 4}
                            fontSize={10}
                            fill={colors.textMuted}
                            textAnchor="end"
                            fontWeight="500"
                        >
                            {line.label}
                        </SvgText>
                    </React.Fragment>
                ))}

                {/* Area fill */}
                <Path d={areaPath} fill="url(#areaFill)" />

                {/* Line */}
                <Path
                    d={linePath}
                    stroke="url(#lineGradient)"
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Dots with glow */}
                {points.map((p, i) => (
                    <React.Fragment key={`dot-${i}`}>
                        <Circle cx={p.x} cy={p.y} r={8} fill={color} opacity={0.15} />
                        <Circle
                            cx={p.x}
                            cy={p.y}
                            r={4.5}
                            fill={colors.surface}
                            stroke={color}
                            strokeWidth={2.5}
                        />
                    </React.Fragment>
                ))}

                {/* X-axis labels */}
                {data.map((d, i) => {
                    const showLabel =
                        data.length <= 7 ||
                        i % Math.ceil(data.length / 6) === 0 ||
                        i === data.length - 1;
                    if (!showLabel) return null;
                    return (
                        <SvgText
                            key={`lbl-${i}`}
                            x={getX(i)}
                            y={height - 10}
                            fontSize={10}
                            fill={colors.textMuted}
                            textAnchor="middle"
                            fontWeight="500"
                        >
                            {d.label}
                        </SvgText>
                    );
                })}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    empty: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
});
