import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Modal } from '../components/Modal';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { useApp } from '../contexts/AppContext';
import { ActivityLevel, AllergenKey, GoalType, HouseholdMember } from '../types';
import { ACTIVITY_CONFIG } from '../utils/health';
import { ALLERGENS, ALLERGEN_BY_KEY } from '../utils/allergens';
import { OWNER_ID, computeTargetsForGoal, newHouseholdMember } from '../utils/storage';
import { AppBackground, Glass } from '../components/glass';
import {
  AnimatedNumber,
  Card,
  Chip,
  PressableScale,
  SectionLabel,
  Segmented,
  Stepper,
} from '../components/ui';

const GOALS: { value: GoalType; label: string }[] = [
  { value: 'cut', label: 'Perte' },
  { value: 'maintain', label: 'Maintien' },
  { value: 'bulk', label: 'Muscle' },
];

const GOAL_LABEL: Record<GoalType, string> = {
  cut: 'Perte de poids',
  maintain: 'Maintien',
  bulk: 'Prise de muscle',
};

const SEXES: { value: 'male' | 'female'; label: string }[] = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
];

const CUISINES = [
  'Ivoirienne',
  'Ouest-africaine',
  'Coréenne',
  'Japonaise',
  'Thaïe',
  'Québécoise',
  'Méditerranéenne',
  'Libanaise',
  'Mexicaine',
];

const HAIRLINE = StyleSheet.hairlineWidth;

export default function HouseholdScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { members, updateProfile, upsertMember, removeMember, playFx } = useApp();
  const [editing, setEditing] = useState<HouseholdMember | null>(null);

  const saveMember = async (m: HouseholdMember) => {
    const updated = computeTargetsForGoal(m, m.goal) as HouseholdMember;
    if (m.id === OWNER_ID) {
      const { id: _id, ...profile } = updated;
      await updateProfile(profile);
    } else {
      await upsertMember(updated);
    }
    playFx('success');
    setEditing(null);
  };

  const confirmRemove = (m: HouseholdMember) => {
    Alert.alert(`Retirer ${m.name || 'cette personne'} ?`, 'Ses cibles et ses exclusions seront effacées de ce téléphone.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          await removeMember(m.id);
          setEditing(null);
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} accessibilityLabel="Retour" accessibilityRole="button">
          <Glass radius={20} interactive style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Glass>
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.xs, paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.display}>Foyer</Text>
          <Text style={styles.lead}>Qui mange à ta table. Chaque personne garde ses cibles, et ses allergies bloquent les recettes.</Text>
        </View>

        {members.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            isOwner={m.id === OWNER_ID}
            onPress={() => {
              playFx('click');
              setEditing(m);
            }}
          />
        ))}

        <PressableScale
          style={{ marginTop: SPACING.md }}
          onPress={() => {
            playFx('click');
            setEditing(newHouseholdMember());
          }}
          accessibilityLabel="Ajouter une personne"
          accessibilityRole="button"
        >
          <Glass radius={RADIUS.pill} interactive style={styles.secondaryBtn}>
            <Ionicons name="person-add-outline" size={20} color={COLORS.text} />
            <Text style={styles.secondaryText}>Ajouter une personne</Text>
          </Glass>
        </PressableScale>

        <View style={styles.note}>
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.danger} style={{ marginTop: 1 }} />
          <Text style={styles.noteText}>
            Une allergie est une exclusion stricte : toute recette qui la contient est écartée avant de s'afficher, même si l'IA se trompe. Ces données restent sur ce téléphone.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={!!editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(null)}
      >
        {editing && (
          <MemberEditor
            initial={editing}
            isOwner={editing.id === OWNER_ID}
            isNew={editing.id !== OWNER_ID && !members.some((m) => m.id === editing.id)}
            onCancel={() => setEditing(null)}
            onSave={saveMember}
            onRemove={() => confirmRemove(editing)}
          />
        )}
      </Modal>
    </View>
  );
}

// ── Carte d'une personne ───────────────────────────────────────────────────
const MemberCard: React.FC<{
  member: HouseholdMember;
  isOwner: boolean;
  onPress: () => void;
}> = ({ member, isOwner, onPress }) => {
  const strict = [
    ...(member.allergens ?? []).map((k) => ALLERGEN_BY_KEY[k]?.label).filter(Boolean),
    ...(member.strictExclusions ?? []),
  ] as string[];

  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={{ marginTop: SPACING.md }} accessibilityRole="button">
      <Card>
        <View style={styles.cardTop}>
          <View style={[styles.avatar, isOwner && { backgroundColor: COLORS.primarySoft }]}>
            <Text style={[styles.avatarText, isOwner && { color: COLORS.primary }]}>
              {(member.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {member.name || 'Sans nom'}
              {isOwner ? <Text style={styles.nameMuted}>  ·  toi</Text> : null}
            </Text>
            <Text style={styles.goal}>{GOAL_LABEL[member.goal]}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </View>

        <View style={styles.statsRow}>
          <Stat value={member.targetCalories} unit="kcal" />
          <Stat value={member.targetProtein} unit="g prot." />
          <Stat value={member.targetCarbs} unit="g gluc." />
        </View>

        {strict.length > 0 && (
          <View style={styles.strictBlock}>
            <View style={styles.strictHead}>
              <Ionicons name="lock-closed" size={13} color={COLORS.danger} />
              <Text style={styles.strictLabel}>Exclusions strictes</Text>
            </View>
            <View style={styles.chipsRow}>
              {strict.map((s) => (
                <Chip key={s} label={s} tone="danger" active />
              ))}
            </View>
          </View>
        )}
      </Card>
    </PressableScale>
  );
};

const Stat: React.FC<{ value: number; unit: string }> = ({ value, unit }) => (
  <View style={{ flex: 1 }}>
    <AnimatedNumber value={value} style={styles.statValue} />
    <Text style={styles.statUnit}>{unit}</Text>
  </View>
);

// Étiquette de section d'une exclusion stricte : rouge + cadenas, sans capitales.
const StrictLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.dangerSection}>
    <Text style={styles.dangerSectionLabel}>{children}</Text>
    <View style={styles.dangerHint}>
      <Ionicons name="lock-closed" size={12} color={COLORS.danger} />
      <Text style={styles.dangerHintText}>Exclusion stricte</Text>
    </View>
  </View>
);

// ── Édition d'une personne ─────────────────────────────────────────────────
const MemberEditor: React.FC<{
  initial: HouseholdMember;
  isOwner: boolean;
  isNew: boolean;
  onCancel: () => void;
  onSave: (m: HouseholdMember) => void;
  onRemove: () => void;
}> = ({ initial, isOwner, isNew, onCancel, onSave, onRemove }) => {
  const insets = useSafeAreaInsets();
  const [m, setM] = useState<HouseholdMember>({
    ...initial,
    allergens: initial.allergens ?? [],
    strictExclusions: initial.strictExclusions ?? [],
    dislikes: initial.dislikes ?? [],
    cuisines: initial.cuisines ?? [],
  });
  const [strictInput, setStrictInput] = useState('');
  const [dislikeInput, setDislikeInput] = useState('');

  // Les cibles se recalculent en direct pendant la saisie.
  const preview = useMemo(() => computeTargetsForGoal(m, m.goal), [m]);
  const set = (patch: Partial<HouseholdMember>) => setM((prev) => ({ ...prev, ...patch }));

  const toggleAllergen = (k: AllergenKey) =>
    set({
      allergens: m.allergens!.includes(k) ? m.allergens!.filter((a) => a !== k) : [...m.allergens!, k],
    });
  const toggleCuisine = (c: string) =>
    set({ cuisines: m.cuisines!.includes(c) ? m.cuisines!.filter((x) => x !== c) : [...m.cuisines!, c] });

  const addTo = (field: 'strictExclusions' | 'dislikes', raw: string, reset: () => void) => {
    const v = raw.trim();
    if (!v) return;
    const list = m[field] ?? [];
    if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) set({ [field]: [...list, v] });
    reset();
  };

  const canSave = m.name.trim().length > 0;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppBackground />
      <View style={styles.editorHeader}>
        <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel="Annuler">
          <Glass radius={RADIUS.pill} interactive style={styles.navPill}>
            <Text style={styles.navPillText}>Annuler</Text>
          </Glass>
        </PressableScale>
        <Text style={styles.editorTitle} numberOfLines={1}>{isNew ? 'Nouvelle personne' : m.name || 'Profil'}</Text>
        <PressableScale
          onPress={() => canSave && onSave(m)}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="OK"
          accessibilityState={{ disabled: !canSave }}
          style={[styles.navPill, styles.navPillPrimary, !canSave && { opacity: 0.4 }]}
        >
          <Text style={styles.navPillPrimaryText}>OK</Text>
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: insets.bottom + 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <Text style={styles.previewLabel}>Cible par jour</Text>
          <View style={styles.previewRow}>
            <AnimatedNumber value={preview.targetCalories} style={styles.previewKcal} />
            <Text style={styles.previewUnit}>kcal</Text>
          </View>
          <View style={styles.statsRow}>
            <Stat value={preview.targetProtein} unit="g protéines" />
            <Stat value={preview.targetCarbs} unit="g glucides" />
            <Stat value={preview.targetFats} unit="g lipides" />
          </View>
        </Card>

        <SectionLabel>Prénom</SectionLabel>
        <Glass radius={RADIUS.lg}>
          <TextInput
            value={m.name}
            onChangeText={(name) => set({ name })}
            placeholder="Prénom"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
            autoCapitalize="words"
          />
        </Glass>

        <SectionLabel>Objectif</SectionLabel>
        <Segmented options={GOALS} value={m.goal} onChange={(goal) => set({ goal })} />

        <SectionLabel>Corps</SectionLabel>
        <Segmented
          options={SEXES}
          value={m.sex === 'female' ? 'female' : 'male'}
          onChange={(sex) => set({ sex })}
        />
        <View style={styles.stepperGrid}>
          <Stepper label="Âge" value={m.age} unit="ans" min={14} max={99} onChange={(age) => set({ age })} />
          <Stepper label="Taille" value={m.heightCm} unit="cm" min={120} max={230} onChange={(heightCm) => set({ heightCm })} />
        </View>
        <View style={styles.stepperGrid}>
          <Stepper label="Poids" value={m.weightKg} unit="kg" step={0.5} decimals={1} min={35} max={250} onChange={(weightKg) => set({ weightKg })} />
        </View>

        <SectionLabel>Activité</SectionLabel>
        <View style={styles.chipsRow}>
          {(Object.keys(ACTIVITY_CONFIG) as ActivityLevel[]).map((k) => (
            <Chip key={k} label={ACTIVITY_CONFIG[k].label} active={m.activityLevel === k} onPress={() => set({ activityLevel: k })} />
          ))}
        </View>
        <Text style={styles.helper}>{ACTIVITY_CONFIG[m.activityLevel].description}</Text>

        <StrictLabel>Allergies</StrictLabel>
        <View style={styles.chipsRow}>
          {ALLERGENS.map((a) => (
            <Chip
              key={a.key}
              label={a.label}
              tone="danger"
              active={m.allergens!.includes(a.key)}
              onPress={() => toggleAllergen(a.key)}
            />
          ))}
        </View>

        <StrictLabel>Autres aliments interdits</StrictLabel>
        <AddRow
          value={strictInput}
          onChange={setStrictInput}
          placeholder="Ex. kiwi, porc"
          onAdd={() => addTo('strictExclusions', strictInput, () => setStrictInput(''))}
        />
        {m.strictExclusions!.length > 0 && (
          <View style={styles.chipsRow}>
            {m.strictExclusions!.map((s) => (
              <Chip key={s} label={s} tone="danger" active onRemove={() => set({ strictExclusions: m.strictExclusions!.filter((x) => x !== s) })} />
            ))}
          </View>
        )}

        <SectionLabel hint="À éviter si possible">N'aime pas</SectionLabel>
        <AddRow
          value={dislikeInput}
          onChange={setDislikeInput}
          placeholder="Ex. bouillon miso"
          onAdd={() => addTo('dislikes', dislikeInput, () => setDislikeInput(''))}
        />
        {m.dislikes!.length > 0 && (
          <View style={styles.chipsRow}>
            {m.dislikes!.map((s) => (
              <Chip key={s} label={s} active onRemove={() => set({ dislikes: m.dislikes!.filter((x) => x !== s) })} />
            ))}
          </View>
        )}

        <SectionLabel>Cuisines préférées</SectionLabel>
        <View style={styles.chipsRow}>
          {CUISINES.map((c) => (
            <Chip key={c} label={c} active={m.cuisines!.includes(c)} onPress={() => toggleCuisine(c)} />
          ))}
        </View>

        {!isOwner && !isNew && (
          <PressableScale onPress={onRemove} style={styles.removeBtn} accessibilityRole="button">
            <Text style={styles.removeText}>Retirer du foyer</Text>
          </PressableScale>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const AddRow: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onAdd: () => void;
}> = ({ value, onChange, placeholder, onAdd }) => (
  <View style={styles.addRow}>
    <Glass radius={RADIUS.pill} style={{ flex: 1 }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        style={styles.pillInput}
        onSubmitEditing={onAdd}
        returnKeyType="done"
      />
    </Glass>
    <PressableScale onPress={onAdd} style={styles.addBtn} accessibilityLabel="Ajouter" accessibilityRole="button">
      <Ionicons name="add" size={22} color={COLORS.onPrimary} />
    </PressableScale>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { paddingHorizontal: SPACING.xs },
  display: { ...TYPE.largeTitle, color: COLORS.text },
  lead: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 22 },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  name: { ...TYPE.headline, color: COLORS.text },
  nameMuted: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary },
  goal: { ...TYPE.caption, fontWeight: '400', color: COLORS.textSecondary, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: HAIRLINE,
    borderTopColor: COLORS.border,
  },
  statValue: { ...TYPE.number, fontSize: 22, color: COLORS.text },
  statUnit: { ...TYPE.caption, fontWeight: '400', color: COLORS.textSecondary, marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },

  strictBlock: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: HAIRLINE,
    borderTopColor: COLORS.border,
  },
  strictHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strictLabel: { ...TYPE.caption, color: COLORS.danger },

  secondaryBtn: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  secondaryText: { color: COLORS.text, fontSize: 17, fontWeight: '600' },

  note: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  noteText: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textSecondary, flex: 1, lineHeight: 17 },

  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  editorTitle: { ...TYPE.headline, color: COLORS.text, flex: 1, textAlign: 'center' },
  navPill: { height: 36, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center' },
  navPillText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  navPillPrimary: { borderRadius: RADIUS.pill, backgroundColor: COLORS.primary, minWidth: 56 },
  navPillPrimaryText: { fontSize: 15, fontWeight: '600', color: COLORS.onPrimary },

  previewLabel: { ...TYPE.caption, color: COLORS.textSecondary },
  previewRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: SPACING.xs },
  previewKcal: { ...TYPE.number, color: COLORS.text, fontSize: 44 },
  previewUnit: { ...TYPE.headline, fontWeight: '500', color: COLORS.textSecondary },

  input: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 17,
  },
  pillInput: {
    paddingHorizontal: SPACING.lg,
    height: 46,
    color: COLORS.text,
    fontSize: 16,
  },
  stepperGrid: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  helper: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 17 },

  dangerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  dangerSectionLabel: { ...TYPE.overline, color: COLORS.textSecondary },
  dangerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.dangerSoft,
  },
  dangerHintText: { ...TYPE.footnote, color: COLORS.danger },

  addRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    marginTop: SPACING.xxl,
    height: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerSoft,
  },
  removeText: { color: COLORS.danger, fontSize: 17, fontWeight: '600' },
});
