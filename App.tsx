import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppProvider, useApp } from './src/contexts/AppContext';
import LevelUpOverlay from './src/components/LevelUpOverlay';
import { COLORS } from './src/theme';
import { AppBackground, Glass } from './src/components/glass';

import DashboardScreen from './src/screens/DashboardScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import NutritionScreen from './src/screens/NutritionScreen';
import StatsScreen from './src/screens/StatsScreen';
import LiveWorkoutScreen from './src/screens/LiveWorkoutScreen';
import CoachChatScreen from './src/screens/CoachChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ExerciseLibraryScreen from './src/screens/ExerciseLibraryScreen';
import WorkoutBuilderScreen from './src/screens/WorkoutBuilderScreen';
import ShoppingListScreen from './src/screens/ShoppingListScreen';
import HouseholdScreen from './src/screens/HouseholdScreen';
import MealPlanScreen from './src/screens/MealPlanScreen';
import CheckInScreen from './src/screens/CheckInScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { active: 'home',            inactive: 'home-outline' },
  Training:  { active: 'barbell',         inactive: 'barbell-outline' },
  Nutrition: { active: 'restaurant',      inactive: 'restaurant-outline' },
  Stats:     { active: 'analytics',       inactive: 'analytics-outline' },
};

const TAB_LABELS: Record<string, string> = {
  Dashboard: 'Coach',
  Training:  'Sport',
  Nutrition: 'Repas',
  Stats:     'Stats',
};

// Chaque écran se dessine sur le fond à halos : les écrans sont transparents,
// le fond est peint ici une fois par écran pour que les transitions restent nettes.
function withBackground<P extends object>(Screen: React.ComponentType<P>) {
  const Wrapped = (props: P) => (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <Screen {...props} />
    </View>
  );
  Wrapped.displayName = `WithBackground(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return Wrapped;
}

const BG = {
  LiveWorkoutScreen: withBackground(LiveWorkoutScreen),
  CoachChatScreen: withBackground(CoachChatScreen),
  SettingsScreen: withBackground(SettingsScreen),
  ExerciseLibraryScreen: withBackground(ExerciseLibraryScreen),
  WorkoutBuilderScreen: withBackground(WorkoutBuilderScreen),
  ShoppingListScreen: withBackground(ShoppingListScreen),
  HouseholdScreen: withBackground(HouseholdScreen),
  MealPlanScreen: withBackground(MealPlanScreen),
  CheckInScreen: withBackground(CheckInScreen),
};

const Dashboard = withBackground(DashboardScreen);
const Training = withBackground(TrainingScreen);
const Nutrition = withBackground(NutritionScreen);
const Stats = withBackground(StatsScreen);

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Barre d'onglets flottante en verre, façon iOS 26.
        tabBarStyle: {
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: Math.max(insets.bottom, 12),
          height: 68,
          borderRadius: 34,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarBackground: () => <Glass radius={34} interactive strong style={StyleSheet.absoluteFill} />,
        // Toujours l'icône au-dessus du libellé, même sur un écran large.
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarLabel: TAB_LABELS[route.name] ?? route.name,
        tabBarIcon: ({ color, size, focused }) => {
          const icons = TAB_ICONS[route.name];
          if (!icons) return null;
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={22}
              color={focused ? COLORS.primary : color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={Dashboard} />
      <Tab.Screen name="Training"  component={Training} />
      <Tab.Screen name="Nutrition" component={Nutrition} />
      <Tab.Screen name="Stats"     component={Stats} />
    </Tab.Navigator>
  );
}

function RootShell() {
  const { levelUpQueue, dismissLevelUp } = useApp();
  return (
    <>
      <NavigationContainer
        theme={{
          ...DefaultTheme,
          dark: true,
          colors: {
            ...DefaultTheme.colors,
            background: COLORS.backgroundSolid,
            card: COLORS.backgroundSolid,
            text: COLORS.text,
            border: COLORS.border,
            primary: COLORS.primary,
            notification: COLORS.accent,
          },
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.backgroundSolid },
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="LiveWorkout"
            component={BG.LiveWorkoutScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="CoachChat"
            component={BG.CoachChatScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Settings"
            component={BG.SettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ExerciseLibrary"
            component={BG.ExerciseLibraryScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="WorkoutBuilder"
            component={BG.WorkoutBuilderScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="CheckIn"
            component={BG.CheckInScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="MealPlan"
            component={BG.MealPlanScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Household"
            component={BG.HouseholdScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ShoppingList"
            component={BG.ShoppingListScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <LevelUpOverlay level={levelUpQueue} onDismiss={dismissLevelUp} />
    </>
  );
}

// Sur le web, l'app garde une largeur de téléphone, centrée, au lieu de
// s'étirer sur tout l'écran d'un ordinateur.
const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  Platform.OS === 'web' ? (
    <View style={frame.outer}>
      <View style={frame.inner}>{children}</View>
    </View>
  ) : (
    <>{children}</>
  );

const frame = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: 460, overflow: 'hidden', backgroundColor: COLORS.backgroundSolid },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider>
        <PhoneFrame>
          <RootShell />
        </PhoneFrame>
      </AppProvider>
    </SafeAreaProvider>
  );
}
