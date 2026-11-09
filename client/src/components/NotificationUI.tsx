import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell, ChevronRight, X } from 'lucide-react-native';
import type { NotificationItem } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { DISCOVERY_IMG, useReducedMotion } from './DiscoveryArtwork';
import { useNotificationStore, useUnreadCount } from '../store/notificationStore';

export function notificationVisual(type: NotificationItem['type']) {
  if (type === 'friend' || type === 'friend_request') return { image: DISCOVERY_IMG.social, label: 'ARKADAŞLIK', color: '#ADF0D8' };
  if (type === 'duel' || type === 'match_invite') return { image: DISCOVERY_IMG.robot, label: 'DÜELLO DAVETİ', color: '#E1BFFF' };
  if (type === 'reward') return { image: DISCOVERY_IMG.collector, label: 'ÖDÜL', color: '#FFE19B' };
  if (type === 'league') return { image: DISCOVERY_IMG.victory, label: 'LİG', color: '#FFE19B' };
  return { image: DISCOVERY_IMG.bell, label: 'TAVRİKO', color: '#D7CBF1' };
}

export const NotificationBell: React.FC = () => {
  const count = useUnreadCount();
  const reduced = useReducedMotion();
  const bounce = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    bounce.setValue(1);
    ring.setValue(0);
    if (!count || reduced) return;
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1.25, duration: 130, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(bounce, { toValue: 1, friction: 5, useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.sequence([1, -1, 0.6, -0.6, 0].map(value => Animated.timing(ring, {
        toValue: value, duration: 85, useNativeDriver: Platform.OS !== 'web',
      }))),
    ]);
    animation.start();
    return () => animation.stop();
  }, [count, reduced, bounce, ring]);
  return (
    <View pointerEvents="none" accessible={false} style={styles.bell}>
      <Animated.View style={{ transform: [{ rotate: ring.interpolate({ inputRange: [-1, 1], outputRange: ['-15deg', '15deg'] }) }] }}>
        <Bell size={21} color="#F2EAFE" strokeWidth={2} />
      </Animated.View>
      {count > 0 && (
        <Animated.View testID="notification-unread-badge" style={[styles.badge, { transform: [{ scale: bounce }] }]}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </Animated.View>
      )}
    </View>
  );
};

export const NotificationToast: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const notification = useNotificationStore(state => state.toast);
  const dismiss = useNotificationStore(state => state.dismissToast);
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!notification) return;
    const id = notification.id;
    enter.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(enter, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    const timer = setTimeout(() => {
      if (useNotificationStore.getState().toast?.id === id) dismiss();
    }, 6000);
    return () => { clearTimeout(timer); animation.stop(); };
  }, [notification?.id, enter, reduced, dismiss]);
  if (!notification) return null;
  const visual = notificationVisual(notification.type);
  return (
    <Animated.View accessibilityLiveRegion="polite" style={[styles.toast, {
      opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
    }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Bildirimi aç: ${notification.title}`}
        onPress={() => { dismiss(); onOpen(); }} activeOpacity={0.88} style={styles.toastBody}>
        <Image source={visual.image} style={styles.toastImage} resizeMode="contain" />
        <View style={styles.copy}>
          <Text style={[styles.type, { color: visual.color }]}>YENİ BİLDİRİM · {visual.label}</Text>
          <Text style={styles.toastTitle} numberOfLines={2}>{notification.title}</Text>
          <Text style={styles.toastSub} numberOfLines={2}>{notification.sub}</Text>
        </View>
        <ChevronRight size={16} color="#D7CBF1" />
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} accessibilityRole="button" accessibilityLabel="Bildirimi kapat" style={styles.close}>
        <X size={17} color="#D7CBF1" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bell: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  badge: { position: 'absolute', right: -11, top: -9, minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 11, backgroundColor: '#FFC43D', borderWidth: 2, borderColor: '#281447', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#29143E', fontFamily: THEME.fonts.extraBold, fontSize: 12, lineHeight: 15 },
  toast: { position: 'absolute', top: 76, left: 12, right: 12, zIndex: 100, flexDirection: 'row', backgroundColor: '#2C1B48', borderRadius: 22, borderWidth: 1, borderColor: '#8060A5', paddingLeft: 12, paddingVertical: 10, ...Platform.select({ web: { boxShadow: '0 12px 32px #09041488' }, default: { elevation: 15 } }) },
  toastBody: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  toastImage: { width: 44, height: 48 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  type: { fontFamily: THEME.fonts.extraBold, fontSize: 12 },
  toastTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.extraBold, fontSize: 14, lineHeight: 19 },
  toastSub: { color: '#D7CBF1', fontFamily: THEME.fonts.body, fontSize: 12, lineHeight: 17 },
  close: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
});
