import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  PressableProps,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { useApp } from '../contexts/AppContext';
import {
  formatDateKey,
  getNutritionKcalRange,
  getNutritionLog,
  getWeightHistory,
  getWorkouts,
  getProgramDays,
  getCheckIns,
  OWNER_ID,
  saveNutritionLog,
} from '../utils/storage';
import { DEFAULT_PROGRAM_DAYS, ProgramDays, sessionForDay } from '../data/programs';
import { nextCheckInIn } from '../utils/checkin';
import { NutritionLog, WeightEntry, Workout } from '../types';
import { MissingApiKeyError, getCoachAdvice } from '../services/gemini';
import { findExerciseById } from '../services/exercises';
import EnergyRing from '../components/EnergyRing';
import SemiGauge from '../components/SemiGauge';
import Sparkline from '../components/Sparkline';
import HydrationStrip from '../components/HydrationStrip';
import { AnimatedExerciseImage } from '../components/ExerciseCard';
import { Glass, GlassCard } from '../components/glass';
import { SectionLabel } from '../components/ui';

const { width: SCREEN_W } = Dimensions.get('window');

// Couleurs de data viz des macros (même code partout sur l'écran).
const MACRO_COLORS = { protein: COLORS.blue, carbs: COLORS.accent, fats: COLORS.purple };

// ── Helpers ────────────────────────────────────────────────────────────────
function greetingFor(name: string): string {
  const h = new Date().getHours();
  if (h < 5)  return `Encore éveillé, ${name} ?`;
  if (h < 12) return `Bonjour, ${name}`;
  if (h < 18) return `Bon après-midi, ${name}`;
  return `Bonsoir, ${name}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function streakDays(workouts: Workout[]): number {
  if (workouts.length === 0) return 0;
  const dates = new Set(workouts.map((w) => new Date(w.date).toDateString()));
  const cursor = new Date();
  let s = 0;
  while (true) {
    if (dates.has(cursor.toDateString())) {
      s += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (s === 0) {
      cursor.setDate(cursor.getDate() - 1);
      if (dates.has(cursor.toDateString())) continue;
      return 0;
    } else break;
  }
  return s;
}

function workoutsThisWeek(workouts: Workout[]): number {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - dayOfWeek);
  return workouts.filter((w) => new Date(w.date).getTime() >= monday.getTime()).length;
}

function weeklyWorkoutSparkline(workouts: Workout[], weeks = 6): number[] {
  const out: number[] = [];
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(thisMonday.getDate() - dayOfWeek);

  for (let w = weeks - 1; w >= 0; w--) {
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - w * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    out.push(workouts.filter((wk) => {
      const t = new Date(wk.date).getTime();
      return t >= start.getTime() && t < end.getTime();
    }).length);
  }
  return out;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-CA');
}

// ── Hero state ─────────────────────────────────────────────────────────────
type HeroKind = 'breakfast' | 'workout' | 'workout_done' | 'meal_more' | 'goal_hit' | 'rest' | 'past_recap';

interface HeroState {
  kind: HeroKind;
  title: string;
  subtitle?: string;
  cta: { label: string; icon: keyof typeof Ionicons.glyphMap; tab: string; params?: any };
}

function computeHero(args: {
  selectedDate: Date;
  totalCals: number;
  targetCals: number;
  workoutTodayDone: boolean;
  isRest: boolean;
  dayTitle: string;
  dayExoCount: number;
  pastWorkoutCount: number;
}): HeroState {
  const isToday = sameDay(args.selectedDate, new Date());

  if (!isToday) {
    return {
      kind: 'past_recap',
      title: capitalize(args.selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })),
      subtitle: args.pastWorkoutCount > 0
        ? `${args.pastWorkoutCount} séance loggée`
        : 'Aucune séance ce jour-là',
      cta: { label: 'Voir les stats', icon: 'analytics-outline', tab: 'Stats' },
    };
  }

  if (args.isRest) {
    return {
      kind: 'rest',
      title: 'Jour de récup',
      subtitle: 'Étirements doux, sommeil de qualité',
      cta: { label: 'Voir les étirements', icon: 'leaf-outline', tab: 'Training' },
    };
  }

  const calsPct = args.targetCals > 0 ? (args.totalCals / args.targetCals) * 100 : 0;
  const hour = new Date().getHours();

  if (args.totalCals < 200 && hour < 11) {
    return {
      kind: 'breakfast',
      title: 'Commence par ton petit-déj',
      subtitle: `Cible : ${fmt(args.targetCals)} kcal sur la journée`,
      cta: { label: 'Scanner un plat', icon: 'camera-outline', tab: 'Nutrition', params: { autoOpen: 'camera' } },
    };
  }

  if (!args.workoutTodayDone && !args.isRest) {
    return {
      kind: 'workout',
      title: args.dayTitle,
      subtitle: `${args.dayExoCount} exercices prévus`,
      cta: { label: 'Lancer la séance', icon: 'play', tab: 'Training' },
    };
  }

  if (calsPct >= 90 && calsPct <= 110) {
    return {
      kind: 'goal_hit',
      title: 'Cible atteinte',
      subtitle: 'Discipline parfaite aujourd\'hui',
      cta: { label: 'Voir le programme de demain', icon: 'calendar-outline', tab: 'Training' },
    };
  }

  return {
    kind: 'meal_more',
    title: 'Continue sur ta lancée',
    subtitle: `${fmt(Math.max(0, args.targetCals - args.totalCals))} kcal restantes`,
    cta: { label: 'Ajouter un repas', icon: 'restaurant-outline', tab: 'Nutrition', params: { autoOpen: 'manual' } },
  };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { profile, goal, gamification, currentLevel, xpProgress, playFx, addXp } = useApp();

  const [date, setDate] = useState<Date>(new Date());
  const [nutrition, setNutrition] = useState<NutritionLog | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [kcal7d, setKcal7d] = useState<number[]>([]);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [programDays, setProgramDays] = useState<ProgramDays>(DEFAULT_PROGRAM_DAYS);
  const [checkInDue, setCheckInDue] = useState(false);
  const session = sessionForDay(date.getDay(), programDays);
  const dayInfo = session
    ? { title: session.title, type: 'Musculation' }
    : { title: 'Repos', type: 'Récupération' };
  const baseExercises = session?.exercises ?? [];
  const isRest = baseExercises.length === 0;

  const loadAll = useCallback(async () => {
    const [log, w, wt, k7, pd, checkIns] = await Promise.all([
      getNutritionLog(formatDateKey(date)),
      getWorkouts(),
      getWeightHistory(),
      getNutritionKcalRange(7),
      getProgramDays(),
      getCheckIns(OWNER_ID),
    ]);
    setProgramDays(pd);
    setCheckInDue(nextCheckInIn(checkIns[0], formatDateKey(new Date())) === 0);
    setNutrition(log);
    setWorkouts(w);
    setWeights(wt);
    setKcal7d(k7);
  }, [date]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));
  useEffect(() => { loadAll(); }, [loadAll]);

  const totalCals = (nutrition?.meals ?? []).reduce((a, m) => a + m.calories, 0);
  const totalProt = (nutrition?.meals ?? []).reduce((a, m) => a + m.protein, 0);
  const totalCarbs = (nutrition?.meals ?? []).reduce((a, m) => a + m.carbs, 0);
  const totalFats = (nutrition?.meals ?? []).reduce((a, m) => a + m.fats, 0);
  const waterMl = nutrition?.water ?? 0;

  const workoutTodayDone = useMemo(
    () => workouts.some((w) => sameDay(new Date(w.date), date)),
    [workouts, date]
  );
  const pastWorkoutCount = useMemo(
    () => workouts.filter((w) => sameDay(new Date(w.date), date)).length,
    [workouts, date]
  );

  const streak = useMemo(() => streakDays(workouts), [workouts]);
  const weekCount = useMemo(() => workoutsThisWeek(workouts), [workouts]);
  const weeklySpark = useMemo(() => weeklyWorkoutSparkline(workouts, 6), [workouts]);
  const weightSpark = useMemo(
    () => weights.slice(-7).map((w) => w.weight),
    [weights]
  );
  // Si pas d'historique, on retombe sur le poids du profil pour que le widget ne soit jamais vide.
  const hasWeightHistory = weights.length > 0;
  const currentWeight = hasWeightHistory ? weights[weights.length - 1].weight : profile.weightKg;
  const weightDelta = useMemo(() => {
    if (weights.length < 2) return 0;
    return weights[weights.length - 1].weight - weights[weights.length - 2].weight;
  }, [weights]);

  const hero = useMemo(
    () => computeHero({
      selectedDate: date,
      totalCals,
      targetCals: profile.targetCalories,
      workoutTodayDone,
      isRest,
      dayTitle: dayInfo.title,
      dayExoCount: baseExercises.length,
      pastWorkoutCount,
    }),
    [date, totalCals, profile.targetCalories, workoutTodayDone, isRest, dayInfo.title, baseExercises.length, pastWorkoutCount]
  );

  // Hydration
  const handleWaterChange = async (next: number) => {
    if (!nutrition) return;
    const clamped = Math.max(0, Math.min(next, profile.targetWater * 2));
    const log = { ...nutrition, water: clamped };
    setNutrition(log);
    await saveNutritionLog(log);
    playFx('water');
    if (clamped > waterMl) await addXp(2);
  };
  const handleWaterReset = async () => {
    if (!nutrition) return;
    const log = { ...nutrition, water: 0 };
    setNutrition(log);
    await saveNutritionLog(log);
    playFx('click');
  };

  // Coach
  const fetchAdvice = useCallback(async () => {
    if (!nutrition) return;
    setLoadingAdvice(true);
    try {
      const res = await getCoachAdvice(profile, goal, nutrition, dayInfo.title);
      setAdvice(res);
    } catch (err: any) {
      setAdvice(err instanceof MissingApiKeyError
        ? "Configure ta clé Gemini dans Réglages pour activer le coach."
        : 'Connexion impossible. Continue tes efforts !');
    } finally {
      setLoadingAdvice(false);
    }
  }, [nutrition, profile, goal, dayInfo.title]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    await fetchAdvice();
    setRefreshing(false);
  }, [loadAll, fetchAdvice]);

  // Swipe horizontal sur hero
  const heroX = useRef(new Animated.Value(0)).current;
  const jumpDay = (offset: number) => {
    playFx('click');
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d);
  };
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => heroX.setValue(g.dx * 0.5),
      onPanResponderRelease: (_e, g) => {
        const threshold = SCREEN_W * 0.18;
        if (g.dx > threshold) jumpDay(-1);
        else if (g.dx < -threshold) jumpDay(1);
        Animated.spring(heroX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
      },
    }),
    [date]
  );

  const handleHeroAction = () => {
    playFx('click');
    navigation.navigate(hero.cta.tab, hero.cta.params);
  };

  const handleLevelLongPress = () => {
    playFx('click');
    navigation.navigate('Settings');
  };

  const isToday = sameDay(date, new Date());
  const todaysWorkoutExo = baseExercises[0];
  const todaysWorkoutCat = todaysWorkoutExo?.exerciseId ? findExerciseById(todaysWorkoutExo.exerciseId) : undefined;

  const todayLabel = capitalize(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
  const dayLabel = isToday
    ? "Aujourd'hui"
    : capitalize(date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }));
  const target = profile.targetCalories;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textSecondary} />}
      >
        {/* ─── En-tête : date, grand titre, actions ───────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerDate}>{todayLabel}</Text>
            <Text style={styles.largeTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {greetingFor(profile.name)}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <IconCircle
              icon="chatbubble-ellipses-outline"
              label="Discuter avec le coach"
              onPress={() => navigation.navigate('CoachChat')}
            />
            <IconCircle
              icon="settings-outline"
              label="Réglages"
              onPress={() => navigation.navigate('Settings')}
            />
          </View>
        </View>

        <Pressable
          style={styles.levelRow}
          onLongPress={handleLevelLongPress}
          onPress={() => navigation.navigate('Stats')}
          delayLongPress={400}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Niveau ${gamification.level}, ${currentLevel.name}`}
        >
          <Text style={styles.levelText}>Niveau {gamification.level} · {currentLevel.name}</Text>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xpProgress}%` }]} />
          </View>
        </Pressable>

        {/* ─── Suggestion du jour (glisser pour changer de jour) ──────────── */}
        <Animated.View style={[styles.block, { transform: [{ translateX: heroX }] }]} {...panResponder.panHandlers}>
          <Glass>
            <View style={styles.heroInner}>
              <View style={styles.heroTop}>
                <Text style={styles.heroDay}>{dayLabel}</Text>
                <View style={styles.dayNav}>
                  <IconCircle small icon="chevron-back" label="Jour précédent" onPress={() => jumpDay(-1)} />
                  <IconCircle small icon="chevron-forward" label="Jour suivant" onPress={() => jumpDay(1)} />
                </View>
              </View>

              <Pressable onPress={handleHeroAction} style={styles.heroRow} accessibilityRole="button">
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.heroTitle} numberOfLines={2}>{hero.title}</Text>
                  {hero.subtitle ? <Text style={styles.heroSubtitle} numberOfLines={2}>{hero.subtitle}</Text> : null}
                </View>
                <EnergyRing
                  kcal={totalCals}
                  kcalTarget={target}
                  protein={{ value: totalProt, target: profile.targetProtein, color: MACRO_COLORS.protein, short: 'P' }}
                  carbs={{ value: totalCarbs, target: profile.targetCarbs, color: MACRO_COLORS.carbs, short: 'G' }}
                  fats={{ value: totalFats, target: profile.targetFats, color: MACRO_COLORS.fats, short: 'L' }}
                  size={124}
                />
              </Pressable>

              <Tap style={styles.primaryBtn} onPress={handleHeroAction} accessibilityLabel={hero.cta.label}>
                <Ionicons name={hero.cta.icon} size={18} color={COLORS.onPrimary} />
                <Text style={styles.primaryBtnText} numberOfLines={1}>{hero.cta.label}</Text>
              </Tap>
            </View>
          </Glass>
        </Animated.View>

        {/* ─── Bilan dû ───────────────────────────────────────────────────── */}
        {checkInDue && (
          <Tap style={styles.block} onPress={() => navigation.navigate('CheckIn')} accessibilityLabel="Bilan des 2 semaines">
            <GlassCard padding={SPACING.md} style={styles.listRow}>
              <View style={styles.rowIcon}>
                <Ionicons name="clipboard-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Bilan des 2 semaines</Text>
                <Text style={styles.rowSub}>C'est le moment : poids, mensurations et calories</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </GlassCard>
          </Tap>
        )}

        {/* ─── Nutrition ──────────────────────────────────────────────────── */}
        <SectionLabel hint={`Objectif ${fmt(target)} kcal`}>Nutrition</SectionLabel>
        <Tap onPress={() => navigation.navigate('Nutrition')} scaleTo={0.98} accessibilityLabel="Ouvrir la nutrition">
          <GlassCard>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Énergie</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </View>

            <View style={styles.gaugeWrap}>
              <SemiGauge
                value={totalCals}
                target={target}
                size={Math.min(240, SCREEN_W - 2 * SPACING.md - 2 * SPACING.lg - 24)}
                color={COLORS.primary}
                centerUnit="kcal"
                caption={`sur ${fmt(target)}`}
                subArcs={[
                  { value: totalProt, target: profile.targetProtein, color: MACRO_COLORS.protein },
                  { value: totalCarbs, target: profile.targetCarbs, color: MACRO_COLORS.carbs },
                  { value: totalFats, target: profile.targetFats, color: MACRO_COLORS.fats },
                ]}
              />
            </View>

            <View style={styles.macroRow}>
              <MacroStat color={MACRO_COLORS.protein} label="Protéines" value={totalProt} target={profile.targetProtein} />
              <MacroStat color={MACRO_COLORS.carbs} label="Glucides" value={totalCarbs} target={profile.targetCarbs} />
              <MacroStat color={MACRO_COLORS.fats} label="Lipides" value={totalFats} target={profile.targetFats} />
            </View>

            <View style={styles.separator} />

            <View style={styles.trendRow}>
              <Text style={styles.trendLabel}>7 derniers jours</Text>
              <Sparkline data={kcal7d.length > 0 ? kcal7d : [0, 0]} color={COLORS.primary} width={120} height={32} />
            </View>
          </GlassCard>
        </Tap>

        {/* ─── Entraînement ───────────────────────────────────────────────── */}
        <SectionLabel>Entraînement</SectionLabel>
        <Tap onPress={() => navigation.navigate('Training')} scaleTo={0.98} accessibilityLabel="Ouvrir l'entraînement">
          <GlassCard padding={SPACING.md} style={styles.workoutCard}>
            {todaysWorkoutCat && !isRest ? (
              <View style={styles.workoutThumb}>
                <AnimatedExerciseImage exercise={todaysWorkoutCat} height={88} rounded variant="product" />
              </View>
            ) : (
              <View style={[styles.workoutThumb, styles.workoutFallback]}>
                <Ionicons name={isRest ? 'moon-outline' : 'barbell-outline'} size={28} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.metaLabel}>Séance du jour</Text>
              <Text style={styles.rowTitle} numberOfLines={2}>{dayInfo.title}</Text>
              <Text style={styles.rowSub}>
                {isRest ? 'Récupération' : `${baseExercises.length} exercices · ${dayInfo.type}`}
              </Text>
              {!isRest && (
                <Glass radius={RADIUS.pill} style={styles.secondaryPill}>
                  <Ionicons name="play" size={13} color={COLORS.primary} />
                  <Text style={styles.secondaryPillText}>Lancer</Text>
                </Glass>
              )}
            </View>
          </GlassCard>
        </Tap>

        <View style={[styles.row, styles.block]}>
          <GlassCard padding={SPACING.md} style={styles.tile}>
            <TileLabel icon="flame-outline" label="Série" />
            <View>
              <Text style={styles.tileValue}>
                {streak}
                <Text style={styles.tileUnit}> {streak === 1 ? 'jour' : 'jours'}</Text>
              </Text>
              <Text style={styles.rowSub}>{streak === 0 ? 'Reprends aujourd\'hui' : 'd\'affilée'}</Text>
            </View>
          </GlassCard>
          <GlassCard padding={SPACING.md} style={styles.tile}>
            <TileLabel icon="calendar-outline" label="Cette semaine" />
            <View>
              <Text style={styles.tileValue}>
                {weekCount}
                <Text style={styles.tileUnit}> sur 5</Text>
              </Text>
              <View style={{ marginTop: 6 }}>
                <Sparkline
                  data={weeklySpark.length > 0 ? weeklySpark : [0, 0]}
                  color={COLORS.primary}
                  width={104}
                  height={26}
                  showLastDot={false}
                />
              </View>
            </View>
          </GlassCard>
        </View>

        {/* ─── Corps ──────────────────────────────────────────────────────── */}
        <SectionLabel>Corps</SectionLabel>
        <Tap onPress={() => navigation.navigate('Stats')} scaleTo={0.98} accessibilityLabel="Ouvrir les stats de poids">
          <GlassCard style={styles.weightCard}>
            <View style={{ flex: 1 }}>
              <TileLabel icon="body-outline" label="Poids" />
              <Text style={styles.tileValue}>
                {currentWeight.toFixed(1)}
                <Text style={styles.tileUnit}> kg</Text>
              </Text>
              {weights.length >= 2 && weightDelta !== 0 ? (
                <View style={styles.deltaRow}>
                  <Ionicons
                    name={weightDelta < 0 ? 'trending-down' : 'trending-up'}
                    size={14}
                    color={weightDelta < 0 ? COLORS.primary : COLORS.red}
                  />
                  <Text style={[styles.deltaText, { color: weightDelta < 0 ? COLORS.primary : COLORS.red }]}>
                    {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg
                  </Text>
                </View>
              ) : (
                <Text style={styles.rowSub}>{hasWeightHistory ? '1 mesure' : 'Depuis ton profil'}</Text>
              )}
            </View>
            {weightSpark.length >= 2 ? (
              <Sparkline data={weightSpark} color={COLORS.purple} width={128} height={56} />
            ) : (
              <Glass radius={RADIUS.pill} style={styles.secondaryPill}>
                <Ionicons name="add" size={15} color={COLORS.text} />
                <Text style={styles.secondaryPillText}>Ajouter une mesure</Text>
              </Glass>
            )}
          </GlassCard>
        </Tap>

        <View style={styles.block}>
          <HydrationStrip
            waterMl={waterMl}
            targetMl={profile.targetWater}
            onChange={handleWaterChange}
            onReset={handleWaterReset}
          />
        </View>

        {/* ─── Coach ──────────────────────────────────────────────────────── */}
        <SectionLabel>Coach</SectionLabel>
        <Tap
          scaleTo={0.98}
          onPress={() => {
            if (advice) navigation.navigate('CoachChat', { seedMessage: advice });
            else fetchAdvice();
          }}
          accessibilityLabel={advice ? 'Poursuivre avec le coach' : 'Obtenir un conseil du coach'}
        >
          <GlassCard>
            <View style={styles.cardHead}>
              <View style={styles.tileLabel}>
                <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
                <Text style={styles.cardTitle}>Conseil du coach</Text>
              </View>
              {loadingAdvice ? (
                <ActivityIndicator size="small" color={COLORS.textSecondary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              )}
            </View>
            <Text style={[styles.coachText, !advice && { color: COLORS.textSecondary }]} numberOfLines={4}>
              {advice ?? 'Touchez pour obtenir un conseil personnalisé du coach IA.'}
            </Text>
            {advice ? <Text style={styles.coachLink}>Poursuivre la discussion</Text> : null}
          </GlassCard>
        </Tap>
      </ScrollView>
    </View>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Zone pressable avec ressort léger ; le style s'applique à la zone elle-même
// (utile pour les cartes en flex dans une rangée).
const Tap: React.FC<
  Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: React.ReactNode }
> = ({ style, scaleTo = 0.96, children, ...rest }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
};

// Bouton icône rond en verre (40, ou 32 en version compacte).
const IconCircle: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  small?: boolean;
}> = ({ icon, label, onPress, small }) => {
  const d = small ? 32 : 40;
  return (
    <Tap onPress={onPress} hitSlop={8} accessibilityLabel={label} scaleTo={0.9}>
      <Glass radius={d / 2} interactive style={{ width: d, height: d, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={small ? 16 : 20} color={COLORS.text} />
      </Glass>
    </Tap>
  );
};

const TileLabel: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = ({ icon, label }) => (
  <View style={styles.tileLabel}>
    <Ionicons name={icon} size={18} color={COLORS.primary} />
    <Text style={styles.tileLabelText}>{label}</Text>
  </View>
);

const MacroStat: React.FC<{ color: string; label: string; value: number; target: number }> = ({
  color,
  label,
  value,
  target,
}) => {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <View style={styles.macroStat}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>
        {Math.round(value)}
        <Text style={styles.macroTarget}> / {Math.round(target)} g</Text>
      </Text>
      <View style={[styles.macroTrack, { backgroundColor: `${color}2E` }]}>
        <View style={[styles.macroFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  block: { marginTop: SPACING.md },
  row: { flexDirection: 'row', gap: 12 },

  // En-tête
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  headerDate: { ...TYPE.overline, color: COLORS.textSecondary, marginBottom: 2 },
  largeTitle: { ...TYPE.largeTitle, color: COLORS.text },
  headerActions: { flexDirection: 'row', gap: SPACING.sm, paddingBottom: 2 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SPACING.sm, alignSelf: 'flex-start' },
  levelText: { ...TYPE.footnote, color: COLORS.textSecondary },
  xpTrack: { width: 96, height: 4, borderRadius: 2, backgroundColor: COLORS.surface, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 2, backgroundColor: COLORS.primary },

  // Suggestion du jour
  heroInner: { padding: SPACING.lg, gap: SPACING.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroDay: { ...TYPE.overline, color: COLORS.textSecondary },
  dayNav: { flexDirection: 'row', gap: SPACING.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  heroTitle: { ...TYPE.title, color: COLORS.text },
  heroSubtitle: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary, lineHeight: 20 },
  primaryBtn: {
    height: 50,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: SPACING.lg,
  },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },

  // Lignes et cartes
  listRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...TYPE.headline, color: COLORS.text },
  rowSub: { ...TYPE.caption, fontWeight: '400', color: COLORS.textSecondary, marginTop: 2 },
  metaLabel: { ...TYPE.footnote, color: COLORS.textSecondary },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...TYPE.headline, color: COLORS.text },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: SPACING.md },

  // Nutrition
  gaugeWrap: { alignItems: 'center', marginTop: SPACING.md },
  macroRow: { flexDirection: 'row', gap: 12, marginTop: SPACING.md },
  macroStat: { flex: 1, gap: 4 },
  macroLabel: { ...TYPE.footnote, color: COLORS.textSecondary },
  macroValue: { ...TYPE.number, fontSize: 20, color: COLORS.text },
  macroTarget: { fontSize: 13, fontWeight: '500', letterSpacing: 0, color: COLORS.textMuted },
  macroTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  macroFill: { height: '100%', borderRadius: 2 },
  trendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trendLabel: { ...TYPE.caption, color: COLORS.textSecondary },

  // Entraînement
  workoutCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  workoutThumb: { width: 88, height: 88, borderRadius: RADIUS.lg, overflow: 'hidden' },
  workoutFallback: { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    marginTop: SPACING.sm,
  },
  secondaryPillText: { ...TYPE.callout, fontWeight: '600', color: COLORS.text },

  // Tuiles
  tile: { flex: 1, minHeight: 132, justifyContent: 'space-between', gap: SPACING.sm },
  tileLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabelText: { ...TYPE.callout, fontWeight: '600', color: COLORS.textSecondary },
  tileValue: { ...TYPE.number, fontSize: 34, color: COLORS.text, marginTop: SPACING.sm },
  tileUnit: { fontSize: 15, fontWeight: '500', letterSpacing: 0, color: COLORS.textSecondary },

  // Poids
  weightCard: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.md },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  deltaText: { ...TYPE.caption, fontWeight: '600' },

  // Coach
  coachText: { ...TYPE.body, color: COLORS.text, lineHeight: 22, marginTop: SPACING.sm },
  coachLink: { ...TYPE.caption, fontWeight: '600', color: COLORS.primary, marginTop: SPACING.sm },
});
