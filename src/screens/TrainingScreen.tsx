import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme';
import { EXERCISES_DB, WEEKLY_SCHEDULE } from '../data/library';
import { useApp } from '../contexts/AppContext';
import { CustomWorkout, LibraryExercise, WorkoutSession } from '../types';
import { MissingApiKeyError, generateSmartWorkout } from '../services/gemini';
import {
  ALL_MUSCLES,
  Location,
  findExerciseById,
  muscleFR,
} from '../services/exercises';
import { ExerciseMuscle } from '../data/exercises';
import { AnimatedExerciseImage } from '../components/ExerciseCard';
import ExerciseDetailModal from '../components/ExerciseDetailModal';
import {
  customToSession,
  deleteCustomWorkout,
  duplicateCustomWorkout,
  getCustomWorkouts,
} from '../utils/storage';

export default function TrainingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { goal, playFx, profile } = useApp();

  const dayId = new Date().getDay();
  const dayInfo = WEEKLY_SCHEDULE[dayId];
  const baseExercises = EXERCISES_DB[dayId] || [];
  const isRest = baseExercises.length === 0;

  // Modal IA
  const [showGen, setShowGen] = useState(false);
  const [duration, setDuration] = useState('45');
  const [style, setStyle] = useState('Hypertrophie');
  const [location, setLocation] = useState<Location>('gym');
  const [targetMuscles, setTargetMuscles] = useState<ExerciseMuscle[]>([]);
  const [userIntent, setUserIntent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<WorkoutSession | null>(null);

  // Custom workouts
  const [customs, setCustoms] = useState<CustomWorkout[]>([]);

  // Détail d'exercice (modal global)
  const [activeExercise, setActiveExercise] = useState<LibraryExercise | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getCustomWorkouts().then((list) => {
        if (alive) setCustoms(list);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  const startSession = (session: WorkoutSession) => {
    playFx('success');
    navigation.navigate('LiveWorkout', { session });
  };

  const launchSuggestion = () =>
    startSession({
      title: dayInfo.title,
      focus: dayInfo.focus,
      type: dayInfo.type,
      exercises: baseExercises,
    });

  const toggleMuscle = (m: ExerciseMuscle) =>
    setTargetMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const handleGenerate = async () => {
    setGenerating(true);
    playFx('click');
    try {
      const session = await generateSmartWorkout({
        duration,
        equipment: location === 'home' ? 'Maison (poids du corps, haltères, élastiques)' : 'Salle complète',
        type: style,
        goal,
        profile,
        location,
        targetMuscles,
        userIntent: userIntent.trim() || undefined,
      });
      setGenerated(session);
      playFx('success');
    } catch (err: any) {
      console.error('[Gemini] generateSmartWorkout:', err);
      playFx('error');
      Alert.alert(
        'IA indisponible',
        err instanceof MissingApiKeyError
          ? 'Configure ta clé Gemini dans Réglages.'
          : `Erreur: ${err?.message ?? 'inconnue'}`
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

  const refreshCustoms = async () => setCustoms(await getCustomWorkouts());

  const handleDeleteCustom = (cw: CustomWorkout) => {
    Alert.alert('Supprimer cette séance ?', cw.name, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setCustoms(await deleteCustomWorkout(cw.id));
          playFx('success');
        },
      },
    ]);
  };

  const handleDuplicateCustom = async (cw: CustomWorkout) => {
    setCustoms(await duplicateCustomWorkout(cw.id));
    playFx('success');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Entraînement</Text>
          <Text style={styles.subtitle}>{dayInfo.dayName} · {dayInfo.focus}</Text>
        </View>
        <TouchableOpacity style={styles.libBtn} onPress={() => navigation.navigate('ExerciseLibrary')}>
          <Ionicons name="library-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.libBtnText}>EXOS</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── ACTIONS PRINCIPALES ─────────────────────────────────────── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCustom]}
            onPress={() => navigation.navigate('WorkoutBuilder')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary }]}>
              <Ionicons name="add" size={22} color="#08110D" />
            </View>
            <Text style={styles.actionTitle}>Créer ma séance</Text>
            <Text style={styles.actionSub}>Choisis tes exos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionIA]}
            onPress={() => setShowGen(true)}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.blue }]}>
              <Ionicons name="sparkles" size={20} color="#08110D" />
            </View>
            <Text style={styles.actionTitle}>Générer par IA</Text>
            <Text style={styles.actionSub}>Adapté à ton profil</Text>
          </TouchableOpacity>
        </View>

        {/* ─── MES SÉANCES ─────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MES SÉANCES ({customs.length})</Text>
          {customs.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('WorkoutBuilder')} hitSlop={8}>
              <Text style={styles.sectionAction}>+ NOUVELLE</Text>
            </TouchableOpacity>
          )}
        </View>

        {customs.length === 0 ? (
          <View style={styles.emptyCustom}>
            <Ionicons name="barbell-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyCustomText}>
              Aucune séance enregistrée. Crée-en une ou laisse l'IA t'en composer une.
            </Text>
          </View>
        ) : (
          customs.map((cw) => (
            <CustomWorkoutCard
              key={cw.id}
              workout={cw}
              onLaunch={() => startSession(customToSession(cw))}
              onEdit={() => navigation.navigate('WorkoutBuilder', { workout: cw })}
              onDuplicate={() => handleDuplicateCustom(cw)}
              onDelete={() => handleDeleteCustom(cw)}
              onTapExercise={(ex) => setActiveExercise(ex)}
            />
          ))
        )}

        {/* ─── SUGGESTION DU JOUR ───────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>SUGGESTION DU JOUR</Text>
        <View style={styles.suggestionCard}>
          <View style={styles.suggestionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionTitle}>{dayInfo.title}</Text>
              <Text style={styles.suggestionFocus}>⚡ {dayInfo.focus}</Text>
            </View>
            <View style={[styles.dayBadge, styles.dayBadgeActive]}>
              <Text style={[styles.dayBadgeText, { color: '#08110D' }]}>
                {dayInfo.dayName.slice(0, 3).toUpperCase()}
              </Text>
            </View>
          </View>

          {isRest ? (
            <View style={styles.restBox}>
              <Ionicons name="moon" size={28} color={COLORS.textMuted} />
              <Text style={styles.restText}>RÉCUPÉRATION</Text>
            </View>
          ) : (
            <>
              <View style={{ marginTop: SPACING.sm }}>
                {baseExercises.slice(0, 4).map((ex, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.exRow}
                    onPress={() => setActiveExercise(ex)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.exLeft}>
                      <Ionicons name="ellipse" size={5} color={COLORS.primary} />
                      <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                    </View>
                    <Text style={styles.exMeta}>{ex.sets} × {ex.reps}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.startBtn} onPress={launchSuggestion} activeOpacity={0.85}>
                <Ionicons name="play" size={16} color="#08110D" />
                <Text style={styles.startBtnText}>LANCER (+250 XP)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ─── PLANNING HEBDO ──────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>STRUCTURE HEBDOMADAIRE</Text>
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
                <Text style={[styles.dayTitle, today && { color: COLORS.text }]} numberOfLines={1}>{s.title}</Text>
                <Text style={styles.dayType}>{s.type}</Text>
              </View>
              {today && <View style={styles.dot} />}
            </View>
          );
        })}
      </ScrollView>

      {/* ─── MODAL IA ──────────────────────────────────────────────────── */}
      {/* Modal détail d'exercice (réutilisé partout) */}
      <ExerciseDetailModal
        visible={!!activeExercise}
        onClose={() => setActiveExercise(null)}
        libraryExercise={activeExercise}
      />

      <AIGeneratorModal
        visible={showGen}
        onClose={() => {
          setShowGen(false);
          setGenerated(null);
        }}
        onTapExercise={(ex) => setActiveExercise(ex)}
        duration={duration}
        setDuration={setDuration}
        style={style}
        setStyle={setStyle}
        location={location}
        setLocation={setLocation}
        targetMuscles={targetMuscles}
        toggleMuscle={toggleMuscle}
        userIntent={userIntent}
        setUserIntent={setUserIntent}
        generating={generating}
        generated={generated}
        onGenerate={handleGenerate}
        onLaunch={startGenerated}
        onSaveAsCustom={async () => {
          if (!generated) return;
          navigation.navigate('WorkoutBuilder', {
            workout: {
              id: '', // sera regénéré
              name: generated.title,
              focus: generated.focus,
              exercises: generated.exercises,
              createdAt: '',
              updatedAt: '',
            } satisfies CustomWorkout,
          });
          setShowGen(false);
          setGenerated(null);
          await refreshCustoms();
        }}
      />
    </View>
  );
}

// ── Card pour chaque séance perso ──────────────────────────────────────────
function CustomWorkoutCard({
  workout,
  onLaunch,
  onEdit,
  onDuplicate,
  onDelete,
  onTapExercise,
}: {
  workout: CustomWorkout;
  onLaunch: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTapExercise: (ex: LibraryExercise) => void;
}) {
  // Affiche les 3 premiers exos avec leur thumbnail si dispo
  const previewExos = workout.exercises.slice(0, 3);
  const moreCount = Math.max(0, workout.exercises.length - 3);

  return (
    <View style={styles.customCard}>
      <View style={styles.customHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.customName} numberOfLines={1}>{workout.name}</Text>
          <Text style={styles.customMeta}>
            {workout.focus} · {workout.exercises.length} exo{workout.exercises.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.previewRow}>
        {previewExos.map((ex, i) => {
          const cat = ex.exerciseId ? findExerciseById(ex.exerciseId) : undefined;
          return (
            <TouchableOpacity
              key={i}
              style={styles.previewThumb}
              onPress={() => onTapExercise(ex)}
              activeOpacity={0.7}
            >
              {cat ? (
                <AnimatedExerciseImage exercise={cat} height={56} rounded />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Ionicons name="barbell-outline" size={20} color={COLORS.textMuted} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        {moreCount > 0 && (
          <View style={[styles.previewThumb, styles.previewMore]}>
            <Text style={styles.previewMoreText}>+{moreCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.customActions}>
        <TouchableOpacity style={[styles.customAction, styles.customActionMain]} onPress={onLaunch}>
          <Ionicons name="play" size={14} color="#08110D" />
          <Text style={styles.customActionMainText}>LANCER</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.customActionIcon} onPress={onEdit} hitSlop={6}>
          <Ionicons name="create-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.customActionIcon} onPress={onDuplicate} hitSlop={6}>
          <Ionicons name="copy-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.customActionIcon} onPress={onDelete} hitSlop={6}>
          <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Modal IA réutilisable ──────────────────────────────────────────────────
function AIGeneratorModal({
  visible,
  onClose,
  duration, setDuration,
  style: styleProp, setStyle,
  location, setLocation,
  targetMuscles, toggleMuscle,
  userIntent, setUserIntent,
  generating, generated,
  onGenerate, onLaunch,
  onSaveAsCustom,
  onTapExercise,
}: {
  visible: boolean;
  onClose: () => void;
  duration: string; setDuration: (v: string) => void;
  style: string; setStyle: (v: string) => void;
  location: Location; setLocation: (v: Location) => void;
  targetMuscles: ExerciseMuscle[]; toggleMuscle: (m: ExerciseMuscle) => void;
  userIntent: string; setUserIntent: (v: string) => void;
  generating: boolean; generated: WorkoutSession | null;
  onGenerate: () => void; onLaunch: () => void;
  onSaveAsCustom: () => void;
  onTapExercise: (ex: LibraryExercise) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.genOverlay}>
        <View style={[styles.genCard, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.genHeader}>
            <Text style={styles.genTitle}>{generated ? 'PROGRAMME GÉNÉRÉ' : 'PROGRAMME IA'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {!generated ? (
            <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.genLabel}>LIEU</Text>
              <View style={styles.row}>
                {([
                  { key: 'home', label: 'MAISON', icon: 'home' as const },
                  { key: 'gym',  label: 'SALLE',  icon: 'barbell' as const },
                  { key: 'any',  label: 'TOUT',   icon: 'apps' as const },
                ] satisfies { key: Location; label: string; icon: keyof typeof Ionicons.glyphMap }[]).map((opt) => {
                  const active = location === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.chip, active && styles.chipActive, { flexDirection: 'row', gap: 6 }]}
                      onPress={() => setLocation(opt.key)}
                    >
                      <Ionicons name={opt.icon} size={12} color={active ? '#08110D' : COLORS.textSecondary} />
                      <Text style={[styles.chipText, active && { color: '#08110D' }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.genLabel}>DURÉE</Text>
              <View style={styles.row}>
                {['30', '45', '60'].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, duration === d && styles.chipActive]}
                    onPress={() => setDuration(d)}
                  >
                    <Text style={[styles.chipText, duration === d && { color: '#08110D' }]}>{d} MIN</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.genLabel}>STYLE</Text>
              <View style={styles.row}>
                {['Hypertrophie', 'Force', 'Conditionnement'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, styleProp === t && styles.chipActive]}
                    onPress={() => setStyle(t)}
                  >
                    <Text style={[styles.chipText, styleProp === t && { color: '#08110D' }]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.genLabel}>MUSCLES CIBLES (optionnel)</Text>
              <View style={styles.musclesWrap}>
                {ALL_MUSCLES.map((m) => {
                  const active = targetMuscles.includes(m);
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.muscleChip, active && styles.chipActive]}
                      onPress={() => toggleMuscle(m)}
                    >
                      <Text style={[styles.chipText, active && { color: '#08110D' }]}>{muscleFR(m)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.genLabel}>DEMANDE LIBRE (optionnel)</Text>
              <TextInput
                style={styles.intentInput}
                value={userIntent}
                onChangeText={setUserIntent}
                placeholder="ex. Je veux brûler des calories, j'ai mal au dos donc évite les charges lourdes, j'ai seulement 20 min..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                maxLength={280}
              />
              <Text style={styles.intentHint}>L'IA prendra cette demande comme prioritaire.</Text>

              <TouchableOpacity style={styles.genBtn} onPress={onGenerate} disabled={generating}>
                {generating ? (
                  <ActivityIndicator color="#08110D" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#08110D" />
                    <Text style={styles.genBtnText}>GÉNÉRER</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <>
              <Text style={styles.generatedTitle}>{generated.title}</Text>
              <Text style={styles.generatedFocus}>{generated.focus}</Text>
              <ScrollView style={{ maxHeight: 360, marginVertical: SPACING.md }}>
                {generated.exercises.map((ex, i) => {
                  const cat = ex.exerciseId ? findExerciseById(ex.exerciseId) : undefined;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={styles.generatedRow}
                      onPress={() => onTapExercise(ex)}
                      activeOpacity={0.7}
                    >
                      {cat ? (
                        <View style={styles.thumbWrap}>
                          <AnimatedExerciseImage exercise={cat} height={48} rounded />
                        </View>
                      ) : (
                        <View style={[styles.thumbWrap, styles.previewPlaceholder]}>
                          <Ionicons name="barbell-outline" size={18} color={COLORS.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.generatedName} numberOfLines={1}>{ex.name}</Text>
                        {cat && (
                          <Text style={styles.generatedMuscles} numberOfLines={1}>
                            {cat.primaryMuscles.map(muscleFR).join(' · ')}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.generatedMeta}>{ex.sets} × {ex.reps}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={onSaveAsCustom}>
                  <Ionicons name="bookmark-outline" size={16} color={COLORS.text} />
                  <Text style={styles.secondaryBtnText}>ÉDITER</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.genBtn, { flex: 2, marginTop: 0 }]} onPress={onLaunch}>
                  <Ionicons name="play" size={18} color="#08110D" />
                  <Text style={styles.genBtnText}>LANCER</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

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
  subtitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  libBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
  },
  libBtnText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  // Actions principales (créer/IA)
  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  actionCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: COLORS.card,
    gap: 6,
  },
  actionCustom: { borderColor: `${COLORS.primary}55` },
  actionIA: { borderColor: `${COLORS.blue}55` },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { color: COLORS.text, fontWeight: '900', fontSize: 14, marginTop: 4 },
  actionSub: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  sectionTitle: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: SPACING.sm },
  sectionAction: { color: COLORS.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  // Mes séances
  emptyCustom: {
    alignItems: 'center',
    gap: 8,
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyCustomText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },

  customCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  customHead: { flexDirection: 'row', alignItems: 'center' },
  customName: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  customMeta: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },

  previewRow: { flexDirection: 'row', gap: 6 },
  previewThumb: { width: 56, height: 56, borderRadius: RADIUS.md, overflow: 'hidden' },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMore: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMoreText: { color: COLORS.textSecondary, fontWeight: '900', fontSize: 13 },

  customActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customActionMain: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
  },
  customActionMainText: { color: '#08110D', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  customActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Suggestion du jour
  suggestionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  suggestionFocus: { color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 2 },

  restBox: {
    marginTop: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    gap: 6,
  },
  restText: { color: COLORS.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },

  exRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  startBtnText: { color: '#08110D', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  // Hebdo
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 6,
  },
  dayCardActive: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}11` },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeActive: { backgroundColor: COLORS.primary },
  dayBadgeText: { color: COLORS.textMuted, fontWeight: '800', fontSize: 10 },
  dayTitle: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '800' },
  dayType: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },

  // Modal IA
  genOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  genCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  genHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
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
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  musclesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
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

  secondaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: '800', fontSize: 12, letterSpacing: 0.8 },

  intentInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  intentHint: { color: COLORS.textMuted, fontSize: 10, marginTop: 4, fontStyle: 'italic' },

  generatedTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  generatedFocus: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
  generatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: 6,
  },
  thumbWrap: { width: 48, height: 48, borderRadius: RADIUS.md, overflow: 'hidden' },
  generatedName: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
  generatedMuscles: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  generatedMeta: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
});
