import React, { useEffect, useState } from 'react';
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
import { GoalType } from '../types';
import {
  GOAL_CONFIGS,
  computeTargetsForGoal,
  getApiKey,
  setApiKey,
  wipeAllData,
} from '../utils/storage';

const GOALS: GoalType[] = ['cut', 'maintain', 'bulk'];

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
  const [tee, setTee] = useState(String(profile.tee));

  useEffect(() => {
    setName(profile.name);
    setWeight(String(profile.weightKg));
    setHeight(String(profile.heightCm));
    setAge(String(profile.age));
    setTee(String(profile.tee));
  }, [profile]);

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
    const teeNum = parseInt(tee, 10) || profile.tee;
    const merged = computeTargetsForGoal(
      {
        ...profile,
        name: name.trim() || profile.name,
        weightKg: weightNum,
        heightCm: heightNum,
        age: ageNum,
        tee: teeNum,
      },
      profile.goal
    );
    await updateProfile(merged);
    playFx('success');
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field label="Âge" value={age} onChangeText={setAge} keyboardType="numeric" style={{ flex: 1 }} />
            <Field
              label="TEE (kcal)"
              value={tee}
              onChangeText={setTee}
              keyboardType="numeric"
              style={{ flex: 1 }}
              helper="Dépense totale"
            />
          </View>

          <Text style={styles.label}>Objectif</Text>
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

          <TouchableOpacity style={styles.primaryBtn} onPress={saveProfileForm}>
            <Text style={styles.primaryBtnText}>METTRE À JOUR LE PROFIL</Text>
          </TouchableOpacity>

          <View style={styles.macroSummary}>
            <Text style={styles.macroSumLabel}>Cibles auto-calculées</Text>
            <Text style={styles.macroSumValue}>
              {profile.targetCalories} kcal · P {profile.targetProtein}g · G {profile.targetCarbs}g · L {profile.targetFats}g
            </Text>
          </View>
        </View>

        {/* API */}
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
