import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { GroceryBudget, GroceryCategory, ShoppingItem } from '../types';
import {
  addGroceryTrip,
  addManualShoppingItem,
  clearCheckedShoppingItems,
  clearShoppingList,
  getGroceryBudget,
  getShoppingList,
  removeShoppingItem,
  saveGroceryBudget,
  toggleShoppingItem,
} from '../utils/storage';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../utils/grocery';
import { useApp } from '../contexts/AppContext';
import { Card, PressableScale, Segmented } from '../components/ui';

const money = (n: number) =>
  n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ShoppingListScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { playFx } = useApp();

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [budget, setBudget] = useState<GroceryBudget>({ weekly: null, trips: [] });
  const [input, setInput] = useState('');
  const [tripOpen, setTripOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);

  const load = useCallback(async () => {
    const [list, b] = await Promise.all([getShoppingList(), getGroceryBudget()]);
    setItems(list);
    setBudget(b);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;

  const sections = useMemo(() => {
    const groups = new Map<GroceryCategory, ShoppingItem[]>();
    for (const it of items) {
      const cat = it.category ?? 'other';
      groups.set(cat, [...(groups.get(cat) ?? []), it]);
    }
    return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({
      title: CATEGORY_LABEL[c],
      data: groups.get(c)!.sort((a, b) => Number(a.checked) - Number(b.checked)),
    }));
  }, [items]);

  // Dépense par semaine sur les 3 dernières épiceries saisies.
  const recent = budget.trips.slice(0, 3);
  const perWeek = recent.length
    ? recent.reduce((s, t) => s + t.amount, 0) / recent.reduce((s, t) => s + t.weeks, 0)
    : null;

  const handleToggle = async (id: string) => {
    setItems(await toggleShoppingItem(id));
    playFx('click');
  };

  const handleDelete = async (id: string) => {
    setItems(await removeShoppingItem(id));
    playFx('click');
  };

  const handleAdd = async () => {
    const v = input.trim();
    if (!v) return;
    setItems(await addManualShoppingItem(v));
    setInput('');
    playFx('success');
  };

  const handleClearChecked = () => {
    if (checkedCount === 0) return;
    Alert.alert('Effacer les articles cochés ?', `${checkedCount} article(s) sera(ont) retiré(s).`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Effacer',
        style: 'destructive',
        onPress: async () => {
          setItems(await clearCheckedShoppingItems());
          playFx('success');
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (totalCount === 0) return;
    Alert.alert('Vider toute la liste ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vider',
        style: 'destructive',
        onPress: async () => {
          setItems(await clearShoppingList());
          playFx('success');
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </PressableScale>
        <PressableScale onPress={() => navigation.navigate('MealPlan')} style={styles.iconBtn} accessibilityLabel="Menu de la semaine">
          <Ionicons name="calendar-outline" size={19} color={COLORS.primaryLight} />
        </PressableScale>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SectionList
          sections={sections}
          keyExtractor={(it) => it.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 160 }}
          ListHeaderComponent={
            <View>
              <Text style={styles.display}>Épicerie</Text>
              <Text style={styles.lead}>
                {totalCount > 0 ? `${checkedCount} sur ${totalCount} dans le panier` : 'Ta liste se remplit depuis le menu de la semaine.'}
              </Text>

              <Card style={{ marginTop: SPACING.lg }}>
                <View style={styles.budgetTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.overline}>Budget par semaine</Text>
                    <Text style={styles.budgetValue}>{budget.weekly ? money(budget.weekly) : 'À définir'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.overline}>Dépensé par semaine</Text>
                    <Text
                      style={[
                        styles.budgetValue,
                        perWeek !== null && !!budget.weekly && perWeek > budget.weekly && { color: COLORS.warning },
                      ]}
                    >
                      {perWeek !== null ? money(perWeek) : '—'}
                    </Text>
                  </View>
                </View>
                {perWeek !== null && budget.weekly ? (
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${Math.min(100, (perWeek / budget.weekly) * 100)}%`,
                          backgroundColor: perWeek > budget.weekly ? COLORS.warning : COLORS.primary,
                        },
                      ]}
                    />
                  </View>
                ) : null}
                <Text style={styles.hint}>
                  {recent.length
                    ? `Moyenne de tes ${recent.length} dernière${recent.length > 1 ? 's' : ''} épicerie${recent.length > 1 ? 's' : ''}.`
                    : "Après l'épicerie, entre le total du reçu pour suivre ton budget."}
                </Text>
                <View style={styles.budgetActions}>
                  <PressableScale onPress={() => setBudgetOpen(true)} style={styles.ghost}>
                    <Text style={styles.ghostText}>Modifier le budget</Text>
                  </PressableScale>
                  <PressableScale onPress={() => setTripOpen(true)} style={styles.primarySmall}>
                    <Ionicons name="receipt-outline" size={15} color="#08110D" />
                    <Text style={styles.primarySmallText}>J'ai fait l'épicerie</Text>
                  </PressableScale>
                </View>
              </Card>

              {items.length > 0 && (
                <View style={styles.actionsRow}>
                  {checkedCount > 0 && (
                    <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleClearChecked}>
                      <Ionicons name="checkmark-done-outline" size={14} color={COLORS.primary} />
                      <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Effacer cochés</Text>
                    </Pressable>
                  )}
                  <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleClearAll}>
                    <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                    <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Tout vider</Text>
                  </Pressable>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucun article</Text>
              <Text style={styles.emptyText}>Ouvre Ta semaine, puis « Liste d'épicerie », ou ajoute un article ci-dessous.</Text>
            </View>
          }
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) => (
            <Pressable style={[styles.row, item.checked && styles.rowChecked]} onPress={() => handleToggle(item.id)}>
              <View style={[styles.checkbox, item.checked && styles.checkboxOn]}>
                {item.checked && <Ionicons name="checkmark" size={14} color="#08110D" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, item.checked && styles.itemNameChecked]} numberOfLines={2}>
                  {item.name}
                </Text>
                {(item.note || item.recipes.length > 0) && (
                  <Text style={styles.itemFrom} numberOfLines={1}>
                    {item.note ??
                      (item.recipes.length === 1 ? `pour ${item.recipes[0]}` : `pour ${item.recipes.length} plats`)}
                  </Text>
                )}
              </View>
              {item.quantity ? <Text style={styles.qty}>{item.quantity}</Text> : null}
              <Pressable hitSlop={10} onPress={() => handleDelete(item.id)} accessibilityLabel={`Retirer ${item.name}`}>
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </Pressable>
            </Pressable>
          )}
        />

        <View style={[styles.addBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ajouter un article…"
            placeholderTextColor={COLORS.textMuted}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <PressableScale style={styles.addBtn} onPress={handleAdd} disabled={!input.trim()}>
            <Ionicons name="add" size={22} color="#08110D" />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      <AmountSheet
        key={`budget-${budgetOpen}`}
        visible={budgetOpen}
        title="Budget épicerie par semaine"
        initial={budget.weekly ?? undefined}
        onClose={() => setBudgetOpen(false)}
        onSave={async (amount) => {
          setBudget(await saveGroceryBudget({ weekly: amount }));
          setBudgetOpen(false);
          playFx('success');
        }}
      />
      <AmountSheet
        key={`trip-${tripOpen}`}
        visible={tripOpen}
        title="Total du reçu"
        withWeeks
        onClose={() => setTripOpen(false)}
        onSave={async (amount, weeks) => {
          setBudget(await addGroceryTrip({ date: localToday(), amount, weeks: weeks ?? 1 }));
          setTripOpen(false);
          playFx('success');
        }}
      />
    </View>
  );
}

// ── Saisie d'un montant ────────────────────────────────────────────────────
const AmountSheet: React.FC<{
  visible: boolean;
  title: string;
  initial?: number;
  withWeeks?: boolean;
  onClose: () => void;
  onSave: (amount: number, weeks?: number) => void;
}> = ({ visible, title, initial, withWeeks, onClose, onSave }) => {
  const [value, setValue] = useState(initial ? String(initial) : '');
  const [weeks, setWeeks] = useState<'1' | '2' | '3'>('2');
  const amount = parseFloat(value.replace(',', '.'));
  const valid = Number.isFinite(amount) && amount > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="0 $"
            placeholderTextColor={COLORS.textMuted}
            style={styles.amountInput}
            autoFocus
          />
          {withWeeks && (
            <>
              <Text style={styles.sheetLabel}>Cette épicerie couvre</Text>
              <Segmented
                options={[
                  { value: '1', label: '1 sem.' },
                  { value: '2', label: '2 sem.' },
                  { value: '3', label: '3 sem.' },
                ]}
                value={weeks}
                onChange={setWeeks}
              />
            </>
          )}
          <PressableScale
            onPress={() => valid && onSave(Math.round(amount * 100) / 100, Number(weeks))}
            style={[styles.saveBtn, !valid && { opacity: 0.4 }]}
            disabled={!valid}
          >
            <Text style={styles.saveText}>Enregistrer</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  display: { ...TYPE.display, color: COLORS.text },
  lead: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.xs },
  overline: { ...TYPE.overline, color: COLORS.textMuted },
  budgetTop: { flexDirection: 'row', gap: SPACING.md },
  budgetValue: { ...TYPE.title, color: COLORS.text, marginTop: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: COLORS.surface, marginTop: SPACING.md, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  hint: { ...TYPE.caption, color: COLORS.textMuted, marginTop: SPACING.sm, fontWeight: '500' },
  budgetActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  ghost: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, alignItems: 'center' },
  ghostText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  primarySmall: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 12, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  primarySmallText: { fontSize: 13, fontWeight: '800', color: '#08110D' },
  sectionTitle: { ...TYPE.overline, color: COLORS.textSecondary, marginTop: SPACING.lg, marginBottom: SPACING.sm },

  empty: { alignItems: 'center', padding: SPACING.xl, gap: 10 },
  emptyTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.lg },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: RADIUS.pill, borderWidth: 1 },
  actionBtnSecondary: { backgroundColor: `${COLORS.primary}11`, borderColor: `${COLORS.primary}55` },
  actionBtnDanger: { backgroundColor: `${COLORS.danger}11`, borderColor: `${COLORS.danger}55` },
  actionBtnText: { fontSize: 12, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginBottom: 6 },
  rowChecked: { opacity: 0.45 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  itemName: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  itemNameChecked: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  itemFrom: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  qty: { color: COLORS.primaryLight, fontSize: 14, fontWeight: '800' },

  addBar: { flexDirection: 'row', gap: 8, padding: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  input: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 11, color: COLORS.text, fontSize: 15 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xxl },
  sheetTitle: { ...TYPE.headline, color: COLORS.text },
  sheetLabel: { ...TYPE.caption, color: COLORS.textMuted, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  amountInput: { marginTop: SPACING.md, fontSize: 36, fontWeight: '800', color: COLORS.text, paddingVertical: SPACING.sm },
  saveBtn: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#08110D', fontSize: 16, fontWeight: '800' },
});
