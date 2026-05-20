import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme';
import { EXERCISES_DB, WEEKLY_SCHEDULE } from '../data/library';
import { useApp } from '../contexts/AppContext';
import { LibraryExercise, WorkoutSession } from '../types';
import { MissingApiKeyError, generateSmartWorkout } from '../services/gemini';

export default function TrainingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { goal, playFx } = useApp();

  const dayId = new Date().getDay();
  const dayInfo = WEEKLY_SCHEDULE[dayId];
  const baseExercises = EXERCISES_DB[dayId] || [];
  const isRest = baseExercises.length === 0;

  const [tutorial, setTutorial] = useState<LibraryExercise | null>(null);
  const [showGen, setShowGen] = useState(false);
  const [duration, setDuration] = useState('45');
  const [style, setStyle] = useState('Hypertrophie');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<WorkoutSession | null>(null);

  const startSession = (session: WorkoutSession) => {
    playFx('success');
    navigation.navigate('LiveWorkout', { session });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    playFx('click');
    try {
      const session = await generateSmartWorkout({
        duration,
        equipment: 'Salle complète',
        type: style,
        goal,
      });
      setGenerated(session);
      playFx('success');
    } catch (err: any) {
      playFx('error');
      Alert.alert(
        'IA indisponible',
        err instanceof MissingApiKeyError
          ? 'Configure ta clé Gemini dans Réglages.'
          : 'Erreur lors de la génération. Réessaie.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const startGenerated = () => {
    if (!generated) return;
    setShowGen(false);
    setGenerated(null);
    startSession(generated);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.title}>Entraînement</Text>
        <TouchableOpacity style={styles.aiBtn} onPress={() => setShowGen(true)}>
          <Ionicons name="sparkles" size={14} color={COLORS.blue} />
          <Text style={styles.aiBtnText}>SMART IA</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>COACHING ACTIF</Text>
          <Text style={styles.heroTitle}>{dayInfo.title}</Text>
          <Text style={styles.heroFocus}>⚡ {dayInfo.focus}</Text>

          {isRest ? (
            <View style={styles.restBox}>
              <Ionicons name="moon" size={32} color={COLORS.textMuted} />
              <Text style={styles.restText}>RÉCUPÉRATION NÉCESSAIRE</Text>
            </View>
          ) : (
            <>
              <View style={{ marginTop: SPACING.md }}>
                {baseExercises.slice(0, 4).map((ex, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.exRow}
                    onPress={() => {
                      playFx('click');
                      setTutorial(ex);
                    }}
                  >
                    <View style={styles.exLeft}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                    </View>
                    <Text style={styles.exMeta}>
                      {ex.sets} × {ex.reps}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.startBtn}
                onPress={() =>
                  startSession({
                    title: dayInfo.title,
                    focus: dayInfo.focus,
                    type: dayInfo.type,
                    exercises: baseExercises,
                  })
                }
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={18} color="#08110D" />
                <Text style={styles.startBtnText}>LANCER LA SÉANCE (+250 XP)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Weekly */}
        <Text style={styles.sectionTitle}>STRUCTURE HEBDOMADAIRE</Text>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const s = WEEKLY_SCHEDULE[d];
          const today = d === dayId;
          return (
            <View key={d} style={[styles.dayCard, today && styles.dayCardActive]}>
              <View style={[styles.dayBadge, today && styles.dayBadgeActive]}>
                <Text style={[styles.dayBadgeText, today && { color: '#08110D' }]}>
                  {s.dayName.slice(0, 3).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dayTitle, today && { color: COLORS.text }]} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={styles.dayType}>{s.type}</Text>
              </View>
              {today && <View style={styles.dot} />}
            </View>
          );
        })}
      </ScrollView>

      {/* Tutorial modal */}
      <Modal visible={!!tutorial} animationType="slide" onRequestClose={() => setTutorial(null)}>
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setTutorial(null)} hitSlop={10}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          {tutorial && (
            <ScrollView
              contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.tutorialIcon}>
                <Ionicons name="barbell" size={48} color={COLORS.primary} />
              </View>
              <Text style={styles.tutorialTitle}>{tutorial.name}</Text>
              <Text style={styles.tutorialMeta}>
                {tutorial.sets} SÉRIES · {tutorial.reps} REPS · {tutorial.rest}s REPOS
              </Text>

              {tutorial.setup && (
                <Section title="Installation" icon="locate">
                  <Text style={styles.bodyText}>{tutorial.setup}</Text>
                </Section>
              )}
              {tutorial.execution && (
                <Section title="Exécution" icon="play-circle">
                  <Text style={styles.bodyText}>{tutorial.execution}</Text>
                </Section>
              )}
              {tutorial.mistakes && tutorial.mistakes.length > 0 && (
                <Section title="Erreurs à éviter" icon="warning">
                  {tutorial.mistakes.map((m, i) => (
                    <Text key={i} style={styles.bullet}>• {m}</Text>
                  ))}
                </Section>
              )}
              {tutorial.goalSpecificTip && (
                <Section title={`Conseil — ${goal.toUpperCase()}`} icon="bulb">
                  <Text style={styles.bodyText}>"{tutorial.goalSpecificTip}"</Text>
                </Section>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* AI generator modal */}
      <Modal
        visible={showGen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowGen(false);
          setGenerated(null);
        }}
      >
        <View style={styles.genOverlay}>
          <View style={[styles.genCard, { paddingBottom: insets.bottom + SPACING.md }]}>
            <View style={styles.genHeader}>
              <Text style={styles.genTitle}>{generated ? 'PROGRAMME GÉNÉRÉ' : 'PROGRAMME IA'}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowGen(false);
                  setGenerated(null);
                }}
              >
                <Ionicons name="close" size={26} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {!generated ? (
              <>
                <Text style={styles.genLabel}>DURÉE</Text>
                <View style={styles.row}>
                  {['30', '45', '60'].map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.chip, duration === d && styles.chipActive]}
                      onPress={() => setDuration(d)}
                    >
                      <Text style={[styles.chipText, duration === d && { color: '#08110D' }]}>
                        {d} MIN
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.genLabel}>STYLE</Text>
                <View style={styles.row}>
                  {['Hypertrophie', 'Force', 'Conditionnement'].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, style === t && styles.chipActive]}
                      onPress={() => setStyle(t)}
                    >
                      <Text style={[styles.chipText, style === t && { color: '#08110D' }]}>
                        {t.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.genBtn}
                  onPress={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <ActivityIndicator color="#08110D" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color="#08110D" />
                      <Text style={styles.genBtnText}>GÉNÉRER</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.generatedTitle}>{generated.title}</Text>
                <Text style={styles.generatedFocus}>{generated.focus}</Text>
                <ScrollView style={{ maxHeight: 360, marginVertical: SPACING.md }}>
                  {generated.exercises.map((ex, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.generatedRow}
                      onPress={() => setTutorial(ex)}
                    >
                      <Text style={styles.generatedName} numberOfLines={1}>{ex.name}</Text>
                      <Text style={styles.generatedMeta}>
                        {ex.sets} × {ex.reps}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.genBtn} onPress={startGenerated}>
                  <Ionicons name="play" size={18} color="#08110D" />
                  <Text style={styles.genBtnText}>LANCER LA SÉANCE</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const Section: React.FC<{ title: string; icon: any; children: React.ReactNode }> = ({ title, icon, children }) => (
  <View style={{ marginTop: SPACING.lg }}>
    <View style={styles.sectionRow}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
      <Text style={styles.sectionLabel}>{title}</Text>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.blue}22`,
    borderColor: `${COLORS.blue}44`,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
  },
  aiBtnText: { color: COLORS.blue, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  hero: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroLabel: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: { color: COLORS.text, fontSize: 28, fontWeight: '900', marginTop: 6 },
  heroFocus: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginTop: 4, letterSpacing: 0.8 },

  restBox: {
    marginTop: SPACING.lg,
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  restText: {
    color: COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginTop: 8,
  },

  exRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  exLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  exName: { color: COLORS.text, fontSize: 13, fontWeight: '600', flex: 1 },
  exMeta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  startBtnText: { color: '#08110D', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },

  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  dayCardActive: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}11` },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeActive: { backgroundColor: COLORS.primary },
  dayBadgeText: { color: COLORS.textMuted, fontWeight: '800', fontSize: 11 },
  dayTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '800' },
  dayType: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },

  // tutorial modal
  modalRoot: { flex: 1, backgroundColor: COLORS.background },
  modalClose: {
    position: 'absolute',
    right: SPACING.md,
    top: SPACING.md,
    zIndex: 10,
    backgroundColor: COLORS.surface,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialIcon: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: RADIUS.xl,
    backgroundColor: `${COLORS.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  tutorialTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  tutorialMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 8,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionBody: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bodyText: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  bullet: { color: COLORS.text, fontSize: 13, marginBottom: 4 },

  // generator modal
  genOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  genCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  genHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  genTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  genLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: SPACING.md,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 11 },
  genBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  genBtnText: { color: '#08110D', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  generatedTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  generatedFocus: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
  generatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: 6,
  },
  generatedName: { color: COLORS.text, fontWeight: '700', flex: 1, marginRight: 8 },
  generatedMeta: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
});
