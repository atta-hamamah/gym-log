import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { borderRadius } from '../theme/colors';
import { IconProp, Tone, renderIcon, toneColors } from '../theme/tones';

interface ListGroupProps {
    /** Small uppercase heading above the group. */
    title?: string;
    /** Muted note below the group. */
    footer?: string;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** Rounded card holding rows separated by inset hairlines (settings-style list). */
export const ListGroup: React.FC<ListGroupProps> = ({ title, footer, children, style }) => {
    const { colors } = useTheme();
    const rows = React.Children.toArray(children).filter(Boolean);
    return (
        <View style={[styles.groupWrap, style]}>
            {title ? <Text style={[styles.groupTitle, { color: colors.textMuted }]}>{title}</Text> : null}
            <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {rows.map((row, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <View style={[styles.separator, { backgroundColor: colors.border }]} />}
                        {row}
                    </React.Fragment>
                ))}
            </View>
            {footer ? <Text style={[styles.groupFooter, { color: colors.textMuted }]}>{footer}</Text> : null}
        </View>
    );
};

interface ListRowProps {
    title: string;
    subtitle?: string;
    icon?: IconProp;
    iconTone?: Tone;
    /** Value shown on the right, before the chevron. */
    value?: string;
    /** Custom right side (switch, badge...). Replaces value and chevron. */
    right?: React.ReactNode;
    onPress?: () => void;
    /** Red title and icon. */
    destructive?: boolean;
    disabled?: boolean;
    showChevron?: boolean;
}

/** One row of a ListGroup: tinted icon, title / subtitle, value or chevron. */
export const ListRow: React.FC<ListRowProps> = ({
    title,
    subtitle,
    icon,
    iconTone = 'primary',
    value,
    right,
    onPress,
    destructive,
    disabled,
    showChevron,
}) => {
    const { colors } = useTheme();
    const tone = toneColors(colors, destructive ? 'danger' : iconTone);
    const content = (
        <>
            {icon ? (
                <View style={[styles.iconBox, { backgroundColor: tone.soft }]}>{renderIcon(icon, tone.fg)}</View>
            ) : null}
            <View style={styles.texts}>
                <Text style={[styles.title, { color: destructive ? colors.error : colors.text }]} numberOfLines={1}>
                    {title}
                </Text>
                {subtitle ? (
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            {right ?? (
                <View style={styles.trailing}>
                    {value ? <Text style={[styles.value, { color: colors.textSecondary }]} numberOfLines={1}>{value}</Text> : null}
                    {(showChevron ?? !!onPress) && !destructive ? <ChevronRight color={colors.textMuted} size={18} /> : null}
                </View>
            )}
        </>
    );
    if (!onPress) return <View style={[styles.row, disabled && styles.disabled]}>{content}</View>;
    return (
        <TouchableOpacity
            style={[styles.row, disabled && styles.disabled]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.6}
            accessibilityRole="button"
        >
            {content}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    groupWrap: {
        marginBottom: 22,
    },
    groupTitle: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginLeft: 4,
        marginBottom: 8,
    },
    groupFooter: {
        fontSize: 12.5,
        lineHeight: 17,
        marginTop: 8,
        marginHorizontal: 4,
    },
    group: {
        borderRadius: borderRadius.l,
        borderWidth: 1,
        overflow: 'hidden',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 60,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 12,
    },
    iconBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '500',
    },
    subtitle: {
        fontSize: 12.5,
        lineHeight: 17,
        marginTop: 2,
    },
    trailing: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        maxWidth: '45%',
    },
    value: {
        fontSize: 14,
    },
    disabled: {
        opacity: 0.45,
    },
});
