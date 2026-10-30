import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { LEVELS } from '../data/library';
import { Glass } from './glass';
import { PressableScale } from './ui';

interface Props {
  level: number | null;
  onDismiss: () => void;
}

const LevelUpOverlay: React.FC<Props> = ({ level, onDismiss }) => {
  const data = LEVELS.find((l) => l.level === level);
  return (
    <Modal visible={level !== null} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.cardWrap}>
          {/* Fond sous le verre : garde la carte lisible sur Android. */}
          <View style={styles.cardUnder} />
          <Glass radius={RADIUS.xl} style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="trophy-outline" size={30} color={COLORS.primary} />
            </View>
            <Text style={styles.label}>Niveau supérieur</Text>
            <Text style={styles.level}>Niveau {level}</Text>
            {data && <Text style={styles.name}>{data.name}</Text>}
            <PressableScale style={styles.btn} onPress={onDismiss} accessibilityRole="button">
              <Text style={styles.btnText}>C'est parti</Text>
            </PressableScale>
          </Glass>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  cardWrap: { width: '100%', maxWidth: 340 },
  cardUnder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(18,20,28,0.85)',
  },
  card: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  label: { ...TYPE.callout, color: COLORS.textSecondary },
  level: { ...TYPE.number, fontSize: 40, color: COLORS.text, marginTop: 2 },
  name: { ...TYPE.headline, color: COLORS.primary, marginTop: 2 },
  btn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    height: 50,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },
});

export default LevelUpOverlay;
