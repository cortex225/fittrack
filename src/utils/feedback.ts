import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type FxType = 'click' | 'success' | 'tick' | 'water' | 'levelUp' | 'error';

let hapticsEnabled = true;

export const configureFeedback = (opts: { haptics: boolean }) => {
  hapticsEnabled = opts.haptics;
};

export const playFx = (type: FxType): void => {
  if (!hapticsEnabled) return;
  if (Platform.OS === 'web') return;

  switch (type) {
    case 'click':
      Haptics.selectionAsync().catch(() => {});
      break;
    case 'success':
    case 'water':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      break;
    case 'levelUp':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 120);
      break;
    case 'tick':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      break;
    case 'error':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      break;
  }
};
