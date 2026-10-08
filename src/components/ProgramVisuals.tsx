import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BicepsFlexed, Dumbbell, Flame, Zap } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { Tone } from '../theme/tones';
import { WorkoutProgram } from '../types';

/** Theme tone for a program goal (keeps program cards inside the app palette). */
export const goalTone = (goal: WorkoutProgram['goal']): Tone =>
    goal === 'strength' ? 'primary' : goal === 'hypertrophy' ? 'secondary' : goal === 'fat_loss' ? 'accent' : 'success';

export const GoalIcon: React.FC<{ goal: WorkoutProgram['goal']; color: string; size?: number }> = ({ goal, color, size = 22 }) => {
    switch (goal) {
        case 'strength': return <Dumbbell color={color} size={size} />;
        case 'hypertrophy': return <BicepsFlexed color={color} size={size} />;
        case 'fat_loss': return <Flame color={color} size={size} />;
        default: return <Zap color={color} size={size} />;
    }
};

const LEVEL_DOTS: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };

/** Three small dots showing the program level (1 = beginner … 3 = advanced). */
export const LevelDots: React.FC<{ level: string }> = ({ level }) => {
    const { colors } = useTheme();
    const filled = LEVEL_DOTS[level] ?? 0;
    return (
        <View style={styles.dots}>
            {[1, 2, 3].map(i => (
                <View key={i} style={[styles.dot, { backgroundColor: i <= filled ? colors.primary : colors.border }]} />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    dots: {
        flexDirection: 'row',
        gap: 3,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
});
