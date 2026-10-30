import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { useApp } from '../contexts/AppContext';
import { CheckIn, HouseholdMember, MeasureKey } from '../types';
import {
  OWNER_ID,
  computeTargetsForGoal,
  generateId,
  getCheckIns,
  saveCheckIn,
  saveWeightEntry,
} from '../utils/storage';
import { CheckInVerdict, MEASURES, evaluateCheckIn, nextCheckInIn } from '../utils/checkin';
import { AnimatedNumber, Card, Chip, PressableScale, SectionLabel } from '../components/ui';
import { Glass, GlassCard } from '../components/glass';
import Sparkline from '../components/Sparkline';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const num = (v: string): number | undefined => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined;
};

const fmt = (n: number) => n.toLocaleString('fr-CA');

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
};

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { members, updateProfile, upsertMember, playFx, addXp } = useApp();

  const [memberId, setMemberId] = useState(OWNER_ID);
  const member = members.find((m) => m.id === memberId) ?? members[0];
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [weight, setWeight] = useState('');
  const [measures, setMeasures] = useState<Partial<Record<MeasureKey, string>>>({});
  const [result, setResult] = useState<{ verdict: CheckInVerdict | null; checkIn: CheckIn } | null>(null);
  const [applied, setApplied] = useState(false);

  const load = useCallback(async (id: string) => {
    setHistory(await getCheckIns(id));
    setWeight('');
    setMeasures({});
    setResult(null);
    setApplied(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(memberId);
    }, [load, memberId])
  );

  const last = history[0];
  const dueIn = nextCheckInIn(last, localToday());
  const weights = history.slice(0, 12).map((c) => c.weightKg).reverse();
  const canSave = num(weight) !== undefined;

  const save = async () => {
    const w = num(weight);
    if (!w || !member) return;
    const parsed: Partial<Record<MeasureKey, number>> = {};
    for (const { key } of MEASURES) {
      const v = num(measures[key] ?? '');
      if (v) parsed[key] = v;
    }
    const checkIn: CheckIn = { id: generateId(), memberId: member.id, date: localToday(), weightKg: w, measures: parsed };
    const verdict = last ? evaluateCheckIn(last, checkIn, member.goal) : null;
    setHistory(await saveCheckIn(checkIn));
    if (member.id === OWNER_ID) await saveWeightEntry({ date: checkIn.date, weight: w });
    setResult({ verdict, checkIn });
    playFx('success');
    addXp(100);
  };

  const applyAdjustment = async () => {
    if (!result?.verdict || !member) return;
    const adjusted = computeTargetsForGoal(
      { ...member, weightKg: result.checkIn.weightKg, calorieAdjustment: (member.calorieAdjustment ?? 0) + result.verdict.adjustment },
      member.goal
    ) as HouseholdMember;
    if (member.id === OWNER_ID) {
      const { id: _id, ...profile } = adjusted;
      await updateProfile(profile);
    } else {
      await upsertMember(adjusted);
    }
    await saveCheckIn({ ...result.checkIn, appliedAdjustment: result.verdict.adjustment });
    setApplied(true);
    playFx('success');
  };

  if (!member) return null;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} accessibilityLabel="Retour" accessibilityRole="button">
          <Glass radius={20} interactive style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Glass>
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.xs, paddingBottom: insets.bottom + 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.display}>Bilan</Text>
          <Text style={styles.lead}>Toutes les 2 semaines : poids et mensurations, puis on ajuste les calories.</Text>
        </View>

        {members.length > 1 && (
          <View style={styles.chipsRow}>
            {members.map((m) => (
              <Chip key={m.id} label={m.id === OWNER_ID ? 'Moi' : m.name} active={m.id === memberId} onPress={() => setMemberId(m.id)} />
            ))}
          </View>
        )}

        <Card style={{ marginTop: SPACING.lg }}>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.overline}>{dueIn === 0 ? "C'est le moment" : 'Prochain bilan'}</Text>
              {dueIn === 0 ? (
                <Text style={[styles.statusValue, { color: COLORS.primary }]}>Bilan à faire</Text>
              ) : (
                <View style={styles.numberRow}>
                  <Text style={styles.statusValue}>{dueIn}</Text>
                  <Text style={styles.statusUnit}> jour{dueIn > 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
            <View style={styles.statusDivider} />
            <View style={{ flex: 1 }}>
              <Text style={styles.overline}>Cible actuelle</Text>
              <View style={styles.numberRow}>
                <AnimatedNumber value={member.targetCalories} style={styles.statusValue} />
                <Text style={styles.statusUnit}> kcal</Text>
              </View>
            </View>
          </View>
          {weights.length >= 2 && (
            <View style={{ marginTop: SPACING.lg }}>
              <Sparkline data={weights} color={COLORS.primary} width={300} height={56} filled showLastDot />
            </View>
          )}
          {last && (
            <View style={styles.cardFooter}>
              <Text style={styles.hint}>Dernier bilan le {shortDate(last.date)}</Text>
              <Text style={styles.hintValue}>{fmt(last.weightKg)} kg</Text>
            </View>
          )}
        </Card>

        {result ? (
          <GlassCard tint={COLORS.primary} style={{ marginTop: SPACING.lg }}>
            {result.verdict ? (
              <>
                <Text style={styles.resultTitle}>{result.verdict.title}</Text>
                <Text style={styles.resultDetail}>{result.verdict.detail}</Text>
                {result.verdict.waistDelta !== null && (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultRowLabel}>Tour de taille</Text>
                    <Text style={styles.resultRowValue}>
                      {result.verdict.waistDelta > 0 ? '+' : ''}
                      {fmt(result.verdict.waistDelta)} cm
                    </Text>
                  </View>
                )}
                {result.verdict.adjustment !== 0 && !applied && (
                  <PressableScale onPress={applyAdjustment} style={styles.primaryBtn} accessibilityRole="button">
                    <Text style={styles.primaryText}>
                      Appliquer {result.verdict.adjustment > 0 ? '+' : ''}
                      {result.verdict.adjustment} kcal
                    </Text>
                  </PressableScale>
                )}
                {applied && (
                  <View style={styles.appliedRow}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.applied}>Nouvelle cible : {fmt(member.targetCalories)} kcal par jour.</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.resultTitle}>Bilan enregistré</Text>
                <Text style={styles.resultDetail}>
                  {last && history.length > 1
                    ? 'Moins de 10 jours depuis le dernier : on attend le prochain pour ajuster.'
                    : 'C\'est ton point de départ. Prochain bilan dans 14 jours.'}
                </Text>
              </>
            )}
          </GlassCard>
        ) : (
          <>
            <SectionLabel hint="Le matin, à jeun">Poids</SectionLabel>
            <Card>
              <View style={styles.weightRow}>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder={last ? fmt(last.weightKg) : fmt(member.weightKg)}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.weightInput}
                  accessibilityLabel="Poids en kilogrammes"
                />
                <Text style={styles.weightUnit}>kg</Text>
              </View>
            </Card>

            <SectionLabel hint="En cm, facultatif">Mensurations</SectionLabel>
            <Glass>
              {MEASURES.map(({ key, label }, i) => (
                <View key={key}>
                  {i > 0 && <View style={styles.sep} />}
                  <View style={styles.measureRow}>
                    <Text style={styles.measureLabel}>{label}</Text>
                    <TextInput
                      value={measures[key] ?? ''}
                      onChangeText={(v) => setMeasures((m) => ({ ...m, [key]: v }))}
                      keyboardType="decimal-pad"
                      placeholder={last?.measures[key] ? fmt(last.measures[key]!) : '—'}
                      placeholderTextColor={COLORS.textMuted}
                      style={styles.measureInput}
                      accessibilityLabel={`${label} en centimètres`}
                    />
                    <Text style={styles.measureUnit}>cm</Text>
                  </View>
                </View>
              ))}
            </Glass>

            <PressableScale
              onPress={save}
              style={[styles.primaryBtn, !canSave && { opacity: 0.4 }]}
              disabled={!canSave}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Enregistrer le bilan</Text>
            </PressableScale>
          </>
        )}

        {history.length > 0 && (
          <>
            <SectionLabel>Historique</SectionLabel>
            <Glass>
              {history.slice(0, 10).map((c, i) => {
                const prev = history[i + 1];
                const dw = prev ? Math.round((c.weightKg - prev.weightKg) * 10) / 10 : null;
                return (
                  <View key={c.id}>
                    {i > 0 && <View style={styles.sep} />}
                    <View style={styles.histRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.histValue}>
                          {fmt(c.weightKg)}
                          <Text style={styles.histUnit}> kg</Text>
                        </Text>
                        <Text style={styles.histDate}>
                          {shortDate(c.date)}
                          {c.measures.waist ? ` · taille ${fmt(c.measures.waist)} cm` : ''}
                        </Text>
                      </View>
                      <Text style={styles.histDelta}>
                        {dw === null ? '' : `${dw > 0 ? '+' : ''}${fmt(dw)} kg`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Glass>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const HAIRLINE = StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { paddingHorizontal: SPACING.xs },
  display: { ...TYPE.largeTitle, color: COLORS.text },
  lead: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 22 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.lg },

  overline: { ...TYPE.caption, color: COLORS.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'stretch' },
  statusDivider: { width: HAIRLINE, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  statusValue: { ...TYPE.number, fontSize: 28, color: COLORS.text, marginTop: 4 },
  statusUnit: { ...TYPE.callout, color: COLORS.textSecondary },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: HAIRLINE,
    borderTopColor: COLORS.border,
  },
  hint: { ...TYPE.caption, color: COLORS.textSecondary },
  hintValue: { ...TYPE.caption, color: COLORS.text, fontVariant: ['tabular-nums'] },

  weightRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm },
  weightInput: {
    flex: 1,
    ...TYPE.number,
    fontSize: 44,
    color: COLORS.text,
    paddingVertical: 0,
  },
  weightUnit: { ...TYPE.title, fontWeight: '500', color: COLORS.textSecondary },

  sep: { height: HAIRLINE, backgroundColor: COLORS.border, marginLeft: SPACING.lg },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    minHeight: 50,
  },
  measureLabel: { ...TYPE.body, color: COLORS.text, flex: 1 },
  measureInput: {
    minWidth: 72,
    textAlign: 'right',
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    paddingVertical: 12,
  },
  measureUnit: { ...TYPE.callout, color: COLORS.textSecondary, marginLeft: 6, width: 24 },

  primaryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },

  resultTitle: { ...TYPE.title, color: COLORS.text },
  resultDetail: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 22 },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: HAIRLINE,
    borderTopColor: COLORS.border,
  },
  resultRowLabel: { ...TYPE.body, color: COLORS.textSecondary },
  resultRowValue: { ...TYPE.headline, color: COLORS.text, fontVariant: ['tabular-nums'] },
  appliedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  applied: { ...TYPE.headline, color: COLORS.text, flex: 1 },

  histRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: 12, gap: SPACING.sm },
  histValue: { ...TYPE.headline, color: COLORS.text, fontVariant: ['tabular-nums'] },
  histUnit: { ...TYPE.caption, color: COLORS.textSecondary },
  histDate: { ...TYPE.caption, fontWeight: '400', color: COLORS.textSecondary, marginTop: 2 },
  histDelta: { ...TYPE.callout, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
});
