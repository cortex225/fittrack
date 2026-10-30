import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { Glass } from '../components/glass';
import { PressableScale } from '../components/ui';
import { useApp } from '../contexts/AppContext';
import { ChatTurn, MissingApiKeyError, coachChat } from '../services/gemini';

export default function CoachChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { profile, goal, settings, playFx } = useApp();

  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: 'model',
      text: `Salut ${profile.name} ! Je suis Coach JL-AI. Prêt à tout casser ?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList<ChatTurn>>(null);

  // Si un seedMessage est passé en route param (depuis la bibliothèque d'exercices ou Training),
  // on le pré-remplit dans l'input — l'utilisateur peut toujours l'éditer avant d'envoyer.
  useEffect(() => {
    const seed = route.params?.seedMessage;
    if (seed && typeof seed === 'string') setInput(seed);
  }, [route.params?.seedMessage]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    if (!settings.hasApiKey) {
      navigation.navigate('Settings');
      return;
    }
    playFx('click');
    setInput('');
    const next = [...messages, { role: 'user' as const, text: msg }];
    setMessages(next);
    setLoading(true);
    try {
      const reply = await coachChat(messages, msg, profile, goal);
      setMessages([...next, { role: 'model', text: reply }]);
      playFx('success');
    } catch (err: any) {
      console.error('[Gemini] coachChat:', err);
      const errText =
        err instanceof MissingApiKeyError
          ? 'Configure ta clé Gemini dans Réglages pour activer le coach.'
          : `Connexion impossible. (${err?.message ?? 'erreur inconnue'})`;
      setMessages([...next, { role: 'model', text: errText }]);
      playFx('error');
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Retour">
          <Glass radius={20} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Glass>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Coach JL-AI</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: settings.hasApiKey ? COLORS.primary : COLORS.textMuted },
              ]}
            />
            <Text style={styles.headerStatus}>{settings.hasApiKey ? 'En ligne' : 'Clé API requise'}</Text>
          </View>
        </View>
        <PressableScale onPress={() => navigation.navigate('Settings')} hitSlop={12} accessibilityLabel="Réglages">
          <Glass radius={20} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={COLORS.text} />
          </Glass>
        </PressableScale>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            if (isUser) {
              return (
                <View style={[styles.bubble, styles.bubbleUser]}>
                  <Text style={[styles.bubbleText, { color: COLORS.onPrimary }]}>{item.text}</Text>
                </View>
              );
            }
            return (
              <Glass radius={22} style={[styles.bubble, styles.bubbleModel]}>
                <MarkdownText text={item.text} color={COLORS.text} />
              </Glass>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.lg }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            loading ? (
              <Glass radius={22} style={[styles.bubble, styles.bubbleModel, styles.typing]}>
                <ActivityIndicator size="small" color={COLORS.textSecondary} />
              </Glass>
            ) : undefined
          }
        />

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
          <Glass radius={RADIUS.pill} style={styles.inputGlass}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={settings.hasApiKey ? 'Pose ta question…' : 'Configure ta clé d\'abord'}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              editable={!loading}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <PressableScale
              style={[styles.sendBtn, (loading || !input.trim()) && styles.sendBtnDisabled]}
              onPress={send}
              disabled={loading || !input.trim()}
              accessibilityLabel="Envoyer"
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={loading || !input.trim() ? COLORS.textMuted : COLORS.onPrimary}
              />
            </PressableScale>
          </Glass>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Markdown léger (gras + listes num/puces + paragraphes) ───────────────────
function renderInline(text: string, color: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push(
      <Text key={`b-${key++}`} style={{ fontWeight: '600', color }}>
        {m[1]}
      </Text>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MarkdownText({ text, color }: { text: string; color: string }) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trimStart();
        const num = trimmed.match(/^(\d+)\.\s+(.*)$/);
        const bullet = trimmed.match(/^[-*]\s+(.*)$/);
        const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);

        if (trimmed === '') return <View key={i} style={{ height: 8 }} />;

        if (heading) {
          return (
            <Text key={i} style={[styles.mdHeading, { color }]}>
              {renderInline(heading[2], color)}
            </Text>
          );
        }
        if (num) {
          return (
            <View key={i} style={styles.mdListRow}>
              <Text style={[styles.mdMarker, { color }]}>{num[1]}.</Text>
              <Text style={[styles.mdItem, { color }]}>{renderInline(num[2], color)}</Text>
            </View>
          );
        }
        if (bullet) {
          return (
            <View key={i} style={styles.mdListRow}>
              <Text style={[styles.mdMarker, { color }]}>•</Text>
              <Text style={[styles.mdItem, { color }]}>{renderInline(bullet[1], color)}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[styles.mdPara, { color }]}>
            {renderInline(trimmed, color)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...TYPE.headline, color: COLORS.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  headerStatus: { ...TYPE.footnote, color: COLORS.textSecondary },

  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    borderBottomRightRadius: 8,
  },
  bubbleModel: {
    alignSelf: 'flex-start',
  },
  typing: { paddingHorizontal: 20 },
  bubbleText: { ...TYPE.body, color: COLORS.text, lineHeight: 22 },

  mdPara: { fontSize: 16, lineHeight: 22, letterSpacing: -0.15, marginBottom: 2 },
  mdHeading: { ...TYPE.headline, lineHeight: 23, marginTop: 6, marginBottom: 4 },
  mdListRow: { flexDirection: 'row', gap: 8, marginVertical: 2 },
  mdMarker: { fontSize: 16, lineHeight: 22, fontWeight: '500', minWidth: 18, opacity: 0.64 },
  mdItem: { flex: 1, fontSize: 16, lineHeight: 22, letterSpacing: -0.15 },

  inputBar: {
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  inputGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 5,
    paddingVertical: 5,
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    color: COLORS.text,
    ...TYPE.body,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.cardElevated },
});
