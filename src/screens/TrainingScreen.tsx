import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Modal } from '../components/Modal';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import {
  DAY_NAMES,
  DEFAULT_PROGRAM_DAYS,
  ProgramDays,
  SessionKey,
  UPPER_LOWER_4,
  nextSession,
  sessionForDay,
} from '../data/programs';
import { Chip, PressableScale, Segmented } from '../components/ui';
import { Glass, GlassCard } from '../components/glass';
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
  getProgramDays,
  saveProgramDays,
} from '../utils/storage';

export default function TrainingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { goal, playFx, profile } = useApp();

  const dayId = new Date().getDay();
  // Programme haut / bas 4 jours : la séance du jour dépend des jours choisis.
  const [programDays, setProgramDays] = useState<ProgramDays>(DEFAULT_PROGRAM_DAYS);
  const [daysOpen, setDaysOpen] = useState(false);
  const todaySession = sessionForDay(dayId, programDays);
  const upcoming = nextSession(dayId, programDays);
  const dayInfo = todaySession
    ? { dayName: DAY_NAMES[dayId], title: todaySession.title, focus: todaySession.focus, type: 'Musculation' }
    : {
        dayName: DAY_NAMES[dayId],
        title: 'Repos',
        focus: upcoming ? `Prochaine séance : ${upcoming.session.title}, ${DAY_NAMES[upcoming.day].toLowerCase()}` : 'Récupération',
        type: 'Repos',
      };
  const baseExercises = todaySession?.exercises ?? [];
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
      getProgramDays().then((d) => {
        if (alive) setProgramDays(d);
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

  const moreToday = Math.max(0, baseExercises.length - 4);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── En-tête ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Entraînement</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Double progression, charge proposée à chaque série
            </Text>
          </View>
          <IconButton
            icon="library-outline"
            label="Bibliothèque d'exercices"
            onPress={() => navigation.navigate('ExerciseLibrary')}
          />
        </View>

        {/* ─── Séance du jour ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Séance du jour</Text>
        <GlassCard>
          <Text style={styles.todayKicker}>{isRest ? dayInfo.dayName : `${dayInfo.dayName} · ${dayInfo.type}`}</Text>
          <Text style={styles.todayTitle}>{dayInfo.title}</Text>
          <Text style={styles.todayFocus}>{dayInfo.focus}</Text>

          {isRest ? (
            <View style={styles.restBox}>
              <View style={styles.restIcon}>
                <Ionicons name="moon-outline" size={22} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.restText}>Jour de récupération. Laisse tes muscles se reconstruire.</Text>
              {upcoming && (
                <View style={{ alignSelf: 'stretch', marginTop: SPACING.md }}>
                  <PressableScale
                    style={styles.primaryBtn}
                    onPress={() =>
                      startSession({
                        title: upcoming.session.title,
                        focus: upcoming.session.focus,
                        type: 'Musculation',
                        exercises: upcoming.session.exercises,
                      })
                    }
                    accessibilityRole="button"
                  >
                    <Ionicons name="play" size={16} color={COLORS.onPrimary} />
                    <Text style={styles.primaryBtnText} numberOfLines={1}>
                      Faire {upcoming.session.title} maintenant
                    </Text>
                  </PressableScale>
                </View>
              )}
            </View>
          ) : (
            <>
              <View style={styles.exList}>
                {baseExercises.slice(0, 4).map((ex, i) => (
                  <View key={i}>
                    <View style={styles.hairline} />
                    <PressableScale
                      style={styles.exRow}
                      onPress={() => setActiveExercise(ex)}
                      scaleTo={0.98}
                      accessibilityRole="button"
                    >
                      <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                      <Text style={styles.exMeta}>{ex.sets} × {ex.reps}</Text>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                    </PressableScale>
                  </View>
                ))}
                {moreToday > 0 && (
                  <>
                    <View style={styles.hairline} />
                    <Text style={styles.moreText}>
                      et {moreToday} autre{moreToday > 1 ? 's' : ''} exercice{moreToday > 1 ? 's' : ''}
                    </Text>
                  </>
                )}
              </View>
              <PressableScale style={[styles.primaryBtn, { marginTop: SPACING.md }]} onPress={launchSuggestion} accessibilityRole="button">
                <Ionicons name="play" size={16} color={COLORS.onPrimary} />
                <Text style={styles.primaryBtnText}>Lancer la séance</Text>
              </PressableScale>
              <Text style={styles.xpHint}>+250 XP à la fin de la séance</Text>
            </>
          )}
        </GlassCard>

        {/* ─── Créer / générer ─────────────────────────────────────────── */}
        <View style={styles.actionsRow}>
          <View style={{ flex: 1 }}>
            <PressableScale onPress={() => navigation.navigate('WorkoutBuilder')} accessibilityRole="button">
              <GlassCard style={styles.actionCard} padding={SPACING.md}>
                <View style={styles.actionIcon}>
                  <Ionicons name="add" size={22} color={COLORS.primary} />
                </View>
                <Text style={styles.actionTitle}>Créer ma séance</Text>
                <Text style={styles.actionSub}>Choisis tes exercices</Text>
              </GlassCard>
            </PressableScale>
          </View>
          <View style={{ flex: 1 }}>
            <PressableScale onPress={() => setShowGen(true)} accessibilityRole="button">
              <GlassCard style={styles.actionCard} padding={SPACING.md}>
                <View style={styles.actionIcon}>
                  <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.actionTitle}>Générer par IA</Text>
                <Text style={styles.actionSub}>Adaptée à ton profil</Text>
              </GlassCard>
            </PressableScale>
          </View>
        </View>

        {/* ─── Mes séances ─────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
            Mes séances{customs.length > 0 ? <Text style={styles.sectionCount}>  {customs.length}</Text> : null}
          </Text>
          {customs.length > 0 && (
            <PressableScale onPress={() => navigation.navigate('WorkoutBuilder')} hitSlop={8} accessibilityRole="button">
              <Text style={styles.sectionAction}>Nouvelle</Text>
            </PressableScale>
          )}
        </View>

        {customs.length === 0 ? (
          <GlassCard style={styles.emptyCustom}>
            <Ionicons name="barbell-outline" size={26} color={COLORS.textMuted} />
            <Text style={styles.emptyCustomText}>
              Aucune séance enregistrée. Crée-en une ou laisse l'IA t'en composer une.
            </Text>
          </GlassCard>
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

        {/* ─── Planning hebdo ──────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Ta semaine</Text>
            <Text style={styles.sectionHint}>Haut / bas, 4 jours</Text>
          </View>
          <PressableScale onPress={() => setDaysOpen(true)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.sectionAction}>Modifier les jours</Text>
          </PressableScale>
        </View>
        <Glass radius={RADIUS.xl} style={styles.weekCard}>
          {[1, 2, 3, 4, 5, 6, 0].map((d, idx) => {
            const session = sessionForDay(d, programDays);
            const s = {
              dayName: DAY_NAMES[d],
              title: session ? `${session.title} · ${session.focus}` : 'Repos',
              type: session ? 'Musculation' : 'Récupération',
            };
            const today = d === dayId;
            return (
              <View key={d}>
                {idx > 0 && <View style={[styles.hairline, { marginLeft: 72 }]} />}
                <View style={styles.dayRow}>
                  <View style={[styles.dayBadge, today && styles.dayBadgeActive]}>
                    <Text style={[styles.dayBadgeText, today && { color: COLORS.onPrimary }]}>
                      {s.dayName.slice(0, 3)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayTitle, !session && { color: COLORS.textSecondary }]} numberOfLines={1}>
                      {s.title}
                    </Text>
                    <Text style={styles.dayType}>{today ? `Aujourd'hui · ${s.type}` : s.type}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </Glass>
      </ScrollView>

      {/* ─── Jours du programme ─────────────────────────────────────────── */}
      <Modal visible={daysOpen} transparent animationType="slide" onRequestClose={() => setDaysOpen(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setDaysOpen(false)}>
          <Pressable onPress={() => {}} style={styles.sheetBacking}>
            <Glass radius={RADIUS.xl} style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
              <View style={styles.grabber} />
              <Text style={styles.sheetTitle}>Tes jours d'entraînement</Text>
              <Text style={styles.sheetSub}>Choisis le jour de chaque séance du programme haut / bas.</Text>
              {(Object.keys(UPPER_LOWER_4) as SessionKey[]).map((key) => (
                <View key={key} style={{ marginTop: SPACING.lg }}>
                  <Text style={styles.daysLabel}>
                    {UPPER_LOWER_4[key].title}
                    <Text style={styles.daysLabelMuted}> · {UPPER_LOWER_4[key].focus}</Text>
                  </Text>
                  <View style={styles.daysRow}>
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <Chip
                        key={d}
                        label={DAY_NAMES[d].slice(0, 3)}
                        active={programDays[key] === d}
                        onPress={async () => {
                          const next = { ...programDays, [key]: d };
                          setProgramDays(next);
                          await saveProgramDays(next);
                          playFx('click');
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
              <PressableScale style={[styles.primaryBtn, { marginTop: SPACING.xl }]} onPress={() => setDaysOpen(false)} accessibilityRole="button">
                <Text style={styles.primaryBtnText}>Terminé</Text>
              </PressableScale>
            </Glass>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal détail d'exercice (réutilisé partout) */}
      <ExerciseDetailModal
        visible={!!activeExercise}
        onClose={() => setActiveExercise(null)}
        libraryExercise={activeExercise}
      />

      {/* ─── Modal IA ──────────────────────────────────────────────────── */}
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

// ── Bouton icône rond en verre ─────────────────────────────────────────────
function IconButton({
  icon,
  label,
  onPress,
  color = COLORS.text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <PressableScale onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <Glass radius={20} style={styles.iconBtn}>
        <Ionicons name={icon} size={19} color={color} />
      </Glass>
    </PressableScale>
  );
}

// ── Carte pour chaque séance perso ─────────────────────────────────────────
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
  // Affiche les 3 premiers exos avec leur vignette si dispo
  const previewExos = workout.exercises.slice(0, 3);
  const moreCount = Math.max(0, workout.exercises.length - 3);

  return (
    <GlassCard style={styles.customCard}>
      <Text style={styles.customName} numberOfLines={1}>{workout.name}</Text>
      <Text style={styles.customMeta}>
        {workout.focus} · {workout.exercises.length} exercice{workout.exercises.length > 1 ? 's' : ''}
      </Text>

      <View style={styles.previewRow}>
        {previewExos.map((ex, i) => {
          const cat = ex.exerciseId ? findExerciseById(ex.exerciseId) : undefined;
          return (
            <PressableScale
              key={i}
              style={styles.previewThumb}
              onPress={() => onTapExercise(ex)}
              accessibilityRole="button"
              accessibilityLabel={ex.name}
            >
              {cat ? (
                <AnimatedExerciseImage exercise={cat} height={56} rounded />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Ionicons name="barbell-outline" size={20} color={COLORS.textMuted} />
                </View>
              )}
            </PressableScale>
          );
        })}
        {moreCount > 0 && (
          <View style={[styles.previewThumb, styles.previewMore]}>
            <Text style={styles.previewMoreText}>+{moreCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.customActions}>
        <View style={{ flex: 1 }}>
          <PressableScale style={styles.primaryBtnSmall} onPress={onLaunch} accessibilityRole="button">
            <Ionicons name="play" size={14} color={COLORS.onPrimary} />
            <Text style={styles.primaryBtnText}>Lancer</Text>
          </PressableScale>
        </View>
        <IconButton icon="create-outline" label="Modifier" onPress={onEdit} />
        <IconButton icon="copy-outline" label="Dupliquer" onPress={onDuplicate} />
        <IconButton icon="trash-outline" label="Supprimer" onPress={onDelete} color={COLORS.danger} />
      </View>
    </GlassCard>
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
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetBacking}>
          <Glass radius={RADIUS.xl} style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
            <View style={styles.grabber} />
            <View style={styles.genHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{generated ? 'Programme généré' : 'Programme IA'}</Text>
                {!generated && <Text style={styles.sheetSub}>Une séance composée pour toi en quelques secondes.</Text>}
              </View>
              <IconButton icon="close" label="Fermer" onPress={onClose} />
            </View>

            {!generated ? (
              <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.genLabel}>Lieu</Text>
                <Segmented
                  options={[
                    { value: 'home' as Location, label: 'Maison' },
                    { value: 'gym' as Location, label: 'Salle' },
                    { value: 'any' as Location, label: 'Tout' },
                  ]}
                  value={location}
                  onChange={setLocation}
                />

                <Text style={styles.genLabel}>Durée</Text>
                <Segmented
                  options={['30', '45', '60'].map((d) => ({ value: d, label: `${d} min` }))}
                  value={duration}
                  onChange={setDuration}
                />

                <Text style={styles.genLabel}>Style</Text>
                <View style={styles.chipsWrap}>
                  {['Hypertrophie', 'Force', 'Conditionnement'].map((t) => (
                    <Chip key={t} label={t} active={styleProp === t} onPress={() => setStyle(t)} />
                  ))}
                </View>

                <Text style={styles.genLabel}>Muscles ciblés (facultatif)</Text>
                <View style={styles.chipsWrap}>
                  {ALL_MUSCLES.map((m) => (
                    <Chip key={m} label={muscleFR(m)} active={targetMuscles.includes(m)} onPress={() => toggleMuscle(m)} />
                  ))}
                </View>

                <Text style={styles.genLabel}>Demande libre (facultatif)</Text>
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

                <PressableScale
                  style={[styles.primaryBtn, { marginTop: SPACING.lg }, generating && { opacity: 0.7 }]}
                  onPress={onGenerate}
                  disabled={generating}
                  accessibilityRole="button"
                >
                  {generating ? (
                    <ActivityIndicator color={COLORS.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={18} color={COLORS.onPrimary} />
                      <Text style={styles.primaryBtnText}>Générer</Text>
                    </>
                  )}
                </PressableScale>
              </ScrollView>
            ) : (
              <>
                <Text style={styles.generatedTitle}>{generated.title}</Text>
                <Text style={styles.generatedFocus}>{generated.focus}</Text>
                <ScrollView style={{ maxHeight: 360, marginVertical: SPACING.md }} showsVerticalScrollIndicator={false}>
                  <View style={styles.generatedList}>
                    {generated.exercises.map((ex, i) => {
                      const cat = ex.exerciseId ? findExerciseById(ex.exerciseId) : undefined;
                      return (
                        <View key={i}>
                          {i > 0 && <View style={[styles.hairline, { marginLeft: 70 }]} />}
                          <PressableScale
                            style={styles.generatedRow}
                            onPress={() => onTapExercise(ex)}
                            scaleTo={0.98}
                            accessibilityRole="button"
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
                          </PressableScale>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                  <View style={{ flex: 1 }}>
                    <PressableScale onPress={onSaveAsCustom} accessibilityRole="button">
                      <Glass radius={RADIUS.pill} style={styles.secondaryBtn}>
                        <Ionicons name="bookmark-outline" size={17} color={COLORS.text} />
                        <Text style={styles.secondaryBtnText}>Modifier</Text>
                      </Glass>
                    </PressableScale>
                  </View>
                  <View style={{ flex: 1.4 }}>
                    <PressableScale style={styles.primaryBtn} onPress={onLaunch} accessibilityRole="button">
                      <Ionicons name="play" size={16} color={COLORS.onPrimary} />
                      <Text style={styles.primaryBtnText}>Lancer</Text>
                    </PressableScale>
                  </View>
                </View>
              </>
            )}
          </Glass>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // En-tête
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingTop: SPACING.md,
  },
  title: { ...TYPE.largeTitle, color: COLORS.text },
  subtitle: { ...TYPE.callout, color: COLORS.textSecondary, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Sections
  sectionTitle: { ...TYPE.title, color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.md },
  sectionTitleInline: { marginTop: 0, marginBottom: 0 },
  sectionCount: { color: COLORS.textMuted, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  sectionHint: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 2 },
  sectionAction: { ...TYPE.callout, color: COLORS.primary, paddingBottom: 2 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },

  // Séance du jour
  todayKicker: { ...TYPE.caption, color: COLORS.textMuted },
  todayTitle: { ...TYPE.largeTitle, fontSize: 30, color: COLORS.text, marginTop: 4 },
  todayFocus: { ...TYPE.body, color: COLORS.textSecondary, marginTop: 2 },
  exList: { marginTop: SPACING.md },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  exName: { ...TYPE.body, color: COLORS.text, flex: 1 },
  exMeta: { ...TYPE.callout, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
  moreText: { ...TYPE.caption, color: COLORS.textMuted, paddingTop: 12 },
  xpHint: { ...TYPE.footnote, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm },
  restBox: { marginTop: SPACING.lg, alignItems: 'center', gap: SPACING.sm },
  restIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restText: { ...TYPE.callout, color: COLORS.textSecondary, textAlign: 'center' },

  // Boutons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
  },
  primaryBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
  },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },
  secondaryBtn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: COLORS.text, fontSize: 17, fontWeight: '600' },

  // Actions principales (créer / IA)
  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionCard: { gap: 2, minHeight: 128 },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  actionTitle: { ...TYPE.headline, color: COLORS.text },
  actionSub: { ...TYPE.caption, color: COLORS.textSecondary },

  // Mes séances
  emptyCustom: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyCustomText: { ...TYPE.callout, color: COLORS.textSecondary, textAlign: 'center' },

  customCard: { marginBottom: SPACING.md },
  customName: { ...TYPE.headline, fontSize: 19, color: COLORS.text },
  customMeta: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: 2 },

  previewRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.md },
  previewThumb: { width: 56, height: 56, borderRadius: RADIUS.md, overflow: 'hidden' },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMore: { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  previewMoreText: { ...TYPE.callout, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },

  customActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },

  // Hebdo
  weekCard: { paddingHorizontal: SPACING.md },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 12 },
  dayBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeActive: { backgroundColor: COLORS.primary },
  dayBadgeText: { ...TYPE.footnote, fontWeight: '600', color: COLORS.textSecondary },
  dayTitle: { ...TYPE.body, color: COLORS.text },
  dayType: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 1 },

  // Feuilles du bas
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetBacking: {
    backgroundColor: 'rgba(18,20,28,0.85)',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  sheet: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.borderStrong,
    marginBottom: SPACING.md,
  },
  sheetTitle: { ...TYPE.title, color: COLORS.text },
  sheetSub: { ...TYPE.callout, color: COLORS.textSecondary, marginTop: 4 },
  daysLabel: { ...TYPE.headline, color: COLORS.text, marginBottom: SPACING.sm },
  daysLabelMuted: { color: COLORS.textSecondary, fontWeight: '400' },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // Modal IA
  genHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.sm },
  genLabel: { ...TYPE.overline, color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.lg },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  intentInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 12,
    color: COLORS.text,
    fontSize: 15,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  intentHint: { ...TYPE.footnote, color: COLORS.textMuted, marginTop: 6 },

  generatedTitle: { ...TYPE.title, color: COLORS.text, marginTop: 4 },
  generatedFocus: { ...TYPE.callout, color: COLORS.textSecondary, marginTop: 4 },
  generatedList: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.sm },
  generatedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  thumbWrap: { width: 48, height: 48, borderRadius: RADIUS.md, overflow: 'hidden' },
  generatedName: { ...TYPE.callout, fontWeight: '600', color: COLORS.text },
  generatedMuscles: { ...TYPE.footnote, color: COLORS.textMuted },
  generatedMeta: { ...TYPE.callout, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
});
