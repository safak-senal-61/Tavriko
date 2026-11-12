import { AppState, Platform, Vibration } from 'react-native';
import { cdnUrl } from '../utils/cdn';

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

// Ses efektleri ve müzik Cloudflare CDN'inden (tavriko-cdn) çekilir
const SOUND_FILES: Record<SoundEffect, string> = {
  tap: 'sounds/tap.wav',
  nav: 'sounds/nav.wav',
  correct: 'sounds/correct.wav',
  wrong: 'sounds/wrong.wav',
  streak: 'sounds/streak.wav',
  timer_tick: 'sounds/timer_tick.wav',
  radar_ping: 'sounds/radar_ping.wav',
  match_found: 'sounds/match_found.wav',
  victory: 'sounds/victory.wav',
  reward: 'sounds/reward.wav',
};
const SOUND_URLS = Object.fromEntries(
  (Object.keys(SOUND_FILES) as SoundEffect[]).map((k) => [k, cdnUrl(SOUND_FILES[k])])
) as Record<SoundEffect, string>;
export const MUSIC_URL = cdnUrl('music/tavriko_theme.mp3');
// Müzik dosyası tepe seviyeye yakın normalize edildiği için ayar yüzdesi bu katsayıyla ölçeklenir
const MUSIC_GAIN = 0.6;

// Singleton Web AudioContext and user gesture tracking for modern browser autoplay policies
let sharedWebAudioCtx: any = null;
let hasUserGesture: boolean = false;
const gestureListeners = new Set<() => void>();

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const registerUserGesture = () => {
    hasUserGesture = true;
    if (sharedWebAudioCtx && sharedWebAudioCtx.state === 'suspended') {
      sharedWebAudioCtx.resume().catch(() => {});
    }
    // Açılışta müzik tercihi açıksa tarayıcı ilk dokunuşa kadar izin vermez; şimdi başlat
    gestureListeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
  window.addEventListener('pointerdown', registerUserGesture, { capture: true, passive: true });
  window.addEventListener('touchstart', registerUserGesture, { capture: true, passive: true });
  window.addEventListener('keydown', registerUserGesture, { capture: true, passive: true });
  window.addEventListener('click', registerUserGesture, { capture: true, passive: true });
}

class SoundService {
  private soundEnabled: boolean = true;
  private hapticsEnabled: boolean = true;
  private sfxVolume: number = 1; // 0..1 (Settings: %25/50/75/100)
  private hapticIntensity: 'light' | 'medium' | 'strong' = 'medium';
  private musicEnabled: boolean = false;
  private musicVolume: number = 0.5; // 0..1
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

  /** 0..1 — Settings: %25/50/75/100 */
  public setSoundVolume(volume01: number) {
    this.sfxVolume = Math.min(1, Math.max(0, Number(volume01) || 0));
  }

  public getSoundVolume(): number {
    return this.sfxVolume;
  }

  public setHapticIntensity(intensity: 'light' | 'medium' | 'strong') {
    this.hapticIntensity = intensity;
  }

  public getHapticIntensity() {
    return this.hapticIntensity;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public isHapticsEnabled(): boolean {
    return this.hapticsEnabled;
  }

  // --- Arka plan müziği (CDN'den akan döngü; web: HTMLAudio, mobil: expo-audio) ---
  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) this.startMusic();
    else this.stopMusic();
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setMusicVolume(volume01: number) {
    this.musicVolume = Math.min(1, Math.max(0, Number(volume01) || 0));
    const v = this.musicVolume * MUSIC_GAIN;
    try {
      if (this.musicEl) this.musicEl.volume = v;
      if (this.musicPlayer) this.musicPlayer.volume = v;
    } catch {}
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  private musicEl: any = null; // web HTMLAudioElement
  private musicPlayer: any = null; // native expo-audio player
  private musicRetryArmed: boolean = false;
  private lifecycleBound: boolean = false;

  /** Tarayıcı otomatik oynatmayı engellediyse ilk kullanıcı etkileşiminde yeniden dene */
  private armMusicRetry() {
    if (this.musicRetryArmed) return;
    this.musicRetryArmed = true;
    const retry = () => {
      this.musicRetryArmed = false;
      gestureListeners.delete(retry);
      if (this.musicEnabled) this.startMusic();
    };
    gestureListeners.add(retry);
  }

  private bindMusicLifecycle() {
    if (this.lifecycleBound) return;
    this.lifecycleBound = true;
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) this.pauseMusic();
          else if (this.musicEnabled) this.startMusic();
        });
      } else {
        AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            if (this.musicEnabled) this.startMusic();
          } else {
            this.pauseMusic();
          }
        });
      }
    } catch {}
  }

  private startMusic() {
    this.bindMusicLifecycle();
    const volume = this.musicVolume * MUSIC_GAIN;
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined' || typeof (window as any).Audio === 'undefined') return;
        if (!hasUserGesture) {
          this.armMusicRetry();
          return;
        }
        if (!this.musicEl) {
          const el = new (window as any).Audio(MUSIC_URL);
          el.loop = true;
          el.preload = 'auto';
          this.musicEl = el;
        }
        this.musicEl.volume = volume;
        const result = this.musicEl.play();
        if (result && typeof result.catch === 'function') {
          result.catch(() => this.armMusicRetry());
        }
        return;
      }
      if (!expoAudioModule?.createAudioPlayer) return;
      this.ensureAudioMode();
      if (!this.musicPlayer) {
        const player = expoAudioModule.createAudioPlayer({ uri: MUSIC_URL });
        try {
          player.loop = true;
        } catch {}
        this.musicPlayer = player;
      }
      this.musicPlayer.volume = volume;
      this.musicPlayer.play();
    } catch {
      // Müzik başlatılamadıysa sessizce devam et; tercih yine de saklı kalır
    }
  }

  private pauseMusic() {
    try {
      if (this.musicEl && typeof this.musicEl.pause === 'function') this.musicEl.pause();
      if (this.musicPlayer && typeof this.musicPlayer.pause === 'function') this.musicPlayer.pause();
    } catch {}
  }

  private stopMusic() {
    this.pauseMusic();
    try {
      if (this.musicEl) this.musicEl.currentTime = 0;
      if (this.musicPlayer && typeof this.musicPlayer.seekTo === 'function') this.musicPlayer.seekTo(0);
    } catch {}
  }

  private sfxBuffers: Partial<Record<SoundEffect, any>> = {};
  private sfxLoading: Partial<Record<SoundEffect, boolean>> = {};

  private loadSfxBuffer(effect: SoundEffect) {
    if (this.sfxBuffers[effect] || this.sfxLoading[effect]) return;
    if (Platform.OS !== 'web' || typeof fetch === 'undefined') return;
    const AudioCtx = typeof window !== 'undefined' ? window.AudioContext || (window as any).webkitAudioContext : null;
    if (!AudioCtx) return;
    if (!sharedWebAudioCtx) sharedWebAudioCtx = new AudioCtx();
    this.sfxLoading[effect] = true;
    fetch(SOUND_URLS[effect])
      .then((res) => {
        if (!res.ok) throw new Error('sfx fetch failed');
        return res.arrayBuffer();
      })
      .then(
        (data) =>
          new Promise<any>((resolve, reject) => {
            const ctx = sharedWebAudioCtx;
            const maybe = ctx.decodeAudioData(data, resolve, reject);
            if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
          })
      )
      .then((decoded) => {
        this.sfxBuffers[effect] = decoded;
      })
      .catch(() => {
        // Ağ hatasında sentezlenmiş sese düşmeye devam edilir; sonraki çalışta yeniden denenir
      })
      .finally(() => {
        this.sfxLoading[effect] = false;
      });
  }

  /** İlk kullanıcı etkileşiminde tüm efektleri CDN'den önceden indir (web) */
  public preloadWebSounds() {
    (Object.keys(SOUND_URLS) as SoundEffect[]).forEach((k) => this.loadSfxBuffer(k));
  }

  public playSound(effect: SoundEffect): void {
    if (!this.soundEnabled) return;

    // 1. Native Mobile Audio via expo-audio (Android & iOS)
    if (Platform.OS !== 'web' && expoAudioModule?.createAudioPlayer) {
      try {
        this.ensureAudioMode();
        let player = this.players[effect];
        if (!player) {
          player = expoAudioModule.createAudioPlayer({ uri: SOUND_URLS[effect] });
          this.players[effect] = player;
        }
        if (typeof player.seekTo === 'function') {
          player.seekTo(0);
        }
        if ('volume' in player) {
          try {
            player.volume = this.sfxVolume;
          } catch {}
        }
        if (typeof player.play === 'function') {
          player.play();
        }
        return;
      } catch {
        // Fallback if player fails
      }
    }

    // 2. Web Audio API (Browser) - Respects Autoplay Policy without Console Errors
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as any).webkitAudioContext)
    ) {
      try {
        // If user has not yet interacted with the page, postpone sound to prevent browser warning
        if (!hasUserGesture) {
          return;
        }

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!sharedWebAudioCtx) {
          sharedWebAudioCtx = new AudioCtx();
        }

        if (sharedWebAudioCtx.state === 'suspended') {
          sharedWebAudioCtx.resume().catch(() => {});
          return;
        }

        const ctx = sharedWebAudioCtx;
        // CDN'den indirilen gerçek ses efekti hazırsa onu çal; değilse bu seferlik sentezlenmiş sesi kullan
        const buffer = this.sfxBuffers[effect];
        if (buffer) {
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          const sfxGain = ctx.createGain();
          sfxGain.gain.value = this.sfxVolume;
          src.connect(sfxGain);
          sfxGain.connect(ctx.destination);
          src.start();
          return;
        }
        this.loadSfxBuffer(effect);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        // Respect the user's SFX volume preference (Settings: %25..%100)
        const volumeNode = ctx.createGain();
        volumeNode.gain.value = this.sfxVolume;
        gain.connect(volumeNode);
        volumeNode.connect(ctx.destination);
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
        // Safe silence on web audio error
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
          // User-controlled "Titreşim Şiddeti": strong upgrades medium hits, light softens them
          let style =
            type === 'medium'
              ? expoHapticsModule.ImpactFeedbackStyle.Medium
              : expoHapticsModule.ImpactFeedbackStyle.Light;
          if (
            this.hapticIntensity === 'strong' &&
            type === 'medium' &&
            expoHapticsModule.ImpactFeedbackStyle.Heavy
          ) {
            style = expoHapticsModule.ImpactFeedbackStyle.Heavy;
          }
          expoHapticsModule.impactAsync(style);
          return;
        }
      } catch {
        // Fallback to React Native Vibration below
      }
    }

    // 2. Web: Vibration API (Android Chrome / PWA). iOS Safari desteklemez, sessizce atlanır.
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        typeof (navigator as any).vibrate === 'function' &&
        hasUserGesture
      ) {
        const s = this.hapticIntensity === 'light' ? 0.6 : this.hapticIntensity === 'strong' ? 1.8 : 1;
        if (type === 'success') (navigator as any).vibrate([Math.round(18 * s), 40, Math.round(26 * s)]);
        else if (type === 'error') (navigator as any).vibrate([Math.round(40 * s), 40, Math.round(40 * s)]);
        else if (type === 'warning') (navigator as any).vibrate(Math.round(30 * s));
        else if (type === 'medium') (navigator as any).vibrate(Math.round(22 * s));
        else (navigator as any).vibrate(Math.round(10 * s));
        return;
      }
    } catch {
      // Ignore web vibration errors
    }

    // 3. React Native Vibration fallback (scaled by user's haptic intensity)
    try {
      if (Platform.OS !== 'web') {
        const s = this.hapticIntensity === 'light' ? 0.6 : this.hapticIntensity === 'strong' ? 1.6 : 1;
        if (type === 'success') Vibration.vibrate([0, 20 * s, 40, 30 * s]);
        else if (type === 'error') Vibration.vibrate([0, 45 * s, 40, 45 * s]);
        else if (type === 'medium') Vibration.vibrate(Math.round(25 * s));
        else Vibration.vibrate(Math.round(12 * s));
      }
    } catch {
      // Ignore vibration errors
    }
  }
}

export const sound = new SoundService();
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  gestureListeners.add(() => sound.preloadWebSounds());
}
