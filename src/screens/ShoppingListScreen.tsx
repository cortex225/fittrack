import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme';
import { ShoppingItem } from '../types';
import {
  addManualShoppingItem,
  clearCheckedShoppingItems,
  clearShoppingList,
  getShoppingList,
  removeShoppingItem,
  toggleShoppingItem,
} from '../utils/storage';
import { useApp } from '../contexts/AppContext';

export default function ShoppingListScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { playFx } = useApp();

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [input, setInput] = useState('');

  const load = useCallback(async () => {
    setItems(await getShoppingList());
  }, []);

  useEffect(() => { load(); }, [load]);

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.title}>LISTE DE COURSE</Text>
          {totalCount > 0 && (
            <Text style={styles.subtitle}>
              {checkedCount} / {totalCount} cochés
            </Text>
          )}
        </View>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 160, gap: 6 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucun article</Text>
              <Text style={styles.emptyText}>
                Génère une recette et tape "Ajouter au panier", ou ajoute un article ci-dessous.
              </Text>
            </View>
          }
          ListHeaderComponent={
            items.length > 0 ? (
              <View style={styles.actionsRow}>
                {checkedCount > 0 && (
                  <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleClearChecked}>
                    <Ionicons name="checkmark-done-outline" size={14} color={COLORS.primary} />
                    <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>EFFACER COCHÉS</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleClearAll}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                  <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>TOUT VIDER</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, item.checked && styles.rowChecked]}
              onPress={() => handleToggle(item.id)}
            >
              <View style={[styles.checkbox, item.checked && styles.checkboxOn]}>
                {item.checked && <Ionicons name="checkmark" size={14} color="#08110D" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, item.checked && styles.itemNameChecked]} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.recipes.length > 0 && (
                  <Text style={styles.itemFrom} numberOfLines={1}>
                    {item.recipes.length === 1
                      ? `de ${item.recipes[0]}`
                      : `de ${item.recipes.length} recettes`}
                  </Text>
                )}
              </View>
              <Pressable hitSlop={10} onPress={() => handleDelete(item.id)}>
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
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={!input.trim()}>
            <Ionicons name="add" size={22} color="#08110D" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

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
  title: { color: COLORS.text, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  subtitle: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },

  empty: { alignItems: 'center', padding: SPACING.xl, gap: 10 },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900', marginTop: 4 },
  emptyText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 16 },

  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  actionBtnSecondary: { backgroundColor: `${COLORS.primary}11`, borderColor: `${COLORS.primary}55` },
  actionBtnDanger: { backgroundColor: `${COLORS.danger}11`, borderColor: `${COLORS.danger}55` },
  actionBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowChecked: { opacity: 0.5 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  itemName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  itemNameChecked: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  itemFrom: { color: COLORS.textMuted, fontSize: 10, marginTop: 2, fontStyle: 'italic' },

  addBar: {
    flexDirection: 'row',
    gap: 8,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
