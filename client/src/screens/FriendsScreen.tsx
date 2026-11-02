import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  TextInput,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { UserProfile, calculateLevelFromXp } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import { socketService } from '../services/socketService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  Button3D,
  CharacterAvatar,
} from '../components/TavrikoIcons';
interface FriendsScreenProps {
  user?: UserProfile;
  isGuest?: boolean;
  apiBaseUrl?: string;
  onBack: () => void;
  onInviteToMatch: (friendId: string, friendName?: string, roomCode?: string) => void;
  onJoinFriendRoom?: (roomCode: string) => void;
  onNavigateTab?: (tab: 'play' | 'explore' | 'leaders' | 'friends' | 'profile') => void;
  onNotifications?: () => void;
}
interface FriendRowItem {
  id: string;
  name: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  rankTitle: string;
  level: number;
  rankPoints?: number;
  xp?: number;
  wins?: number;
  totalMatches?: number;
  correctAnswers?: number;
  bestStreak?: number;
  countryCode?: string;
  countryName?: string;
  online: boolean;
  status: string;
  isFriend?: boolean;
  inRoom?: boolean;
  currentRoomCode?: string;
}
export const FriendsScreen: React.FC<FriendsScreenProps> = ({
  user,
  isGuest = false,
  apiBaseUrl,
  onBack,
  onInviteToMatch,
  onJoinFriendRoom,
  onNavigateTab,
  onNotifications,
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'add' | 'requests'>('friends');
  const [copied, setCopied] = useState(false);
  const [friendCode, setFriendCode] = useState(user?.friendCode || 'TV-10000');
  const [friendsList, setFriendsList] = useState<FriendRowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengeLoadingId, setChallengeLoadingId] = useState<string | null>(null);
  const [challengeNotice, setChallengeNotice] = useState<string | null>(null);
  // Profile Inspection Modal State
  const [inspectPlayer, setInspectPlayer] = useState<FriendRowItem | null>(null);
  const [inspectDetails, setInspectDetails] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  // Add Friend state
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null);
  const [addErrorMsg, setAddErrorMsg] = useState<string | null>(null);
  const base = apiBaseUrl || DEFAULT_API_BASE;
  const fetchFriends = () => {
    const uid = user?.id || 'default';
    setLoading(true);
    fetch(`${base}/social/friends/${uid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.friendCode) setFriendCode(data.friendCode);
        if (Array.isArray(data.friends)) {
          // Strictly deduplicate users by ID and username
          const seenIds = new Set<string>();
          const seenUsernames = new Set<string>();
          const cleanFriends = data.friends.filter((f: FriendRowItem) => {
            if (!f || !f.id || seenIds.has(f.id)) return false;
            const uName = (f.username || f.name || f.displayName || '').toLowerCase().trim();
            if (uName && seenUsernames.has(uName)) return false;
            seenIds.add(f.id);
            if (uName) seenUsernames.add(uName);
            return true;
          });
          setFriendsList(cleanFriends);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFriends();

    // Listen to real-time presence events from WebSocket
    const unsubPresenceUpdate = socketService.on('presence:update', (data: any) => {
      if (!data || !data.userId) return;
      setFriendsList((prev) =>
        prev.map((f) => {
          if (f.id === data.userId) {
            const isOnline = data.online ?? f.online;
            const inRoom = data.inRoom ?? f.inRoom;
            const currentRoomCode = data.currentRoomCode ?? f.currentRoomCode;
            let status = f.status;
            if (inRoom && currentRoomCode) {
              status = `Oda: #${currentRoomCode} · Lobide`;
            } else if (f.isFriend) {
              status = isOnline ? 'Arkadaşın · Çevrimiçi' : 'Arkadaşın · Çevrimdışı';
            } else {
              status = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
            }
            return {
              ...f,
              online: isOnline,
              inRoom,
              currentRoomCode,
              status,
            };
          }
          return f;
        })
      );
    });

    const unsubUserOnline = socketService.on('user:online', (data: any) => {
      const uid = data?.userId || data?.presence?.userId;
      if (!uid) return;
      setFriendsList((prev) =>
        prev.map((f) => {
          if (f.id === uid) {
            return {
              ...f,
              online: true,
              status: f.isFriend ? 'Arkadaşın · Çevrimiçi' : 'Çevrimiçi',
            };
          }
          return f;
        })
      );
    });

    const unsubUserOffline = socketService.on('user:offline', (data: any) => {
      const uid = data?.userId || data?.presence?.userId;
      if (!uid) return;
      setFriendsList((prev) =>
        prev.map((f) => {
          if (f.id === uid) {
            return {
              ...f,
              online: false,
              inRoom: false,
              status: f.isFriend ? 'Arkadaşın · Çevrimdışı' : 'Çevrimdışı',
            };
          }
          return f;
        })
      );
    });

    const unsubFriendsUpdate = socketService.on('friends:update', () => {
      fetchFriends();
    });

    return () => {
      unsubPresenceUpdate();
      unsubUserOnline();
      unsubUserOffline();
      unsubFriendsUpdate();
    };
  }, [apiBaseUrl, user?.id]);
  const currentCode = user?.friendCode || friendCode;
  const handleCopyCode = async () => {
    sound.playSound('reward');
    sound.triggerHaptic('success');
    await Clipboard.setStringAsync(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleShareCode = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    try {
      await Share.share({
        message: `Tavriko bilgi yarışmasında bana meydan oku! 🎮\nArkadaşlık Kodum: ${currentCode}\nUygulamayı aç ve 1v1 düelloya başla!`,
      });
    } catch {}
  };
  const handleOpenProfile = async (player: FriendRowItem) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setInspectPlayer(player);
    setInspectDetails(null);
    setInspectLoading(true);
    try {
      const res = await fetch(`${base}/social/profile/${player.id}`);
      if (res.ok) {
        const fullProfile = await res.json();
        setInspectDetails(fullProfile);
      }
    } catch {
      // offline / cached fallback
    } finally {
      setInspectLoading(false);
    }
  };
  const handleAddFriend = async () => {
    const clean = addInput.trim();
    if (!clean) {
      sound.playSound('wrong');
      setAddErrorMsg('Lütfen arkadaşlık kodu veya kullanıcı adı girin.');
      return;
    }
    if (!user) {
      sound.playSound('wrong');
      setAddErrorMsg('Arkadaş eklemek için lütfen giriş yapın.');
      return;
    }
    setAddLoading(true);
    setAddErrorMsg(null);
    setAddSuccessMsg(null);
    try {
      const res = await fetch(`${base}/social/friends/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          codeOrUsername: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Arkadaş eklenemedi.');
      }
      sound.playSound('victory');
      sound.triggerHaptic('success');
      setAddSuccessMsg(`🎉 ${data.friend?.displayName || clean} başarıyla arkadaş listene eklendi!`);
      setAddInput('');
      fetchFriends();
    } catch (err: any) {
      sound.playSound('wrong');
      setAddErrorMsg(err.message || 'Kullanıcı bulunamadı.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleSendChallenge = async (friend: FriendRowItem) => {
    if (!user) {
      sound.playSound('wrong');
      setChallengeNotice('1v1 yarış daveti göndermek için giriş yapmalısınız.');
      return;
    }
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    setChallengeLoadingId(friend.id);
    setChallengeNotice(null);

    try {
      const res = await fetch(`${base}/social/friends/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          targetUserId: friend.id,
          category: 'genel_kultur',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        sound.playSound('reward');
        sound.triggerHaptic('success');
        setChallengeNotice(`⚔️ ${friend.displayName || friend.name} oyuncusuna 1v1 düello daveti gönderildi! Odaya aktarılıyorsunuz...`);
        setTimeout(() => {
          onInviteToMatch(friend.id, friend.displayName || friend.name, data.roomCode);
        }, 1000);
      } else {
        throw new Error(data.error || 'Düello daveti gönderilemedi.');
      }
    } catch (err: any) {
      sound.playSound('wrong');
      setChallengeNotice(`⚠️ ${err.message || 'Davet gönderilemedi.'}`);
    } finally {
      setChallengeLoadingId(null);
    }
  };
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="bell"
        onLeftPress={onNotifications || onBack}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
        onAvatarPress={() => onNavigateTab && onNavigateTab('profile')}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>ARKADAŞLAR</Text>
        {/* Friend Code Card (Fixed Width, No Overflow, Full Copy & Share) */}
        <View style={styles.codeCard}>
          <Text style={styles.codeHeaderLabel}>SENİN ARKADAŞLIK KODUN</Text>
          <View style={styles.codePillBox}>
            <Text
              style={styles.codeValueText}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {currentCode}
            </Text>
          </View>
          <View style={styles.codeActionsRow}>
            <Button3D
              title={copied ? 'KOPYALANDI' : 'KOPYALA'}
              variant="mint"
              onPress={handleCopyCode}
              style={{ flex: 1, minHeight: 44 }}
              textStyle={{ fontSize: 13 }}
            />
            <Button3D
              title="PAYLAŞ"
              variant="gold"
              onPress={handleShareCode}
              style={{ flex: 1, minHeight: 44 }}
              textStyle={{ fontSize: 13 }}
            />
          </View>
        </View>
        {challengeNotice && (
          <View style={styles.challengeNoticeCard}>
            <Text style={styles.challengeNoticeText}>{challengeNotice}</Text>
          </View>
        )}
        {/* 3 Navigation Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'friends' && styles.tabPillActive,
            ]}
            onPress={() => {
              sound.playSound('nav');
              setActiveTab('friends');
            }}
          >
            <Text style={styles.tabText}>Oyuncular ({friendsList.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'add' && styles.tabPillActive,
            ]}
            onPress={() => {
              sound.playSound('nav');
              setActiveTab('add');
              setAddErrorMsg(null);
              setAddSuccessMsg(null);
            }}
          >
            <Text style={styles.tabText}>+ Arkadaş Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'requests' && styles.tabPillActive,
            ]}
            onPress={() => {
              sound.playSound('nav');
              setActiveTab('requests');
            }}
          >
            <Text style={styles.tabText}>Düello Davetleri</Text>
          </TouchableOpacity>
        </View>
        {/* Tab 1: Friends List */}
        {activeTab === 'friends' && (
          loading ? (
            <ActivityIndicator color="#FFC43D" size="large" style={{ marginTop: 28 }} />
          ) : friendsList.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateTitle}>Henüz ekli arkadaşın yok</Text>
              <Text style={styles.emptyStateSub}>
                "Arkadaş Ekle" sekmesinden kodunu girerek arkadaşını ekle veya kodunu paylaş!
              </Text>
              <Button3D
                title="ARKADAŞ EKLE"
                variant="gold"
                onPress={() => setActiveTab('add')}
                style={{ marginTop: 14 }}
              />
            </View>
          ) : (
            friendsList.map((f) => {
              const playerName = f.displayName || f.username || f.name || 'Oyuncu';
              return (
                <TouchableOpacity
                  key={f.id}
                  style={styles.friendRow}
                  activeOpacity={0.82}
                  onPress={() => handleOpenProfile(f)}
                >
                  <View style={styles.avatarWrap}>
                    <CharacterAvatar seed={f.avatarUrl || playerName} size={46} />
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: f.online ? '#3FD08A' : '#6B6288' },
                      ]}
                    />
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {playerName}
                      </Text>
                      {f.isFriend && (
                        <View style={styles.friendBadge}>
                          <Text style={styles.friendBadgeText}>Arkadaş</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.friendStatus} numberOfLines={1}>
                      Seviye {f.level} · {f.rankTitle}
                    </Text>
                    <Text style={styles.friendSubStatus} numberOfLines={1}>
                      {f.status || (f.online ? 'Çevrimiçi' : 'Çevrimdışı')} · Profili Gör →
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {f.inRoom && f.currentRoomCode && (
                      <Button3D
                        title="KATIL"
                        variant="mint"
                        onPress={() => {
                          sound.playSound('tap');
                          if (onJoinFriendRoom) onJoinFriendRoom(f.currentRoomCode!);
                        }}
                        style={{ minHeight: 38, paddingHorizontal: 12 }}
                        textStyle={{ fontSize: 12 }}
                      />
                    )}
                    <Button3D
                      title={challengeLoadingId === f.id ? '...' : '1v1'}
                      variant="gold"
                      disabled={challengeLoadingId === f.id}
                      onPress={() => handleSendChallenge(f)}
                      style={{ minHeight: 38, paddingHorizontal: 14 }}
                      textStyle={{ fontSize: 13 }}
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}
        {/* Tab 2: Add Friend Form */}
        {activeTab === 'add' && (
          <View style={styles.addCard}>
            <Text style={styles.addCardTitle}>YENİ ARKADAŞ EKLE</Text>
            <Text style={styles.addCardSub}>
              Arkadaşının 7 haneli kodunu (Örn: TV-UB1AY94) veya kullanıcı adını girerek 1v1 düello maçlarına davet et.
            </Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: TV-UB1AY94 veya DenizPro"
                placeholderTextColor="rgba(217, 205, 245, 0.45)"
                value={addInput}
                onChangeText={(t) => {
                  setAddInput(t);
                  setAddErrorMsg(null);
                  setAddSuccessMsg(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            {addErrorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {addErrorMsg}</Text>
              </View>
            )}
            {addSuccessMsg && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{addSuccessMsg}</Text>
              </View>
            )}
            <Button3D
              title={addLoading ? 'EKLENİYOR...' : 'ARKADAŞI LİSTEYE EKLE'}
              variant="mint"
              disabled={addLoading}
              onPress={handleAddFriend}
              style={{ marginTop: 14 }}
            />
          </View>
        )}
        {/* Tab 3: Duel Invitations */}
        {activeTab === 'requests' && (
          <View style={styles.emptyStateBox}>
            <Text style={styles.emptyStateTitle}>Düello & Arkadaşlık Bildirimleri</Text>
            <Text style={styles.emptyStateSub}>
              Gelen tüm 1v1 düello meydan okumaları ve arkadaşlık talepleri Bildirimler sayfasında anlık olarak listelenir ve kabul/reddedilebilir.
            </Text>
            <Button3D
              title="BİLDİRİMLERİ AÇ"
              variant="mint"
              onPress={() => {
                sound.playSound('tap');
                if (onNotifications) onNotifications();
              }}
              style={{ marginTop: 14, minWidth: 200 }}
            />
          </View>
        )}
      </ScrollView>
      {!isGuest && (
        <TavrikoBottomNav
          activeTab="friends"
          onSelectTab={(tab) => {
            if (tab === 'play') onBack();
            else if (onNavigateTab) onNavigateTab(tab);
          }}
        />
      )}
      {/* Interactive Player Profile Modal */}
      <Modal
        visible={Boolean(inspectPlayer)}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectPlayer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalCard}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                sound.playSound('tap');
                setInspectPlayer(null);
              }}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>OYUNCU PROFİLİ</Text>
            {inspectPlayer && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ alignItems: 'center', paddingBottom: 10 }}
              >
                {/* Avatar & Online status */}
                <View style={styles.inspectAvatarWrap}>
                  <CharacterAvatar
                    seed={inspectDetails?.avatarUrl || inspectPlayer.avatarUrl || inspectPlayer.name}
                    size={76}
                  />
                  <View
                    style={[
                      styles.inspectStatusBadge,
                      { backgroundColor: inspectPlayer.online ? '#3FD08A' : '#736B92' },
                    ]}
                  >
                    <Text style={styles.inspectStatusText}>
                      {inspectPlayer.online ? 'ÇEVRİMİÇİ' : 'ÇEVRİMD IŞI'}
                    </Text>
                  </View>
                </View>
                {/* Player Names */}
                <Text style={styles.inspectDisplayName} numberOfLines={1}>
                  {inspectDetails?.displayName || inspectPlayer.displayName || inspectPlayer.name}
                </Text>
                <Text style={styles.inspectUsername}>
                  @{inspectDetails?.username || inspectPlayer.username || 'oyuncu'}
                  {inspectDetails?.countryName ? ` · 🇹🇷 ${inspectDetails.countryName}` : ' · 🇹🇷 Türkiye'}
                </Text>
                {/* Level & Rank Pill */}
                <View style={styles.inspectLevelPill}>
                  <Text style={styles.inspectLevelText}>
                    Seviye {inspectDetails?.level || inspectPlayer.level} · {inspectDetails?.rankTitle || inspectPlayer.rankTitle}
                  </Text>
                </View>
                {/* XP Progress */}
                {(() => {
                  const xp = inspectDetails?.xp ?? inspectPlayer.xp ?? 0;
                  const prog = calculateLevelFromXp(xp);
                  return (
                    <View style={styles.inspectXpBox}>
                      <View style={styles.inspectXpHeader}>
                        <Text style={styles.inspectXpLabel}>SEVİYE İLERLEMESİ</Text>
                        <Text style={styles.inspectXpValue}>
                          {prog.currentLevelXp} / {prog.nextLevelXpRequired} XP (%{prog.progressPct})
                        </Text>
                      </View>
                      <View style={styles.inspectXpTrack}>
                        <View style={[styles.inspectXpBar, { width: `${prog.progressPct}%` }]} />
                      </View>
                    </View>
                  );
                })()}
                {/* Stats Grid */}
                <View style={styles.inspectStatsGrid}>
                  <View style={styles.inspectStatCard}>
                    <Text style={styles.inspectStatVal}>
                      {inspectDetails?.stats?.totalMatches ?? inspectPlayer.totalMatches ?? 0}
                    </Text>
                    <Text style={styles.inspectStatLbl}>Toplam Maç</Text>
                  </View>
                  <View style={styles.inspectStatCard}>
                    <Text style={[styles.inspectStatVal, { color: '#3FD08A' }]}>
                      {inspectDetails?.stats?.wins ?? inspectPlayer.wins ?? 0}
                    </Text>
                    <Text style={styles.inspectStatLbl}>Galibiyet</Text>
                  </View>
                  <View style={styles.inspectStatCard}>
                    <Text style={[styles.inspectStatVal, { color: '#FFC43D' }]}>
                      {inspectDetails?.stats?.correctAnswers ?? inspectPlayer.correctAnswers ?? 0}
                    </Text>
                    <Text style={styles.inspectStatLbl}>Doğru Cevap</Text>
                  </View>
                  <View style={styles.inspectStatCard}>
                    <Text style={[styles.inspectStatVal, { color: '#FF7A00' }]}>
                      🔥 {inspectDetails?.stats?.bestStreak ?? inspectPlayer.bestStreak ?? 0}
                    </Text>
                    <Text style={styles.inspectStatLbl}>En İyi Seri</Text>
                  </View>
                </View>
                {/* Action buttons */}
                <View style={{ width: '100%', gap: 10, marginTop: 14 }}>
                  <Button3D
                    title="⚡ 1V1 DÜELLOYA DAVET ET"
                    variant="gold"
                    onPress={() => {
                      const pid = inspectPlayer.id;
                      setInspectPlayer(null);
                      onInviteToMatch(pid);
                    }}
                    style={{ width: '100%' }}
                  />
                  {!inspectPlayer.isFriend && (
                    <Button3D
                      title="+ ARKADAŞ OLARAK EKLE"
                      variant="mint"
                      onPress={() => {
                        setAddInput(inspectPlayer.username || inspectPlayer.id);
                        setActiveTab('add');
                        setInspectPlayer(null);
                      }}
                      style={{ width: '100%' }}
                    />
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  codeCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(28, 12, 62, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.45)',
    alignItems: 'center',
  },
  codeHeaderLabel: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  codePillBox: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(8, 3, 20, 0.72)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  codeValueText: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
    color: '#FFC43D',
    letterSpacing: 3,
    textAlign: 'center',
  },
  codeActionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  challengeNoticeCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    borderWidth: 1,
    borderColor: '#FFC43D',
    borderRadius: 14,
    marginBottom: 14,
  },
  challengeNoticeText: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    lineHeight: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabPillActive: {
    backgroundColor: '#6B3CFF',
  },
  tabText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  friendRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  avatarWrap: {
    position: 'relative',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#241050',
    position: 'absolute',
    right: -1,
    bottom: -1,
  },
  friendName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  friendStatus: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },
  emptyStateBox: {
    padding: 24,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    marginTop: 10,
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 6,
  },
  emptyStateSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    lineHeight: 18,
  },
  addCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(28, 12, 62, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(107, 60, 255, 0.55)',
  },
  addCardTitle: {
    color: '#FFC43D',
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    marginBottom: 4,
    textAlign: 'center',
  },
  addCardSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  inputWrap: {
    backgroundColor: 'rgba(8, 3, 20, 0.75)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 92, 119, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 119, 0.45)',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  errorText: {
    color: '#FF8598',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: 'rgba(90, 219, 181, 0.16)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  successText: {
    color: '#5ADBB5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  friendBadge: {
    backgroundColor: 'rgba(255, 196, 61, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.55)',
  },
  friendBadgeText: {
    color: '#FFC43D',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  friendSubStatus: {
    color: '#84D8FF',
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 3, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileModalCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#1E0E45',
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255, 196, 61, 0.55)',
    padding: 20,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.bold,
  },
  modalTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#FFC43D',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 1.5,
  },
  inspectAvatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  inspectStatusBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E0E45',
  },
  inspectStatusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  inspectDisplayName: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
  },
  inspectUsername: {
    fontSize: 12,
    color: '#D9CDF5',
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  inspectLevelPill: {
    backgroundColor: 'rgba(107, 60, 255, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.4)',
    marginBottom: 12,
  },
  inspectLevelText: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  inspectXpBox: {
    width: '100%',
    backgroundColor: 'rgba(8, 3, 20, 0.65)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 14,
  },
  inspectXpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inspectXpLabel: {
    color: '#A992E2',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.8,
  },
  inspectXpValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  inspectXpTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  inspectXpBar: {
    height: '100%',
    backgroundColor: '#FFC43D',
    borderRadius: 4,
  },
  inspectStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    marginBottom: 6,
  },
  inspectStatCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  inspectStatVal: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFFFFF',
  },
  inspectStatLbl: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
});