import { cdnImage } from '../utils/cdn';
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
import { authHeaders } from '../utils/apiAuth';
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
import Reanimated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Image, ImageSourcePropType } from 'react-native';
import { KitHero, KitSegment, KitEmpty, STORE_IMG, storeImageFor, KIT, FloatingElement, PulseElement, ShimmerView, UI_IMG } from '../components/StoreKit';

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

// Etkinlik kartlarına özel üretilmiş görseller
const EVENT_TYPE_IMG: Record<EventTab, ImageSourcePropType> = {
  daily: cdnImage('images/ui/event_daily.png'),
  weekly: cdnImage('images/ui/event_weekly.png'),
  special: cdnImage('images/ui/event_special.png'),
};

const EVENT_METRIC_IMG: Record<string, ImageSourcePropType> = {
  wins: cdnImage('images/ui/event_wins.png'),
  streak: cdnImage('images/ui/event_streak.png'),
  correct_answers: cdnImage('images/ui/event_correct.png'),
};

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
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
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

  const getEventArtwork = (metric: string, type: string): ImageSourcePropType =>
    EVENT_METRIC_IMG[metric] || EVENT_TYPE_IMG[(type as EventTab)] || EVENT_TYPE_IMG.daily;

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
        <KitHero
          source={STORE_IMG.eventsHero}
          eyebrow="GÖREV VE TURNUVA"
          title="Etkinlikler"
          subtitle="Canlı görevler ve özel turnuva ödülleri"
          height={150}
          delay={0}
        />

        <KitSegment<EventTab>
          tabs={[
            { id: 'daily', label: 'Günlük', icon: UI_IMG.daily },
            { id: 'weekly', label: 'Haftalık', icon: UI_IMG.weekly },
            { id: 'special', label: 'Özel Turnuva', icon: UI_IMG.special },
          ]}
          active={activeTab}
          onChange={(t) => t !== activeTab && switchTab(t)}
        />

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
          <KitEmpty
            source={STORE_IMG.eventsEmpty}
            title="Aktif görev yok"
            desc="Bu kategoride henüz yeni görev başlamadı. Yakında tekrar kontrol et."
          />
        ) : (
          <Animated.View style={[styles.eventsList, { opacity: fadeAnim }]}>
            {filteredEvents.map((item, index) => {
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
                <Reanimated.View
                  key={`${activeTab}-${item.id}`}
                  entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(360)}
                  style={[
                    styles.eventCard,
                    isCompleted && !isClaimed && styles.eventCardCompleted,
                  ]}
                >
                  {/* Card Header Row: Custom Artwork + Title/Desc + Action Button */}
                  <View style={styles.cardHeaderRow}>
                    <FloatingElement amplitude={4} duration={1600}>
                      <Reanimated.View
                        entering={ZoomIn.delay(Math.min(index, 8) * 60 + 80).springify().damping(12)}
                      >
                        {isCompleted && !isClaimed ? (
                          <PulseElement min={1} max={1.08} duration={900}>
                            <Image
                              source={getEventArtwork(item.metric, item.type)}
                              style={[styles.eventArt, isCompleted && { borderColor: 'rgba(90, 219, 181, 0.7)' }]}
                              resizeMode="cover"
                              accessibilityLabel={item.title}
                            />
                          </PulseElement>
                        ) : (
                          <Image
                            source={getEventArtwork(item.metric, item.type)}
                            style={styles.eventArt}
                            resizeMode="cover"
                            accessibilityLabel={item.title}
                          />
                        )}
                      </Reanimated.View>
                    </FloatingElement>

                    <View style={styles.headerInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.eventDesc} numberOfLines={2}>{desc}</Text>
                    </View>

                    {/* Top Right Action Button */}
                    <View style={styles.actionBtnWrap}>
                      {isClaimed ? (
                        <View style={styles.claimedBadge}>
                          <Text style={styles.claimedText}>Alındı</Text>
                        </View>
                      ) : isCompleted ? (
                        <PulseElement min={1} max={1.05} duration={700}>
                          <TouchableOpacity
                            style={styles.collectBtn}
                            disabled={isBusy}
                            activeOpacity={0.85}
                            onPress={() => handleAction(item)}
                          >
                            {isBusy ? (
                              <ActivityIndicator color="#0A2920" size="small" />
                            ) : (
                              <Text style={styles.collectBtnText}>Topla</Text>
                            )}
                          </TouchableOpacity>
                        </PulseElement>
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
                            <Text style={styles.playBtnText}>Oyna</Text>
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
                            width: `${Math.max(progressPct, 10)}%`,
                            backgroundColor: isCompleted ? '#5ADBB5' : '#FF9B2F',
                          },
                        ]}
                      >
                        <ShimmerView color="#FFFFFF" duration={2000} />
                      </View>
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
                        {storeImageFor(itemReward.id || '', itemReward.category) ? (
                          <Image
                            source={storeImageFor(itemReward.id || '', itemReward.category) as any}
                            style={{ width: 20, height: 20 }}
                            resizeMode="contain"
                          />
                        ) : itemReward.category === 'chest' ? (
                          <ChestIcon size={14} />
                        ) : (
                          <KeyIcon size={14} />
                        )}
                      </View>
                    )}
                  </View>
                </Reanimated.View>
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
    paddingBottom: 160, // Ample space so bottom card is never covered by bottom nav
    paddingHorizontal: 14,
  },
  heroBox: {
    borderWidth: 1.5,
    borderColor: '#30398A',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(23, 16, 52, 0.45)',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 32,
    color: '#FFC43D',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: '#D9CDF5',
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
    backgroundColor: KIT.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: KIT.border,
    padding: 14,
  },
  eventCardCompleted: {
    borderColor: 'rgba(90, 219, 181, 0.45)',
    backgroundColor: 'rgba(20, 40, 52, 0.7)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventArt: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: '#241637',
  },
  metricEmoji: {
    fontSize: 22,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 15,
    color: '#FFFFFF',
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
    backgroundColor: KIT.gold,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 12,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    color: '#1A0B3B',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  collectBtn: {
    backgroundColor: '#5ADBB5',
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 12,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectBtnText: {
    color: '#072E22',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
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
