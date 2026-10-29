import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { useApp } from '../contexts/AppContext';
import { ActivityLevel, AllergenKey, GoalType, HouseholdMember } from '../types';
import { ACTIVITY_CONFIG } from '../utils/health';
import { ALLERGENS, ALLERGEN_BY_KEY } from '../utils/allergens';
import { OWNER_ID, computeTargetsForGoal, newHouseholdMember } from '../utils/storage';
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

const AVATAR_TINTS = [COLORS.primary, COLORS.purple, COLORS.blue, COLORS.accent];

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
        <PressableScale onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 60 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.display}>Foyer</Text>
        <Text style={styles.lead}>Qui mange à ta table. Chaque personne garde ses cibles, et ses allergies bloquent les recettes.</Text>

        {members.map((m, i) => (
          <MemberCard
            key={m.id}
            member={m}
            tint={AVATAR_TINTS[i % AVATAR_TINTS.length]}
            isOwner={m.id === OWNER_ID}
            onPress={() => {
              playFx('click');
              setEditing(m);
            }}
          />
        ))}

        <PressableScale
          style={styles.addCard}
          onPress={() => {
            playFx('click');
            setEditing(newHouseholdMember());
          }}
          accessibilityLabel="Ajouter une personne"
        >
          <Ionicons name="person-add-outline" size={20} color={COLORS.primaryLight} />
          <Text style={styles.addText}>Ajouter une personne</Text>
        </PressableScale>

        <View style={styles.note}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textSecondary} />
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
  tint: string;
  isOwner: boolean;
  onPress: () => void;
}> = ({ member, tint, isOwner, onPress }) => {
  const strict = [
    ...(member.allergens ?? []).map((k) => ALLERGEN_BY_KEY[k]?.label).filter(Boolean),
    ...(member.strictExclusions ?? []),
  ] as string[];

  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={{ marginTop: SPACING.md }}>
      <Card>
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: tint + '22', borderColor: tint }]}>
            <Text style={[styles.avatarText, { color: tint }]}>{(member.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{member.name || 'Sans nom'}{isOwner ? '  ·  toi' : ''}</Text>
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
          <View style={styles.chipsRow}>
            {strict.map((s) => (
              <Chip key={s} label={s} tone="danger" active />
            ))}
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
      <View style={styles.editorHeader}>
        <PressableScale onPress={onCancel} style={styles.textBtn}>
          <Text style={styles.textBtnLabel}>Annuler</Text>
        </PressableScale>
        <Text style={styles.editorTitle}>{isNew ? 'Nouvelle personne' : m.name || 'Profil'}</Text>
        <PressableScale onPress={() => canSave && onSave(m)} style={styles.textBtn} disabled={!canSave}>
          <Text style={[styles.textBtnLabel, { color: canSave ? COLORS.primaryLight : COLORS.textMuted }]}>OK</Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 80 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card style={styles.previewCard}>
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
        <TextInput
          value={m.name}
          onChangeText={(name) => set({ name })}
          placeholder="Prénom"
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
          autoCapitalize="words"
        />

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

        <SectionLabel hint="exclusion stricte">Allergies</SectionLabel>
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

        <SectionLabel hint="exclusion stricte">Autres aliments interdits</SectionLabel>
        <AddRow
          value={strictInput}
          onChange={setStrictInput}
          placeholder="Ex. kiwi, porc"
          onAdd={() => addTo('strictExclusions', strictInput, () => setStrictInput(''))}
        />
        <View style={styles.chipsRow}>
          {m.strictExclusions!.map((s) => (
            <Chip key={s} label={s} tone="danger" active onRemove={() => set({ strictExclusions: m.strictExclusions!.filter((x) => x !== s) })} />
          ))}
        </View>

        <SectionLabel hint="à éviter si possible">N'aime pas</SectionLabel>
        <AddRow
          value={dislikeInput}
          onChange={setDislikeInput}
          placeholder="Ex. bouillon miso"
          onAdd={() => addTo('dislikes', dislikeInput, () => setDislikeInput(''))}
        />
        <View style={styles.chipsRow}>
          {m.dislikes!.map((s) => (
            <Chip key={s} label={s} active onRemove={() => set({ dislikes: m.dislikes!.filter((x) => x !== s) })} />
          ))}
        </View>

        <SectionLabel>Cuisines préférées</SectionLabel>
        <View style={styles.chipsRow}>
          {CUISINES.map((c) => (
            <Chip key={c} label={c} active={m.cuisines!.includes(c)} onPress={() => toggleCuisine(c)} />
          ))}
        </View>

        {!isOwner && !isNew && (
          <PressableScale onPress={onRemove} style={styles.removeBtn}>
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
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      style={[styles.input, { flex: 1 }]}
      onSubmitEditing={onAdd}
      returnKeyType="done"
    />
    <PressableScale onPress={onAdd} style={styles.addBtn} accessibilityLabel="Ajouter">
      <Ionicons name="add" size={22} color="#08110D" />
    </PressableScale>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  display: { ...TYPE.display, color: COLORS.text },
  lead: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 21 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800' },
  name: { ...TYPE.headline, color: COLORS.text },
  goal: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', marginTop: SPACING.lg },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  statUnit: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  addCard: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.borderStrong,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  addText: { ...TYPE.headline, color: COLORS.primaryLight },
  note: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  noteText: { ...TYPE.caption, color: COLORS.textSecondary, flex: 1, lineHeight: 18, fontWeight: '500' },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  editorTitle: { ...TYPE.headline, color: COLORS.text },
  textBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  textBtnLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  previewCard: { backgroundColor: COLORS.cardElevated },
  previewLabel: { ...TYPE.overline, color: COLORS.textMuted },
  previewRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: SPACING.xs },
  previewKcal: { ...TYPE.display, color: COLORS.text, fontSize: 40 },
  previewUnit: { ...TYPE.headline, color: COLORS.textSecondary },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
    color: COLORS.text,
    fontSize: 15,
  },
  stepperGrid: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  helper: { ...TYPE.caption, color: COLORS.textMuted, marginTop: SPACING.sm, fontWeight: '500' },
  addRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    marginTop: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    backgroundColor: COLORS.dangerSoft,
  },
  removeText: { ...TYPE.headline, color: COLORS.danger },
});
