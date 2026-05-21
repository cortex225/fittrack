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
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme';
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
      text: `Salut ${profile.name} ! Je suis Coach JL-AI. Prêt à tout casser ? 💪`,
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={18} color="#08110D" />
          </View>
          <View>
            <Text style={styles.headerTitle}>COACH JL-AI</Text>
            <Text style={styles.headerStatus}>{settings.hasApiKey ? 'En ligne' : 'Clé API requise'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={12}>
          <Ionicons name="settings-outline" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
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
            const textColor = isUser ? '#08110D' : COLORS.text;
            return (
              <View
                style={[
                  styles.bubble,
                  isUser ? styles.bubbleUser : styles.bubbleModel,
                ]}
              >
                {isUser ? (
                  <Text style={[styles.bubbleText, { color: textColor }]}>{item.text}</Text>
                ) : (
                  <MarkdownText text={item.text} color={textColor} />
                )}
              </View>
            );
          }}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.lg }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            loading ? (
              <View style={[styles.bubble, styles.bubbleModel]}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
        />

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
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
          <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={loading || !input.trim()}>
            <Ionicons name="arrow-up" size={22} color="#08110D" />
          </TouchableOpacity>
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
      <Text key={`b-${key++}`} style={{ fontWeight: '900', color }}>
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
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  headerStatus: { color: COLORS.primary, fontSize: 10, fontWeight: '700' },

  bubble: {
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 6,
  },
  bubbleModel: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleText: { color: COLORS.text, fontSize: 14, lineHeight: 20 },

  mdPara: { fontSize: 14, lineHeight: 20, marginBottom: 2 },
  mdHeading: { fontSize: 15, lineHeight: 22, fontWeight: '900', marginTop: 4, marginBottom: 4 },
  mdListRow: { flexDirection: 'row', gap: 8, marginVertical: 2 },
  mdMarker: { fontSize: 14, lineHeight: 20, fontWeight: '800', minWidth: 18 },
  mdItem: { flex: 1, fontSize: 14, lineHeight: 20 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
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
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
