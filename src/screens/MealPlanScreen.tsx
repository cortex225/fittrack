import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { useApp } from '../contexts/AppContext';
import { MemberPortion, PlannedMeal, WeekPlan } from '../types';
import {
  IvorianShare,
  generateWeekPlan,
  mondayOf,
  regenerateMeal,
  todayIndex,
} from '../services/mealPlan';
import { MissingApiKeyError } from '../services/gemini';
import { recipeImageUrl } from '../components/RecipeSwipeStack';
import {
  OWNER_ID,
  generateId,
  getDishHistory,
  getTodayNutrition,
  getWeekPlan,
  replacePlanShoppingItems,
  saveNutritionLog,
  saveWeekPlan,
} from '../utils/storage';
import { groceryToShoppingItems } from '../utils/grocery';
import { describeStrictExclusions } from '../utils/allergens';
import { AnimatedNumber, Card, Chip, PressableScale, Segmented } from '../components/ui';
import { Glass } from '../components/glass';

const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const LOADING_STEPS = [
  'On choisit les plats de la semaine…',
  'On écarte tout ce qui touche une allergie…',
  'On calcule la portion de chacun…',
  'On cherche les photos…',
];

const IVORIAN_OPTIONS: { value: IvorianShare; label: string }[] = [
  { value: 'some', label: 'Quelques' },
  { value: 'half', label: 'La moitié' },
  { value: 'most', label: 'Surtout' },
];

const dateOf = (weekStart: string, day: number): Date => {
  const [y, m, d] = weekStart.split('-').map(Number);
  return new Date(y, m - 1, d + day);
};

export default function MealPlanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { members, playFx, addXp } = useApp();

  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [day, setDay] = useState(todayIndex());

  const [dinerIds, setDinerIds] = useState<string[] | null>(null);
  const [dinnerCount, setDinnerCount] = useState<'5' | '7'>('7');
  const [ivorian, setIvorian] = useState<IvorianShare>('half');
  const [groceryWeeks, setGroceryWeeks] = useState<'1' | '2' | '3'>('2');

  const activeIds = dinerIds ?? members.map((m) => m.id);
  const diners = members.filter((m) => activeIds.includes(m.id));

  useEffect(() => {
    getWeekPlan().then((p) => {
      setPlan(p);
      setSetupOpen(!p);
      setLoaded(true);
    });
  }, []);

  const isOldWeek = plan ? plan.weekStart !== mondayOf() : false;

  const toggleDiner = (id: string) => {
    if (id === OWNER_ID) return;
    setDinerIds(activeIds.includes(id) ? activeIds.filter((x) => x !== id) : [...activeIds, id]);
  };

  const showError = (err: any) => {
    playFx('error');
    Alert.alert(
      'IA indisponible',
      err instanceof MissingApiKeyError ? 'Configure ta clé Gemini dans Réglages.' : `Erreur : ${err?.message ?? 'inconnue'}`
    );
  };

  const generate = async () => {
    setGenerating(true);
    playFx('click');
    try {
      const next = await generateWeekPlan({
        diners,
        dinnerCount: Number(dinnerCount) as 5 | 7,
        lunchCount: 2,
        ivorianShare: ivorian,
        recentDishes: await getDishHistory(),
      });
      await saveWeekPlan(next);
      setPlan(next);
      setSetupOpen(false);
      setDay(todayIndex());
      playFx('success');
      addXp(50);
    } catch (err) {
      showError(err);
    } finally {
      setGenerating(false);
    }
  };

  const swap = async (meal: PlannedMeal) => {
    if (!plan) return;
    setSwapping(meal.id);
    playFx('click');
    try {
      const planDiners = members.filter((m) => plan.dinerIds.includes(m.id));
      const next = await regenerateMeal(plan, meal.id, {
        diners: planDiners,
        ivorianShare: ivorian,
        recentDishes: await getDishHistory(),
      });
      await saveWeekPlan(next);
      setPlan(next);
      playFx('success');
    } catch (err) {
      showError(err);
    } finally {
      setSwapping(null);
    }
  };

  const logMine = async (meal: PlannedMeal) => {
    const mine = meal.portions.find((p) => p.memberId === OWNER_ID);
    if (!mine) return;
    const log = await getTodayNutrition();
    await saveNutritionLog({
      ...log,
      meals: [
        ...log.meals,
        {
          id: generateId(),
          name: meal.name,
          calories: mine.calories,
          protein: mine.protein,
          carbs: mine.carbs,
          fats: mine.fats,
          category: meal.slot,
          loggedAt: new Date().toISOString(),
        },
      ],
    });
    playFx('success');
    addXp(25);
    Alert.alert('Ajouté', `${meal.name} est dans ton journal du jour.`);
  };

  const buildGroceries = async () => {
    if (!plan) return;
    await replacePlanShoppingItems(groceryToShoppingItems(plan, Number(groceryWeeks), generateId));
    playFx('success');
    navigation.navigate('ShoppingList');
  };

  const dayMeals = useMemo(() => {
    if (!plan) return { lunch: undefined, dinner: undefined };
    return {
      lunch: plan.meals.find((m) => m.slot === 'lunch' && m.days.includes(day)),
      dinner: plan.meals.find((m) => m.slot === 'dinner' && m.days.includes(day)),
    };
  }, [plan, day]);

  const range = plan
    ? `${dateOf(plan.weekStart, 0).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })} au ${dateOf(plan.weekStart, 6).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}`
    : '';

  const exclusions = describeStrictExclusions(diners.map((d) => (d.id === OWNER_ID ? { ...d, name: 'toi' } : d)));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} accessibilityLabel="Retour">
          <Glass radius={20} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Glass>
        </PressableScale>
        {plan && !setupOpen && !generating && (
          <PressableScale onPress={() => setSetupOpen(true)} accessibilityLabel="Nouvelle semaine">
            <Glass radius={20} style={styles.iconBtn}>
              <Ionicons name="sparkles-outline" size={20} color={COLORS.text} />
            </Glass>
          </PressableScale>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + 60 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.display}>Ta semaine</Text>
        <Text style={styles.lead}>
          {plan && !setupOpen ? `${range} · un même plat, une portion pour chacun` : 'Un même plat pour tout le monde, une portion calculée pour chacun.'}
        </Text>

        {!loaded ? null : generating ? (
          <GeneratingCard />
        ) : setupOpen ? (
          <Card style={{ marginTop: SPACING.lg }}>
            {members.length > 1 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Pour qui</Text>
                <View style={styles.chipsRow}>
                  {members.map((m) => (
                    <Chip
                      key={m.id}
                      label={m.id === OWNER_ID ? 'Moi' : m.name}
                      active={activeIds.includes(m.id)}
                      icon={activeIds.includes(m.id) ? 'checkmark-circle' : 'ellipse-outline'}
                      onPress={() => toggleDiner(m.id)}
                    />
                  ))}
                </View>
              </>
            )}
            {members.length === 1 && (
              <PressableScale onPress={() => navigation.navigate('Household')} style={styles.inlineLink}>
                <View style={styles.inlineIcon}>
                  <Ionicons name="people-outline" size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.inlineLinkText}>Ajoute la personne avec qui tu manges</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </PressableScale>
            )}

            <Text style={styles.fieldLabel}>Soupers</Text>
            <Segmented
              options={[
                { value: '5', label: '5 soirs' },
                { value: '7', label: '7 soirs' },
              ]}
              value={dinnerCount}
              onChange={setDinnerCount}
            />

            <Text style={styles.fieldLabel}>Plats ivoiriens</Text>
            <Segmented options={IVORIAN_OPTIONS} value={ivorian} onChange={setIvorian} />

            <Text style={styles.helper}>Plus 2 dîners à préparer le dimanche pour la semaine.</Text>
            {exclusions ? (
              <SafetyBanner icon="lock-closed" text={`Exclu d'office : ${exclusions}`} />
            ) : null}

            <PressableScale onPress={generate} style={styles.primaryBtn}>
              <Ionicons name="sparkles" size={18} color={COLORS.onPrimary} />
              <Text style={styles.primaryText}>Planifier ma semaine</Text>
            </PressableScale>
            {plan && (
              <PressableScale onPress={() => setSetupOpen(false)} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Garder la semaine actuelle</Text>
              </PressableScale>
            )}
          </Card>
        ) : plan ? (
          <>
            {isOldWeek && (
              <PressableScale onPress={() => setSetupOpen(true)} style={{ marginTop: SPACING.lg }}>
                <Glass radius={RADIUS.lg} style={styles.oldWeek}>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
                  <Text style={styles.oldWeekText}>Ce menu date d'une autre semaine. Planifier la nouvelle ?</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </Glass>
              </PressableScale>
            )}

            <DayStrip weekStart={plan.weekStart} value={day} onChange={(d) => { playFx('click'); setDay(d); }} />

            <Text style={styles.dayTitle}>{DAY_LONG[day]}</Text>

            {dayMeals.lunch ? (
              <MealCard
                meal={dayMeals.lunch}
                label="Dîner · préparé le dimanche"
                swapping={swapping === dayMeals.lunch.id}
                onSwap={swap}
                onLog={logMine}
              />
            ) : null}
            {dayMeals.dinner ? (
              <MealCard
                meal={dayMeals.dinner}
                label="Souper"
                swapping={swapping === dayMeals.dinner.id}
                onSwap={swap}
                onLog={logMine}
              />
            ) : (
              <Glass radius={RADIUS.xl} style={styles.freeNight}>
                <Ionicons name="moon-outline" size={20} color={COLORS.textSecondary} />
                <Text style={styles.freeText}>Souper libre ce soir</Text>
              </Glass>
            )}

            <Text style={styles.sectionTitle}>Liste d'épicerie</Text>
            <Card>
              <Text style={styles.helperTop}>Quantités pour vous deux, calculées depuis vos portions.</Text>
              <View style={{ marginTop: SPACING.md }}>
                <Segmented
                  options={[
                    { value: '1', label: '1 semaine' },
                    { value: '2', label: '2 semaines' },
                    { value: '3', label: '3 semaines' },
                  ]}
                  value={groceryWeeks}
                  onChange={setGroceryWeeks}
                />
              </View>
              <PressableScale onPress={buildGroceries} style={styles.primaryBtn}>
                <Ionicons name="cart-outline" size={19} color={COLORS.onPrimary} />
                <Text style={styles.primaryText}>Faire ma liste</Text>
              </PressableScale>
            </Card>

            {plan.blockedCount > 0 && (
              <SafetyBanner
                icon="shield-checkmark"
                style={{ marginTop: SPACING.lg }}
                text={`${plan.blockedCount} plat${plan.blockedCount > 1 ? 's écartés' : ' écarté'} à cause d'une allergie, et remplacé${plan.blockedCount > 1 ? 's' : ''}.`}
              />
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Bandeau de sécurité (allergies) : rouge, toujours lisible ──────────────
const SafetyBanner: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  style?: StyleProp<ViewStyle>;
}> = ({ icon, text, style }) => (
  <View style={[styles.safety, style]} accessibilityRole="alert">
    <View style={styles.safetyIcon}>
      <Ionicons name={icon} size={15} color={COLORS.danger} />
    </View>
    <Text style={styles.safetyText}>{text}</Text>
  </View>
);

// ── Bande des jours ────────────────────────────────────────────────────────
const DayStrip: React.FC<{ weekStart: string; value: number; onChange: (d: number) => void }> = ({
  weekStart,
  value,
  onChange,
}) => {
  const today = weekStart === mondayOf() ? todayIndex() : -1;
  return (
    <Glass radius={RADIUS.xl} style={styles.dayStrip}>
      {DAY_SHORT.map((label, i) => {
        const active = i === value;
        return (
          <View key={label} style={{ flex: 1 }}>
            <PressableScale onPress={() => onChange(i)} style={[styles.dayPill, active && styles.dayPillActive]} accessibilityLabel={DAY_LONG[i]}>
              <Text style={[styles.dayLabel, active && { color: COLORS.onPrimary }]}>{label}</Text>
              <Text style={[styles.dayNum, active && { color: COLORS.onPrimary }]}>{dateOf(weekStart, i).getDate()}</Text>
              <View style={[styles.todayDot, { opacity: i === today ? 1 : 0 }, active && { backgroundColor: COLORS.onPrimary }]} />
            </PressableScale>
          </View>
        );
      })}
    </Glass>
  );
};

// ── Carte d'un plat ────────────────────────────────────────────────────────
const MealCard: React.FC<{
  meal: PlannedMeal;
  label: string;
  swapping: boolean;
  onSwap: (m: PlannedMeal) => void;
  onLog: (m: PlannedMeal) => void;
}> = ({ meal, label, swapping, onSwap, onLog }) => {
  const [open, setOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [meal.id, fade]);

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        marginTop: SPACING.md,
      }}
    >
      <Glass radius={RADIUS.xl}>
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: meal.image ?? recipeImageUrl(meal.imageKeyword, meal.name) }}
            style={styles.mealImage}
            contentFit="cover"
            transition={250}
          />
          <LinearGradient
            colors={['rgba(5,6,11,0)', 'rgba(5,6,11,0.85)']}
            style={styles.imageShade}
            pointerEvents="none"
          />
          <View style={styles.imageText}>
            <Text style={styles.mealLabel}>{label}</Text>
            <Text style={styles.mealName}>{meal.name}</Text>
          </View>
        </View>
        {meal.imageCredit && (
          <Pressable onPress={() => Linking.openURL(meal.imageCredit!.url)} style={styles.credit}>
            <Text style={styles.creditText}>Photo : {meal.imageCredit.author} sur Pexels</Text>
          </Pressable>
        )}

        <View style={styles.mealBody}>
          <View style={styles.tagsRow}>
            <Tag icon="earth-outline" text={meal.cuisine} />
            <Tag icon="time-outline" text={meal.prepTime} />
            <Tag icon="pricetag-outline" text={'$'.repeat(meal.costLevel)} />
          </View>
          <Text style={styles.mealDesc}>{meal.desc}</Text>

          <View style={styles.portionGroup}>
            {meal.portions.map((p, i) => (
              <View key={p.memberId}>
                {i > 0 && <View style={styles.portionSep} />}
                <PortionRow portion={p} open={open} />
              </View>
            ))}
          </View>

          <PressableScale onPress={() => setOpen(!open)} style={styles.expand}>
            <Text style={styles.expandText}>{open ? 'Masquer la recette' : 'Quantités et recette'}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
          </PressableScale>

          {open && (
            <View style={{ marginTop: SPACING.xs }}>
              {meal.extras.length > 0 && <Text style={styles.extras}>Aussi : {meal.extras.join(', ')}</Text>}
              {meal.instructions.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNum}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <PressableScale onPress={() => onSwap(meal)} disabled={swapping}>
                <Glass radius={RADIUS.pill} style={styles.actionBtn}>
                  {swapping ? <ActivityIndicator size="small" color={COLORS.text} /> : <Ionicons name="refresh" size={17} color={COLORS.text} />}
                  <Text style={styles.actionText}>Changer</Text>
                </Glass>
              </PressableScale>
            </View>
            <View style={{ flex: 1 }}>
              <PressableScale onPress={() => onLog(meal)} style={[styles.actionBtn, styles.actionPrimary]}>
                <Ionicons name="checkmark" size={17} color={COLORS.onPrimary} />
                <Text style={[styles.actionText, { color: COLORS.onPrimary }]}>J'ai mangé ça</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Glass>
    </Animated.View>
  );
};

const PortionRow: React.FC<{ portion: MemberPortion; open: boolean }> = ({ portion, open }) => (
  <View style={styles.portion}>
    <View style={styles.portionTop}>
      <View style={styles.portionAvatar}>
        <Text style={styles.portionInitial}>{(portion.memberName || '?').charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.portionName}>{portion.memberId === OWNER_ID ? 'Toi' : portion.memberName}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.portionKcalRow}>
          <AnimatedNumber value={portion.calories} style={styles.portionKcal} />
          <Text style={styles.portionUnit}> kcal</Text>
        </Text>
        <Text style={styles.portionProt}>{portion.protein} g prot.</Text>
      </View>
    </View>
    {open && (
      <Text style={styles.portionLines}>{portion.lines.map((l) => `${l.name} ${l.grams} g`).join(' · ')}</Text>
    )}
  </View>
);

const Tag: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({ icon, text }) => (
  <View style={styles.tag}>
    <Ionicons name={icon} size={13} color={COLORS.textSecondary} />
    <Text style={styles.tagText}>{text}</Text>
  </View>
);

// ── Pendant la génération ──────────────────────────────────────────────────
const GeneratingCard: React.FC = () => {
  const [step, setStep] = useState(0);
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % LOADING_STEPS.length), 2200);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      clearInterval(id);
      loop.stop();
    };
  }, [pulse]);

  return (
    <Card style={{ marginTop: SPACING.lg, alignItems: 'center', paddingVertical: SPACING.xxl }}>
      <Animated.View style={[styles.pulse, { opacity: pulse }]}>
        <Ionicons name="restaurant-outline" size={28} color={COLORS.primary} />
      </Animated.View>
      <Text style={styles.genText}>{LOADING_STEPS[step]}</Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  display: { ...TYPE.largeTitle, color: COLORS.text, marginTop: SPACING.xs },
  lead: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 21 },
  fieldLabel: { ...TYPE.overline, color: COLORS.textSecondary, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionTitle: { ...TYPE.title, color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.md },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  helper: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textMuted, marginTop: SPACING.md, lineHeight: 17 },
  helperTop: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary, lineHeight: 20 },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inlineIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  inlineLinkText: { ...TYPE.callout, color: COLORS.text, flex: 1 },
  safety: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.danger}66`,
    marginTop: SPACING.md,
  },
  safetyIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: `${COLORS.danger}26`, alignItems: 'center', justifyContent: 'center' },
  safetyText: { ...TYPE.caption, color: COLORS.text, flex: 1, lineHeight: 18 },
  primaryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },
  ghostBtn: { marginTop: SPACING.sm, paddingVertical: 12, alignItems: 'center' },
  ghostText: { ...TYPE.callout, color: COLORS.primary },
  oldWeek: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md },
  oldWeekText: { ...TYPE.callout, fontWeight: '400', color: COLORS.text, flex: 1 },
  dayStrip: { flexDirection: 'row', gap: 2, marginTop: SPACING.lg, padding: 6 },
  dayPill: { alignItems: 'center', paddingVertical: 10, borderRadius: 22 },
  dayPillActive: { backgroundColor: COLORS.primary },
  dayLabel: { ...TYPE.footnote, color: COLORS.textSecondary },
  dayNum: { ...TYPE.number, fontSize: 18, color: COLORS.text, marginTop: 2 },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginTop: 4 },
  dayTitle: { ...TYPE.title, color: COLORS.text, marginTop: SPACING.xl },
  imageWrap: { margin: 8, borderRadius: RADIUS.xl - 8, overflow: 'hidden' },
  mealImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: COLORS.surface },
  imageShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  imageText: { position: 'absolute', left: SPACING.md, right: SPACING.md, bottom: SPACING.md },
  mealLabel: { ...TYPE.caption, color: 'rgba(255,255,255,0.78)' },
  mealName: { ...TYPE.title, fontSize: 24, color: '#FFFFFF', marginTop: 2 },
  credit: { paddingHorizontal: SPACING.lg, paddingTop: 2 },
  creditText: { fontSize: 11, color: COLORS.textMuted },
  mealBody: { padding: SPACING.lg, paddingTop: SPACING.sm },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface },
  tagText: { ...TYPE.footnote, color: COLORS.textSecondary },
  mealDesc: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.md, lineHeight: 22 },
  portionGroup: { marginTop: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, overflow: 'hidden' },
  portionSep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: SPACING.md + 32 + 12 },
  portion: { paddingHorizontal: SPACING.md, paddingVertical: 12 },
  portionTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  portionAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.cardElevated, alignItems: 'center', justifyContent: 'center' },
  portionInitial: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  portionName: { ...TYPE.headline, color: COLORS.text, flex: 1 },
  portionKcalRow: { color: COLORS.text },
  portionKcal: { ...TYPE.number, fontSize: 18, color: COLORS.text },
  portionUnit: { ...TYPE.footnote, color: COLORS.textSecondary },
  portionProt: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textMuted, marginTop: 1 },
  portionLines: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textSecondary, marginTop: SPACING.sm, marginLeft: 44, lineHeight: 18 },
  expand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: SPACING.sm, paddingVertical: 10 },
  expandText: { ...TYPE.callout, color: COLORS.textSecondary },
  extras: { ...TYPE.caption, fontWeight: '400', color: COLORS.textMuted, marginBottom: SPACING.sm },
  stepRow: { flexDirection: 'row', gap: 12, marginTop: SPACING.sm },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.cardElevated, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNum: { ...TYPE.footnote, fontWeight: '600', color: COLORS.text },
  stepText: { ...TYPE.body, color: COLORS.text, flex: 1, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  actionPrimary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill },
  actionText: { ...TYPE.callout, fontWeight: '600', color: COLORS.text },
  freeNight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SPACING.md, padding: SPACING.lg },
  freeText: { ...TYPE.body, color: COLORS.textSecondary },
  pulse: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  genText: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.lg, textAlign: 'center' },
});
