import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../theme';
import { useApp } from '../contexts/AppContext';
import {
  formatDateKey,
  getNutritionKcalRange,
  getNutritionLog,
  getWeightHistory,
  getWorkouts,
  saveNutritionLog,
} from '../utils/storage';
import { EXERCISES_DB, WEEKLY_SCHEDULE } from '../data/library';
import { NutritionLog, WeightEntry, Workout } from '../types';
import { MissingApiKeyError, getCoachAdvice } from '../services/gemini';
import { findExerciseById } from '../services/exercises';
import EnergyRing from '../components/EnergyRing';
import SemiGauge from '../components/SemiGauge';
import Sparkline from '../components/Sparkline';
import HydrationStrip from '../components/HydrationStrip';
import { AnimatedExerciseImage } from '../components/ExerciseCard';

const { width: SCREEN_W } = Dimensions.get('window');

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

// ── Hero state ─────────────────────────────────────────────────────────────
type HeroKind = 'breakfast' | 'workout' | 'workout_done' | 'meal_more' | 'goal_hit' | 'rest' | 'past_recap';

interface HeroState {
  kind: HeroKind;
  title: string;
  subtitle?: string;
  cta: { label: string; icon: keyof typeof Ionicons.glyphMap; tab: string; params?: any };
  gradient: [string, string];
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
      title: args.selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
      subtitle: args.pastWorkoutCount > 0
        ? `${args.pastWorkoutCount} séance loggée`
        : 'Aucune séance ce jour-là',
      cta: { label: 'VOIR LES STATS', icon: 'analytics-outline', tab: 'Stats' },
      gradient: [`${COLORS.textSecondary}22`, `${COLORS.textSecondary}05`],
    };
  }

  if (args.isRest) {
    return {
      kind: 'rest',
      title: 'Jour de récup',
      subtitle: 'Étirements doux, sommeil de qualité',
      cta: { label: 'VOIR LES ÉTIREMENTS', icon: 'leaf-outline', tab: 'Training' },
      gradient: [`${COLORS.purple}25`, `${COLORS.purple}05`],
    };
  }

  const calsPct = args.targetCals > 0 ? (args.totalCals / args.targetCals) * 100 : 0;
  const hour = new Date().getHours();

  if (args.totalCals < 200 && hour < 11) {
    return {
      kind: 'breakfast',
      title: 'Commence par ton petit-déj',
      subtitle: `Cible : ${args.targetCals} kcal sur la journée`,
      cta: { label: 'SCANNER UN PLAT', icon: 'camera-outline', tab: 'Nutrition', params: { autoOpen: 'camera' } },
      gradient: [`${COLORS.accent}30`, `${COLORS.accent}05`],
    };
  }

  if (!args.workoutTodayDone && !args.isRest) {
    return {
      kind: 'workout',
      title: args.dayTitle,
      subtitle: `${args.dayExoCount} exercices prévus`,
      cta: { label: 'LANCER LA SÉANCE', icon: 'play', tab: 'Training' },
      gradient: [`${COLORS.primary}30`, `${COLORS.primary}05`],
    };
  }

  if (calsPct >= 90 && calsPct <= 110) {
    return {
      kind: 'goal_hit',
      title: 'Cible atteinte',
      subtitle: 'Discipline parfaite aujourd\'hui',
      cta: { label: 'PROGRAMME DEMAIN', icon: 'calendar-outline', tab: 'Training' },
      gradient: [`${COLORS.primary}35`, `${COLORS.primary}05`],
    };
  }

  return {
    kind: 'meal_more',
    title: 'Continue sur ta lancée',
    subtitle: `${Math.max(0, args.targetCals - args.totalCals)} kcal restantes`,
    cta: { label: 'AJOUTER UN REPAS', icon: 'restaurant-outline', tab: 'Nutrition', params: { autoOpen: 'manual' } },
    gradient: [`${COLORS.blue}25`, `${COLORS.blue}05`],
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

  const dayInfo = WEEKLY_SCHEDULE[date.getDay()];
  const baseExercises = EXERCISES_DB[date.getDay()] ?? [];
  const isRest = baseExercises.length === 0;

  const loadAll = useCallback(async () => {
    const [log, w, wt, k7] = await Promise.all([
      getNutritionLog(formatDateKey(date)),
      getWorkouts(),
      getWeightHistory(),
      getNutritionKcalRange(7),
    ]);
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* ─── Header sans card ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greetingFor(profile.name)}</Text>
          <Pressable
            style={styles.levelRow}
            onLongPress={handleLevelLongPress}
            onPress={() => navigation.navigate('Stats')}
            delayLongPress={400}
            hitSlop={6}
          >
            <Ionicons name="flash" size={11} color={COLORS.accent} />
            <Text style={styles.levelText}>Niv. {gamification.level} · {currentLevel.name}</Text>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpProgress}%` }]} />
            </View>
          </Pressable>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('CoachChat')} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 96, gap: SPACING.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ─── A · HERO (full width) ──────────────────────────────────────── */}
        <Animated.View style={{ transform: [{ translateX: heroX }] }} {...panResponder.panHandlers}>
          <Pressable onPress={handleHeroAction} style={styles.heroOuter}>
            <LinearGradient
              colors={hero.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.dateChip}>
                    <Ionicons name={isToday ? 'sunny' : 'calendar-outline'} size={11} color={COLORS.textSecondary} />
                    <Text style={styles.dateChipText}>
                      {isToday ? "AUJOURD'HUI" : date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.heroTitle} numberOfLines={2}>{hero.title}</Text>
                  {hero.subtitle && <Text style={styles.heroSubtitle} numberOfLines={2}>{hero.subtitle}</Text>}
                  <View style={styles.heroCta}>
                    <Ionicons name={hero.cta.icon} size={14} color={COLORS.text} />
                    <Text style={styles.heroCtaText}>{hero.cta.label}</Text>
                    <Ionicons name="arrow-forward" size={14} color={COLORS.text} />
                  </View>
                </View>
                <View style={styles.heroRingWrap}>
                  <EnergyRing
                    kcal={totalCals}
                    kcalTarget={profile.targetCalories}
                    protein={{ value: totalProt, target: profile.targetProtein, color: COLORS.primary, short: 'P' }}
                    carbs={{ value: totalCarbs, target: profile.targetCarbs, color: COLORS.accent, short: 'G' }}
                    fats={{ value: totalFats, target: profile.targetFats, color: COLORS.red, short: 'L' }}
                    size={132}
                  />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* ─── B · KCAL GAUGE (large) + C/D streak/semaine (carrés) ──────── */}
        <View style={styles.rowAsymmetric}>
          {/* B · SemiGauge kcal (2/3) */}
          <TouchableOpacity
            style={styles.gaugeCard}
            onPress={() => navigation.navigate('Nutrition')}
            activeOpacity={0.92}
          >
            <LinearGradient
              colors={[`${COLORS.primary}10`, 'transparent']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.tinyHeader}>
              <Text style={styles.tinyLabel}>ÉNERGIE</Text>
              <Text style={styles.tinyValue}>{profile.targetCalories} kcal</Text>
            </View>
            <SemiGauge
              value={totalCals}
              target={profile.targetCalories}
              size={170}
              color={COLORS.primary}
              centerUnit="kcal"
              subArcs={[
                { value: totalProt, target: profile.targetProtein, color: COLORS.primary },
                { value: totalCarbs, target: profile.targetCarbs, color: COLORS.accent },
                { value: totalFats, target: profile.targetFats, color: COLORS.red },
              ]}
            />
            <View style={styles.macroPills}>
              <MacroPill color={COLORS.primary} label="P" value={Math.round(totalProt)} target={profile.targetProtein} />
              <MacroPill color={COLORS.accent} label="G" value={Math.round(totalCarbs)} target={profile.targetCarbs} />
              <MacroPill color={COLORS.red} label="L" value={Math.round(totalFats)} target={profile.targetFats} />
            </View>
            <View style={styles.sparklineRow}>
              <Text style={styles.sparklineLabel}>7 derniers jours</Text>
              <Sparkline data={kcal7d.length > 0 ? kcal7d : [0, 0]} color={COLORS.primary} width={100} height={28} />
            </View>
          </TouchableOpacity>

          {/* C/D · Stack vertical de 2 carrés (1/3) */}
          <View style={styles.smallStack}>
            {/* C · Streak */}
            <View style={[styles.smallTile, { overflow: 'hidden' }]}>
              <LinearGradient
                colors={[`${COLORS.accent}25`, 'transparent']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.smallHead}>
                <Ionicons name="flame" size={14} color={COLORS.accent} />
                <Text style={[styles.tinyLabel, { color: COLORS.accent }]}>STREAK</Text>
              </View>
              <Text style={styles.smallBig}>{streak}<Text style={styles.smallUnit}>j</Text></Text>
              <Text style={styles.smallSub}>{streak === 0 ? 'Reprends aujourd\'hui' : 'd\'affilée'}</Text>
            </View>
            {/* D · Semaine */}
            <View style={[styles.smallTile, { overflow: 'hidden' }]}>
              <LinearGradient
                colors={[`${COLORS.primary}20`, 'transparent']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.smallHead}>
                <Ionicons name="barbell-outline" size={14} color={COLORS.primary} />
                <Text style={[styles.tinyLabel, { color: COLORS.primary }]}>SEMAINE</Text>
              </View>
              <Text style={styles.smallBig}>{weekCount}<Text style={styles.smallUnit}>/5</Text></Text>
              <View style={{ marginTop: 4 }}>
                <Sparkline data={weeklySpark.length > 0 ? weeklySpark : [0, 0]} color={COLORS.primary} width={90} height={24} showLastDot={false} />
              </View>
            </View>
          </View>
        </View>

        {/* ─── E/F · Workout + Poids ──────────────────────────────────────── */}
        <View style={styles.rowEqual}>
          {/* E · Workout card avec GIF preview */}
          <TouchableOpacity
            style={styles.workoutCard}
            onPress={() => navigation.navigate('Training')}
            activeOpacity={0.92}
          >
            <LinearGradient
              colors={[`${COLORS.blue}20`, 'transparent']}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.smallHead}>
              <Ionicons name="fitness-outline" size={14} color={COLORS.blue} />
              <Text style={[styles.tinyLabel, { color: COLORS.blue }]}>SÉANCE</Text>
            </View>
            {todaysWorkoutCat && !isRest ? (
              <View style={styles.workoutPreviewWrap}>
                <AnimatedExerciseImage exercise={todaysWorkoutCat} height={84} rounded variant="product" />
              </View>
            ) : (
              <View style={styles.workoutFallback}>
                <Ionicons name={isRest ? 'moon' : 'barbell-outline'} size={32} color={COLORS.textMuted} />
              </View>
            )}
            <Text style={styles.workoutTitle} numberOfLines={1}>{dayInfo.title}</Text>
            <Text style={styles.workoutSub}>
              {isRest ? 'Récup' : `${baseExercises.length} exos · ${dayInfo.type}`}
            </Text>
            {!isRest && (
              <View style={styles.workoutCta}>
                <Ionicons name="play" size={12} color={COLORS.blue} />
                <Text style={styles.workoutCtaText}>LANCER</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* F · Poids */}
          <TouchableOpacity
            style={styles.weightCard}
            onPress={() => navigation.navigate('Stats')}
            activeOpacity={0.92}
          >
            <LinearGradient
              colors={[`${COLORS.purple}20`, 'transparent']}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.smallHead}>
              <Ionicons name="body-outline" size={14} color={COLORS.purple} />
              <Text style={[styles.tinyLabel, { color: COLORS.purple }]}>POIDS</Text>
            </View>

            <Text style={styles.weightValue}>
              {currentWeight.toFixed(1)}
              <Text style={styles.weightUnit}> kg</Text>
            </Text>

            {weights.length >= 2 && weightDelta !== 0 ? (
              <View style={styles.weightDeltaRow}>
                <Ionicons
                  name={weightDelta < 0 ? 'trending-down' : 'trending-up'}
                  size={11}
                  color={weightDelta < 0 ? COLORS.primary : COLORS.red}
                />
                <Text style={[styles.weightDelta, { color: weightDelta < 0 ? COLORS.primary : COLORS.red }]}>
                  {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg
                </Text>
              </View>
            ) : (
              <Text style={styles.weightHint}>
                {hasWeightHistory ? '1 mesure' : 'depuis ton profil'}
              </Text>
            )}

            {weightSpark.length >= 2 ? (
              <View style={{ marginTop: 6 }}>
                <Sparkline data={weightSpark} color={COLORS.purple} width={120} height={36} />
              </View>
            ) : (
              <View style={styles.weightCta}>
                <Ionicons name="add" size={12} color={COLORS.purple} />
                <Text style={styles.weightCtaText}>LOGGER UNE MESURE</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── G · Hydratation full width ─────────────────────────────────── */}
        <HydrationStrip
          waterMl={waterMl}
          targetMl={profile.targetWater}
          onChange={handleWaterChange}
          onReset={handleWaterReset}
        />

        {/* ─── H · Coach inline ───────────────────────────────────────────── */}
        <Pressable
          style={styles.coachInline}
          onPress={() => {
            if (advice) navigation.navigate('CoachChat', { seedMessage: advice });
            else fetchAdvice();
          }}
        >
          <LinearGradient
            colors={[`${COLORS.purple}18`, 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={styles.coachIcon}>
            {loadingAdvice ? (
              <ActivityIndicator size="small" color={COLORS.purple} />
            ) : (
              <Ionicons name="sparkles" size={14} color={COLORS.purple} />
            )}
          </View>
          <Text style={styles.coachText} numberOfLines={2}>
            {advice ?? 'Tap pour un conseil personnalisé du Coach IA'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
const MacroPill: React.FC<{ color: string; label: string; value: number; target: number }> = ({ color, label, value, target }) => (
  <View style={[styles.macroPill, { borderColor: `${color}55` }]}>
    <Text style={[styles.macroPillLabel, { color }]}>{label}</Text>
    <Text style={styles.macroPillValue}>
      <Text style={{ color, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: COLORS.textMuted }}>/{target}</Text>
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  greet: { color: COLORS.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  levelText: { color: COLORS.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  xpTrack: { flex: 1, height: 3, backgroundColor: COLORS.surface, borderRadius: 2, overflow: 'hidden', marginLeft: 6, maxWidth: 120 },
  xpFill: { height: '100%', backgroundColor: COLORS.accent },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Hero
  heroOuter: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroGradient: { padding: SPACING.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  dateChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  dateChipText: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4, lineHeight: 26 },
  heroSubtitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', lineHeight: 16, marginTop: 2 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroCtaText: { color: COLORS.text, fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  heroRingWrap: { marginLeft: 'auto' },

  // Row layout
  rowAsymmetric: { flexDirection: 'row', gap: SPACING.sm },
  rowEqual: { flexDirection: 'row', gap: SPACING.sm },

  // Tile styles
  tinyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tinyLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  tinyValue: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  smallHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },

  // B · Gauge card
  gaugeCard: {
    flex: 2,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    gap: SPACING.sm,
  },
  macroPills: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  macroPill: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    gap: 1,
  },
  macroPillLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  macroPillValue: { fontSize: 10, fontWeight: '700' },
  sparklineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sparklineLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // C/D · Small stack
  smallStack: { flex: 1, gap: SPACING.sm },
  smallTile: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'space-between',
  },
  smallBig: { color: COLORS.text, fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  smallUnit: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '700' },
  smallSub: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },

  // E · Workout
  workoutCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    gap: 4,
  },
  workoutPreviewWrap: {
    height: 84,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: 4,
  },
  workoutFallback: {
    height: 84,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  workoutTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900', marginTop: 2 },
  workoutSub: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  workoutCta: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.blue}22`,
    borderWidth: 1,
    borderColor: `${COLORS.blue}55`,
  },
  workoutCtaText: { color: COLORS.blue, fontWeight: '900', fontSize: 10, letterSpacing: 0.8 },

  // F · Weight
  weightCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  weightValue: { color: COLORS.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8, lineHeight: 30 },
  weightUnit: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  weightDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  weightDelta: { fontSize: 11, fontWeight: '800' },
  weightHint: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2, fontStyle: 'italic' },
  weightCta: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.purple}22`,
    borderWidth: 1,
    borderColor: `${COLORS.purple}55`,
  },
  weightCtaText: { color: COLORS.purple, fontWeight: '900', fontSize: 10, letterSpacing: 0.8 },

  // Coach
  coachInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.purple}33`,
    overflow: 'hidden',
  },
  coachIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${COLORS.purple}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachText: { flex: 1, color: COLORS.text, fontSize: 12, fontWeight: '600', lineHeight: 16 },
});
