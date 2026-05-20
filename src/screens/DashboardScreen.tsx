import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useApp, GOAL_CONFIGS } from '../contexts/AppContext';
import { formatDateKey, getNutritionLog } from '../utils/storage';
import { WEEKLY_SCHEDULE } from '../data/library';
import { GoalType, NutritionLog } from '../types';
import { MissingApiKeyError, getCoachAdvice } from '../services/gemini';

const GOALS: GoalType[] = ['cut', 'maintain', 'bulk'];

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {
    profile,
    goal,
    gamification,
    currentLevel,
    nextLevel,
    xpProgress,
    setGoal,
    playFx,
    addXp,
  } = useApp();

  const [date, setDate] = useState<Date>(new Date());
  const [nutrition, setNutrition] = useState<NutritionLog | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const dayInfo = WEEKLY_SCHEDULE[date.getDay()];

  const loadDay = useCallback(async () => {
    const log = await getNutritionLog(formatDateKey(date));
    setNutrition(log);
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      loadDay();
    }, [loadDay])
  );

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  const totalCals = (nutrition?.meals ?? []).reduce((a, m) => a + m.calories, 0);
  const waterMl = nutrition?.water ?? 0;
  const calPct = Math.min(100, (totalCals / profile.targetCalories) * 100);
  const waterPct = Math.min(100, (waterMl / profile.targetWater) * 100);

  const jumpToDate = (offset: number) => {
    playFx('click');
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d);
  };

  const handleAddWater = async () => {
    if (!nutrition) return;
    const next = { ...nutrition, water: waterMl + 250 };
    setNutrition(next);
    const { saveNutritionLog } = await import('../utils/storage');
    await saveNutritionLog(next);
    playFx('water');
    await addXp(5);
  };

  const handleGetAdvice = async () => {
    if (!nutrition) return;
    setLoadingAdvice(true);
    playFx('click');
    try {
      const res = await getCoachAdvice(profile, goal, nutrition, dayInfo.title);
      setAdvice(res);
      playFx('success');
    } catch (err: any) {
      if (err instanceof MissingApiKeyError) {
        setAdvice("Configure ta clé Gemini dans Réglages pour activer le coach IA.");
      } else {
        setAdvice('Connexion impossible. Continue tes efforts !');
      }
      playFx('error');
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>JL Fit</Text>
            <View style={styles.levelChip}>
              <Ionicons name="flash" size={11} color={COLORS.accent} />
              <Text style={styles.levelChipText}>NIV. {gamification.level} · {currentLevel.name}</Text>
            </View>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xpProgress}%` }]} />
          </View>
          <Text style={styles.xpLabel}>{gamification.xp} / {nextLevel.xpNeeded} XP</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: SPACING.md, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('CoachChat')} hitSlop={10}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={10}>
            <Ionicons name="settings-outline" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Navigator */}
      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => jumpToDate(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.dateLabel}>
          {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <TouchableOpacity onPress={() => jumpToDate(1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Goal Switcher */}
        <View style={styles.goalRow}>
          {GOALS.map((g) => {
            const cfg = GOAL_CONFIGS[g];
            const active = goal === g;
            return (
              <TouchableOpacity
                key={g}
                style={[
                  styles.goalBtn,
                  active && { backgroundColor: cfg.color, borderColor: cfg.color },
                ]}
                onPress={() => {
                  playFx('click');
                  setGoal(g);
                }}
              >
                <Text style={[styles.goalText, active && { color: '#fff' }]}>{cfg.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {/* Calories */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => navigation.navigate('Nutrition')}
            activeOpacity={0.85}
          >
            <View style={styles.tileHeader}>
              <Text style={styles.tileLabel}>ÉNERGIE</Text>
              <Ionicons
                name="flame"
                size={16}
                color={totalCals > profile.targetCalories ? COLORS.danger : COLORS.primary}
              />
            </View>
            <Text style={styles.tileBig}>
              {totalCals} <Text style={styles.tileUnit}>kcal</Text>
            </Text>
            <Text style={styles.tileSub}>Objectif: {profile.targetCalories}</Text>
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${calPct}%`,
                    backgroundColor: totalCals > profile.targetCalories ? COLORS.danger : COLORS.primary,
                  },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* Workout */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => navigation.navigate('Training')}
            activeOpacity={0.85}
          >
            <View style={styles.tileHeader}>
              <Text style={styles.tileLabel}>AUJOURD'HUI</Text>
              <Ionicons name="barbell" size={16} color={COLORS.blue} />
            </View>
            <Text style={styles.tileTitle} numberOfLines={2}>
              {dayInfo.title}
            </Text>
            <Text style={styles.tileSub}>{dayInfo.type}</Text>
            <View style={[styles.cta, { backgroundColor: `${COLORS.blue}22`, borderColor: `${COLORS.blue}44` }]}>
              <Text style={[styles.ctaText, { color: COLORS.blue }]}>PROGRAMME</Text>
            </View>
          </TouchableOpacity>

          {/* Water */}
          <View style={styles.tile}>
            <View style={styles.tileHeader}>
              <Text style={styles.tileLabel}>HYDRATATION</Text>
              <Ionicons name="water" size={16} color="#42A5F5" />
            </View>
            <Text style={styles.tileBig}>
              {(waterMl / 1000).toFixed(1)} <Text style={styles.tileUnit}>L</Text>
            </Text>
            <Text style={styles.tileSub}>Objectif: {(profile.targetWater / 1000).toFixed(1)} L</Text>
            <View style={styles.waterRow}>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${waterPct}%`, backgroundColor: '#42A5F5' }]} />
              </View>
              <TouchableOpacity style={styles.waterBtn} onPress={handleAddWater}>
                <Ionicons name="add" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Coach AI */}
          <TouchableOpacity
            style={styles.tile}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CoachChat')}
          >
            <View style={styles.tileHeader}>
              <Text style={styles.tileLabel}>COACH IA</Text>
              <Ionicons name="sparkles" size={16} color={COLORS.purple} />
            </View>
            {advice ? (
              <>
                <Text style={styles.adviceText} numberOfLines={4}>"{advice}"</Text>
                <View style={[styles.cta, { backgroundColor: `${COLORS.purple}22`, borderColor: `${COLORS.purple}44`, marginTop: 8 }]}>
                  <Text style={[styles.ctaText, { color: COLORS.purple }]}>OUVRIR LE CHAT</Text>
                </View>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.cta, { backgroundColor: `${COLORS.purple}22`, borderColor: `${COLORS.purple}44`, marginTop: 8 }]}
                onPress={handleGetAdvice}
                disabled={loadingAdvice}
              >
                {loadingAdvice ? (
                  <ActivityIndicator size="small" color={COLORS.purple} />
                ) : (
                  <Text style={[styles.ctaText, { color: COLORS.purple }]}>ANALYSER</Text>
                )}
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {/* Macros breakdown */}
        <View style={styles.macroCard}>
          <Text style={styles.cardTitle}>Macros du jour</Text>
          {[
            { label: 'Protéines', value: (nutrition?.meals ?? []).reduce((a, m) => a + m.protein, 0), target: profile.targetProtein, color: COLORS.primary, unit: 'g' },
            { label: 'Glucides', value: (nutrition?.meals ?? []).reduce((a, m) => a + m.carbs, 0), target: profile.targetCarbs, color: COLORS.accent, unit: 'g' },
            { label: 'Lipides', value: (nutrition?.meals ?? []).reduce((a, m) => a + m.fats, 0), target: profile.targetFats, color: COLORS.danger, unit: 'g' },
          ].map((m) => {
            const pct = m.target > 0 ? Math.min(100, (m.value / m.target) * 100) : 0;
            return (
              <View key={m.label} style={{ marginTop: SPACING.sm }}>
                <View style={styles.macroHeader}>
                  <Text style={styles.macroLabel}>{m.label}</Text>
                  <Text style={styles.macroValue}>
                    <Text style={{ color: m.color, fontWeight: '700' }}>{Math.round(m.value)}</Text>
                    <Text style={{ color: COLORS.textSecondary }}> / {m.target}{m.unit}</Text>
                  </Text>
                </View>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: m.color }]} />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelChipText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  xpTrack: {
    height: 5,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    overflow: 'hidden',
    width: 200,
  },
  xpFill: { height: '100%', backgroundColor: COLORS.accent },
  xpLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4, fontWeight: '600' },

  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  dateLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  goalRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  goalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  goalText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 12, letterSpacing: 0.8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tile: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 140,
  },
  tileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tileLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  tileBig: { color: COLORS.text, fontSize: 26, fontWeight: '900', marginTop: 6 },
  tileUnit: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  tileTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 2,
  },
  tileSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, marginBottom: 8 },
  bar: { height: 5, backgroundColor: COLORS.surface, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  waterBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#42A5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: 'auto',
    borderWidth: 1,
  },
  ctaText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  adviceText: {
    color: COLORS.text,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 6,
  },

  macroCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  macroValue: { fontSize: 12 },
});
