import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { Glass, GlassCard } from './glass';
import { PressableScale } from './ui';

// Hydratation : une rangée de verres (250 ml chacun) dans une carte de verre.
// Toucher un verre remplit jusqu'à lui ; le bouton de remise à zéro vide tout.

const WATER = COLORS.blue;
const PORTION_ML = 250;

interface Props {
  waterMl: number;
  targetMl: number;
  /** Callback avec la nouvelle valeur totale en ml */
  onChange: (nextMl: number) => void;
  /** Permet de remettre à zéro via le bouton reset */
  onReset?: () => void;
}

const liters = (ml: number) => (ml / 1000).toFixed(1).replace('.', ',');

export default function HydrationStrip({ waterMl, targetMl, onChange, onReset }: Props) {
  // Nombre de verres calculé à partir de la cible, entre 6 et 12 pour rester lisible
  const totalCups = Math.min(12, Math.max(6, Math.round(targetMl / PORTION_ML)));
  const filled = Math.min(totalCups, Math.floor(waterMl / PORTION_ML));
  const partial = (waterMl % PORTION_ML) / PORTION_ML; // entre 0 et 1

  const handleTapCup = (index: number) => {
    // Verre i (à partir de 0) → on remplit jusqu'à i+1 portions.
    onChange((index + 1) * PORTION_ML);
  };

  return (
    <GlassCard>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="water-outline" size={20} color={WATER} />
            <Text style={styles.title}>Hydratation</Text>
          </View>
          <Text style={styles.valueLine}>
            <Text style={styles.value}>{liters(waterMl)}</Text>
            <Text style={styles.unit}> L sur {liters(targetMl)} L</Text>
          </Text>
        </View>
        {onReset && waterMl > 0 && (
          <PressableScale onPress={onReset} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remettre l'hydratation à zéro">
            <Glass radius={20} style={styles.resetBtn}>
              <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
            </Glass>
          </PressableScale>
        )}
      </View>

      <View style={styles.cupsRow}>
        {Array.from({ length: totalCups }).map((_, i) => {
          const isFull = i < filled;
          const isPartial = i === filled && partial > 0;
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.cup, pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
              onPress={() => handleTapCup(i)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Verre ${i + 1} sur ${totalCups}`}
            >
              <View style={styles.cupOuter}>
                <View
                  style={[
                    styles.cupFill,
                    { height: isFull ? '100%' : isPartial ? `${partial * 100}%` : '0%' },
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>Un verre = {PORTION_ML} ml. Touchez un verre pour ajuster.</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...TYPE.headline, color: COLORS.text },
  valueLine: { marginTop: SPACING.sm },
  value: { ...TYPE.number, fontSize: 28, color: COLORS.text },
  unit: { ...TYPE.callout, color: COLORS.textSecondary },
  resetBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  cupsRow: { flexDirection: 'row', gap: 6, marginTop: SPACING.md },
  cup: { flex: 1 },
  cupOuter: {
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: `${WATER}24`,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cupFill: { width: '100%', backgroundColor: WATER },

  hint: { ...TYPE.footnote, color: COLORS.textMuted, marginTop: SPACING.sm },
});
