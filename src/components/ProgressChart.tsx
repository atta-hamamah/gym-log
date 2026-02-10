import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
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
    showDots?: boolean;
    showGrid?: boolean;
}

export const ProgressChart: React.FC<ProgressChartProps> = ({
    data,
    width,
    height = 200,
    unit = 'kg',
    color = colors.primary,
    showDots = true,
    showGrid = true,
}) => {
    if (data.length === 0) {
        return (
            <View style={[styles.empty, { width, height }]}>
                <Typography variant="body" color={colors.textSecondary}>
                    No data to display
                </Typography>
            </View>
        );
    }

    const paddingLeft = 45;
    const paddingRight = 16;
    const paddingTop = 16;
    const paddingBottom = 32;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    // Add some padding to the range
    const yMin = Math.max(0, minVal - range * 0.1);
    const yMax = maxVal + range * 0.1;
    const yRange = yMax - yMin || 1;

    const getX = (index: number) => {
        if (data.length === 1) return paddingLeft + chartWidth / 2;
        return paddingLeft + (index / (data.length - 1)) * chartWidth;
    };

    const getY = (value: number) => {
        return paddingTop + chartHeight - ((value - yMin) / yRange) * chartHeight;
    };

    // Build path
    const points = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        // Smooth bezier curves
        const prev = points[i - 1];
        const curr = points[i];
        const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
        const cpx2 = prev.x + (curr.x - prev.x) * 0.6;
        linePath += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    // Area fill path
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

    // Grid lines (3–4 horizontal)
    const gridCount = 4;
    const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
        const val = yMin + (i / gridCount) * yRange;
        return { y: getY(val), label: Math.round(val).toString() };
    });

    return (
        <View style={[styles.container, { width, height }]}>
            <Svg width={width} height={height}>
                <Defs>
                    <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity="0.3" />
                        <Stop offset="1" stopColor={color} stopOpacity="0.02" />
                    </LinearGradient>
                </Defs>

                {/* Grid lines */}
                {showGrid && gridLines.map((line, i) => (
                    <React.Fragment key={`grid-${i}`}>
                        <Line
                            x1={paddingLeft}
                            y1={line.y}
                            x2={width - paddingRight}
                            y2={line.y}
                            stroke={colors.border}
                            strokeWidth={0.5}
                            strokeDasharray="4,4"
                        />
                        <SvgText
                            x={paddingLeft - 8}
                            y={line.y + 4}
                            fontSize={10}
                            fill={colors.textSecondary}
                            textAnchor="end"
                        >
                            {line.label}
                        </SvgText>
                    </React.Fragment>
                ))}

                {/* Area fill */}
                <Path d={areaPath} fill="url(#areaGradient)" />

                {/* Line */}
                <Path
                    d={linePath}
                    stroke={color}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Dots */}
                {showDots && points.map((p, i) => (
                    <React.Fragment key={`dot-${i}`}>
                        <Circle cx={p.x} cy={p.y} r={5} fill={colors.surface} stroke={color} strokeWidth={2.5} />
                    </React.Fragment>
                ))}

                {/* X-axis labels */}
                {data.map((d, i) => {
                    // Show subset of labels if too many
                    const showLabel = data.length <= 6 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1;
                    if (!showLabel) return null;
                    return (
                        <SvgText
                            key={`label-${i}`}
                            x={getX(i)}
                            y={height - 8}
                            fontSize={10}
                            fill={colors.textSecondary}
                            textAnchor="middle"
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
        borderRadius: borderRadius.m,
        overflow: 'hidden',
    },
    empty: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.m,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
