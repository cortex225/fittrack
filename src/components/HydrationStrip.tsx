import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../theme';

// Strip horizontal de N gobelets. Tap = remplir jusqu'à ce gobelet.
// Long-press sur n'importe lequel = re-tap suffit pour ajouter une portion.

const WATER_BLUE = '#3B82F6';
const PORTION_ML = 250;

interface Props {
  waterMl: number;
  targetMl: number;
  /** Callback avec la nouvelle valeur totale en ml */
  onChange: (nextMl: number) => void;
  /** Permet de remettre à zéro via le bouton reset */
  onReset?: () => void;
}

export default function HydrationStrip({ waterMl, targetMl, onChange, onReset }: Props) {
  // Nombre de gobelets calculés à partir du target, plafonnés à 12 pour rester lisible
  const totalCups = Math.min(12, Math.max(6, Math.round(targetMl / PORTION_ML)));
  const cupSize = PORTION_ML; // chaque gobelet vaut 250ml
  const filled = Math.min(totalCups, Math.floor(waterMl / cupSize));
  const partial = (waterMl % cupSize) / cupSize; // entre 0 et 1
  const pct = Math.min(100, (waterMl / targetMl) * 100);

  const handleTapCup = (index: number) => {
    // Tap sur le gobelet i (0-indexed) → on remplit jusqu'à i+1 portions.
    const next = (index + 1) * cupSize;
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="water" size={14} color={WATER_BLUE} />
          <Text style={styles.title}>HYDRATATION</Text>
          <Text style={styles.value}>
            {(waterMl / 1000).toFixed(1)} <Text style={styles.unit}>L</Text>
            <Text style={styles.target}>  /  {(targetMl / 1000).toFixed(1)} L</Text>
          </Text>
        </View>
        {onReset && waterMl > 0 && (
          <Pressable onPress={onReset} hitSlop={8}>
            <Ionicons name="refresh" size={14} color={COLORS.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.cupsRow}>
        {Array.from({ length: totalCups }).map((_, i) => {
          const isFull = i < filled;
          const isPartial = i === filled && partial > 0;
          return (
            <Pressable
              key={i}
              style={styles.cup}
              onPress={() => handleTapCup(i)}
              hitSlop={4}
            >
              {/* Container du gobelet */}
              <View style={styles.cupOuter}>
                {/* Remplissage */}
                <View
                  style={[
                    styles.cupFill,
                    {
                      height: isFull ? '100%' : isPartial ? `${partial * 100}%` : '0%',
                      backgroundColor: WATER_BLUE,
                      opacity: isFull ? 1 : 0.7,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.cupLabel, (isFull || isPartial) && { color: WATER_BLUE, fontWeight: '900' }]}>
                {i + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  title: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, flex: 1 },
  value: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  unit: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  target: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },

  cupsRow: { flexDirection: 'row', gap: 4, alignItems: 'flex-end' },
  cup: { flex: 1, alignItems: 'center', gap: 2 },
  cupOuter: {
    width: '100%',
    height: 26,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cupFill: {
    width: '100%',
    borderRadius: RADIUS.sm - 1,
  },
  cupLabel: { color: COLORS.textMuted, fontSize: 8, fontWeight: '800' },

  barTrack: { height: 3, backgroundColor: COLORS.surface, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: WATER_BLUE },
});
