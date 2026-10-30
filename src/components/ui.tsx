// Briques d'interface de JL-Fit 2.0.
// Direction : sobre et vivante. Une seule couleur d'accent, de grandes
// surfaces arrondies, un retour au toucher (ressort + haptique) sur tout ce qui
// se presse, et des chiffres qui s'animent quand ils changent.
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { GlassCard } from './glass';

// ── PressableScale : ressort léger à l'appui ───────────────────────────────
interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children: React.ReactNode;
}

export const PressableScale: React.FC<PressableScaleProps> = ({
  style,
  scaleTo = 0.96,
  children,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        animate(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

// ── AnimatedNumber : compte jusqu'à la nouvelle valeur ─────────────────────
export const AnimatedNumber: React.FC<{
  value: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
  duration?: number;
}> = ({ value, style, suffix = '', duration = 500 }) => {
  const anim = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, anim, duration]);

  return (
    <Text style={style}>
      {display.toLocaleString('fr-CA')}
      {suffix}
    </Text>
  );
};

// ── Card ───────────────────────────────────────────────────────────────────
export const Card: React.FC<{ style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({
  style,
  children,
}) => <GlassCard style={style}>{children}</GlassCard>;

// ── SectionLabel ───────────────────────────────────────────────────────────
export const SectionLabel: React.FC<{ children: React.ReactNode; hint?: string }> = ({
  children,
  hint,
}) => (
  <View style={ui.sectionRow}>
    <Text style={ui.sectionLabel}>{children}</Text>
    {hint ? <Text style={ui.sectionHint}>{hint}</Text> : null}
  </View>
);

// ── Chip ───────────────────────────────────────────────────────────────────
// tone 'danger' = exclusion stricte (allergie), toujours avec un cadenas.
export const Chip: React.FC<{
  label: string;
  active?: boolean;
  tone?: 'default' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  onRemove?: () => void;
}> = ({ label, active, tone = 'default', icon, onPress, onRemove }) => {
  const danger = tone === 'danger';
  const bg = active ? (danger ? COLORS.dangerSoft : COLORS.primarySoft) : COLORS.surface;
  const border = active ? (danger ? COLORS.danger : COLORS.primary) : COLORS.border;
  const color = active ? (danger ? COLORS.danger : COLORS.primaryLight) : COLORS.textSecondary;
  const shownIcon = danger && active ? 'lock-closed' : icon;

  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress && !onRemove}
      style={[ui.chip, { backgroundColor: bg, borderColor: border }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {shownIcon ? <Ionicons name={shownIcon} size={13} color={color} /> : null}
      <Text style={[ui.chipText, { color }]}>{label}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Retirer ${label}`}>
          <Ionicons name="close" size={14} color={color} />
        </Pressable>
      ) : null}
    </PressableScale>
  );
};

// ── Segmented : choix unique avec pastille qui glisse ──────────────────────
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(index)).current;
  const segW = width / options.length;

  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
  }, [index, x]);

  return (
    <View style={ui.segment} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 && (
        <Animated.View
          style={[
            ui.segmentThumb,
            {
              width: segW,
              transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, segW] }) }],
            },
          ]}
        />
      )}
      {options.map((o) => (
        <Pressable
          key={o.value}
          style={ui.segmentItem}
          onPress={() => onChange(o.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
        >
          <Text style={[ui.segmentText, o.value === value && { color: COLORS.text }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Stepper : nombre ajusté au doigt ───────────────────────────────────────
export const Stepper: React.FC<{
  label: string;
  value: number;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  onChange: (v: number) => void;
}> = ({ label, value, unit, step = 1, min = 0, max = 999, decimals = 0, onChange }) => {
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(decimals))));
  return (
    <View style={ui.stepper}>
      <Text style={ui.stepperLabel}>{label}</Text>
      <View style={ui.stepperRow}>
        <PressableScale style={ui.stepperBtn} onPress={() => onChange(clamp(value - step))} accessibilityLabel={`Moins ${label}`}>
          <Ionicons name="remove" size={18} color={COLORS.text} />
        </PressableScale>
        <Text style={ui.stepperValue}>
          {value.toFixed(decimals)}
          <Text style={ui.stepperUnit}> {unit}</Text>
        </Text>
        <PressableScale style={ui.stepperBtn} onPress={() => onChange(clamp(value + step))} accessibilityLabel={`Plus ${label}`}>
          <Ionicons name="add" size={18} color={COLORS.text} />
        </PressableScale>
      </View>
    </View>
  );
};

export const ui = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderStrong,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  sectionLabel: { ...TYPE.overline, color: COLORS.textSecondary },
  sectionHint: { ...TYPE.caption, color: COLORS.textMuted },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  segmentThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardElevated,
  },
  segmentItem: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  stepper: { flex: 1 },
  stepperLabel: { ...TYPE.caption, color: COLORS.textMuted, marginBottom: 6 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardElevated,
  },
  stepperValue: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  stepperUnit: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
});
