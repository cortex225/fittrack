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
import { COLORS, RADIUS, SPACING } from '../theme';
import { useApp } from '../contexts/AppContext';
import {
  formatDateKey,
  getNutritionLog,
  getRecentTrainingContext,
  getWeightHistory,
  getWorkouts,
  saveNutritionLog,
} from '../utils/storage';
import { WEEKLY_SCHEDULE } from '../data/library';
import { NutritionLog, WeightEntry, Workout } from '../types';
import { MissingApiKeyError, getCoachAdvice } from '../services/gemini';
import EnergyRing from '../components/EnergyRing';
import HydrationStrip from '../components/HydrationStrip';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Helpers contextuels ────────────────────────────────────────────────────
function greetingFor(date: Date, name: string): string {
  const h = date.getHours();
  if (h < 5) return `Encore éveillé, ${name} ?`;
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
  // Aujourd'hui ne compte pas tant que pas de séance ; on commence au jour le plus récent qui en a une.
  while (true) {
    if (dates.has(cursor.toDateString())) {
      s += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (s === 0) {
      // Pas encore commencé → reculer d'un jour pour voir si la veille a une séance
      cursor.setDate(cursor.getDate() - 1);
      if (dates.has(cursor.toDateString())) continue;
      return 0;
    } else {
      break;
    }
  }
  return s;
}

function workoutsThisWeek(workouts: Workout[]): number {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // lundi = 0
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - dayOfWeek);
  return workouts.filter((w) => new Date(w.date).getTime() >= monday.getTime()).length;
}

// ── Hero state (algo déterministe local) ──────────────────────────────────
type HeroKind = 'breakfast' | 'workout' | 'workout_done' | 'meal_more' | 'goal_hit' | 'rest' | 'past_recap';

interface HeroState {
  kind: HeroKind;
  title: string;
  subtitle?: string;
  cta: { label: string; icon: keyof typeof Ionicons.glyphMap; tab: string };
  accentColor: string;
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
        ? `${args.pastWorkoutCount} séance${args.pastWorkoutCount > 1 ? 's' : ''} loggée${args.pastWorkoutCount > 1 ? 's' : ''}`
        : 'Aucune séance ce jour',
      cta: { label: 'VOIR LES STATS', icon: 'analytics-outline', tab: 'Stats' },
      accentColor: COLORS.textSecondary,
    };
  }

  if (args.isRest) {
    return {
      kind: 'rest',
      title: 'Jour de récup',
      subtitle: 'Profite-en pour t\'étirer et bien dormir',
      cta: { label: 'VOIR LES ÉTIREMENTS', icon: 'leaf-outline', tab: 'Training' },
      accentColor: COLORS.purple,
    };
  }

  const calsPct = args.targetCals > 0 ? (args.totalCals / args.targetCals) * 100 : 0;
  const hour = new Date().getHours();

  if (args.totalCals < 200 && hour < 11) {
    return {
      kind: 'breakfast',
      title: 'Commence par ton petit-déj',
      subtitle: `Cible : ${args.targetCals} kcal sur la journée`,
      cta: { label: 'SCAN OU SAISIR', icon: 'camera-outline', tab: 'Nutrition' },
      accentColor: COLORS.accent,
    };
  }

  if (!args.workoutTodayDone) {
    return {
      kind: 'workout',
      title: args.dayTitle,
      subtitle: `${args.dayExoCount} exos prévus`,
      cta: { label: 'LANCER LA SÉANCE', icon: 'play', tab: 'Training' },
      accentColor: COLORS.primary,
    };
  }

  if (calsPct >= 90 && calsPct <= 110) {
    return {
      kind: 'goal_hit',
      title: 'Cible journée atteinte',
      subtitle: 'Beau travail. On enchaîne demain ?',
      cta: { label: 'VOIR LE PROGRAMME', icon: 'calendar-outline', tab: 'Training' },
      accentColor: COLORS.primary,
    };
  }

  if (args.workoutTodayDone) {
    return {
      kind: 'workout_done',
      title: 'Séance ✓',
      subtitle: `${Math.max(0, args.targetCals - args.totalCals)} kcal restantes pour atteindre ta cible`,
      cta: { label: 'AJOUTER UN REPAS', icon: 'restaurant-outline', tab: 'Nutrition' },
      accentColor: COLORS.primary,
    };
  }

  return {
    kind: 'meal_more',
    title: 'Continue sur ta lancée',
    subtitle: `${Math.max(0, args.targetCals - args.totalCals)} kcal restantes`,
    cta: { label: 'AJOUTER UN REPAS', icon: 'restaurant-outline', tab: 'Nutrition' },
    accentColor: COLORS.primary,
  };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { profile, goal, gamification, currentLevel, nextLevel, xpProgress, playFx, addXp } = useApp();

  const [date, setDate] = useState<Date>(new Date());
  const [nutrition, setNutrition] = useState<NutritionLog | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dayInfo = WEEKLY_SCHEDULE[date.getDay()];
  // EXERCISES_DB est lié à WEEKLY_SCHEDULE — on compte les exos prévus pour ce jour-là
  const isRest = useMemo(() => {
    const { EXERCISES_DB } = require('../data/library');
    return (EXERCISES_DB[date.getDay()] ?? []).length === 0;
  }, [date]);
  const dayExoCount = useMemo(() => {
    const { EXERCISES_DB } = require('../data/library');
    return (EXERCISES_DB[date.getDay()] ?? []).length;
  }, [date]);

  const loadDay = useCallback(async () => {
    const [log, w, wt] = await Promise.all([
      getNutritionLog(formatDateKey(date)),
      getWorkouts(),
      getWeightHistory(),
    ]);
    setNutrition(log);
    setWorkouts(w);
    setWeights(wt);
  }, [date]);

  useFocusEffect(useCallback(() => { loadDay(); }, [loadDay]));
  useEffect(() => { loadDay(); }, [loadDay]);

  // Métriques
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
  const currentWeight = weights[weights.length - 1]?.weight;
  const weightDelta = useMemo(() => {
    if (weights.length < 2) return 0;
    return weights[weights.length - 1].weight - weights[0].weight;
  }, [weights]);

  const hero = useMemo(
    () => computeHero({
      selectedDate: date,
      totalCals,
      targetCals: profile.targetCalories,
      workoutTodayDone,
      isRest,
      dayTitle: dayInfo.title,
      dayExoCount,
      pastWorkoutCount,
    }),
    [date, totalCals, profile.targetCalories, workoutTodayDone, isRest, dayInfo.title, dayExoCount, pastWorkoutCount]
  );

  // Hydration
  const handleWaterChange = async (next: number) => {
    if (!nutrition) return;
    const clamped = Math.max(0, Math.min(next, profile.targetWater * 2)); // garde-fou : pas plus que 2× target
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

  // Coach inline (lazy)
  const fetchAdvice = useCallback(async () => {
    if (!nutrition) return;
    setLoadingAdvice(true);
    try {
      const res = await getCoachAdvice(profile, goal, nutrition, dayInfo.title);
      setAdvice(res);
    } catch (err: any) {
      if (err instanceof MissingApiKeyError) {
        setAdvice("Configure ta clé Gemini dans Réglages pour activer le coach.");
      } else {
        setAdvice('Connexion impossible. Continue tes efforts !');
      }
    } finally {
      setLoadingAdvice(false);
    }
  }, [nutrition, profile, goal, dayInfo.title]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDay();
    await fetchAdvice();
    setRefreshing(false);
  }, [loadDay, fetchAdvice]);

  // Swipe horizontal sur le hero pour changer de jour
  const heroX = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => heroX.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        const threshold = SCREEN_W * 0.2;
        if (g.dx > threshold) {
          jumpDay(-1);
          Animated.spring(heroX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
        } else if (g.dx < -threshold) {
          jumpDay(1);
          Animated.spring(heroX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
        } else {
          Animated.spring(heroX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
        }
      },
    }),
    []
  );

  const jumpDay = (offset: number) => {
    playFx('click');
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d);
  };

  const handleHeroAction = () => {
    playFx('click');
    navigation.navigate(hero.cta.tab);
  };

  const handleLevelLongPress = () => {
    playFx('click');
    navigation.navigate('Settings');
  };

  const greet = useMemo(() => greetingFor(new Date(), profile.name), [profile.name]);
  const isToday = sameDay(date, new Date());

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greet}</Text>
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
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 96, gap: SPACING.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* ─── Hero contextuel (swipeable) ────────────────────────────────── */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.hero,
            { transform: [{ translateX: heroX }], borderColor: `${hero.accentColor}55` },
          ]}
        >
          <View style={styles.heroDateRow}>
            <Pressable onPress={() => jumpDay(-1)} hitSlop={10}>
              <Ionicons name="chevron-back" size={16} color={COLORS.textMuted} />
            </Pressable>
            <Text style={styles.heroDate}>
              {isToday ? 'AUJOURD\'HUI' : date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
            </Text>
            <Pressable onPress={() => jumpDay(1)} hitSlop={10}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.heroTitle} numberOfLines={2}>{hero.title}</Text>
          {hero.subtitle && <Text style={styles.heroSubtitle}>{hero.subtitle}</Text>}

          <TouchableOpacity
            style={[styles.heroCta, { backgroundColor: hero.accentColor }]}
            onPress={handleHeroAction}
            activeOpacity={0.9}
          >
            <Ionicons name={hero.cta.icon} size={16} color="#08110D" />
            <Text style={styles.heroCtaText}>{hero.cta.label}</Text>
          </TouchableOpacity>

          <Text style={styles.heroHint}>Glisse pour changer de jour</Text>
        </Animated.View>

        {/* ─── Anneau d'énergie + macros ───────────────────────────────────── */}
        <TouchableOpacity
          style={styles.ringCard}
          onPress={() => navigation.navigate('Nutrition')}
          activeOpacity={0.92}
        >
          <EnergyRing
            kcal={totalCals}
            kcalTarget={profile.targetCalories}
            protein={{ value: totalProt, target: profile.targetProtein, color: COLORS.primary, short: 'P' }}
            carbs={{ value: totalCarbs, target: profile.targetCarbs, color: COLORS.accent, short: 'G' }}
            fats={{ value: totalFats, target: profile.targetFats, color: COLORS.red, short: 'L' }}
            size={220}
          />
          <View style={styles.macroLegend}>
            <MacroLegendItem color={COLORS.primary} label="Protéines" value={totalProt} target={profile.targetProtein} />
            <MacroLegendItem color={COLORS.accent} label="Glucides" value={totalCarbs} target={profile.targetCarbs} />
            <MacroLegendItem color={COLORS.red} label="Lipides" value={totalFats} target={profile.targetFats} />
          </View>
          <View style={styles.quickActions}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: `${COLORS.primary}15`, borderColor: `${COLORS.primary}55` }]}
              onPress={(e) => { e.stopPropagation(); playFx('click'); navigation.navigate('Nutrition', { autoOpen: 'camera' }); }}
            >
              <Ionicons name="camera-outline" size={14} color={COLORS.primary} />
              <Text style={[styles.quickActionText, { color: COLORS.primary }]}>SCAN</Text>
            </Pressable>
            <Pressable
              style={[styles.quickAction, { backgroundColor: `${COLORS.blue}15`, borderColor: `${COLORS.blue}55` }]}
              onPress={(e) => { e.stopPropagation(); playFx('click'); navigation.navigate('Nutrition', { autoOpen: 'manual' }); }}
            >
              <Ionicons name="pencil-outline" size={14} color={COLORS.blue} />
              <Text style={[styles.quickActionText, { color: COLORS.blue }]}>SAISIR</Text>
            </Pressable>
          </View>
        </TouchableOpacity>

        {/* ─── Hydratation ─────────────────────────────────────────────────── */}
        <HydrationStrip
          waterMl={waterMl}
          targetMl={profile.targetWater}
          onChange={handleWaterChange}
          onReset={handleWaterReset}
        />

        {/* ─── Coach inline ────────────────────────────────────────────────── */}
        <Pressable
          style={styles.coachInline}
          onPress={() => {
            if (advice) {
              navigation.navigate('CoachChat', { seedMessage: advice });
            } else {
              fetchAdvice();
            }
          }}
        >
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

        {/* ─── Footer mini-stats ───────────────────────────────────────────── */}
        <View style={styles.footerStats}>
          <FooterStat
            icon="flame"
            color={COLORS.accent}
            value={`${streak}j`}
            label="Streak"
          />
          <View style={styles.footerSep} />
          <FooterStat
            icon="barbell-outline"
            color={COLORS.primary}
            value={`${weekCount}/${dayInfo ? 5 : 0}`}
            label="Cette semaine"
          />
          <View style={styles.footerSep} />
          <FooterStat
            icon="body-outline"
            color={COLORS.blue}
            value={currentWeight ? `${currentWeight} kg` : '—'}
            label={
              weights.length > 1
                ? `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg`
                : 'Poids actuel'
            }
            labelColor={
              weights.length > 1 && weightDelta !== 0
                ? (weightDelta < 0 ? COLORS.primary : COLORS.red)
                : undefined
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
const MacroLegendItem: React.FC<{ color: string; label: string; value: number; target: number }> = ({ color, label, value, target }) => (
  <View style={styles.macroLegendItem}>
    <View style={[styles.macroDot, { backgroundColor: color }]} />
    <View>
      <Text style={styles.macroLegendLabel}>{label}</Text>
      <Text style={styles.macroLegendValue}>
        <Text style={{ color, fontWeight: '900' }}>{Math.round(value)}</Text>
        <Text style={{ color: COLORS.textMuted }}> / {target}g</Text>
      </Text>
    </View>
  </View>
);

const FooterStat: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: string;
  label: string;
  labelColor?: string;
}> = ({ icon, color, value, label, labelColor }) => (
  <View style={styles.footerStat}>
    <View style={styles.footerStatHead}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.footerStatValue, { color }]}>{value}</Text>
    </View>
    <Text style={[styles.footerStatLabel, labelColor && { color: labelColor }]}>{label}</Text>
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
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  levelText: { color: COLORS.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  xpTrack: {
    flex: 1,
    height: 3,
    backgroundColor: COLORS.surface,
    borderRadius: 2,
    overflow: 'hidden',
    marginLeft: 6,
    maxWidth: 120,
  },
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
  hero: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    gap: 6,
  },
  heroDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  heroDate: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { color: COLORS.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, lineHeight: 30 },
  heroSubtitle: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  heroCta: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  heroCtaText: { color: '#08110D', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  heroHint: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 6,
  },

  // Ring + macros
  ringCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.md,
  },
  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: SPACING.sm,
  },
  macroLegendItem: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroLegendLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  macroLegendValue: { fontSize: 12, marginTop: 1 },

  quickActions: { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  quickActionText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  // Coach inline
  coachInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.purple}33`,
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

  // Footer stats
  footerStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  footerSep: { width: 1, height: 28, backgroundColor: COLORS.border },
  footerStat: { flex: 1, alignItems: 'center', gap: 2 },
  footerStatHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerStatValue: { fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
  footerStatLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
