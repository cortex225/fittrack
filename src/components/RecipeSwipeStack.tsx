import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../theme';
import { Recipe } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

export function recipeImageUrl(keyword: string, seed: string): string {
  // Pollinations attend un seed numérique — hash le nom de la recette pour
  // garantir un seed unique par carte (sinon toutes les recettes reçoivent la même image).
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const numericSeed = Math.abs(hash) || 1;
  // On inclut aussi le nom dans le prompt : si Gemini renvoie le même imageKeyword
  // pour plusieurs recettes, le prompt reste différent et l'image aussi.
  const prompt = `${keyword}, ${seed}, food photography, top down, vibrant, appetizing`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=420&nologo=true&seed=${numericSeed}`;
}

interface Props {
  recipes: Recipe[];
  onLike: (r: Recipe) => void;
  onSkip: (r: Recipe) => void;
  onDetails: (r: Recipe) => void;
  onExhausted: () => void;
}

export default function RecipeSwipeStack({ recipes, onLike, onSkip, onDetails, onExhausted }: Props) {
  const [index, setIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;

  const advance = (dir: 'left' | 'right') => {
    const current = recipes[index];
    if (!current) return;
    if (dir === 'right') onLike(current);
    else onSkip(current);
    position.setValue({ x: 0, y: 0 });
    const next = index + 1;
    setIndex(next);
    if (next >= recipes.length) onExhausted();
  };

  const flick = (dir: 'left' | 'right') => {
    Animated.timing(position, {
      toValue: { x: dir === 'right' ? SCREEN_W * 1.5 : -SCREEN_W * 1.5, y: 0 },
      duration: 220,
      useNativeDriver: true,
    }).start(() => advance(dir));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
        onPanResponderMove: (_e, g) => position.setValue({ x: g.dx, y: g.dy }),
        onPanResponderRelease: (_e, g) => {
          if (g.dx > SWIPE_THRESHOLD) flick('right');
          else if (g.dx < -SWIPE_THRESHOLD) flick('left');
          else {
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              friction: 6,
            }).start();
          }
        },
      }),
    [index]
  );

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-12deg', '0deg', '12deg'],
  });
  const likeOpacity = position.x.interpolate({ inputRange: [0, SCREEN_W * 0.25], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-SCREEN_W * 0.25, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const current = recipes[index];
  const next = recipes[index + 1];

  if (!current) {
    return (
      <View style={styles.doneBox}>
        <Ionicons name="checkmark-done-circle" size={48} color={COLORS.primary} />
        <Text style={styles.doneTitle}>Plus de suggestions</Text>
        <Text style={styles.doneSub}>Régénère pour de nouvelles idées.</Text>
      </View>
    );
  }

  return (
    <View style={styles.stackWrap}>
      <Text style={styles.counter}>
        {index + 1} / {recipes.length}
      </Text>

      <View style={styles.stack}>
        {next && (
          <View style={[styles.card, styles.cardBehind]} pointerEvents="none">
            <RecipeCardContent recipe={next} />
          </View>
        )}

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: Animated.multiply(position.y, 0.3) },
                { rotate },
              ],
            },
          ]}
        >
          <RecipeCardContent recipe={current} />

          <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]}>
            <Text style={styles.stampTextLike}>MIAM</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampNope, { opacity: nopeOpacity }]}>
            <Text style={styles.stampTextNope}>PASSE</Text>
          </Animated.View>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionSkip]} onPress={() => flick('left')}>
          <Ionicons name="close" size={28} color={COLORS.danger} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionInfo]} onPress={() => onDetails(current)}>
          <Ionicons name="reader-outline" size={22} color={COLORS.blue} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionLike]} onPress={() => flick('right')}>
          <Ionicons name="heart" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Swipe → garder · ← passer · tap ℹ pour détails</Text>
    </View>
  );
}

function RecipeCardContent({ recipe }: { recipe: Recipe }) {
  const img = recipe.image ?? recipeImageUrl(recipe.imageKeyword, recipe.name);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  return (
    <>
      <Image
        source={{ uri: img }}
        style={styles.cardImage}
        contentFit="cover"
        transition={200}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
      {!loaded && (
        <View style={styles.imagePlaceholder} pointerEvents="none">
          {errored ? (
            <>
              <Ionicons name="image-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.imagePlaceholderText}>Image indisponible</Text>
            </>
          ) : (
            <>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.imagePlaceholderText}>Génération de l'image…</Text>
            </>
          )}
        </View>
      )}
      <View style={styles.cardOverlay} />
      <View style={styles.cardInfo}>
        <Text style={styles.recipeName} numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text style={styles.recipeDesc} numberOfLines={2}>
          {recipe.desc}
        </Text>
        <View style={styles.statRow}>
          <Stat color={COLORS.primary} value={`${recipe.calories}`} label="KCAL" />
          <Stat color={COLORS.blue} value={`${recipe.protein}g`} label="PROT" />
          <Stat color={COLORS.accent} value={`${recipe.carbs}g`} label="GLUC" />
          <Stat color={COLORS.danger} value={`${recipe.fats}g`} label="LIP" />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{recipe.prepTime}</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="flame-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{recipe.difficulty}</Text>
          </View>
        </View>
      </View>
    </>
  );
}

const Stat: React.FC<{ color: string; value: string; label: string }> = ({ color, value, label }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const CARD_HEIGHT = 480;

const styles = StyleSheet.create({
  stackWrap: { flex: 1, alignItems: 'center', paddingTop: SPACING.sm },
  counter: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  stack: {
    width: '100%',
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: '94%',
    height: CARD_HEIGHT,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardBehind: {
    transform: [{ scale: 0.94 }, { translateY: 14 }],
    opacity: 0.5,
  },
  cardImage: {
    width: '100%',
    height: '60%',
    backgroundColor: COLORS.surface,
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
  },
  imagePlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    height: '25%',
    backgroundColor: 'transparent',
  },
  cardInfo: {
    padding: SPACING.md,
    flex: 1,
    justifyContent: 'space-between',
  },
  recipeName: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  recipeDesc: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  stamp: {
    position: 'absolute',
    top: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 3,
  },
  stampLike: { right: SPACING.lg, borderColor: COLORS.primary, transform: [{ rotate: '-15deg' }] },
  stampNope: { left: SPACING.lg, borderColor: COLORS.danger, transform: [{ rotate: '15deg' }] },
  stampTextLike: { color: COLORS.primary, fontWeight: '900', fontSize: 22, letterSpacing: 2 },
  stampTextNope: { color: COLORS.danger, fontWeight: '900', fontSize: 22, letterSpacing: 2 },

  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSkip: { borderColor: `${COLORS.danger}55` },
  actionInfo: { width: 48, height: 48, borderRadius: 24, borderColor: `${COLORS.blue}55` },
  actionLike: { borderColor: `${COLORS.primary}55` },
  hint: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: SPACING.sm,
    textAlign: 'center',
  },

  doneBox: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 8 },
  doneTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  doneSub: { color: COLORS.textMuted, fontSize: 12 },
});
