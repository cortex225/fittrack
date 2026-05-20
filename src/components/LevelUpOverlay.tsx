import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../theme';
import { LEVELS } from '../data/library';

interface Props {
  level: number | null;
  onDismiss: () => void;
}

const LevelUpOverlay: React.FC<Props> = ({ level, onDismiss }) => {
  const data = LEVELS.find((l) => l.level === level);
  return (
    <Modal visible={level !== null} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Ionicons name="trophy" size={64} color={COLORS.accent} style={styles.icon} />
          <Text style={styles.label}>NIVEAU SUPÉRIEUR</Text>
          <Text style={styles.level}>NIV. {level}</Text>
          {data && <Text style={styles.name}>{data.name.toUpperCase()}</Text>}
          <Pressable style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>C'EST PARTI</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  icon: { marginBottom: SPACING.md },
  label: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },
  level: {
    color: COLORS.text,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 1,
  },
  name: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 1,
  },
  btn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    width: '100%',
    alignItems: 'center',
  },
  btnText: {
    color: '#101010',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
});

export default LevelUpOverlay;
