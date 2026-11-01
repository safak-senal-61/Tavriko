import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
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
  ChestIcon,
  KeyIcon,
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
  const [actionEventId, setActionEventId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);

  // Tab switch fade animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

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

  const switchTab = (tab: EventTab) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setActiveTab(tab);
    setStatusMessage(null);
  };

  const filteredEvents = events.filter((e) => e.type === activeTab);

  const handleAction = async (event: GameEvent) => {
    if (!user) return;
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    setActionEventId(event.id);
    setStatusMessage(null);
    setIsError(false);

    const isCompleted = (event.currentCount || 0) >= event.targetCount;
    const isClaimed = !!event.claimed;
    const isStarted = !!event.started;

    // 1. Claim Reward ("TOPLA")
    if (isCompleted && !isClaimed) {
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
          setActionEventId(null);
          return;
        }

        sound.playSound('victory');
        sound.triggerHaptic('success');
        setIsError(false);
        setStatusMessage(data.message || 'Ödül başarıyla toplandı!');
        if (data.user && onUpdateUser) {
          onUpdateUser(data.user);
        }
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e, claimed: true } : e))
        );
      } catch {
        sound.playSound('wrong');
        setIsError(true);
        setStatusMessage('Bağlantı hatası oluştu.');
      } finally {
        setActionEventId(null);
      }
      return;
    }

    // 2. Start Event if not started yet ("BAŞLA" / "OYNA")
    if (!isStarted) {
      try {
        const res = await fetch(`${base}/social/events/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, eventId: event.id }),
        });

        const data = await res.json();
        if (res.ok && data.event) {
          setEvents((prev) =>
            prev.map((e) => (e.id === event.id ? { ...e, started: true, currentCount: 0 } : e))
          );
        }
      } catch {}
    }

    setActionEventId(null);
    // 3. Navigate to gameplay arena
    if (onStartEvent) {
      onStartEvent();
    }
  };

  const getMetricIcon = (metric: string, type: string) => {
    if (type === 'special') return '🏆';
    if (metric === 'wins') return '🏆';
    if (metric === 'streak') return '🔥';
    if (metric === 'correct_answers') return '⚡';
    return '🏅';
  };

  const getIconCircleStyle = (metric: string, type: string) => {
    if (metric === 'streak') {
      return {
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        borderColor: 'rgba(249, 115, 22, 0.45)',
      };
    }
    if (metric === 'correct_answers') {
      return {
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderColor: 'rgba(56, 189, 248, 0.45)',
      };
    }
    if (metric === 'wins' || type === 'special') {
      return {
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderColor: 'rgba(168, 85, 247, 0.45)',
      };
    }
    return {
      backgroundColor: 'rgba(255, 196, 61, 0.2)',
      borderColor: 'rgba(255, 196, 61, 0.45)',
    };
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
          <Text style={styles.subtitle}>Canlı görevler ve özel turnuva ödülleri</Text>
        </View>

        {/* 3 Pill Tabs Container */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'daily' && styles.tabBtnActive]}
            activeOpacity={0.8}
            onPress={() => switchTab('daily')}
          >
            <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]} numberOfLines={1}>
              📅 Günlük Görevler
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'weekly' && styles.tabBtnActive]}
            activeOpacity={0.8}
            onPress={() => switchTab('weekly')}
          >
            <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]} numberOfLines={1}>
              🏆 Haftalık Hedefler
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'special' && styles.tabBtnActive]}
            activeOpacity={0.8}
            onPress={() => switchTab('special')}
          >
            <Text style={[styles.tabText, activeTab === 'special' && styles.tabTextActive]} numberOfLines={1}>
              ✪ Özel Turnuva
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Toast / Banner */}
        {statusMessage && (
          <View style={[styles.statusBanner, isError ? styles.statusError : styles.statusSuccess]}>
            <Text style={[styles.statusText, isError ? styles.statusTextError : styles.statusTextSuccess]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Content with Fade Animation */}
        {loading ? (
          <ActivityIndicator color="#FFC43D" size="large" style={{ marginTop: 36 }} />
        ) : filteredEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyTitle}>Aktif Görev Bulunmuyor</Text>
            <Text style={styles.emptyDesc}>Bu kategoride henüz yeni görev başlamadı. Yakında tekrar kontrol et!</Text>
          </View>
        ) : (
          <Animated.View style={[styles.eventsList, { opacity: fadeAnim }]}>
            {filteredEvents.map((item) => {
              const current = item.currentCount ?? (item as any).currentProgress ?? 0;
              const target = item.targetCount ?? (item as any).target ?? 1;
              const isCompleted = current >= target;
              const isClaimed = !!item.claimed;
              const isStarted = !!item.started;
              const progressPct = Math.min(100, Math.round((current / target) * 100));
              const isBusy = actionEventId === item.id;
              const desc = item.desc || (item as any).description || '';

              const coins = item.rewardCoins ?? (item as any).rewards?.coins ?? 0;
              const gems = item.rewardGems ?? (item as any).rewards?.gems ?? 0;
              const xp = item.rewardXp ?? (item as any).rewards?.xp ?? 0;
              const seasonXp = item.rewardSeasonXp ?? 0;
              const itemReward = item.rewardItem;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.eventCard,
                    isCompleted && !isClaimed && styles.eventCardCompleted,
                  ]}
                >
                  {/* Card Header Row: Icon + Title/Desc + Action Button */}
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconCircle, getIconCircleStyle(item.metric, item.type)]}>
                      <Text style={styles.metricEmoji}>{getMetricIcon(item.metric, item.type)}</Text>
                    </View>

                    <View style={styles.headerInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.eventDesc} numberOfLines={2}>{desc}</Text>
                    </View>

                    {/* Top Right Action Button */}
                    <View style={styles.actionBtnWrap}>
                      {isClaimed ? (
                        <View style={styles.claimedBadge}>
                          <Text style={styles.claimedText}>ALINDI ✓</Text>
                        </View>
                      ) : isCompleted ? (
                        <TouchableOpacity
                          style={styles.collectBtn}
                          disabled={isBusy}
                          activeOpacity={0.85}
                          onPress={() => handleAction(item)}
                        >
                          {isBusy ? (
                            <ActivityIndicator color="#0A2920" size="small" />
                          ) : (
                            <Text style={styles.collectBtnText}>TOPLA</Text>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.playBtn}
                          disabled={isBusy}
                          activeOpacity={0.85}
                          onPress={() => handleAction(item)}
                        >
                          {isBusy ? (
                            <ActivityIndicator color="#1A0E00" size="small" />
                          ) : (
                            <Text style={styles.playBtnText}>OYNA</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Progress Row */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>
                        İlerleme: {current} / {target}
                      </Text>
                      <Text style={[styles.progressPct, isCompleted && { color: '#5ADBB5' }]}>
                        %{progressPct}
                      </Text>
                    </View>

                    {/* Progress Bar Track */}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progressPct}%`,
                            backgroundColor: isCompleted ? '#5ADBB5' : '#FF9B2F',
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Rewards Chips Row */}
                  <View style={styles.rewardsRow}>
                    {coins > 0 && (
                      <View style={styles.rewardChip}>
                        <CoinIcon size={13} />
                        <Text style={styles.rewardChipTextGold}>+{coins}</Text>
                      </View>
                    )}
                    {gems > 0 && (
                      <View style={styles.rewardChip}>
                        <GemIcon size={13} />
                        <Text style={styles.rewardChipTextPink}>+{gems}</Text>
                      </View>
                    )}
                    {xp > 0 && (
                      <View style={styles.rewardChip}>
                        <Text style={styles.rewardChipStarBlue}>✪</Text>
                        <Text style={styles.rewardChipTextBlue}>+{xp} XP</Text>
                      </View>
                    )}
                    {seasonXp > 0 && (
                      <View style={styles.rewardChip}>
                        <Text style={styles.rewardChipStarMint}>✪</Text>
                        <Text style={styles.rewardChipTextMint}>+{seasonXp} S-XP</Text>
                      </View>
                    )}
                    {itemReward && (
                      <View style={styles.rewardChip}>
                        {itemReward.category === 'chest' ? <ChestIcon size={14} /> : <KeyIcon size={14} />}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </Animated.View>
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
    paddingBottom: 130, // Ample space so bottom card is never covered by bottom nav
    paddingHorizontal: 14,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 34,
    color: '#FFC43D',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: '#B5A7D6',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(12, 5, 28, 0.75)',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#6236FF',
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
    marginBottom: 10,
    borderWidth: 1.5,
  },
  statusSuccess: {
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
    borderColor: '#5ADBB5',
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
    color: '#5ADBB5',
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
  },
  eventCard: {
    backgroundColor: '#1E163B',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  eventCardCompleted: {
    borderColor: 'rgba(90, 219, 181, 0.5)',
    backgroundColor: '#1E1A3F',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricEmoji: {
    fontSize: 22,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  eventDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: '#A99DC9',
    lineHeight: 16,
  },
  actionBtnWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  playBtn: {
    backgroundColor: '#FFB800',
    borderBottomWidth: 3,
    borderBottomColor: '#B8560A',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 16,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    color: '#1A0E00',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    letterSpacing: 0.5,
  },
  collectBtn: {
    backgroundColor: '#5ADBB5',
    borderBottomWidth: 3,
    borderBottomColor: '#1D7A6B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5ADBB5',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  collectBtnText: {
    color: '#072E22',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    letterSpacing: 0.5,
  },
  claimedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  claimedText: {
    color: '#8A7BB3',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  progressSection: {
    marginTop: 12,
    marginBottom: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  progressLabel: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  progressPct: {
    color: '#FFB21E',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  rewardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 4, 24, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  rewardChipTextGold: {
    color: '#FFEAA7',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  rewardChipTextPink: {
    color: '#FF85C0',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  rewardChipStarBlue: {
    color: '#38BDF8',
    fontSize: 10,
  },
  rewardChipTextBlue: {
    color: '#38BDF8',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  rewardChipStarMint: {
    color: '#6FE3C1',
    fontSize: 10,
  },
  rewardChipTextMint: {
    color: '#6FE3C1',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
});
