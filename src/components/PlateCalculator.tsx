import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Typography } from './Typography';
import { Card } from './Card';
import { Button } from './Button';
import { colors, borderRadius, spacing } from '../theme/colors';
import { useTranslation } from 'react-i18next';

// Standard Olympic plates in kg (descending order)
const AVAILABLE_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 1, 0.5];

// Distinct colors for each plate size — visually matches real gym plates
const PLATE_COLORS: Record<number, string> = {
    25: '#E53935',   // Red
    20: '#1E88E5',   // Blue
    15: '#FDD835',   // Yellow
    10: '#43A047',   // Green
    5: '#F5F5F5',    // White
    2.5: '#E53935',  // Red (smaller)
    1.25: '#9E9E9E', // Silver/Grey
    1: '#1E88E5',    // Blue (small)
    0.5: '#43A047',  // Green (small)
};

const PLATE_TEXT_COLORS: Record<number, string> = {
    25: '#FFFFFF',
    20: '#FFFFFF',
    15: '#212121',
    10: '#FFFFFF',
    5: '#212121',
    2.5: '#FFFFFF',
    1.25: '#212121',
    1: '#FFFFFF',
    0.5: '#FFFFFF',
};

// Plate visual widths proportional to weight
const PLATE_WIDTHS: Record<number, number> = {
    25: 22,
    20: 20,
    15: 18,
    10: 16,
    5: 14,
    2.5: 10,
    1.25: 8,
    1: 8,
    0.5: 6,
};

// Plate visual heights proportional to weight
const PLATE_HEIGHTS: Record<number, number> = {
    25: 100,
    20: 92,
    15: 84,
    10: 76,
    5: 68,
    2.5: 56,
    1.25: 48,
    1: 42,
    0.5: 36,
};

interface PlateBreakdown {
    plate: number;
    count: number;
}

function calculatePlates(totalWeight: number, barWeight: number): PlateBreakdown[] {
    const weightPerSide = (totalWeight - barWeight) / 2;

    if (weightPerSide <= 0) return [];

    const plates: PlateBreakdown[] = [];
    let remaining = weightPerSide;

    for (const plate of AVAILABLE_PLATES) {
        if (remaining >= plate) {
            const count = Math.floor(remaining / plate);
            plates.push({ plate, count });
            remaining -= count * plate;
            remaining = Math.round(remaining * 100) / 100; // fix floating point
        }
    }

    return plates;
}

interface PlateCalculatorProps {
    visible: boolean;
    onClose: () => void;
    weight: number;
}

export const PlateCalculator: React.FC<PlateCalculatorProps> = ({ visible, onClose, weight }) => {
    const { t } = useTranslation();
    const [barWeight, setBarWeight] = useState(20);

    const BAR_OPTIONS = [20, 15, 10];

    const breakdown = useMemo(() => calculatePlates(weight, barWeight), [weight, barWeight]);

    const weightPerSide = Math.max(0, (weight - barWeight) / 2);
    const isExact = useMemo(() => {
        const reconstructed = barWeight + breakdown.reduce((a, b) => a + b.plate * b.count, 0) * 2;
        return Math.abs(reconstructed - weight) < 0.01;
    }, [breakdown, barWeight, weight]);

    // Build array of individual plates for the visual (left side, reversed for right)
    const platesPerSide: number[] = useMemo(() => {
        const result: number[] = [];
        breakdown.forEach(({ plate, count }) => {
            for (let i = 0; i < count; i++) {
                result.push(plate);
            }
        });
        return result;
    }, [breakdown]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Card variant="elevated" style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Typography variant="h2" style={{ marginBottom: 2 }}>
                                {t('plateCalculator.title')}
                            </Typography>
                            <Typography variant="caption">
                                {t('plateCalculator.subtitle')}
                            </Typography>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Typography variant="h3" color={colors.textMuted}>✕</Typography>
                        </TouchableOpacity>
                    </View>

                    {/* Weight Display */}
                    <View style={styles.weightDisplay}>
                        <Typography variant="number" style={styles.weightNumber}>
                            {weight}
                        </Typography>
                        <Typography variant="bodySmall" color={colors.textSecondary}>
                            {t('common.kg')}
                        </Typography>
                    </View>

                    {/* Bar Weight Selector */}
                    <View style={styles.barSection}>
                        <Typography variant="label" style={{ marginBottom: 8 }}>
                            {t('plateCalculator.barWeight')}
                        </Typography>
                        <View style={styles.barOptions}>
                            {BAR_OPTIONS.map(bw => (
                                <TouchableOpacity
                                    key={bw}
                                    style={[
                                        styles.barChip,
                                        barWeight === bw && styles.barChipActive,
                                    ]}
                                    onPress={() => setBarWeight(bw)}
                                    activeOpacity={0.7}
                                >
                                    <Typography
                                        variant="bodySmall"
                                        color={barWeight === bw ? colors.black : colors.textSecondary}
                                        bold={barWeight === bw}
                                    >
                                        {bw} {t('common.kg')}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Visual Barbell */}
                    {weight > barWeight ? (
                        <View style={styles.barbellContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.barbellScroll}
                            >
                                {/* Left sleeve */}
                                <View style={styles.sleeve} />

                                {/* Left plates (reversed so heaviest is inside) */}
                                <View style={styles.platesRow}>
                                    {[...platesPerSide].reverse().map((plate, i) => (
                                        <View
                                            key={`L-${i}`}
                                            style={[
                                                styles.plate,
                                                {
                                                    backgroundColor: PLATE_COLORS[plate],
                                                    width: PLATE_WIDTHS[plate],
                                                    height: PLATE_HEIGHTS[plate],
                                                },
                                            ]}
                                        >
                                            <Typography
                                                variant="label"
                                                color={PLATE_TEXT_COLORS[plate]}
                                                style={plate >= 5 ? styles.plateTextRotated : styles.plateText}
                                            >
                                                {plate}
                                            </Typography>
                                        </View>
                                    ))}
                                </View>

                                {/* Collar left */}
                                <View style={styles.collar} />

                                {/* Bar */}
                                <View style={styles.bar}>
                                    <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 9 }}>
                                        {barWeight}{t('common.kg')}
                                    </Typography>
                                </View>

                                {/* Collar right */}
                                <View style={styles.collar} />

                                {/* Right plates (normal order, heaviest inside) */}
                                <View style={styles.platesRow}>
                                    {platesPerSide.map((plate, i) => (
                                        <View
                                            key={`R-${i}`}
                                            style={[
                                                styles.plate,
                                                {
                                                    backgroundColor: PLATE_COLORS[plate],
                                                    width: PLATE_WIDTHS[plate],
                                                    height: PLATE_HEIGHTS[plate],
                                                },
                                            ]}
                                        >
                                            <Typography
                                                variant="label"
                                                color={PLATE_TEXT_COLORS[plate]}
                                                style={plate >= 5 ? styles.plateTextRotated : styles.plateText}
                                            >
                                                {plate}
                                            </Typography>
                                        </View>
                                    ))}
                                </View>

                                {/* Right sleeve */}
                                <View style={styles.sleeve} />
                            </ScrollView>
                        </View>
                    ) : (
                        <View style={styles.emptyBarbell}>
                            <Typography variant="body" color={colors.textMuted} align="center">
                                {t('plateCalculator.barOnly')}
                            </Typography>
                        </View>
                    )}

                    {/* Plate Breakdown List */}
                    {breakdown.length > 0 && (
                        <View style={styles.breakdownSection}>
                            <Typography variant="label" style={{ marginBottom: 8 }}>
                                {t('plateCalculator.perSide')} ({weightPerSide} {t('common.kg')})
                            </Typography>
                            <View style={styles.breakdownList}>
                                {breakdown.map(({ plate, count }) => (
                                    <View key={plate} style={styles.breakdownItem}>
                                        <View
                                            style={[
                                                styles.breakdownDot,
                                                { backgroundColor: PLATE_COLORS[plate] },
                                            ]}
                                        />
                                        <Typography variant="body" bold>
                                            {plate} {t('common.kg')}
                                        </Typography>
                                        <Typography variant="body" color={colors.textSecondary} style={{ marginLeft: 4 }}>
                                            × {count}
                                        </Typography>
                                    </View>
                                ))}
                            </View>

                            {!isExact && (
                                <View style={styles.warningBanner}>
                                    <Typography variant="caption" color={colors.warning}>
                                        ⚠️ {t('plateCalculator.notExact')}
                                    </Typography>
                                </View>
                            )}
                        </View>
                    )}

                    <Button
                        title={t('common.close')}
                        variant="outline"
                        onPress={onClose}
                        fullWidth
                        style={{ marginTop: 16 }}
                    />
                </Card>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    card: {
        padding: 20,
        marginBottom: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    closeBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    weightDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 6,
    },
    weightNumber: {
        fontSize: 42,
        fontWeight: '800',
        color: colors.primary,
        letterSpacing: -1,
    },
    barSection: {
        marginBottom: 20,
    },
    barOptions: {
        flexDirection: 'row',
        gap: 8,
    },
    barChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: borderRadius.m,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    barChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    barbellContainer: {
        marginBottom: 20,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        paddingVertical: 16,
        overflow: 'hidden',
    },
    barbellScroll: {
        alignItems: 'center',
        paddingHorizontal: 16,
        justifyContent: 'center',
        minWidth: '100%',
    },
    platesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    plate: {
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.15)',
    },
    plateText: {
        fontSize: 8,
        fontWeight: '800',
        textAlign: 'center',
    },
    plateTextRotated: {
        fontSize: 8,
        fontWeight: '800',
        textAlign: 'center',
        transform: [{ rotate: '-90deg' }],
    },
    bar: {
        height: 12,
        width: 60,
        backgroundColor: '#9E9E9E',
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    collar: {
        width: 8,
        height: 24,
        backgroundColor: '#757575',
        borderRadius: 2,
    },
    sleeve: {
        width: 24,
        height: 16,
        backgroundColor: '#BDBDBD',
        borderRadius: 3,
    },
    emptyBarbell: {
        paddingVertical: 24,
        marginBottom: 8,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
    },
    breakdownSection: {
        marginBottom: 4,
    },
    breakdownList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    breakdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: borderRadius.m,
        borderWidth: 1,
        borderColor: colors.border,
    },
    breakdownDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    warningBanner: {
        marginTop: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: colors.warning + '15',
        borderRadius: borderRadius.s,
        borderWidth: 1,
        borderColor: colors.warning + '30',
    },
});
