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
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme';
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

const GOALS: GoalType[] = ['cut', 'maintain', 'bulk'];
const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { profile, settings, updateProfile, updateSettings, refresh, playFx } = useApp();

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
    const w = parseFloat(weight) || profile.weightKg;
    const h = parseFloat(height) || profile.heightCm;
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
    const weightNum = parseFloat(weight) || profile.weightKg;
    const heightNum = parseFloat(height) || profile.heightCm;
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Réglages</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <SectionTitle>PROFIL</SectionTitle>
        <View style={styles.card}>
          <Field label="Nom" value={name} onChangeText={setName} placeholder="Ton prénom" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field label="Poids (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" style={{ flex: 1 }} />
            <Field label="Taille (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" style={{ flex: 1 }} />
          </View>
          <Field label="Âge" value={age} onChangeText={setAge} keyboardType="numeric" />

          <TouchableOpacity style={styles.primaryBtn} onPress={saveProfileForm}>
            <Text style={styles.primaryBtnText}>METTRE À JOUR LE PROFIL</Text>
          </TouchableOpacity>
        </View>

        {/* Métriques santé live */}
        <SectionTitle>MÉTRIQUES SANTÉ</SectionTitle>
        <View style={styles.card}>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{liveMetrics.bmi.toFixed(1)}</Text>
              <Text style={styles.metricLabel}>IMC</Text>
              <View style={[styles.metricBadge, { backgroundColor: `${liveMetrics.cat.color}22`, borderColor: liveMetrics.cat.color }]}>
                <Text style={[styles.metricBadgeText, { color: liveMetrics.cat.color }]}>{liveMetrics.cat.label}</Text>
              </View>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{liveMetrics.bmr}</Text>
              <Text style={styles.metricLabel}>BMR kcal</Text>
              <Text style={styles.metricHint}>Repos</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{liveMetrics.tdee}</Text>
              <Text style={styles.metricLabel}>TDEE kcal</Text>
              <Text style={styles.metricHint}>Total</Text>
            </View>
          </View>
          <View style={styles.idealRow}>
            <Ionicons name="fitness-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.idealText}>
              Poids sain : {liveMetrics.ideal.min}–{liveMetrics.ideal.max} kg · cible IMC 22 : {liveMetrics.ideal.target} kg
            </Text>
          </View>
        </View>

        {/* Niveau d'activité */}
        <SectionTitle>NIVEAU D'ACTIVITÉ</SectionTitle>
        <View style={styles.card}>
          {ACTIVITY_LEVELS.map((lvl) => {
            const cfg = ACTIVITY_CONFIG[lvl];
            const active = profile.activityLevel === lvl;
            return (
              <TouchableOpacity
                key={lvl}
                style={[styles.activityRow, active && styles.activityRowActive]}
                onPress={() => setActivityLevel(lvl)}
              >
                <View style={[styles.activityDot, active && { backgroundColor: COLORS.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activityLabel, active && { color: COLORS.text }]}>{cfg.label}</Text>
                  <Text style={styles.activitySub}>{cfg.description}</Text>
                </View>
                <Text style={styles.activityFactor}>×{cfg.factor}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Suggestion IA */}
        {liveMetrics.suggestion.goal !== profile.goal && (
          <>
            <SectionTitle>SUGGESTION INTELLIGENTE</SectionTitle>
            <View style={[styles.card, styles.suggestionCard]}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="sparkles" size={18} color={COLORS.primary} />
                <Text style={styles.suggestionTitle}>
                  Objectif recommandé : {GOAL_CONFIGS[liveMetrics.suggestion.goal].label}
                </Text>
              </View>
              <Text style={styles.suggestionReason}>{liveMetrics.suggestion.reason}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={applySuggestedGoal}>
                <Text style={styles.primaryBtnText}>APPLIQUER CETTE SUGGESTION</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Objectif */}
        <SectionTitle>OBJECTIF</SectionTitle>
        <View style={styles.card}>
          <View style={styles.goalRow}>
            {GOALS.map((g) => {
              const cfg = GOAL_CONFIGS[g];
              const active = profile.goal === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.goalBtn, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                  onPress={async () => {
                    const merged = computeTargetsForGoal(profile, g);
                    await updateProfile(merged);
                    playFx('click');
                  }}
                >
                  <Text style={[styles.goalText, active && { color: '#fff' }]}>{cfg.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {profile.goal !== 'maintain' && (
            <View style={styles.deficitRow}>
              <Ionicons
                name={profile.goal === 'cut' ? 'trending-down-outline' : 'trending-up-outline'}
                size={14}
                color={COLORS.textMuted}
              />
              <Text style={styles.deficitText}>
                {liveMetrics.deficit.kcalDelta > 0 ? '+' : ''}
                {liveMetrics.deficit.kcalDelta} kcal/j · ~{Math.abs(liveMetrics.deficit.kgPerWeek).toFixed(2)} kg/sem
                {profile.goal === 'cut' ? ' perdus' : ' pris'}
              </Text>
            </View>
          )}

          <View style={styles.macroSummary}>
            <Text style={styles.macroSumLabel}>Cibles auto-calculées</Text>
            <Text style={styles.macroSumValue}>
              {profile.targetCalories} kcal · P {profile.targetProtein}g · G {profile.targetCarbs}g · L {profile.targetFats}g
            </Text>
          </View>
        </View>

        {/* API */}
        {hasEmbeddedApiKey() ? (
          <>
            <SectionTitle>IA</SectionTitle>
            <View style={styles.card}>
              <View style={styles.embeddedKeyRow}>
                <Ionicons name="sparkles" size={18} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.embeddedKeyTitle}>Coach IA, scan repas et chef IA actifs</Text>
                  <Text style={styles.embeddedKeySub}>Propulsé par Gemini · clé fournie par l'app</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            <SectionTitle>CLÉ API GEMINI</SectionTitle>
            <View style={styles.card}>
              <Text style={styles.helper}>
                Active le Coach IA, le scan photo de repas et le générateur de recettes. La clé est stockée chiffrée sur l'appareil.
              </Text>
              <View style={styles.keyRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  placeholder="AIza..."
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowKey((s) => !s)}>
                  <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveKey} disabled={savingKey}>
                <Text style={styles.primaryBtnText}>
                  {settings.hasApiKey ? 'METTRE À JOUR LA CLÉ' : 'ENREGISTRER LA CLÉ'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}
              >
                <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                <Text style={styles.linkText}>Obtenir une clé sur Google AI Studio</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Preferences */}
        <SectionTitle>PRÉFÉRENCES</SectionTitle>
        <View style={styles.card}>
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
        </View>

        {/* Danger */}
        <SectionTitle>DONNÉES</SectionTitle>
        <View style={styles.card}>
          <TouchableOpacity style={styles.dangerBtn} onPress={reset}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            <Text style={styles.dangerText}>EFFACER TOUTES LES DONNÉES</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>JL Fit · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const Field: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  style?: any;
  helper?: string;
}> = ({ label, value, onChangeText, placeholder, keyboardType, style, helper }) => (
  <View style={[{ marginBottom: SPACING.sm }, style]}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      keyboardType={keyboardType}
    />
    {helper && <Text style={styles.fieldHelper}>{helper}</Text>}
  </View>
);

const SwitchRow: React.FC<{
  icon: any;
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon, label, sub, value, onChange }) => (
  <View style={styles.switchRow}>
    <Ionicons name={icon} size={20} color={COLORS.textSecondary} />
    <View style={{ flex: 1 }}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Text style={styles.switchSub}>{sub}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: COLORS.surface, true: COLORS.primary }}
      thumbColor="#fff"
    />
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.text, fontSize: 17, fontWeight: '900', letterSpacing: 1 },

  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 6,
  },
  helper: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 16, marginBottom: SPACING.md },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldHelper: { color: COLORS.textMuted, fontSize: 10, marginTop: 4 },

  goalRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: SPACING.md },
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

  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  primaryBtnText: { color: '#08110D', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  macroSummary: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  macroSumLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  macroSumValue: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginTop: 4 },

  keyRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  eyeBtn: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm, justifyContent: 'center' },
  linkText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  embeddedKeyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  embeddedKeyTitle: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
  embeddedKeySub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  // Métriques santé
  metricsGrid: { flexDirection: 'row', gap: SPACING.sm },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  metricValue: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  metricLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  metricHint: { color: COLORS.textMuted, fontSize: 9 },
  metricBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginTop: 4,
  },
  metricBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  idealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
  },
  idealText: { color: COLORS.textSecondary, fontSize: 11, flex: 1 },

  // Activité
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  activityRowActive: { backgroundColor: `${COLORS.primary}11` },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
  },
  activityLabel: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 13 },
  activitySub: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  activityFactor: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },

  // Suggestion
  suggestionCard: { borderColor: COLORS.primary, borderWidth: 1 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  suggestionTitle: { color: COLORS.text, fontWeight: '900', fontSize: 13 },
  suggestionReason: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 16 },

  // Déficit
  deficitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
  },
  deficitText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  switchLabel: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  switchSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  dangerBtn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.danger}11`,
    borderWidth: 1,
    borderColor: `${COLORS.danger}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: COLORS.danger, fontWeight: '800', fontSize: 13, letterSpacing: 1 },

  version: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: SPACING.lg,
  },
});
