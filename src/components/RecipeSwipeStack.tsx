import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SHADOW, SPACING, TYPE } from '../theme';
import { Glass } from './glass';
import { PressableScale } from './ui';
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
        <Ionicons name="checkmark-circle-outline" size={44} color={COLORS.primary} />
        <Text style={styles.doneTitle}>Plus de suggestions</Text>
        <Text style={styles.doneSub}>Régénère pour de nouvelles idées.</Text>
      </View>
    );
  }

  return (
    <View style={styles.stackWrap}>
      <Text style={styles.counter}>
        {index + 1} sur {recipes.length}
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
            <Ionicons name="heart" size={16} color={COLORS.onPrimary} />
            <Text style={styles.stampTextLike}>Miam</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampNope, { opacity: nopeOpacity }]}>
            <Ionicons name="close" size={16} color={COLORS.text} />
            <Text style={styles.stampTextNope}>Passe</Text>
          </Animated.View>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <PressableScale onPress={() => flick('left')} accessibilityLabel="Passer cette recette">
          <Glass radius={30} style={styles.actionBtn}>
            <Ionicons name="close" size={26} color={COLORS.text} />
          </Glass>
        </PressableScale>
        <PressableScale onPress={() => onDetails(current)} accessibilityLabel="Voir la recette">
          <Glass radius={24} style={styles.actionInfo}>
            <Ionicons name="reader-outline" size={20} color={COLORS.text} />
          </Glass>
        </PressableScale>
        <PressableScale
          onPress={() => flick('right')}
          style={[styles.actionBtn, styles.actionLike]}
          accessibilityLabel="Garder cette recette"
        >
          <Ionicons name="heart" size={24} color={COLORS.onPrimary} />
        </PressableScale>
      </View>

      <Text style={styles.hint}>Glisse à droite pour garder, à gauche pour passer</Text>
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
              <Ionicons name="image-outline" size={30} color={COLORS.textMuted} />
              <Text style={styles.imagePlaceholderText}>Image indisponible</Text>
            </>
          ) : (
            <>
              <ActivityIndicator color={COLORS.textSecondary} />
              <Text style={styles.imagePlaceholderText}>Génération de l'image…</Text>
            </>
          )}
        </View>
      )}
      <LinearGradient
        colors={['rgba(5,6,11,0)', 'rgba(5,6,11,0.72)', 'rgba(5,6,11,0.94)']}
        locations={[0, 0.45, 1]}
        style={styles.cardOverlay}
        pointerEvents="none"
      />
      <View style={styles.cardInfo}>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="time-outline" size={13} color={COLORS.text} />
            <Text style={styles.metaText}>{recipe.prepTime}</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="speedometer-outline" size={13} color={COLORS.text} />
            <Text style={styles.metaText}>{recipe.difficulty}</Text>
          </View>
        </View>
        <Text style={styles.recipeName} numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text style={styles.recipeDesc} numberOfLines={2}>
          {recipe.desc}
        </Text>
        <View style={styles.statRow}>
          <Stat value={`${recipe.calories}`} unit="kcal" label="Énergie" />
          <Stat dot={COLORS.blue} value={`${recipe.protein}`} unit="g" label="Protéines" />
          <Stat dot={COLORS.accent} value={`${recipe.carbs}`} unit="g" label="Glucides" />
          <Stat dot={COLORS.purple} value={`${recipe.fats}`} unit="g" label="Lipides" />
        </View>
      </View>
    </>
  );
}

const Stat: React.FC<{ dot?: string; value: string; unit: string; label: string }> = ({ dot, value, unit, label }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>
      {value}
      <Text style={styles.statUnit}> {unit}</Text>
    </Text>
    <View style={styles.statLabelRow}>
      {dot ? <View style={[styles.statDot, { backgroundColor: dot }]} /> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
);

const CARD_HEIGHT = 480;

const styles = StyleSheet.create({
  stackWrap: { flex: 1, alignItems: 'center', paddingTop: SPACING.sm },
  counter: {
    ...TYPE.footnote,
    color: COLORS.textMuted,
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
    backgroundColor: 'rgba(18,20,28,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderStrong,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  cardBehind: {
    transform: [{ scale: 0.94 }, { translateY: 14 }],
    opacity: 0.5,
  },
  cardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '62%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    ...TYPE.footnote,
    color: COLORS.textMuted,
  },
  cardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  cardInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.lg,
  },
  recipeName: { ...TYPE.title, fontSize: 24, color: COLORS.text, marginTop: SPACING.sm },
  recipeDesc: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderStrong,
  },
  stat: { flex: 1 },
  statValue: { ...TYPE.number, fontSize: 18, color: COLORS.text },
  statUnit: { fontSize: 12, fontWeight: '500', letterSpacing: 0, color: COLORS.textSecondary },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: { ...TYPE.footnote, color: COLORS.textSecondary },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  metaText: { ...TYPE.footnote, color: COLORS.text },

  stamp: {
    position: 'absolute',
    top: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  stampLike: { left: SPACING.lg, backgroundColor: COLORS.primary },
  stampNope: { right: SPACING.lg, backgroundColor: 'rgba(30,32,40,0.85)' },
  stampTextLike: { ...TYPE.headline, color: COLORS.onPrimary },
  stampTextNope: { ...TYPE.headline, color: COLORS.text },

  actions: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  actionBtn: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  actionLike: { borderRadius: 30, backgroundColor: COLORS.primary },
  hint: {
    ...TYPE.footnote,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    textAlign: 'center',
  },

  doneBox: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 8 },
  doneTitle: { ...TYPE.headline, color: COLORS.text },
  doneSub: { ...TYPE.caption, color: COLORS.textSecondary },
});
