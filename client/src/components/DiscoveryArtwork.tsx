import { cdnImage } from '../utils/cdn';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, ImageSourcePropType,
  Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { ArrowRight, Check, LockKeyhole } from 'lucide-react-native';
import { GradientFill } from './TavrikoGradient';
import { THEME } from '../theme/tokens';
import { useGameStore } from '../store/gameStore';
import { usePreferences } from '../store/appPrefs';

export const DISCOVERY_IMG = {
  explorer: cdnImage('images/discovery/guest_explorer.png'),
  arena: cdnImage('images/discovery/duel_arena.webp'),
  victory: cdnImage('images/discovery/badge_victory.png'),
  speed: cdnImage('images/discovery/badge_speed.png'),
  streak: cdnImage('images/discovery/badge_streak.png'),
  accuracy: cdnImage('images/discovery/badge_accuracy.png'),
  expert: cdnImage('images/discovery/badge_expert.png'),
  collector: cdnImage('images/discovery/badge_collector.png'),
  settings: cdnImage('images/discovery/settings.webp'),
  bell: cdnImage('images/discovery/bell.webp'),
  robot: cdnImage('images/discovery/robot.webp'),
  social: cdnImage('images/discovery/social.webp'),
};

/** Profil ekranına özel üretilmiş, her konu için ayrı görseller (şeffaf arka planlı). */
export const PROFILE_IMG = {
  statMatches: cdnImage('images/profile/stat_matches.png'),
  statWinrate: cdnImage('images/profile/stat_winrate.png'),
  statCorrect: cdnImage('images/profile/stat_correct.png'),
  statAccuracy: cdnImage('images/profile/stat_accuracy.png'),
  metricTime: cdnImage('images/profile/metric_time.png'),
  metricStreak: cdnImage('images/profile/metric_streak.png'),
  metricXp: cdnImage('images/profile/metric_xp.png'),
  tabOverview: cdnImage('images/profile/tab_overview.png'),
  tabMastery: cdnImage('images/profile/tab_mastery.png'),
  tabTitles: cdnImage('images/profile/tab_titles.png'),
  achFirstWin: cdnImage('images/profile/ach_first_win.png'),
  achSpeed: cdnImage('images/profile/ach_speed.png'),
  achStreak: cdnImage('images/profile/ach_streak.png'),
  achHundred: cdnImage('images/profile/ach_hundred.png'),
  achExpert: cdnImage('images/profile/ach_expert.png'),
  achCollector: cdnImage('images/profile/ach_collector.png'),
  lpEmblem: cdnImage('images/profile/lp_emblem.png'),
};

/** Follow the OS preference on native and web, including changes while mounted. */
export function useReducedMotion() {
  const accountStill = useGameStore(state =>
    state.user?.settings?.smoothAnimations === false || state.user?.settings?.batterySaver === true);
  // Ayarlar ekranında değiştirilen tercih anında geçerli olur (misafir kullanıcılar dahil)
  const prefs = usePreferences();
  const preferStill = prefs.smoothAnimations === false || prefs.batterySaver === true ||
    (prefs.smoothAnimations === undefined && prefs.batterySaver === undefined && accountStill);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    const media = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined;
    if (media) setReduced(media.matches);
    else AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); });
    const update = (event: MediaQueryListEvent) => setReduced(event.matches);
    media?.addEventListener?.('change', update);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      media?.removeEventListener?.('change', update);
      subscription.remove();
    };
  }, []);
  return reduced || preferStill;
}

export const DiscoveryArtwork: React.FC<{
  source: ImageSourcePropType; size: number; animated?: boolean;
}> = ({ source, size, animated = true }) => {
  const reduced = useReducedMotion();
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    float.setValue(0);
    if (reduced || !animated) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(float, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float, reduced, animated]);
  return (
    <Animated.View pointerEvents="none" accessible={false} style={{
      width: size, height: size,
      transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
    }}>
      <Image source={source} resizeMode="contain" style={{ width: size, height: size }} />
    </Animated.View>
  );
};

export const GuestDiscoveryCard: React.FC<{ onPress: () => void; compact?: boolean }> = ({ onPress, compact = false }) => {
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  return (
  <View style={[styles.card, compact && styles.compact]}>
    <GradientFill colors={['#382064', '#21123F', '#172D3D']} direction="diagonal" />
    <View style={styles.hero}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{compact ? 'HESAPSIZ KEŞFET' : 'MİSAFİR MODUNDASIN'}</Text>
        <Text style={[styles.title, narrow && styles.narrowTitle]}>{compact ? 'Önce bir göz at.' : 'Giriş yap,\ntüm özellikleri aç.'}</Text>
        <Text style={styles.description}>{compact
          ? 'Kategorileri keşfet, tek kişilik pratikle kendini dene.'
          : 'Arkadaşlarına meydan oku. Kendi başarı hikâyeni başlat.'}</Text>
      </View>
      <DiscoveryArtwork source={DISCOVERY_IMG.explorer} size={narrow ? 72 : compact ? 92 : 112} />
    </View>
    {!compact && (
      <View style={styles.perks}>
        {[
          [DISCOVERY_IMG.speed, 'Canlı 1v1'],
          [DISCOVERY_IMG.victory, 'Özel odalar'],
          [DISCOVERY_IMG.expert, 'Pro Lig'],
          [cdnImage('images/store/coins_s.png'), '+800 altın'],
        ].map(([source, title]) => (
          <View key={String(title)} style={styles.perk}>
            <Image source={source as ImageSourcePropType} style={styles.perkImage} resizeMode="contain" />
            <Text style={styles.perkText}>{String(title)}</Text>
          </View>
        ))}
      </View>
    )}
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} accessibilityRole="button"
      style={[styles.action, compact && styles.guestAction]}>
      <Text style={[styles.actionText, compact && styles.guestActionText]}>{compact ? 'Misafir olarak göz at' : 'Giriş yap / Ücretsiz kayıt ol'}</Text>
      <ArrowRight size={18} color={compact ? '#B7F5E1' : '#281543'} />
    </TouchableOpacity>
    {!compact && <Text style={styles.footnote}>Ücretsiz katıl · İlerlemeni hesabında sakla</Text>}
  </View>
  );
};

export const AchievementState: React.FC<{ done: boolean }> = ({ done }) => (
  <View style={[styles.state, done && styles.stateDone]}>
    {done ? <Check size={11} color="#A7F3D0" /> : <LockKeyhole size={10} color="#D9CDF5" />}
    <Text style={[styles.stateText, done && { color: '#A7F3D0' }]}>{done ? 'Kazanıldı' : 'Kilitli'}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: '#21123F', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(230,195,255,0.24)', overflow: 'hidden', padding: 16, marginTop: 8, marginBottom: 16, gap: 12 },
  compact: { marginTop: 16 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#B7F5E1', fontFamily: THEME.fonts.extraBold, fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  title: { color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 24, lineHeight: 28 },
  narrowTitle: { fontSize: 22, lineHeight: 26 },
  description: { color: '#E2D7F5', fontFamily: THEME.fonts.body, fontSize: 12, lineHeight: 18, marginTop: 8 },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  perk: { width: '48%', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10,4,25,0.32)', borderRadius: 14, padding: 8, gap: 6 },
  perkImage: { width: 32, height: 32 },
  perkText: { color: '#F4EEFF', fontFamily: THEME.fonts.bold, fontSize: 12, flexShrink: 1 },
  action: { minHeight: 48, backgroundColor: '#FFC43D', borderRadius: 14, borderBottomWidth: 3, borderBottomColor: '#B87C18', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  actionText: { color: '#281543', fontFamily: THEME.fonts.extraBold, fontSize: 13, flexShrink: 1, textAlign: 'center' },
  guestAction: { backgroundColor: 'rgba(111,227,193,0.10)', borderWidth: 1, borderColor: 'rgba(111,227,193,0.4)', borderBottomColor: 'rgba(111,227,193,0.4)', borderBottomWidth: 1 },
  guestActionText: { color: '#B7F5E1' },
  footnote: { color: '#D9CDF5', textAlign: 'center', fontFamily: THEME.fonts.body, fontSize: 12 },
  state: { flexDirection: 'row', gap: 3, alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(217,205,245,0.08)' },
  stateDone: { backgroundColor: 'rgba(111,227,193,0.12)' },
  stateText: { color: '#D9CDF5', fontFamily: THEME.fonts.bold, fontSize: 12 },
});
