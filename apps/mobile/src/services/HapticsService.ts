import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticPatternType = 'continue' | 'turn_left' | 'turn_right' | 'warning' | 'arrived' | 'emergency';

class HapticsService {
  private isVibrationEnabled: boolean = true;

  public setVibrationEnabled(enabled: boolean): void {
    this.isVibrationEnabled = enabled;
  }

  public async trigger(pattern: HapticPatternType): Promise<void> {
    if (!this.isVibrationEnabled) return;

    console.log(`[HapticsService] Triggering pattern: ${pattern}`);

    try {
      if (Platform.OS === 'web') {
        if ('vibrate' in navigator) {
          switch (pattern) {
            case 'continue':
              navigator.vibrate(100);
              break;
            case 'turn_left':
              navigator.vibrate([100, 100, 100]);
              break;
            case 'turn_right':
              navigator.vibrate([100, 100, 100, 100, 100]);
              break;
            case 'warning':
              navigator.vibrate(600);
              break;
            case 'arrived':
              navigator.vibrate([200, 100, 200, 100, 400]);
              break;
            case 'emergency':
              navigator.vibrate([500, 200, 500, 200, 500]);
              break;
          }
        }
      } else {
        switch (pattern) {
          case 'continue':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'turn_left':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'turn_right':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Additional minor haptic if needed, but since Expo has pre-built triggers:
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 150);
            break;
          case 'warning':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case 'arrived':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);
            break;
          case 'emergency':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        }
      }
    } catch (error) {
      console.warn('[HapticsService] Haptics not supported or failed:', error);
    }
  }
}

export default new HapticsService();
