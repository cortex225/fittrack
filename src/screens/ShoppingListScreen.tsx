import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  FlatList,
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
import { Glass } from '../components/glass';

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
        <PressableScale onPress={() => navigation.goBack()} accessibilityLabel="Retour">
          <Glass radius={20} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Glass>
        </PressableScale>
        <PressableScale onPress={() => navigation.navigate('MealPlan')} accessibilityLabel="Menu de la semaine">
          <Glass radius={20} style={styles.iconBtn}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.text} />
          </Glass>
        </PressableScale>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={sections}
          keyExtractor={(sec) => sec.title}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + 160 }}
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
                  <View style={styles.budgetDivider} />
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
                  <View style={{ flex: 1 }}>
                    <PressableScale onPress={() => setBudgetOpen(true)}>
                      <Glass radius={RADIUS.pill} style={styles.ghost}>
                        <Text style={styles.ghostText}>Modifier le budget</Text>
                      </Glass>
                    </PressableScale>
                  </View>
                  <View style={{ flex: 1 }}>
                    <PressableScale onPress={() => setTripOpen(true)} style={styles.primarySmall}>
                      <Ionicons name="receipt-outline" size={17} color={COLORS.onPrimary} />
                      <Text style={styles.primarySmallText}>J'ai fait l'épicerie</Text>
                    </PressableScale>
                  </View>
                </View>
              </Card>

              {items.length > 0 && (
                <View style={styles.actionsRow}>
                  {checkedCount > 0 && (
                    <View style={{ flex: 1 }}>
                      <PressableScale onPress={handleClearChecked}>
                        <Glass radius={RADIUS.pill} style={styles.actionBtn}>
                          <Ionicons name="checkmark-done-outline" size={17} color={COLORS.text} />
                          <Text style={styles.actionBtnText}>Effacer cochés</Text>
                        </Glass>
                      </PressableScale>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <PressableScale onPress={handleClearAll}>
                      <Glass radius={RADIUS.pill} style={styles.actionBtn}>
                        <Ionicons name="trash-outline" size={17} color={COLORS.danger} />
                        <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Tout vider</Text>
                      </Glass>
                    </PressableScale>
                  </View>
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
          renderItem={({ item: section }) => (
            <View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Glass radius={RADIUS.xl}>
                {section.data.map((item, idx) => (
                  <View key={item.id}>
                    {idx > 0 && <View style={styles.separator} />}
                    <Pressable
                      style={({ pressed }) => [styles.row, pressed && { backgroundColor: COLORS.surface }]}
                      onPress={() => handleToggle(item.id)}
                    >
                      <View style={[styles.checkbox, item.checked && styles.checkboxOn]}>
                        {item.checked && <Ionicons name="checkmark" size={15} color={COLORS.onPrimary} />}
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
                  </View>
                ))}
              </Glass>
            </View>
          )}
        />

        <View style={[styles.addBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
          <Glass radius={RADIUS.pill} style={styles.addGlass}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ajouter un article…"
              placeholderTextColor={COLORS.textMuted}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <PressableScale
              style={[styles.addBtn, !input.trim() && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!input.trim()}
              accessibilityLabel="Ajouter"
            >
              <Ionicons name="add" size={22} color={input.trim() ? COLORS.onPrimary : COLORS.textMuted} />
            </PressableScale>
          </Glass>
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
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initial ? String(initial) : '');
  const [weeks, setWeeks] = useState<'1' | '2' | '3'>('2');
  const amount = parseFloat(value.replace(',', '.'));
  const valid = Number.isFinite(amount) && amount > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheetWrap, { marginBottom: Math.max(insets.bottom, SPACING.sm) }]} onPress={() => {}}>
          <View style={styles.sheetBacking}>
            <Glass radius={RADIUS.xl} style={styles.sheet}>
              <View style={styles.grabber} />
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>{title}</Text>
                <PressableScale onPress={onClose} accessibilityLabel="Fermer">
                  <View style={styles.sheetClose}>
                    <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                  </View>
                </PressableScale>
              </View>
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
            </Glass>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  display: { ...TYPE.largeTitle, color: COLORS.text, marginTop: SPACING.xs },
  lead: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary, marginTop: SPACING.xs },
  overline: { ...TYPE.caption, color: COLORS.textSecondary },
  budgetTop: { flexDirection: 'row', gap: SPACING.md },
  budgetDivider: { width: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  budgetValue: { ...TYPE.number, fontSize: 26, color: COLORS.text, marginTop: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: COLORS.surface, marginTop: SPACING.md, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  hint: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textMuted, marginTop: SPACING.sm, lineHeight: 17 },
  budgetActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  ghost: { paddingVertical: 13, alignItems: 'center' },
  ghostText: { ...TYPE.callout, fontWeight: '600', color: COLORS.text },
  primarySmall: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primarySmallText: { ...TYPE.callout, fontWeight: '600', color: COLORS.onPrimary },
  sectionTitle: { ...TYPE.overline, color: COLORS.textSecondary, marginTop: SPACING.xl, marginBottom: SPACING.sm, marginLeft: SPACING.md },

  empty: { alignItems: 'center', padding: SPACING.xl, gap: 10 },
  emptyTitle: { ...TYPE.headline, color: COLORS.text, marginTop: 4 },
  emptyText: { ...TYPE.caption, fontWeight: '400', color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },

  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  actionBtnText: { ...TYPE.callout, fontWeight: '600', color: COLORS.text },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: SPACING.md, paddingVertical: 13 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: SPACING.md + 24 + 14 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  itemName: { ...TYPE.body, color: COLORS.text },
  itemNameChecked: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  itemFrom: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textMuted, marginTop: 2 },
  qty: { ...TYPE.callout, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },

  addBar: { paddingTop: SPACING.sm, paddingHorizontal: SPACING.md },
  addGlass: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, paddingRight: 5, paddingVertical: 5 },
  input: { flex: 1, paddingVertical: 8, color: COLORS.text, ...TYPE.body },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { backgroundColor: COLORS.cardElevated },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetWrap: { marginHorizontal: SPACING.sm },
  sheetBacking: { borderRadius: RADIUS.xl, backgroundColor: 'rgba(18,20,28,0.85)', overflow: 'hidden' },
  sheet: { padding: SPACING.lg, paddingTop: SPACING.sm },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: COLORS.borderStrong, marginBottom: SPACING.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  sheetTitle: { ...TYPE.title, color: COLORS.text, flex: 1 },
  sheetClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.cardElevated, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  amountInput: { marginTop: SPACING.md, ...TYPE.number, fontSize: 44, color: COLORS.text, paddingVertical: SPACING.sm },
  saveBtn: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  saveText: { fontSize: 17, fontWeight: '600', color: COLORS.onPrimary },
});
