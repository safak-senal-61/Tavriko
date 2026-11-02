import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { UserProfile, NotificationItem } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CharacterAvatar,
  ChestIcon,
  TrophyIcon,
  ModeSquircleIcon,
  StreakFlameIcon,
} from '../components/TavrikoIcons';

interface NotificationsScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onBack: () => void;
  onAcceptDuel?: (roomCode?: string) => void;
  onRefreshUser?: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  user,
  apiBaseUrl,
  onBack,
  onAcceptDuel,
  onRefreshUser,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const base = apiBaseUrl || DEFAULT_API_BASE;
  const userId = user?.id || 'anon';

  const fetchNotifications = () => {
    setLoading(true);
    fetch(`${base}/social/notifications/${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        } else if (user?.notifications && user.notifications.length > 0) {
          setNotifications(user.notifications);
        }
      })
      .catch(() => {
        if (user?.notifications) {
          setNotifications(user.notifications);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchNotifications();
  }, [userId, base]);

  const handleRespond = async (
    notification: NotificationItem,
    action: 'accept' | 'decline'
  ) => {
    sound.playSound(action === 'accept' ? 'reward' : 'tap');
    sound.triggerHaptic(action === 'accept' ? 'success' : 'light');

    setRespondingId(notification.id);

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id
          ? {
              ...n,
              handled: action === 'accept' ? 'accepted' : 'declined',
              sub:
                action === 'accept'
                  ? notification.type === 'match_invite'
                    ? 'Düello kabul edildi! Odaya aktarılıyorsunuz...'
                    : 'Arkadaşlık isteği kabul edildi. Artık arkadaşsınız!'
                  : 'İstek reddedildi.',
            }
          : n
      )
    );

    try {
      const res = await fetch(`${base}/social/notifications/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          notificationId: notification.id,
          action,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (action === 'accept') {
          if (notification.type === 'match_invite' || notification.type === 'duel') {
            const targetRoom = data.roomCode || notification.roomCode || 'DUEL1';
            if (onAcceptDuel) {
              onAcceptDuel(targetRoom);
            }
          }
          if (onRefreshUser) {
            onRefreshUser();
          }
        }
      }
    } catch {
      // Keep optimistic update
    } finally {
      setRespondingId(null);
    }
  };

  const renderNotifIcon = (n: NotificationItem) => {
    if (n.senderAvatar || n.type === 'friend_request' || n.type === 'friend') {
      return (
        <CharacterAvatar
          seed={n.senderAvatar || n.senderName || 'av2'}
          size={42}
        />
      );
    }
    if (n.type === 'match_invite' || n.type === 'duel') {
      return (
        <CharacterAvatar
          seed={n.senderAvatar || n.senderName || 'av3'}
          size={42}
        />
      );
    }
    if (n.type === 'reward') return <ChestIcon size={38} />;
    if (n.type === 'league') return <TrophyIcon size={38} />;
    return <ModeSquircleIcon mode="notification" size={38} />;
  };

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>BİLDİRİMLER</Text>

        {loading ? (
          <ActivityIndicator
            color="#FFC43D"
            size="large"
            style={{ marginTop: 36 }}
          />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <ModeSquircleIcon mode="notification" size={64} />
            <Text style={styles.emptyTitle}>Henüz yeni bildirim yok</Text>
            <Text style={styles.emptySub}>
              Arkadaşlık istekleri ve 1v1 düello meydan okumaları burada listelenir.
            </Text>
          </View>
        ) : (
          notifications.map((n) => {
            const isActionable =
              (n.type === 'friend_request' ||
                n.type === 'friend' ||
                n.type === 'match_invite' ||
                n.type === 'duel') &&
              !n.handled;

            return (
              <View key={n.id} style={styles.notifCard}>
                <View style={styles.iconWrap}>{renderNotifIcon(n)}</View>

                <View style={{ flex: 1 }}>
                  <View style={styles.headerRow}>
                    <Text style={styles.notifTitle} numberOfLines={2}>
                      {n.title}
                    </Text>
                    <Text style={styles.timeText}>{n.timeText || 'Şimdi'}</Text>
                  </View>

                  <Text style={styles.notifSub}>{n.sub}</Text>

                  {isActionable ? (
                    <View style={styles.actionsRow}>
                      <Button3D
                        title={
                          respondingId === n.id
                            ? '...'
                            : n.type === 'match_invite' || n.type === 'duel'
                            ? 'YARIŞA KATIL'
                            : 'KABUL ET'
                        }
                        variant="mint"
                        onPress={() => handleRespond(n, 'accept')}
                        style={styles.actionBtn}
                        textStyle={{ fontSize: 13 }}
                      />
                      <Button3D
                        title="REDDET"
                        variant="red"
                        onPress={() => handleRespond(n, 'decline')}
                        style={styles.actionBtn}
                        textStyle={{ fontSize: 13 }}
                      />
                    </View>
                  ) : n.handled ? (
                    <View style={styles.handledBadge}>
                      <Text
                        style={[
                          styles.handledText,
                          {
                            color:
                              n.handled === 'accepted' ? '#3FD08A' : '#FF5A6A',
                          },
                        ]}
                      >
                        {n.handled === 'accepted'
                          ? '✓ İstek Kabul Edildi'
                          : '✕ İstek Reddedildi'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  iconWrap: {
    paddingTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  notifTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    lineHeight: 18,
  },
  notifSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 4,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  handledBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignSelf: 'flex-start',
  },
  handledText: {
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  timeText: {
    color: 'rgba(217, 205, 245, 0.7)',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 8,
  },
  emptySub: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    color: '#D9CDF5',
    textAlign: 'center',
    lineHeight: 18,
  },
});
