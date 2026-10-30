import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { useApp } from '../contexts/AppContext';
import { ActivityLevel, GoalType } from '../types';
import {
  GOAL_CONFIGS,
  computeTargetsForGoal,
  getApiKey,
  setApiKey,
  wipeAllData,
} from '../utils/storage';
import {
  ACTIVITY_CONFIG,
  bmiCategory,
  computeBMI,
  computeBMR,
  computeTDEE,
  idealWeightRange,
  suggestGoal,
  weeklyDeficitTarget,
} from '../utils/health';
import { hasEmbeddedApiKey } from '../services/gemini';
import { Glass } from '../components/glass';
import { Card, PressableScale, SectionLabel, Segmented } from '../components/ui';

const GOALS: GoalType[] = ['cut', 'maintain', 'bulk'];
const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOAL_OPTIONS = GOALS.map((g) => ({ value: g, label: GOAL_CONFIGS[g].label }));
const HAIRLINE = StyleSheet.hairlineWidth;

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { profile, settings, household, updateProfile, updateSettings, refresh, playFx } = useApp();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const [name, setName] = useState(profile.name);
  const [weight, setWeight] = useState(String(profile.weightKg));
  const [height, setHeight] = useState(String(profile.heightCm));
  const [age, setAge] = useState(String(profile.age));

  useEffect(() => {
    setName(profile.name);
    setWeight(String(profile.weightKg));
    setHeight(String(profile.heightCm));
    setAge(String(profile.age));
  }, [profile]);

  // Métriques en live, recalculées à chaque saisie (pas besoin de "sauvegarder").
  const liveMetrics = useMemo(() => {
    const w = parseFloat(weight.replace(',', '.')) || profile.weightKg;
    const h = parseFloat(height.replace(',', '.')) || profile.heightCm;
    const a = parseInt(age, 10) || profile.age;
    const bmi = computeBMI(w, h);
    const bmr = computeBMR({ weightKg: w, heightCm: h, age: a, sex: profile.sex });
    const tdee = computeTDEE(bmr, profile.activityLevel);
    const cat = bmiCategory(bmi);
    const ideal = idealWeightRange(h);
    const suggestion = suggestGoal({ weightKg: w, heightCm: h });
    const deficit = weeklyDeficitTarget(profile.goal, tdee);
    return { bmi, bmr, tdee, cat, ideal, suggestion, deficit, w, h, a };
  }, [weight, height, age, profile.sex, profile.activityLevel, profile.goal]);

  useEffect(() => {
    getApiKey().then((k) => setApiKeyInput(k ?? ''));
  }, []);

  const saveKey = async () => {
    setSavingKey(true);
    try {
      await setApiKey(apiKeyInput.trim());
      await updateSettings({ hasApiKey: !!apiKeyInput.trim() });
      await refresh();
      playFx('success');
      Alert.alert('OK', 'Clé enregistrée.');
    } catch {
      playFx('error');
      Alert.alert('Erreur', 'Impossible d\'enregistrer la clé.');
    } finally {
      setSavingKey(false);
    }
  };

  const saveProfileForm = async () => {
    const weightNum = parseFloat(weight.replace(',', '.')) || profile.weightKg;
    const heightNum = parseFloat(height.replace(',', '.')) || profile.heightCm;
    const ageNum = parseInt(age, 10) || profile.age;
    const merged = computeTargetsForGoal(
      {
        ...profile,
        name: name.trim() || profile.name,
        weightKg: weightNum,
        heightCm: heightNum,
        age: ageNum,
      },
      profile.goal
    );
    await updateProfile(merged);
    playFx('success');
  };

  const applySuggestedGoal = async () => {
    const merged = computeTargetsForGoal(profile, liveMetrics.suggestion.goal);
    await updateProfile(merged);
    playFx('success');
  };

  const setActivityLevel = async (level: ActivityLevel) => {
    const merged = computeTargetsForGoal({ ...profile, activityLevel: level }, profile.goal);
    await updateProfile(merged);
    playFx('click');
  };

  const reset = () => {
    Alert.alert(
      'Effacer toutes les données ?',
      'Tes séances, repas, poids, profil et clé API seront supprimés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            await wipeAllData();
            await refresh();
            playFx('success');
            navigation.popToTop?.();
          },
        },
      ]
    );
  };

  const selectGoal = async (g: GoalType) => {
    const merged = computeTargetsForGoal(profile, g);
    await updateProfile(merged);
    playFx('click');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Retour" accessibilityRole="button">
          <Glass radius={20} interactive style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Glass>
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.xs, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Réglages</Text>

        {/* Foyer */}
        <SectionLabel>Foyer</SectionLabel>
        <Group>
          <PressableScale onPress={() => navigation.navigate('Household')} scaleTo={0.98} style={styles.row} accessibilityRole="button">
            <IconTile icon="people-outline" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Foyer et allergies</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {household.length
                  ? `Toi + ${household.map((m) => m.name).join(', ')}`
                  : 'Ajoute les personnes avec qui tu manges'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </PressableScale>
        </Group>

        {/* Profil */}
        <SectionLabel>Profil</SectionLabel>
        <Group>
          <FieldRow label="Nom" value={name} onChangeText={setName} placeholder="Ton prénom" />
          <FieldRow label="Poids" value={weight} onChangeText={setWeight} keyboardType="numeric" unit="kg" />
          <FieldRow label="Taille" value={height} onChangeText={setHeight} keyboardType="numeric" unit="cm" />
          <FieldRow label="Âge" value={age} onChangeText={setAge} keyboardType="numeric" unit="ans" />
        </Group>
        <PressableScale style={styles.primaryBtn} onPress={saveProfileForm} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Mettre à jour le profil</Text>
        </PressableScale>

        {/* Métriques santé live */}
        <SectionLabel hint="En direct">Métriques santé</SectionLabel>
        <Card>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>IMC</Text>
              <Text style={styles.metricValue}>{liveMetrics.bmi.toFixed(1).replace('.', ',')}</Text>
              <View style={styles.metricCat}>
                <View style={[styles.metricDot, { backgroundColor: liveMetrics.cat.color }]} />
                <Text style={styles.metricHint}>{liveMetrics.cat.label}</Text>
              </View>
            </View>
            <View style={styles.metricSep} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>BMR</Text>
              <Text style={styles.metricValue}>{liveMetrics.bmr.toLocaleString('fr-CA')}</Text>
              <Text style={styles.metricHint}>kcal au repos</Text>
            </View>
            <View style={styles.metricSep} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>TDEE</Text>
              <Text style={styles.metricValue}>{liveMetrics.tdee.toLocaleString('fr-CA')}</Text>
              <Text style={styles.metricHint}>kcal au total</Text>
            </View>
          </View>
          <View style={styles.cardRows}>
            <InfoRow label="Poids sain" value={`${liveMetrics.ideal.min}–${liveMetrics.ideal.max} kg`} />
            <InfoRow label="Cible IMC 22" value={`${liveMetrics.ideal.target} kg`} />
          </View>
        </Card>

        {/* Niveau d'activité */}
        <SectionLabel>Niveau d'activité</SectionLabel>
        <Group>
          {ACTIVITY_LEVELS.map((lvl) => {
            const cfg = ACTIVITY_CONFIG[lvl];
            const active = profile.activityLevel === lvl;
            return (
              <PressableScale
                key={lvl}
                style={styles.row}
                scaleTo={0.98}
                onPress={() => setActivityLevel(lvl)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{cfg.label}</Text>
                  <Text style={styles.rowSub}>{cfg.description}</Text>
                </View>
                <Text style={styles.rowValue}>×{String(cfg.factor).replace('.', ',')}</Text>
                <View style={styles.checkSlot}>
                  {active && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </View>
              </PressableScale>
            );
          })}
        </Group>

        {/* Suggestion */}
        {liveMetrics.suggestion.goal !== profile.goal && (
          <>
            <SectionLabel>Suggestion</SectionLabel>
            <Card>
              <View style={styles.suggestionHeader}>
                <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
                <Text style={styles.suggestionTitle}>
                  Objectif recommandé : {GOAL_CONFIGS[liveMetrics.suggestion.goal].label}
                </Text>
              </View>
              <Text style={styles.suggestionReason}>{liveMetrics.suggestion.reason}</Text>
              <PressableScale style={styles.primaryBtn} onPress={applySuggestedGoal} accessibilityRole="button">
                <Text style={styles.primaryBtnText}>Appliquer cette suggestion</Text>
              </PressableScale>
            </Card>
          </>
        )}

        {/* Objectif */}
        <SectionLabel>Objectif</SectionLabel>
        <Segmented options={GOAL_OPTIONS} value={profile.goal} onChange={selectGoal} />
        <Group style={{ marginTop: SPACING.md }}>
          {profile.goal !== 'maintain' && (
            <InfoRow
              inGroup
              label={profile.goal === 'cut' ? 'Déficit' : 'Surplus'}
              value={`${liveMetrics.deficit.kcalDelta > 0 ? '+' : ''}${liveMetrics.deficit.kcalDelta} kcal/j`}
            />
          )}
          {profile.goal !== 'maintain' && (
            <InfoRow
              inGroup
              label="Rythme"
              value={`~${Math.abs(liveMetrics.deficit.kgPerWeek).toFixed(2)} kg/sem${profile.goal === 'cut' ? ' perdus' : ' pris'}`}
            />
          )}
          <InfoRow inGroup label="Calories" value={`${profile.targetCalories.toLocaleString('fr-CA')} kcal`} />
          <InfoRow
            inGroup
            label="Macros"
            value={`P ${profile.targetProtein} g · G ${profile.targetCarbs} g · L ${profile.targetFats} g`}
          />
        </Group>
        <Text style={styles.footnote}>Cibles auto-calculées à partir de ton profil et de ton objectif.</Text>

        {/* IA */}
        {hasEmbeddedApiKey() ? (
          <>
            <SectionLabel>IA</SectionLabel>
            <Group>
              <View style={styles.row}>
                <IconTile icon="sparkles-outline" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Coach IA, scan repas et chef IA actifs</Text>
                  <Text style={styles.rowSub}>Propulsé par Gemini · clé fournie par l'app</Text>
                </View>
              </View>
            </Group>
          </>
        ) : (
          <>
            <SectionLabel>Clé API Gemini</SectionLabel>
            <Card>
              <Text style={styles.helper}>
                Active le Coach IA, le scan photo de repas et le générateur de recettes. La clé est stockée chiffrée sur l'appareil.
              </Text>
              <View style={styles.keyRow}>
                <View style={styles.keyField}>
                  <TextInput
                    style={styles.keyInput}
                    value={apiKeyInput}
                    onChangeText={setApiKeyInput}
                    placeholder="AIza..."
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry={!showKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <PressableScale
                  onPress={() => setShowKey((s) => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={showKey ? 'Masquer la clé' : 'Afficher la clé'}
                >
                  <Glass radius={22} interactive style={styles.eyeBtn}>
                    <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.text} />
                  </Glass>
                </PressableScale>
              </View>
              <PressableScale
                style={[styles.primaryBtn, savingKey && { opacity: 0.6 }]}
                onPress={saveKey}
                disabled={savingKey}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>
                  {settings.hasApiKey ? 'Mettre à jour la clé' : 'Enregistrer la clé'}
                </Text>
              </PressableScale>
              <PressableScale
                style={styles.linkBtn}
                onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}
                accessibilityRole="link"
              >
                <Text style={styles.linkText}>Obtenir une clé sur Google AI Studio</Text>
                <Ionicons name="open-outline" size={14} color={COLORS.primary} />
              </PressableScale>
            </Card>
          </>
        )}

        {/* Préférences */}
        <SectionLabel>Préférences</SectionLabel>
        <Group>
          <SwitchRow
            icon="phone-portrait-outline"
            label="Retour haptique"
            sub="Vibration sur les interactions clés"
            value={settings.hapticsEnabled}
            onChange={(v) => updateSettings({ hapticsEnabled: v })}
          />
          <SwitchRow
            icon="volume-medium-outline"
            label="Sons (à venir)"
            sub="Effets sonores désactivés temporairement"
            value={settings.soundEnabled}
            onChange={(v) => updateSettings({ soundEnabled: v })}
          />
        </Group>

        {/* Données */}
        <SectionLabel>Données</SectionLabel>
        <Group>
          <PressableScale style={styles.dangerRow} onPress={reset} scaleTo={0.98} accessibilityRole="button">
            <Text style={styles.dangerText}>Effacer toutes les données</Text>
          </PressableScale>
        </Group>
        <Text style={styles.footnote}>Supprime séances, repas, poids, profil et clé API de ce téléphone.</Text>

        <Text style={styles.version}>JL Fit · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

// ── Liste groupée façon Réglages iOS : verre + séparateurs fins ────────────
const Group: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <Glass style={style}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 && <View style={styles.sep} />}
          {child}
        </View>
      ))}
    </Glass>
  );
};

const IconTile: React.FC<{ icon: keyof typeof Ionicons.glyphMap }> = ({ icon }) => (
  <View style={styles.iconTile}>
    <Ionicons name={icon} size={18} color={COLORS.primary} />
  </View>
);

const InfoRow: React.FC<{ label: string; value: string; inGroup?: boolean }> = ({ label, value, inGroup }) => (
  <View style={inGroup ? styles.infoRowGroup : styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
  </View>
);

const FieldRow: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  unit?: string;
}> = ({ label, value, onChangeText, placeholder, keyboardType, unit }) => (
  <View style={styles.fieldRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.fieldInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      keyboardType={keyboardType}
      accessibilityLabel={label}
    />
    {unit ? <Text style={styles.fieldUnit}>{unit}</Text> : null}
  </View>
);

const SwitchRow: React.FC<{
  icon: any;
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon, label, sub, value, onChange }) => (
  <View style={styles.row}>
    <IconTile icon={icon} />
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text style={styles.rowSub}>{sub}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: 'rgba(120,120,128,0.32)', true: COLORS.primary }}
      thumbColor="#fff"
      ios_backgroundColor="rgba(120,120,128,0.32)"
    />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPE.largeTitle, color: COLORS.text, paddingHorizontal: SPACING.xs },

  sep: { height: HAIRLINE, backgroundColor: COLORS.border, marginLeft: SPACING.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    minHeight: 52,
  },
  rowTitle: { ...TYPE.body, fontWeight: '500', color: COLORS.text },
  rowSub: { ...TYPE.caption, fontWeight: '400', color: COLORS.textSecondary, marginTop: 2 },
  rowValue: { ...TYPE.callout, fontWeight: '400', color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  checkSlot: { width: 20, alignItems: 'center' },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    minHeight: 52,
  },
  fieldLabel: { ...TYPE.body, color: COLORS.text, width: 88 },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    paddingVertical: 14,
  },
  fieldUnit: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary, marginLeft: 6, minWidth: 26 },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },

  // Métriques santé
  metricsGrid: { flexDirection: 'row' },
  metricItem: { flex: 1, alignItems: 'flex-start' },
  metricSep: { width: HAIRLINE, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  metricLabel: { ...TYPE.caption, color: COLORS.textSecondary },
  metricValue: { ...TYPE.number, fontSize: 28, color: COLORS.text, marginTop: 2 },
  metricHint: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textMuted, marginTop: 2 },
  metricCat: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  metricDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  cardRows: {
    marginTop: SPACING.md,
    paddingTop: SPACING.xs,
    borderTopWidth: HAIRLINE,
    borderTopColor: COLORS.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  infoRowGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
    gap: SPACING.md,
  },
  infoLabel: { ...TYPE.body, color: COLORS.text },
  infoValue: { ...TYPE.body, color: COLORS.textSecondary, fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },

  // Suggestion
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  suggestionTitle: { ...TYPE.headline, color: COLORS.text, flex: 1 },
  suggestionReason: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary, lineHeight: 21 },

  // Clé API
  helper: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary, lineHeight: 21, marginBottom: SPACING.md },
  keyRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  keyField: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  keyInput: { color: COLORS.text, fontSize: 16, paddingVertical: 0 },
  eyeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  linkText: { ...TYPE.callout, color: COLORS.primary },

  footnote: {
    ...TYPE.footnote,
    fontWeight: '400',
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    lineHeight: 17,
  },

  dangerRow: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg },
  dangerText: { color: COLORS.danger, fontSize: 17, fontWeight: '500' },

  version: {
    ...TYPE.footnote,
    textAlign: 'center',
    color: COLORS.textMuted,
    marginTop: SPACING.xl,
  },
});
