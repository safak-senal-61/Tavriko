import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { UserProfile, GameEvent } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoSecondaryBottomNav,
  SecondaryNavTab,
  TavrikoProgressBar,
  ChestIcon,
  TrophyIcon,
  GemIcon,
  CoinIcon,
} from '../components/TavrikoIcons';

interface EventsScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onBack?: () => void;
  onNavigateSecondary?: (tab: SecondaryNavTab) => void;
  onNotifications?: () => void;
  onProfile?: () => void;
  onStartEvent?: () => void;
}

type EventTab = 'daily' | 'weekly' | 'special';

export const EventsScreen: React.FC<EventsScreenProps> = ({
  user,
  apiBaseUrl,
  onUpdateUser,
  onBack,
  onNavigateSecondary,
  onNotifications,
  onProfile,
  onStartEvent,
}) => {
  const [activeTab, setActiveTab] = useState<EventTab>('daily');
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);

  const base = apiBaseUrl || DEFAULT_API_BASE;

  const fetchEvents = () => {
    let isMounted = true;
    const url = `${base}/social/events?userId=${encodeURIComponent(user?.id || '')}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.events && Array.isArray(data.events)) {
          setEvents(data.events);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    fetchEvents();
  }, [user?.id, apiBaseUrl]);

  const filteredEvents = events.filter((e) => e.type === activeTab);

  const handleClaim = async (event: GameEvent) => {
    if (!user) return;
    sound.playSound('tap');
    setClaimingId(event.id);
    setStatusMessage(null);
    setIsError(false);

    try {
      const res = await fetch(`${base}/social/events/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, eventId: event.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(data.error || 'Ödül alınamadı.');
        setClaimingId(null);
        return;
      }

      sound.playSound('victory');
      sound.triggerHaptic('success');
      setIsError(false);
      setStatusMessage(data.message || 'Ödül başarıyla alındı!');
      if (data.user && onUpdateUser) {
        onUpdateUser(data.user);
      }
      // Update local event state to claimed
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, claimed: true } : e))
      );
    } catch {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Bağlantı hatası oluştu.');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType={onBack ? 'back' : 'bell'}
        onLeftPress={onBack || onNotifications}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
        onAvatarPress={onProfile}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Hero */}
        <View style={styles.heroWrap}>
          <Text style={styles.title}>ETKİNLİKLER</Text>
          <Text style={styles.subtitle}>Canlı Görevler ve Özel Turnuva Ödülleri</Text>
        </View>

        {/* 3 Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'daily' && styles.tabBtnActive]}
            onPress={() => {
              sound.playSound('tap');
              setActiveTab('daily');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]}>
              📅 Günlük Görevler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'weekly' && styles.tabBtnActive]}
            onPress={() => {
              sound.playSound('tap');
              setActiveTab('weekly');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]}>
              🏆 Haftalık Hedefler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'special' && styles.tabBtnActive]}
            onPress={() => {
              sound.playSound('tap');
              setActiveTab('special');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'special' && styles.tabTextActive]}>
              ⭐ Özel Turnuva
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Message */}
        {statusMessage && (
          <View style={[styles.statusBanner, isError ? styles.statusError : styles.statusSuccess]}>
            <Text style={[styles.statusText, isError ? styles.statusTextError : styles.statusTextSuccess]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Content */}
        {loading ? (
          <ActivityIndicator color="#FFC43D" size="large" style={{ marginTop: 32 }} />
        ) : filteredEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyTitle}>Aktif Etkinlik Bulunmuyor</Text>
            <Text style={styles.emptyDesc}>Bu kategoride henüz yeni etkinlik başlamadı. Yakında tekrar kontrol et!</Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {filteredEvents.map((item) => {
              const current = item.currentProgress || 0;
              const target = item.target || 1;
              const isCompleted = current >= target;
              const isClaimed = !!item.claimed;
              const progressPct = Math.min(100, Math.round((current / target) * 100));
              const isClaiming = claimingId === item.id;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.eventCard,
                    isCompleted && !isClaimed && styles.eventCardReady,
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.iconCircle}>
                      {item.type === 'special' ? (
                        <ChestIcon size={32} />
                      ) : item.metric === 'wins' ? (
                        <TrophyIcon size={28} />
                      ) : item.metric === 'streak' ? (
                        <Text style={{ fontSize: 24 }}>🔥</Text>
                      ) : (
                        <Text style={{ fontSize: 24 }}>🎯</Text>
                      )}
                    </View>
                    <View style={styles.headerInfo}>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                      <Text style={styles.eventDesc}>{item.description}</Text>
                    </View>
                  </View>

                  {/* Progress */}
                  <View style={styles.progressWrap}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressStatusText}>
                        İlerleme: {current} / {target}
                      </Text>
                      <Text style={styles.progressPctText}>%{progressPct}</Text>
                    </View>
                    <TavrikoProgressBar progress={progressPct} height={8} />
                  </View>

                  {/* Rewards Row & Action */}
                  <View style={styles.cardBottomRow}>
                    <View style={styles.rewardsPreview}>
                      <Text style={styles.rewardsLabel}>Ödüller:</Text>
                      <View style={styles.rewardPills}>
                        {item.rewards.coins ? (
                          <View style={styles.rewardPill}>
                            <CoinIcon size={14} />
                            <Text style={styles.rewardPillText}>+{item.rewards.coins}</Text>
                          </View>
                        ) : null}
                        {item.rewards.gems ? (
                          <View style={styles.rewardPill}>
                            <GemIcon size={14} />
                            <Text style={styles.rewardPillText}>+{item.rewards.gems}</Text>
                          </View>
                        ) : null}
                        {item.rewards.xp ? (
                          <View style={styles.rewardPill}>
                            <Text style={styles.rewardPillText}>+{item.rewards.xp} XP</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Claim Button */}
                    {isClaimed ? (
                      <View style={styles.claimedPill}>
                        <Text style={styles.claimedText}>ALINDI ✓</Text>
                      </View>
                    ) : isCompleted ? (
                      <TouchableOpacity
                        style={styles.claimBtn}
                        disabled={isClaiming}
                        onPress={() => handleClaim(item)}
                      >
                        {isClaiming ? (
                          <ActivityIndicator color="#12052C" size="small" />
                        ) : (
                          <Text style={styles.claimBtnText}>ÖDÜLÜ AL</Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.playBtn}
                        onPress={() => {
                          sound.playSound('tap');
                          if (onStartEvent) onStartEvent();
                        }}
                      >
                        <Text style={styles.playBtnText}>OYNA</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <TavrikoSecondaryBottomNav
        activeTab="events"
        onSelectTab={(tab) => onNavigateSecondary && onNavigateSecondary(tab)}
      />
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
    paddingHorizontal: 12,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFC43D',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#6B3CFF',
  },
  tabText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  statusBanner: {
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1.5,
  },
  statusSuccess: {
    backgroundColor: 'rgba(111, 227, 193, 0.15)',
    borderColor: '#6FE3C1',
  },
  statusError: {
    backgroundColor: 'rgba(255, 92, 119, 0.15)',
    borderColor: '#FF5C77',
  },
  statusText: {
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  statusTextSuccess: {
    color: '#6FE3C1',
  },
  statusTextError: {
    color: '#FF8598',
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptyDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: '#D9CDF5',
    textAlign: 'center',
    lineHeight: 18,
  },
  eventsList: {
    gap: 12,
    marginTop: 6,
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 14,
  },
  eventCardReady: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(107, 60, 255, 0.25)',
    borderWidth: 1.5,
    borderColor: '#6B3CFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  eventTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 15,
    color: '#FFFFFF',
  },
  eventDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: '#D9CDF5',
    marginTop: 2,
  },
  progressWrap: {
    marginVertical: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressStatusText: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
  },
  progressPctText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  rewardsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardsLabel: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
  },
  rewardPills: {
    flexDirection: 'row',
    gap: 4,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rewardPillText: {
    color: '#FFEAA7',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  claimedPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  claimedText: {
    color: '#8A7BB3',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  claimBtn: {
    backgroundColor: '#FFC43D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#FFC43D',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  claimBtnText: {
    color: '#12052C',
    fontSize: 12,
    fontFamily: THEME.fonts.display,
  },
  playBtn: {
    backgroundColor: '#6B3CFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  playBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
});
