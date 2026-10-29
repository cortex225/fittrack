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
        <PressableScale onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.display}>Bilan</Text>
        <Text style={styles.lead}>Toutes les 2 semaines : poids et mensurations, puis on ajuste les calories.</Text>

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
              <Text style={styles.statusValue}>{dueIn === 0 ? 'Bilan à faire' : `Dans ${dueIn} jour${dueIn > 1 ? 's' : ''}`}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.overline}>Cible actuelle</Text>
              <AnimatedNumber value={member.targetCalories} style={styles.statusValue} suffix=" kcal" />
            </View>
          </View>
          {weights.length >= 2 && (
            <View style={{ marginTop: SPACING.md }}>
              <Sparkline data={weights} color={COLORS.primary} width={300} height={56} filled showLastDot />
            </View>
          )}
          {last && <Text style={styles.hint}>Dernier bilan le {shortDate(last.date)} : {fmt(last.weightKg)} kg</Text>}
        </Card>

        {result ? (
          <Card style={{ marginTop: SPACING.lg, backgroundColor: COLORS.cardElevated }}>
            {result.verdict ? (
              <>
                <Text style={styles.resultTitle}>{result.verdict.title}</Text>
                <Text style={styles.resultDetail}>{result.verdict.detail}</Text>
                {result.verdict.waistDelta !== null && (
                  <Text style={styles.resultDetail}>
                    Taille : {result.verdict.waistDelta > 0 ? '+' : ''}
                    {fmt(result.verdict.waistDelta)} cm
                  </Text>
                )}
                {result.verdict.adjustment !== 0 && !applied && (
                  <PressableScale onPress={applyAdjustment} style={styles.primaryBtn}>
                    <Text style={styles.primaryText}>
                      Appliquer {result.verdict.adjustment > 0 ? '+' : ''}
                      {result.verdict.adjustment} kcal
                    </Text>
                  </PressableScale>
                )}
                {applied && <Text style={styles.applied}>Nouvelle cible : {fmt(member.targetCalories)} kcal par jour.</Text>}
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
          </Card>
        ) : (
          <>
            <SectionLabel hint="le matin, à jeun">Poids</SectionLabel>
            <View style={styles.weightRow}>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder={last ? fmt(last.weightKg) : fmt(member.weightKg)}
                placeholderTextColor={COLORS.textMuted}
                style={styles.weightInput}
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>

            <SectionLabel hint="en cm, facultatif">Mensurations</SectionLabel>
            <View style={styles.grid}>
              {MEASURES.map(({ key, label }) => (
                <View key={key} style={styles.measure}>
                  <Text style={styles.measureLabel}>{label}</Text>
                  <TextInput
                    value={measures[key] ?? ''}
                    onChangeText={(v) => setMeasures((m) => ({ ...m, [key]: v }))}
                    keyboardType="decimal-pad"
                    placeholder={last?.measures[key] ? fmt(last.measures[key]!) : '—'}
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.measureInput}
                  />
                </View>
              ))}
            </View>

            <PressableScale onPress={save} style={[styles.primaryBtn, !canSave && { opacity: 0.4 }]} disabled={!canSave}>
              <Ionicons name="checkmark" size={18} color="#08110D" />
              <Text style={styles.primaryText}>Enregistrer le bilan</Text>
            </PressableScale>
          </>
        )}

        {history.length > 0 && (
          <>
            <SectionLabel>Historique</SectionLabel>
            {history.slice(0, 10).map((c, i) => {
              const prev = history[i + 1];
              const dw = prev ? Math.round((c.weightKg - prev.weightKg) * 10) / 10 : null;
              return (
                <View key={c.id} style={styles.histRow}>
                  <Text style={styles.histDate}>{shortDate(c.date)}</Text>
                  <Text style={styles.histValue}>{fmt(c.weightKg)} kg</Text>
                  <Text style={[styles.histDelta, dw !== null && dw < 0 && { color: COLORS.blue }]}>
                    {dw === null ? '' : `${dw > 0 ? '+' : ''}${fmt(dw)}`}
                  </Text>
                  <Text style={styles.histWaist}>{c.measures.waist ? `taille ${fmt(c.measures.waist)}` : ''}</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  display: { ...TYPE.display, color: COLORS.text },
  lead: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 21 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.lg },
  overline: { ...TYPE.overline, color: COLORS.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'flex-end' },
  statusValue: { ...TYPE.title, color: COLORS.text, marginTop: 4 },
  hint: { ...TYPE.caption, color: COLORS.textMuted, marginTop: SPACING.sm, fontWeight: '500' },
  weightRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  weightInput: { flex: 1, fontSize: 40, fontWeight: '800', color: COLORS.text, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  weightUnit: { ...TYPE.headline, color: COLORS.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  measure: { width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.sm + 2 },
  measureLabel: { ...TYPE.caption, color: COLORS.textMuted },
  measureInput: { color: COLORS.text, fontSize: 18, fontWeight: '700', paddingVertical: 4 },
  primaryBtn: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#08110D', fontSize: 16, fontWeight: '800' },
  resultTitle: { ...TYPE.title, color: COLORS.text },
  resultDetail: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 21 },
  applied: { ...TYPE.headline, color: COLORS.primaryLight, marginTop: SPACING.md },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, gap: SPACING.sm },
  histDate: { ...TYPE.caption, color: COLORS.textMuted, width: 64 },
  histValue: { ...TYPE.headline, color: COLORS.text, width: 80 },
  histDelta: { ...TYPE.caption, color: COLORS.primaryLight, width: 48 },
  histWaist: { ...TYPE.caption, color: COLORS.textMuted, flex: 1, textAlign: 'right' },
});
