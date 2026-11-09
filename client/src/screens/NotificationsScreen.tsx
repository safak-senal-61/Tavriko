import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import type { UserProfile, NotificationItem } from '@trivia/shared';
import { Check, CheckCheck, Clock3, RefreshCw, X } from 'lucide-react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import { socketService } from '../services/socketService';
import { TavrikoScreen, TavrikoTopBar, CharacterAvatar } from '../components/TavrikoIcons';
import { DISCOVERY_IMG, DiscoveryArtwork } from '../components/DiscoveryArtwork';
import { GradientFill } from '../components/TavrikoGradient';
import { notificationVisual } from '../components/NotificationUI';
import { isInvitation, isUnread, useNotificationStore, useUnreadCount } from '../store/notificationStore';

interface NotificationsScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onBack: () => void;
  onAcceptDuel?: (roomCode?: string) => void;
  onRefreshUser?: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  user, apiBaseUrl, onBack, onAcceptDuel, onRefreshUser,
}) => {
  const { items, readIds, loading, error, markRead, patch, refresh } = useNotificationStore();
  const count = useUnreadCount();
  const [filter, setFilter] = useState<'all' | 'unread' | 'invites'>('all');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<{ id: string; text: string } | null>(null);
  const base = apiBaseUrl || DEFAULT_API_BASE;
  // Includes late HTTP snapshots and WebSocket arrivals while this inbox is open.
  useEffect(() => { useNotificationStore.getState().markAllSeen(); }, [items]);
  const shown = items.filter(item =>
    filter === 'unread' ? isUnread(item, readIds) : filter === 'invites' ? isInvitation(item) : true);

  const handleRespond = async (notification: NotificationItem, action: 'accept' | 'decline') => {
    if (!user?.id || respondingId) return;
    const owner = user.id;
    setRespondingId(notification.id);
    setResponseError(null);
    sound.playSound('tap');
    // Do not pretend an invite succeeded until the server confirms it.
    try {
      const res = await fetch(`${base}/social/notifications/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: owner, notificationId: notification.id, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'İstek tamamlanamadı. Lütfen yeniden dene.');
      if (useNotificationStore.getState().userId !== owner) return;
      const duel = notification.type === 'match_invite' || notification.type === 'duel';
      patch(notification.id, {
        handled: action === 'accept' ? 'accepted' : 'declined',
        sub: action === 'decline' ? 'İstek reddedildi.' : duel
          ? 'Düello kabul edildi. Odaya bağlanıyorsun.'
          : 'Arkadaşlık isteği kabul edildi. Artık birlikte oynayabilirsiniz.',
      });
      markRead([notification.id]);
      sound.playSound(action === 'accept' ? 'reward' : 'tap');
      sound.triggerHaptic(action === 'accept' ? 'success' : 'light');
      if (action === 'accept' && duel) onAcceptDuel?.(data.roomCode || notification.roomCode);
      if (action === 'accept' && !duel && (data.senderId || notification.senderId)) {
        socketService.notifyUserRealtime(data.senderId || notification.senderId, 'friends:update', { friendId: owner });
      }
      onRefreshUser?.();
    } catch (err: any) {
      setResponseError({ id: notification.id, text: err.message || 'Bağlantı kurulamadı. Yeniden dene.' });
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <TavrikoScreen>
      <TavrikoTopBar leftType="back" onLeftPress={onBack} coins={user?.coins} gems={user?.gems}
        avatarSeed={user?.avatarUrl || user?.displayName} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <GradientFill colors={['#362051', '#24173E']} direction="diagonal" />
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>BİLDİRİM MERKEZİ</Text>
            <Text accessibilityRole="header" style={styles.title}>Senden haber var.</Text>
            <Text accessibilityLiveRegion="polite" style={styles.heroSub}>
              {count > 0 ? `${count} yeni bildirim seni bekliyor.` : 'Her şey güncel. Yeni haberler burada.'}
            </Text>
          </View>
          <DiscoveryArtwork source={DISCOVERY_IMG.bell} size={100} />
        </View>

        <View style={styles.toolbar}>
          <Text style={styles.inboxTitle}>Gelen kutun <Text style={styles.total}>{items.length}</Text></Text>
          <TouchableOpacity onPress={() => void refresh(base)} accessibilityRole="button"
            accessibilityLabel="Bildirimleri yenile" disabled={loading} style={styles.refresh}>
            {loading ? <ActivityIndicator size="small" color="#E1BFFF" /> : <RefreshCw size={17} color="#E1BFFF" />}
          </TouchableOpacity>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {([['all', 'Tümü'], ['unread', `Okunmamış (${count})`], ['invites', 'Davetler']] as const).map(([key, label]) => (
            <TouchableOpacity key={key} accessibilityRole="tab" accessibilityState={{ selected: filter === key }} aria-selected={filter === key}
              style={[styles.tab, filter === key && styles.tabActive]} onPress={() => setFilter(key)}>
              <Text style={[styles.tabText, filter === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {count > 0 && (
          <TouchableOpacity accessibilityRole="button" style={styles.markAll}
            onPress={() => { markRead(items.map(item => item.id)); sound.playSound('tap'); }}>
            <CheckCheck size={17} color="#ADF0D8" />
            <Text style={styles.markAllText}>Tümünü okundu işaretle</Text>
          </TouchableOpacity>
        )}
        {error && (
          <View accessibilityLiveRegion="polite" style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => void refresh(base)} style={styles.retry}>
              <Text style={styles.retryText}>Yeniden dene</Text>
            </TouchableOpacity>
          </View>
        )}
        {loading && items.length === 0 ? (
          <View style={styles.loading}>
            {[0, 1, 2].map(i => <View key={i} style={styles.skeleton}><View style={styles.skeletonImage} /><View style={styles.skeletonCopy} /></View>)}
            <Text style={styles.meta}>Haberlerin yükleniyor...</Text>
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <DiscoveryArtwork source={filter === 'invites' ? DISCOVERY_IMG.social : DISCOVERY_IMG.bell} size={144} />
            <Text style={styles.emptyTitle}>{filter === 'unread' ? 'Hepsini yakaladın.' : filter === 'invites' ? 'Yeni rakipler yolda.' : 'Güzel haberler burada birikir.'}</Text>
            <Text style={styles.emptySub}>
              {filter === 'unread' ? 'Okunmamış bildirimin kalmadı. Yeni bir haber geldiğinde zilin üzerinde göreceksin.'
                : 'Arkadaşlık istekleri, düello davetleri ve kazandığın ödüller burada seni bekleyecek.'}
            </Text>
            <TouchableOpacity accessibilityRole="button" style={styles.emptyAction} onPress={filter === 'all' ? onBack : () => setFilter('all')}>
              <Text style={styles.emptyActionText}>{filter === 'all' ? 'Oynamaya devam et' : 'Tüm bildirimleri gör'}</Text>
            </TouchableOpacity>
          </View>
        ) : shown.map(item => {
          const fresh = isUnread(item, readIds);
          const visual = notificationVisual(item.type);
          const actionable = isInvitation(item) && !item.handled;
          const responding = respondingId === item.id;
          return (
            <View key={item.id} testID={`notification-card-${item.id}`} style={[styles.card, fresh && styles.cardFresh]}>
              <View style={styles.cardHeader}>
                <View style={styles.artFrame}>
                  <Image source={visual.image} style={styles.art} resizeMode="contain" />
                  {item.senderAvatar && <View style={styles.sender}><CharacterAvatar seed={item.senderAvatar} size={24} /></View>}
                </View>
                <View style={styles.cardHeading}>
                  <Text style={[styles.type, { color: visual.color }]}>{visual.label}</Text>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={styles.timeRow}><Clock3 size={12} color="#CCBDDD" /><Text style={styles.meta}>{item.timeText || 'Şimdi'}</Text>
                    {fresh && <View style={styles.newPill}><Text style={styles.newText}>Yeni</Text></View>}
                  </View>
                </View>
              </View>
              <Text style={styles.message}>{item.sub}</Text>
              {responseError?.id === item.id && <Text accessibilityLiveRegion="polite" style={styles.errorText}>{responseError.text}</Text>}
              {actionable ? (
                <View style={styles.actions}>
                  <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!respondingId }}
                    disabled={!!respondingId} style={[styles.accept, responding && styles.busy]}
                    onPress={() => void handleRespond(item, 'accept')}>
                    {responding ? <ActivityIndicator size="small" color="#153B30" /> : <Check size={17} color="#153B30" />}
                    <Text style={styles.acceptText}>{responding ? 'İşleniyor...' : item.type === 'duel' || item.type === 'match_invite' ? 'Düelloya katıl' : 'Kabul et'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" disabled={!!respondingId} style={styles.decline}
                    accessibilityState={{ disabled: !!respondingId }} onPress={() => void handleRespond(item, 'decline')}>
                    <X size={16} color="#FFD2DC" /><Text style={styles.declineText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              ) : isInvitation(item) && item.handled ? (
                <View style={styles.handled}>
                  {item.handled === 'accepted' ? <CheckCheck size={15} color="#ADF0D8" /> : <X size={15} color="#FFD2DC" />}
                  <Text style={[styles.handledText, item.handled === 'declined' && { color: '#FFD2DC' }]}>
                    {item.handled === 'accepted' ? 'Kabul edildi' : 'Reddedildi'}
                  </Text>
                </View>
              ) : null}
              {fresh && (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Okundu işaretle: ${item.title}`}
                  style={styles.readAction} onPress={() => markRead([item.id])}>
                  <Check size={14} color="#D7CBF1" /><Text style={styles.readText}>Okundu işaretle</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40, paddingTop: 8, gap: 12 },
  hero: { borderRadius: 24, borderWidth: 1, borderColor: '#685184', padding: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  heroCopy: { flex: 1, minWidth: 0, gap: 8 },
  eyebrow: { color: '#ADF0D8', fontFamily: THEME.fonts.extraBold, fontSize: 12, letterSpacing: 1 },
  title: { color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 26, lineHeight: 32 },
  heroSub: { color: '#DDD0EE', fontFamily: THEME.fonts.body, fontSize: 13, lineHeight: 19 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4 },
  inboxTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.extraBold, fontSize: 18 },
  total: { color: '#CDB9E4', fontSize: 14 },
  refresh: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#1C1030', borderRadius: 16, padding: 4, gap: 3 },
  tab: { flex: 1, minHeight: 44, paddingHorizontal: 2, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tabActive: { backgroundColor: '#61418F' },
  tabText: { color: '#D7CBF1', fontFamily: THEME.fonts.extraBold, fontSize: 12 },
  tabTextActive: { color: '#FFFFFF' },
  markAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingRight: 4 },
  markAllText: { color: '#ADF0D8', fontFamily: THEME.fonts.bold, fontSize: 13 },
  card: { borderRadius: 22, padding: 16, gap: 12, borderWidth: 1, borderColor: '#4C395F', backgroundColor: '#241735' },
  cardFresh: { backgroundColor: '#302044', borderColor: '#8764A7' },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  artFrame: { width: 60, height: 64, flexShrink: 0 },
  art: { width: 60, height: 60 },
  sender: { position: 'absolute', bottom: 0, right: -1, borderWidth: 2, borderRadius: 16, borderColor: '#302044' },
  cardHeading: { flex: 1, minWidth: 0, gap: 4 },
  type: { fontFamily: THEME.fonts.extraBold, fontSize: 12, letterSpacing: 0.7 },
  cardTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.extraBold, fontSize: 16, lineHeight: 22 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  meta: { color: '#CCBDDD', fontFamily: THEME.fonts.body, fontSize: 12 },
  newPill: { backgroundColor: '#264E42', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
  newText: { color: '#C2F8E3', fontFamily: THEME.fonts.extraBold, fontSize: 12 },
  message: { color: '#DDD0EE', fontFamily: THEME.fonts.body, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 8 },
  accept: { flex: 1.3, minHeight: 46, borderRadius: 12, backgroundColor: '#85E6C6', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, paddingHorizontal: 5 },
  acceptText: { color: '#153B30', fontFamily: THEME.fonts.extraBold, fontSize: 14 },
  decline: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: '#483043', borderWidth: 1, borderColor: '#78536A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  declineText: { color: '#FFD2DC', fontFamily: THEME.fonts.bold, fontSize: 14 },
  busy: { opacity: 0.7 },
  handled: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  handledText: { color: '#ADF0D8', fontFamily: THEME.fonts.extraBold, fontSize: 13 },
  readAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, minHeight: 44 },
  readText: { color: '#D7CBF1', fontFamily: THEME.fonts.bold, fontSize: 12 },
  error: { backgroundColor: '#482339', borderWidth: 1, borderColor: '#805065', padding: 12, borderRadius: 14 },
  errorText: { color: '#FFD2DC', fontFamily: THEME.fonts.bold, fontSize: 13, lineHeight: 20 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { color: '#FFFFFF', fontFamily: THEME.fonts.extraBold, fontSize: 14 },
  loading: { gap: 12 },
  skeleton: { height: 132, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#291B3C' },
  skeletonImage: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#453356' },
  skeletonCopy: { flex: 1, height: 44, borderRadius: 8, backgroundColor: '#453356' },
  empty: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, gap: 12 },
  emptyTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.extraBold, fontSize: 20, textAlign: 'center' },
  emptySub: { color: '#DDD0EE', fontFamily: THEME.fonts.body, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  emptyAction: { minHeight: 48, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#85E6C6', justifyContent: 'center', marginTop: 4 },
  emptyActionText: { color: '#153B30', fontFamily: THEME.fonts.extraBold, fontSize: 14 },
});
