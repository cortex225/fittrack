import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AppSettings,
  Gamification,
  GoalType,
  UserProfile,
} from '../types';
import {
  GOAL_CONFIGS,
  addXp as addXpStorage,
  computeTargetsForGoal,
  getGamification,
  getProfile,
  getSettings,
  saveProfile,
  saveSettings,
} from '../utils/storage';
import { LEVELS } from '../data/library';
import { configureFeedback, FxType, playFx as playFxFn } from '../utils/feedback';

interface AppContextValue {
  profile: UserProfile;
  goal: GoalType;
  gamification: Gamification;
  settings: AppSettings;
  levelUpQueue: number | null;
  ready: boolean;

  setGoal: (goal: GoalType) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  addXp: (amount: number) => Promise<void>;
  dismissLevelUp: () => void;
  playFx: (fx: FxType) => void;
  refresh: () => Promise<void>;

  currentLevel: { level: number; name: string; xpNeeded: number };
  nextLevel: { level: number; name: string; xpNeeded: number };
  xpProgress: number; // 0-100
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [gamification, setGamification] = useState<Gamification>({ xp: 0, level: 1 });
  const [settings, setSettings] = useState<AppSettings>({
    soundEnabled: true,
    hapticsEnabled: true,
    hasApiKey: false,
  });
  const [levelUpQueue, setLevelUpQueue] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [p, g, s] = await Promise.all([getProfile(), getGamification(), getSettings()]);
    setProfile(p);
    setGamification(g);
    setSettings(s);
    configureFeedback({ haptics: s.hapticsEnabled });
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const setGoal = useCallback(
    async (goal: GoalType) => {
      if (!profile) return;
      const updated = computeTargetsForGoal(profile, goal);
      const saved = await saveProfile(updated);
      setProfile(saved);
    },
    [profile]
  );

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    const next = await saveProfile(patch);
    setProfile(next);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    configureFeedback({ haptics: next.hapticsEnabled });
  }, []);

  const addXp = useCallback(async (amount: number) => {
    const res = await addXpStorage(amount);
    setGamification(res.state);
    if (res.leveledUpTo) {
      setLevelUpQueue(res.leveledUpTo);
      playFxFn('levelUp');
    }
  }, []);

  const dismissLevelUp = useCallback(() => setLevelUpQueue(null), []);

  const playFx = useCallback((fx: FxType) => playFxFn(fx), []);

  const value = useMemo<AppContextValue>(() => {
    const safeProfile: UserProfile = profile ?? {
      name: 'Athlète',
      goal: 'maintain',
      weightKg: 80,
      heightCm: 178,
      age: 30,
      sex: 'male',
      activityLevel: 'moderate',
      tee: 2700,
      targetCalories: 2700,
      targetProtein: 160,
      targetCarbs: 280,
      targetFats: 80,
      targetWater: 2500,
    };

    const currentLevel =
      LEVELS.slice().reverse().find((l) => gamification.xp >= l.xpNeeded) ?? LEVELS[0];
    const nextLevel = LEVELS.find((l) => l.level === currentLevel.level + 1) ?? {
      level: currentLevel.level + 1,
      name: 'Max',
      xpNeeded: currentLevel.xpNeeded + 50000,
    };
    const span = Math.max(1, nextLevel.xpNeeded - currentLevel.xpNeeded);
    const xpProgress = Math.min(100, ((gamification.xp - currentLevel.xpNeeded) / span) * 100);

    return {
      profile: safeProfile,
      goal: safeProfile.goal,
      gamification,
      settings,
      levelUpQueue,
      ready,
      setGoal,
      updateProfile,
      updateSettings,
      addXp,
      dismissLevelUp,
      playFx,
      refresh,
      currentLevel,
      nextLevel,
      xpProgress,
    };
  }, [
    profile,
    gamification,
    settings,
    levelUpQueue,
    ready,
    setGoal,
    updateProfile,
    updateSettings,
    addXp,
    dismissLevelUp,
    playFx,
    refresh,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { GOAL_CONFIGS };
