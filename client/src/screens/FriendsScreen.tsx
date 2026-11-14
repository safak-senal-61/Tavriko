import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  TextInput,
  Modal,
  Platform,
  Image,
} from 'react-native';
import Reanimated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { UserProfile, calculateLevelFromXp, extractProfileCosmetics } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { authHeaders } from '../utils/apiAuth';
import { DEFAULT_API_BASE } from '../config';
import { socketService } from '../services/socketService';
import { ReferralCards } from '../components/ReferralCards';
import { DISCOVERY_IMG } from '../components/DiscoveryArtwork';
import { GradientFill } from '../components/TavrikoGradient';
import { AnimatedFrame, AnimatedNameText, ANIMATED_FRAME_COLORS, ANIMATED_NAME_COLORS } from '../components/StoreKit';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  Button3D,
  CharacterAvatar,
} from '../components/TavrikoIcons';
interface FriendsScreenProps {
  token?: string | null;
  pendingReferral?: string | null;
  onClearReferral?: () => void;
  onReferralConnected?: () => void;
  user?: UserProfile;
  isGuest?: boolean;
  apiBaseUrl?: string;
  onBack: () => void;
  onInviteToMatch: (friendId: string, friendName?: string, roomCode?: string) => void;
  onJoinFriendRoom?: (roomCode: string) => void;
  onNavigateTab?: (tab: 'play' | 'explore' | 'leaders' | 'friends' | 'profile') => void;
  onNotifications?: () => void;
  /* KVKK: arkadaş profili, tam profil sayfası gibi görüntülenir;
     sağlananrsa profil modal yerine bu ekran açılır (salt okunur). */
  onOpenFullProfile?: (profile: UserProfile) => void;
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
  token,
  pendingReferral,
  onClearReferral,
  onReferralConnected,
  user,
  isGuest = false,
  apiBaseUrl,
  onBack,
  onInviteToMatch,
  onJoinFriendRoom,
  onNavigateTab,
  onNotifications,
  onOpenFullProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'add' | 'requests'>('friends');
  const [copied, setCopied] = useState(false);
  const [friendCode, setFriendCode] = useState(user?.friendCode || 'TV-10000');
  const [friendsList, setFriendsList] = useState<FriendRowItem[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [respondingReqId, setRespondingReqId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [challengeLoadingId, setChallengeLoadingId] = useState<string | null>(null);
  const [challengeNotice, setChallengeNotice] = useState<string | null>(null);
  // Profile Inspection Modal State
  const [inspectPlayer, setInspectPlayer] = useState<FriendRowItem | null>(null);
  const [inspectDetails, setInspectDetails] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  // Smooth tab transition animation
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;

  const switchTabSmooth = (nextTab: 'friends' | 'add' | 'requests') => {
    if (nextTab === activeTab) return;
    sound.playSound('nav');
    sound.triggerHaptic('light');
    setActiveTab(nextTab);
    tabFadeAnim.setValue(0.25);
    tabSlideAnim.setValue(10);
    Animated.parallel([
      Animated.timing(tabFadeAnim, {
        toValue: 1,
        duration: 210,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(tabSlideAnim, {
        toValue: 0,
        damping: 18,
        stiffness: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };
  // Add Friend state
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null);
  const [addErrorMsg, setAddErrorMsg] = useState<string | null>(null);
  const base = apiBaseUrl || DEFAULT_API_BASE;
  const fetchFriends = () => {
    const uid = user?.id || 'default';
    setLoading(true);
    socketService.requestPresenceSnapshot();
    fetch(`${base}/social/friends/${uid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.friendCode) setFriendCode(data.friendCode);
        if (Array.isArray(data.sentRequests)) setSentRequests(data.sentRequests);
        if (Array.isArray(data.incomingRequests)) setIncomingRequests(data.incomingRequests);
        if (Array.isArray(data.friends)) {
          // Strictly deduplicate users by ID, username, and normalized display name
          const seenIds = new Set<string>();
          const seenUsernames = new Set<string>();
          const seenNames = new Set<string>();

          // 1. Never show the current user in their own friends list
          if (user?.id) seenIds.add(user.id);
          if (uid && uid !== 'default') seenIds.add(uid);
          if (user?.username) seenUsernames.add(user.username.toLowerCase().trim());
          const myNormName = (user?.displayName || user?.fullName || user?.username || '')
            .toLowerCase()
            .replace(/[^a-z0-9ğüşıöç]/gi, '')
            .trim();
          if (myNormName) seenNames.add(myNormName);

          // 2. ONLY include accepted friends (f.isFriend === true) and merge Cloudflare WS presence
          const acceptedOnly = data.friends
            .filter((f: FriendRowItem) => f && f.isFriend !== false)
            .map((f: FriendRowItem) => {
              const wsPresence = socketService.getUserPresence(f.id);
              const isOnline = Boolean(f.online || wsPresence?.online);
              const inRoom = Boolean(f.inRoom || wsPresence?.inRoom);
              const currentRoomCode = f.currentRoomCode || wsPresence?.currentRoomCode;
              let status = isOnline ? 'Arkadaşın · Çevrimiçi' : 'Arkadaşın · Çevrimdışı';
              if (inRoom && currentRoomCode) {
                status = `Oda: #${currentRoomCode} · Lobide`;
              }
              return {
                ...f,
                isFriend: true,
                online: isOnline,
                inRoom,
                currentRoomCode,
                status,
              };
            });

          const sorted = [...acceptedOnly].sort((a, b) => {
            if (a.inRoom !== b.inRoom) return a.inRoom ? -1 : 1;
            if (a.online !== b.online) return a.online ? -1 : 1;
            return (b.xp || 0) - (a.xp || 0);
          });

          const cleanFriends = sorted.filter((f: FriendRowItem) => {
            if (!f || !f.id || seenIds.has(f.id)) return false;
            const uName = (f.username || '').toLowerCase().trim();
            const normName = (f.displayName || f.name || f.username || '')
              .toLowerCase()
              .replace(/[^a-z0-9ğüşıöç]/gi, '')
              .trim();
            // Display names are not unique. Two friends named Ahmet are two people.
            seenIds.add(f.id);
            if (uName) seenUsernames.add(uName);
            if (normName) seenNames.add(normName);
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

    const unsubPresenceSnapshot = socketService.on('presence:snapshot', (data: any) => {
      if (!data || !Array.isArray(data.presences)) return;
      const onlineMap = new Map<string, any>();
      for (const p of data.presences) {
        if (p && p.userId) onlineMap.set(p.userId, p);
      }
      setFriendsList((prev) =>
        prev.map((f) => {
          const p = onlineMap.get(f.id);
          const isOnline = p ? Boolean(p.online) : f.online;
          const inRoom = p ? Boolean(p.inRoom) : f.inRoom;
          const currentRoomCode = p?.currentRoomCode || f.currentRoomCode;
          let status = isOnline ? 'Arkadaşın · Çevrimiçi' : 'Arkadaşın · Çevrimdışı';
          if (inRoom && currentRoomCode) {
            status = `Oda: #${currentRoomCode} · Lobide`;
          }
          return { ...f, online: isOnline, inRoom, currentRoomCode, status };
        })
      );
    });

    // Listen to real-time presence events from WebSocket
    const unsubPresenceUpdate = socketService.on('presence:update', (data: any) => {
      if (!data || !data.userId) return;
      setFriendsList((prev) =>
        prev.map((f) => {
          if (f.id === data.userId) {
            const isOnline = data.online ?? f.online;
            const inRoom = data.inRoom ?? f.inRoom;
            const currentRoomCode = data.currentRoomCode ?? f.currentRoomCode;
            let status = isOnline ? 'Arkadaşın · Çevrimiçi' : 'Arkadaşın · Çevrimdışı';
            if (inRoom && currentRoomCode) {
              status = `Oda: #${currentRoomCode} · Lobide`;
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
              status: 'Arkadaşın · Çevrimiçi',
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
              status: 'Arkadaşın · Çevrimdışı',
            };
          }
          return f;
        })
      );
    });

    const unsubFriendsUpdate = socketService.on('friends:update', () => {
      fetchFriends();
    });

    const unsubNewNotif = socketService.on('notification:new', () => {
      fetchFriends();
    });

    return () => {
      unsubPresenceSnapshot();
      unsubPresenceUpdate();
      unsubUserOnline();
      unsubUserOffline();
      unsubFriendsUpdate();
      unsubNewNotif();
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
    setConfirmRemoveId(null);
    /* Tam profil sayfası kullanılıyorsa küçük modal hiç açılmaz:
       profil arkadan çekilip doğrudan tam ekran görüntülenir. */
    if (onOpenFullProfile) {
      setInspectLoading(true);
      try {
        const res = await fetch(`${base}/social/profile/${player.id}`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const fullProfile = await res.json();
          if (fullProfile?.id) {
            setInspectLoading(false);
            onOpenFullProfile(fullProfile);
            return;
          }
        }
      } catch {
        // offline: eski modal temel bilgilerle açılır
      }
      setInspectLoading(false);
    }
    setInspectPlayer(player);
    setInspectDetails(null);
    setInspectLoading(true);
    try {
      const res = await fetch(`${base}/social/profile/${player.id}`, {
        headers: authHeaders(),
      });
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

  const handleRemoveFriend = async (targetPlayer: FriendRowItem) => {
    if (!user || removingFriend) return;
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    setRemovingFriend(true);
    try {
      const res = await fetch(`${base}/social/friends/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          userId: user.id,
          friendId: targetPlayer.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Arkadaş çıkarılamadı.');
      }
      sound.playSound('reward');
      sound.triggerHaptic('success');
      socketService.notifyUserRealtime(targetPlayer.id, 'friends:update', {
        removedBy: user.id,
      });
      setFriendsList((prev) => prev.filter((item) => item.id !== targetPlayer.id));
      setConfirmRemoveId(null);
      setInspectPlayer(null);
      setChallengeNotice(
        `${targetPlayer.displayName || targetPlayer.name} arkadaş listenden çıkarıldı.`
      );
      setTimeout(() => setChallengeNotice(null), 3500);
    } catch (err: any) {
      sound.playSound('wrong');
      setChallengeNotice(`⚠️ ${err.message || 'Arkadaş çıkarılamadı.'}`);
    } finally {
      setRemovingFriend(false);
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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          userId: user.id,
          codeOrUsername: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Arkadaşlık isteği gönderilemedi.');
      }
      sound.playSound('reward');
      sound.triggerHaptic('success');
      if (data.friend?.id && data.notification) {
        socketService.notifyUserRealtime(data.friend.id, 'notification:new', data.notification);
      }
      setAddSuccessMsg(
        data.message ||
          `📨 ${data.friend?.displayName || clean} oyuncusuna arkadaşlık isteği gönderildi! Kabul ettiğinde Arkadaşlarım listende görünecek.`
      );
      setAddInput('');
      fetchFriends();
    } catch (err: any) {
      sound.playSound('wrong');
      setAddErrorMsg(err.message || 'Kullanıcı bulunamadı.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRespondIncomingRequest = async (req: any, action: 'accept' | 'decline') => {
    if (!user) return;
    sound.playSound(action === 'accept' ? 'reward' : 'tap');
    sound.triggerHaptic(action === 'accept' ? 'success' : 'light');
    setRespondingReqId(req.id);
    try {
      const res = await fetch(`${base}/social/notifications/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          userId: user.id,
          notificationId: req.id,
          action,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (action === 'accept') {
          if (req.type === 'match_invite' || req.type === 'duel') {
            const targetRoom = data.roomCode || req.roomCode || 'DUEL1';
            if (onJoinFriendRoom) onJoinFriendRoom(targetRoom);
            return;
          }
          if (req.senderId) {
            socketService.notifyUserRealtime(req.senderId, 'friends:update', { friendId: user.id });
            if (data.senderNotification) {
              socketService.notifyUserRealtime(req.senderId, 'notification:new', data.senderNotification);
            }
          }
        }
        fetchFriends();
      }
    } catch {} finally {
      setRespondingReqId(null);
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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
        if (data.notification) {
          socketService.notifyUserRealtime(friend.id, 'notification:new', data.notification);
        }
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
        {!isGuest && user && <ReferralCards key={user.id} base={base} token={token} userId={user.id}
          pendingToken={pendingReferral} onClear={() => onClearReferral?.()}
          onConnected={() => { fetchFriends(); onReferralConnected?.(); }} />}
        {/* Compact Friend Code Card */}
        <View style={styles.codeCard}>
          <View style={styles.codeTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeHeaderLabel}>ARKADAŞLIK KODUN</Text>
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
                style={{ minHeight: 38, paddingHorizontal: 14 }}
                textStyle={{ fontSize: 12 }}
              />
              <Button3D
                title="PAYLAŞ"
                variant="gold"
                onPress={handleShareCode}
                style={{ minHeight: 38, paddingHorizontal: 14 }}
                textStyle={{ fontSize: 12 }}
              />
            </View>
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
            onPress={() => switchTabSmooth('friends')}
          >
            <Text style={styles.tabText} numberOfLines={1}>
              Arkadaşlarım ({friendsList.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'add' && styles.tabPillActive,
            ]}
            onPress={() => {
              switchTabSmooth('add');
              setAddErrorMsg(null);
              setAddSuccessMsg(null);
            }}
          >
            <Text style={styles.tabText} numberOfLines={1}>+ Arkadaş Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'requests' && styles.tabPillActive,
            ]}
            onPress={() => switchTabSmooth('requests')}
          >
            <Text style={styles.tabText} numberOfLines={1}>
              İstekler {incomingRequests.length > 0 ? `(${incomingRequests.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
        <Animated.View
          style={{
            opacity: tabFadeAnim,
            transform: [{ translateY: tabSlideAnim }],
          }}
        >
        {/* Tab 1: Friends List (ONLY ACCEPTED FRIENDS) */}
        {activeTab === 'friends' && (
          loading ? (
            <ActivityIndicator color="#FFC43D" size="large" style={{ marginTop: 28 }} />
          ) : friendsList.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateTitle}>Henüz ekli arkadaşın yok</Text>
              <Text style={styles.emptyStateSub}>
                "+ Arkadaş Ekle" sekmesinden arkadaşlık isteği gönder! Karşı taraf Bildirimler veya İstekler kısmından kabul ettiğinde burada görünecek.
              </Text>
              <Button3D
                title="+ ARKADAŞLIK İSTEĞİ GÖNDER"
                variant="gold"
                onPress={() => switchTabSmooth('add')}
                style={{ marginTop: 14, width: '100%', maxWidth: 280 }}
                textStyle={{ fontSize: 13 }}
              />
            </View>
          ) : (
            friendsList.map((f, idx) => {
              const playerName = f.displayName || f.username || f.name || 'Oyuncu';
              return (
                <Reanimated.View
                  key={f.id}
                  entering={FadeInDown.delay(idx * 45).springify().damping(18)}
                >
                <TouchableOpacity
                  style={styles.friendRow}
                  activeOpacity={0.82}
                  onPress={() => handleOpenProfile(f)}
                >
                  <View style={styles.avatarWrap}>
                    <CharacterAvatar seed={f.avatarUrl || playerName} size={46} />
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: f.online ? '#3FD08A' : '#6B6288',
                          shadowColor: f.online ? '#3FD08A' : 'transparent',
                          shadowOpacity: f.online ? 0.9 : 0,
                          shadowRadius: f.online ? 6 : 0,
                        },
                      ]}
                    />
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {playerName}
                      </Text>
                      <View style={styles.friendBadge}>
                        <Text style={styles.friendBadgeText}>Arkadaş</Text>
                      </View>
                    </View>
                    <Text style={styles.friendStatus} numberOfLines={1}>
                      Seviye {f.level} · {f.rankTitle}
                    </Text>
                    <Text
                      style={[
                        styles.friendSubStatus,
                        f.online && { color: '#3FD08A', fontFamily: THEME.fonts.bold },
                      ]}
                      numberOfLines={1}
                    >
                      {f.online ? '● Çevrimiçi' : '○ Çevrimdışı'}
                      {f.inRoom && f.currentRoomCode ? ` · Oda #${f.currentRoomCode}` : ''} · Profili Gör →
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
                </Reanimated.View>
              );
            })
          )
        )}
        {/* Tab 2: Add Friend Form */}
        {activeTab === 'add' && (
          <View>
            <Reanimated.View entering={FadeInDown.springify().damping(18)} style={styles.addCard}>
              {/* Hero görsel */}
              <Image source={DISCOVERY_IMG.social} style={styles.addHeroImage} resizeMode="cover" />
              <GradientFill colors={['#1C0C3E00', '#1C0C3ECC', '#1C0C3E']} />
              <Reanimated.Text entering={ZoomIn.delay(80)} style={styles.addCardTitle}>ARKADAŞLIK İSTEĞİ GÖNDER</Reanimated.Text>
              <Text style={styles.addCardSub}>
                Arkadaşının 7 haneli kodunu (Örn: TV-UB1AY94) veya kullanıcı adını girerek arkadaşlık isteği gönder. Karşı taraf Bildirimler kısmından kabul ettiğinde arkadaş listene eklenir.
              </Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Örn: TV-UB1AY94 veya kullanıcı adı"
                  placeholderTextColor="rgba(217, 205, 245, 0.45)"
                  value={addInput}
                  onChangeText={(t) => {
                    setAddInput(t);
                    setAddErrorMsg(null);
                    setAddSuccessMsg(null);
                  }}
                  autoCapitalize="none"
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
                title={addLoading ? 'GÖNDERİLİYOR...' : 'ARKADAŞLIK İSTEĞİ GÖNDER'}
                variant="mint"
                disabled={addLoading}
                onPress={handleAddFriend}
                style={{ marginTop: 14 }}
                textStyle={{ fontSize: 13 }}
              />
            </Reanimated.View>

            {sentRequests.length > 0 && (
              <View style={{ marginTop: 18 }}>
                <Text
                  style={{
                    color: '#FFC43D',
                    fontFamily: THEME.fonts.extraBold,
                    fontSize: 13,
                    marginBottom: 10,
                    letterSpacing: 0.6,
                  }}
                >
                  ⏳ GÖNDERİLEN BEKLEYEN İSTEKLER ({sentRequests.length})
                </Text>
                {sentRequests.map((sr) => (
                  <View key={sr.id} style={styles.friendRow}>
                    <View style={styles.avatarWrap}>
                      <CharacterAvatar seed={sr.targetAvatar || sr.targetName} size={44} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.friendName}>{sr.targetName}</Text>
                      <Text style={[styles.friendSubStatus, { color: '#FFC43D' }]}>
                        Onay Bekliyor · Karşı taraf kabul ettiğinde eklenecek
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        {/* Tab 3: Incoming Friend Requests & Duel Invitations */}
        {activeTab === 'requests' && (
          <View>
            {incomingRequests.length > 0 ? (
              incomingRequests.map((req, rIdx) => (
                <Reanimated.View
                  key={req.id}
                  entering={FadeInDown.delay(rIdx * 55).springify().damping(18)}
                  style={[styles.friendRow, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <CharacterAvatar seed={req.senderAvatar || req.senderName || 'av2'} size={46} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.friendName}>{req.title}</Text>
                      <Text style={styles.friendStatus}>{req.sub}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Button3D
                      title={respondingReqId === req.id ? '...' : '✓ KABUL ET'}
                      variant="mint"
                      disabled={respondingReqId === req.id}
                      onPress={() => handleRespondIncomingRequest(req, 'accept')}
                      style={{ flex: 1, minHeight: 40 }}
                      textStyle={{ fontSize: 13 }}
                    />
                    <Button3D
                      title="✕ REDDET"
                      variant="purple"
                      disabled={respondingReqId === req.id}
                      onPress={() => handleRespondIncomingRequest(req, 'decline')}
                      style={{ flex: 1, minHeight: 40 }}
                      textStyle={{ fontSize: 13 }}
                    />
                  </View>
                </Reanimated.View>
              ))
            ) : (
              <View style={styles.emptyStateBox}>
                <Text style={styles.emptyStateTitle}>Bekleyen İstek veya Davet Yok</Text>
                <Text style={styles.emptyStateSub}>
                  Gelen arkadaşlık istekleri ve 1v1 düello meydan okumaları hem burada hem de Bildirimler sayfasında anlık olarak listelenir.
                </Text>
                <Button3D
                  title="TÜM BİLDİRİMLERİ AÇ"
                  variant="mint"
                  onPress={() => {
                    sound.playSound('tap');
                    if (onNotifications) onNotifications();
                  }}
                  style={{ marginTop: 14, minWidth: 200 }}
                />
              </View>
            )}
          </View>
        )}
        </Animated.View>
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
          <View
            style={[
              styles.profileModalCard,
              (() => {
                const bgCosmetic = extractProfileCosmetics(inspectDetails || {}).background;
                return bgCosmetic
                  ? {
                      backgroundColor: bgCosmetic.visual.bgColor,
                      borderColor: bgCosmetic.visual.bgColor2 || 'rgba(255, 196, 61, 0.55)',
                    }
                  : null;
              })(),
            ]}
          >
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
                {(() => {
                  const cosmetics = extractProfileCosmetics(inspectDetails || {});
                  const frameDef = cosmetics.frame;
                  const bgDef = cosmetics.background;
                  const nameDef = cosmetics.nameEffect;
                  const frameId = (inspectDetails as any)?.equippedFrame;
                  const nameEffectId = (inspectDetails as any)?.equippedNameEffect;
                  const animatedFrame = frameId ? ANIMATED_FRAME_COLORS[frameId] : null;
                  const animatedName = nameEffectId ? ANIMATED_NAME_COLORS[nameEffectId] : null;
                  return (
                    <>
                      <Reanimated.View entering={ZoomIn.springify().damping(16)} style={styles.inspectAvatarWrap}>
                        {animatedFrame ? (
                          <AnimatedFrame
                            frameId={frameId}
                            seed={inspectDetails?.avatarUrl || inspectPlayer.avatarUrl || inspectPlayer.name}
                            size={92}
                          />
                        ) : (
                        <View
                          style={[
                            styles.inspectAvatarRing,
                            frameDef
                              ? {
                                  borderColor: frameDef.visual.ringColor,
                                  borderWidth: 3,
                                  shadowColor: frameDef.visual.ringColor2,
                                  shadowOpacity: 0.7,
                                  shadowRadius: 10,
                                  elevation: 6,
                                }
                              : { borderWidth: 0 },
                          ]}
                        >
                          <CharacterAvatar
                            seed={inspectDetails?.avatarUrl || inspectPlayer.avatarUrl || inspectPlayer.name}
                            size={76}
                          />
                        </View>
                        )}
                        <View
                          style={[
                            styles.inspectStatusBadge,
                            { backgroundColor: inspectPlayer.online ? '#123927' : '#2C234B', borderColor: inspectPlayer.online ? '#3FD08A' : '#736B92' },
                          ]}
                        >
                          <Text style={[styles.inspectStatusText, { color: inspectPlayer.online ? '#3FD08A' : '#D9CDF5' }]}>
                            {inspectPlayer.online ? '● ÇEVRİMİÇİ' : '○ ÇEVRİMDIŞI'}
                          </Text>
                        </View>
                      </Reanimated.View>
                      {/* Player Names — name effect support */}
                      {animatedName ? (
                        <AnimatedNameText
                          effectId={nameEffectId}
                          style={[styles.inspectDisplayName]}
                          numberOfLines={1}
                        >
                          {inspectDetails?.displayName || inspectPlayer.displayName || inspectPlayer.name}
                        </AnimatedNameText>
                      ) : (
                      <Reanimated.Text
                        entering={FadeInDown.delay(60)}
                        style={[
                          styles.inspectDisplayName,
                          nameDef
                            ? {
                                color: nameDef.visual.nameColor,
                                textShadowColor: nameDef.visual.nameColor2 || nameDef.visual.nameColor,
                                textShadowRadius: 6,
                                textShadowOffset: { width: 0, height: 0 },
                              }
                            : null,
                        ]}
                        numberOfLines={1}
                      >
                        {inspectDetails?.displayName || inspectPlayer.displayName || inspectPlayer.name}
                      </Reanimated.Text>
                      )}
                <Reanimated.Text entering={FadeInDown.delay(90)} style={styles.inspectUsername}>
                  @{inspectDetails?.username || inspectPlayer.username || 'oyuncu'}
                  {inspectDetails?.countryName ? ` · ${inspectDetails.countryName}` : ' · Türkiye'}
                </Reanimated.Text>
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
                {/* Sanitized & Accurate Stats Grid */}
                {(() => {
                  const rawMatches = Math.max(
                    0,
                    Number(inspectDetails?.stats?.totalMatches ?? inspectPlayer.totalMatches ?? 0)
                  );
                  const rawWins = Math.max(
                    0,
                    Number(inspectDetails?.stats?.wins ?? inspectPlayer.wins ?? 0)
                  );
                  const safeWins = Math.min(rawMatches, rawWins);
                  const rawTotalAns = Math.max(
                    0,
                    Number(inspectDetails?.stats?.totalAnswers ?? rawMatches * 5)
                  );
                  const safeTotalAnswers =
                    rawMatches === 0
                      ? 0
                      : Math.min(Math.max(rawMatches * 5, rawTotalAns), rawMatches * 10);
                  const rawCorrect = Math.max(
                    0,
                    Number(inspectDetails?.stats?.correctAnswers ?? inspectPlayer.correctAnswers ?? 0)
                  );
                  const safeCorrect =
                    rawMatches === 0 ? 0 : Math.min(safeTotalAnswers, rawCorrect);
                  const accuracyPct =
                    safeTotalAnswers > 0
                      ? Math.min(100, Math.round((safeCorrect / safeTotalAnswers) * 100))
                      : 0;
                  const rawBestStreak = Math.max(
                    0,
                    Number(inspectDetails?.stats?.bestStreak ?? inspectPlayer.bestStreak ?? 0)
                  );
                  const safeStreak = Math.min(safeCorrect, rawBestStreak);

                  return (
                    <View style={styles.inspectStatsGrid}>
                      <View style={styles.inspectStatCard}>
                        <Text style={styles.inspectStatVal}>{rawMatches}</Text>
                        <Text style={styles.inspectStatLbl}>Toplam Maç</Text>
                      </View>
                      <View style={styles.inspectStatCard}>
                        <Text style={[styles.inspectStatVal, { color: '#3FD08A' }]}>{safeWins}</Text>
                        <Text style={styles.inspectStatLbl}>Galibiyet</Text>
                      </View>
                      <View style={styles.inspectStatCard}>
                        <Text style={[styles.inspectStatVal, { color: '#FFC43D' }]}>
                          {safeCorrect}/{safeTotalAnswers}
                        </Text>
                        <Text style={styles.inspectStatLbl}>Doğru (%{accuracyPct})</Text>
                      </View>
                      <View style={styles.inspectStatCard}>
                        <Text style={[styles.inspectStatVal, { color: '#38BDF8' }]}>
                          {safeStreak}x
                        </Text>
                        <Text style={styles.inspectStatLbl}>En İyi Seri</Text>
                      </View>
                    </View>
                  );
                })()}
                {/* Action buttons */}
                <View style={{ width: '100%', gap: 10, marginTop: 14 }}>
                  <Button3D
                    title="1V1 DÜELLOYA DAVET ET"
                    variant="gold"
                    onPress={() => {
                      const target = inspectPlayer;
                      setInspectPlayer(null);
                      handleSendChallenge(target);
                    }}
                    style={{ width: '100%' }}
                    textStyle={{ fontSize: 13 }}
                  />
                  {!inspectPlayer.isFriend ? (
                    <Button3D
                      title="+ ARKADAŞ OLARAK EKLE"
                      variant="mint"
                      onPress={() => {
                        setAddInput(inspectPlayer.username || inspectPlayer.id);
                        switchTabSmooth('add');
                        setInspectPlayer(null);
                      }}
                      style={{ width: '100%' }}
                      textStyle={{ fontSize: 13 }}
                    />
                  ) : confirmRemoveId === inspectPlayer.id ? (
                    <View style={styles.removeConfirmBox}>
                      <Text style={styles.removeConfirmText}>
                        {inspectPlayer.displayName || inspectPlayer.name} arkadaş listenden çıkarılsın mı?
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <Button3D
                          title={removingFriend ? 'ÇIKARILIYOR...' : 'EVET, ÇIKAR'}
                          variant="red"
                          disabled={removingFriend}
                          onPress={() => handleRemoveFriend(inspectPlayer)}
                          style={{ flex: 1, minHeight: 38 }}
                          textStyle={{ fontSize: 12 }}
                        />
                        <Button3D
                          title="VAZGEÇ"
                          variant="purple"
                          disabled={removingFriend}
                          onPress={() => setConfirmRemoveId(null)}
                          style={{ flex: 1, minHeight: 38 }}
                          textStyle={{ fontSize: 12 }}
                        />
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.removeFriendOutlineBtn}
                      activeOpacity={0.82}
                      onPress={() => {
                        sound.playSound('tap');
                        setConfirmRemoveId(inspectPlayer.id);
                      }}
                    >
                      <Text style={styles.removeFriendOutlineText}>Arkadaşlıktan Çıkar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                    </>
                  );
                })()}
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
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  codeCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(28, 12, 62, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.4)',
  },
  codeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  codeHeaderLabel: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.8,
  },
  codeValueText: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#FFC43D',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  codeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeFriendOutlineBtn: {
    width: '100%',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 92, 119, 0.5)',
    backgroundColor: 'rgba(255, 92, 119, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeFriendOutlineText: {
    color: '#FF8598',
    fontSize: 12.5,
    fontFamily: THEME.fonts.extraBold,
  },
  removeConfirmBox: {
    width: '100%',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 92, 119, 0.12)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 92, 119, 0.55)',
  },
  removeConfirmText: {
    color: '#FFD1DA',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
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
    position: 'relative',
    overflow: 'hidden',
  },
  addHeroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 110,
    opacity: 0.4,
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
    padding: 12,
  },
  profileModalCard: {
    // Masaüstünde telefon çerçevesiyle (480px) aynı genişlikte kalır — taşmaz
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    maxHeight: '90%',
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
  inspectAvatarRing: {
    borderRadius: 40,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
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
