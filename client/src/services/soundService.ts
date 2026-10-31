import { Platform, Vibration } from 'react-native';
export type SoundEffect =
  | 'tap'
  | 'nav'
  | 'correct'
  | 'wrong'
  | 'streak'
  | 'timer_tick'
  | 'radar_ping'
  | 'match_found'
  | 'victory'
  | 'reward';
let expoAudioModule: any = null;
let expoHapticsModule: any = null;
try {
  // Dynamically require so Jest unit tests run cleanly without native bridge errors
  expoAudioModule = require('expo-audio');
} catch {
  expoAudioModule = null;
}
try {
  expoHapticsModule = require('expo-haptics');
} catch {
  expoHapticsModule = null;
}
const SOUND_ASSETS: Record<SoundEffect, any> = {
  tap: require('../../assets/sounds/tap.wav'),
  nav: require('../../assets/sounds/nav.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  streak: require('../../assets/sounds/streak.wav'),
  timer_tick: require('../../assets/sounds/timer_tick.wav'),
  radar_ping: require('../../assets/sounds/radar_ping.wav'),
  match_found: require('../../assets/sounds/match_found.wav'),
  victory: require('../../assets/sounds/victory.wav'),
  reward: require('../../assets/sounds/reward.wav'),
};
class SoundService {
  private soundEnabled: boolean = true;
  private hapticsEnabled: boolean = true;
  private players: Partial<Record<SoundEffect, any>> = {};
  private audioModeConfigured: boolean = false;
  private ensureAudioMode() {
    if (this.audioModeConfigured || !expoAudioModule?.setAudioModeAsync) return;
    this.audioModeConfigured = true;
    try {
      expoAudioModule.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionModeAndroid: 'duckOthers',
        interruptionMode: 'mixWithOthers',
      });
    } catch {
      // Ignore audio mode errors in non-native environments
    }
  }
  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }
  public setHapticsEnabled(enabled: boolean) {
    this.hapticsEnabled = enabled;
  }
  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }
  public isHapticsEnabled(): boolean {
    return this.hapticsEnabled;
  }
  public playSound(effect: SoundEffect): void {
    if (!this.soundEnabled) return;
    // 1. Native Mobile Audio via expo-audio (Android & iOS)
    if (Platform.OS !== 'web' && expoAudioModule?.createAudioPlayer) {
      try {
        this.ensureAudioMode();
        let player = this.players[effect];
        if (!player) {
          player = expoAudioModule.createAudioPlayer(SOUND_ASSETS[effect]);
          this.players[effect] = player;
        }
        if (typeof player.seekTo === 'function') {
          player.seekTo(0);
        }
        if (typeof player.play === 'function') {
          player.play();
        }
        return;
      } catch {
        // Fallback if player fails
      }
    }
    // 2. Web Audio API Fallback
    if (
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as any).webkitAudioContext)
    ) {
      try {
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        switch (effect) {
          case 'correct':
          case 'reward':
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.22);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
            osc.start(now);
            osc.stop(now + 0.32);
            break;
          case 'wrong':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(311.13, now);
            osc.frequency.linearRampToValueAtTime(220, now + 0.25);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
            break;
          case 'streak':
          case 'victory':
          case 'match_found':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(659.25, now);
            osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.3);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.45);
            break;
          case 'timer_tick':
          case 'radar_ping':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(987.77, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
            break;
          case 'nav':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(784, now);
            osc.frequency.exponentialRampToValueAtTime(1046, now + 0.08);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
          case 'tap':
          default:
            osc.type = 'sine';
            osc.frequency.setValueAtTime(560, now);
            osc.frequency.exponentialRampToValueAtTime(820, now + 0.05);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.start(now);
            osc.stop(now + 0.06);
            break;
        }
      } catch {
        // AudioContext not ready
      }
    }
  }
  public triggerHaptic(
    type: 'light' | 'medium' | 'success' | 'warning' | 'error' = 'light'
  ): void {
    if (!this.hapticsEnabled) return;
    // 1. Native Expo Haptics
    if (Platform.OS !== 'web' && expoHapticsModule) {
      try {
        if (type === 'success' && expoHapticsModule.notificationAsync) {
          expoHapticsModule.notificationAsync(
            expoHapticsModule.NotificationFeedbackType.Success
          );
          return;
        }
        if (type === 'error' && expoHapticsModule.notificationAsync) {
          expoHapticsModule.notificationAsync(
            expoHapticsModule.NotificationFeedbackType.Error
          );
          return;
        }
        if (type === 'warning' && expoHapticsModule.notificationAsync) {
          expoHapticsModule.notificationAsync(
            expoHapticsModule.NotificationFeedbackType.Warning
          );
          return;
        }
        if (expoHapticsModule.impactAsync) {
          const style =
            type === 'medium'
              ? expoHapticsModule.ImpactFeedbackStyle.Medium
              : expoHapticsModule.ImpactFeedbackStyle.Light;
          expoHapticsModule.impactAsync(style);
          return;
        }
      } catch {
        // Fallback to React Native Vibration below
      }
    }
    // 2. React Native Vibration fallback
    try {
      if (Platform.OS !== 'web') {
        if (type === 'success') Vibration.vibrate([0, 20, 40, 30]);
        else if (type === 'error') Vibration.vibrate([0, 45, 40, 45]);
        else if (type === 'medium') Vibration.vibrate(25);
        else Vibration.vibrate(12);
      }
    } catch {
      // Ignore vibration errors
    }
  }
}
export const sound = new SoundService();