import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppProvider, useApp } from './src/contexts/AppContext';
import LevelUpOverlay from './src/components/LevelUpOverlay';
import { COLORS } from './src/theme';

import DashboardScreen from './src/screens/DashboardScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import NutritionScreen from './src/screens/NutritionScreen';
import StatsScreen from './src/screens/StatsScreen';
import LiveWorkoutScreen from './src/screens/LiveWorkoutScreen';
import CoachChatScreen from './src/screens/CoachChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';

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

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
        tabBarLabel: TAB_LABELS[route.name] ?? route.name,
        tabBarIcon: ({ color, size, focused }) => {
          const icons = TAB_ICONS[route.name];
          if (!icons) return null;
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Training"  component={TrainingScreen} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} />
      <Tab.Screen name="Stats"     component={StatsScreen} />
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
            background: COLORS.background,
            card: COLORS.surface,
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
            contentStyle: { backgroundColor: COLORS.background },
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="LiveWorkout"
            component={LiveWorkoutScreen}
            options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="CoachChat"
            component={CoachChatScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <LevelUpOverlay level={levelUpQueue} onDismiss={dismissLevelUp} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider>
        <RootShell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
