import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
  saveNutritionLog,
  saveWeekPlan,
} from '../utils/storage';
import { describeStrictExclusions } from '../utils/allergens';
import { AnimatedNumber, Card, Chip, PressableScale, SectionLabel, Segmented } from '../components/ui';

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
      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.iconBtn} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </PressableScale>
        {plan && !setupOpen && !generating && (
          <PressableScale onPress={() => setSetupOpen(true)} style={styles.iconBtn} accessibilityLabel="Nouvelle semaine">
            <Ionicons name="sparkles-outline" size={19} color={COLORS.primaryLight} />
          </PressableScale>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 60 }} showsVerticalScrollIndicator={false}>
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
                <SectionLabel>Pour qui</SectionLabel>
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
                <Ionicons name="people-outline" size={16} color={COLORS.primaryLight} />
                <Text style={styles.inlineLinkText}>Ajoute la personne avec qui tu manges</Text>
              </PressableScale>
            )}

            <SectionLabel>Soupers</SectionLabel>
            <Segmented
              options={[
                { value: '5', label: '5 soirs' },
                { value: '7', label: '7 soirs' },
              ]}
              value={dinnerCount}
              onChange={setDinnerCount}
            />

            <SectionLabel>Plats ivoiriens</SectionLabel>
            <Segmented options={IVORIAN_OPTIONS} value={ivorian} onChange={setIvorian} />

            <Text style={styles.helper}>Plus 2 dîners à préparer le dimanche pour la semaine.</Text>
            {exclusions ? (
              <View style={styles.safety}>
                <Ionicons name="lock-closed" size={13} color={COLORS.danger} />
                <Text style={styles.safetyText}>Exclu d'office : {exclusions}</Text>
              </View>
            ) : null}

            <PressableScale onPress={generate} style={styles.primaryBtn}>
              <Ionicons name="sparkles" size={18} color="#08110D" />
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
              <PressableScale onPress={() => setSetupOpen(true)} style={styles.oldWeek}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.accent} />
                <Text style={styles.oldWeekText}>Ce menu date d'une autre semaine. Planifier la nouvelle ?</Text>
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
              <View style={styles.freeNight}>
                <Ionicons name="moon-outline" size={18} color={COLORS.textMuted} />
                <Text style={styles.freeText}>Souper libre ce soir</Text>
              </View>
            )}

            {plan.blockedCount > 0 && (
              <View style={[styles.safety, { marginTop: SPACING.lg }]}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.danger} />
                <Text style={styles.safetyText}>
                  {plan.blockedCount} plat{plan.blockedCount > 1 ? 's écartés' : ' écarté'} à cause d'une allergie, et remplacé{plan.blockedCount > 1 ? 's' : ''}.
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Bande des jours ────────────────────────────────────────────────────────
const DayStrip: React.FC<{ weekStart: string; value: number; onChange: (d: number) => void }> = ({
  weekStart,
  value,
  onChange,
}) => {
  const today = weekStart === mondayOf() ? todayIndex() : -1;
  return (
    <View style={styles.dayStrip}>
      {DAY_SHORT.map((label, i) => {
        const active = i === value;
        return (
          <PressableScale key={label} onPress={() => onChange(i)} style={[styles.dayPill, active && styles.dayPillActive]} accessibilityLabel={DAY_LONG[i]}>
            <Text style={[styles.dayLabel, active && { color: '#08110D' }]}>{label}</Text>
            <Text style={[styles.dayNum, active && { color: '#08110D' }]}>{dateOf(weekStart, i).getDate()}</Text>
            <View style={[styles.todayDot, { opacity: i === today ? 1 : 0 }, active && { backgroundColor: '#08110D' }]} />
          </PressableScale>
        );
      })}
    </View>
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
      <View style={styles.mealCard}>
        <View>
          <Image
            source={{ uri: meal.image ?? recipeImageUrl(meal.imageKeyword, meal.name) }}
            style={styles.mealImage}
            contentFit="cover"
            transition={250}
          />
          <LinearGradient colors={['transparent', 'rgba(10,10,20,0.92)']} style={styles.imageShade} />
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

          {meal.portions.map((p) => (
            <PortionRow key={p.memberId} portion={p} open={open} />
          ))}

          <PressableScale onPress={() => setOpen(!open)} style={styles.expand}>
            <Text style={styles.expandText}>{open ? 'Masquer la recette' : 'Quantités et recette'}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
          </PressableScale>

          {open && (
            <View style={{ marginTop: SPACING.sm }}>
              {meal.extras.length > 0 && <Text style={styles.extras}>Aussi : {meal.extras.join(', ')}</Text>}
              {meal.instructions.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <PressableScale onPress={() => onSwap(meal)} style={styles.actionBtn} disabled={swapping}>
              {swapping ? <ActivityIndicator size="small" color={COLORS.text} /> : <Ionicons name="refresh" size={16} color={COLORS.text} />}
              <Text style={styles.actionText}>Changer</Text>
            </PressableScale>
            <PressableScale onPress={() => onLog(meal)} style={[styles.actionBtn, styles.actionPrimary]}>
              <Ionicons name="checkmark" size={16} color="#08110D" />
              <Text style={[styles.actionText, { color: '#08110D' }]}>J'ai mangé ça</Text>
            </PressableScale>
          </View>
        </View>
      </View>
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
      <AnimatedNumber value={portion.calories} style={styles.portionKcal} suffix=" kcal" />
      <Text style={styles.portionProt}>{portion.protein} g prot.</Text>
    </View>
    {open && (
      <Text style={styles.portionLines}>{portion.lines.map((l) => `${l.name} ${l.grams} g`).join(' · ')}</Text>
    )}
  </View>
);

const Tag: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({ icon, text }) => (
  <View style={styles.tag}>
    <Ionicons name={icon} size={12} color={COLORS.textSecondary} />
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
        <Ionicons name="restaurant" size={28} color={COLORS.primaryLight} />
      </Animated.View>
      <Text style={styles.genText}>{LOADING_STEPS[step]}</Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  display: { ...TYPE.display, color: COLORS.text },
  lead: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 21 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  helper: { ...TYPE.caption, color: COLORS.textMuted, marginTop: SPACING.md, fontWeight: '500' },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: SPACING.sm },
  inlineLinkText: { ...TYPE.caption, color: COLORS.primaryLight },
  safety: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.sm + 2, borderRadius: RADIUS.md, backgroundColor: COLORS.dangerSoft, marginTop: SPACING.md },
  safetyText: { color: COLORS.text, fontSize: 12, fontWeight: '600', flex: 1 },
  primaryBtn: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#08110D', fontSize: 16, fontWeight: '800' },
  ghostBtn: { marginTop: SPACING.sm, paddingVertical: 12, alignItems: 'center' },
  ghostText: { ...TYPE.caption, color: COLORS.textSecondary },
  oldWeek: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: 'rgba(245,158,11,0.12)' },
  oldWeekText: { ...TYPE.caption, color: COLORS.accent, flex: 1 },
  dayStrip: { flexDirection: 'row', gap: 6, marginTop: SPACING.lg },
  dayPill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  dayPillActive: { backgroundColor: COLORS.primary },
  dayLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  dayNum: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primaryLight, marginTop: 4 },
  dayTitle: { ...TYPE.title, color: COLORS.text, marginTop: SPACING.xl },
  mealCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderStrong },
  mealImage: { width: '100%', aspectRatio: 16 / 10, backgroundColor: COLORS.surface },
  imageShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  imageText: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, bottom: SPACING.md },
  mealLabel: { ...TYPE.overline, color: COLORS.primaryLight },
  mealName: { ...TYPE.title, color: COLORS.text, marginTop: 4 },
  credit: { paddingHorizontal: SPACING.lg, paddingTop: 6 },
  creditText: { fontSize: 10, color: COLORS.textMuted },
  mealBody: { padding: SPACING.lg, paddingTop: SPACING.md },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface },
  tagText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  mealDesc: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.md, lineHeight: 21 },
  portion: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  portionTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  portionAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  portionInitial: { color: COLORS.primaryLight, fontWeight: '800', fontSize: 13 },
  portionName: { ...TYPE.headline, color: COLORS.text, flex: 1 },
  portionKcal: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  portionProt: { ...TYPE.caption, color: COLORS.textMuted, marginLeft: 4 },
  portionLines: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 18, fontWeight: '500' },
  expand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: SPACING.md, paddingVertical: 8 },
  expandText: { ...TYPE.caption, color: COLORS.textSecondary },
  extras: { ...TYPE.caption, color: COLORS.textMuted, marginBottom: SPACING.sm, fontWeight: '500' },
  stepRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  stepNum: { width: 22, color: COLORS.primaryLight, fontWeight: '800' },
  stepText: { ...TYPE.body, color: COLORS.text, flex: 1, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: RADIUS.lg, backgroundColor: COLORS.cardElevated },
  actionPrimary: { backgroundColor: COLORS.primary },
  actionText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  freeNight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border },
  freeText: { ...TYPE.body, color: COLORS.textMuted },
  pulse: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  genText: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.lg },
});
