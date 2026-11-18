import { cdnImage } from '../utils/cdn';
import { GradientFill } from '../components/TavrikoGradient';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Share,
  Animated,
  Platform,
  Image,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { DEFAULT_API_BASE } from '../config';
import { authHeaders } from '../utils/apiAuth';
import Reanimated, {
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { GameRoom, UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { socketService } from '../services/socketService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CharacterAvatar,
  CoinIcon,
  GemIcon,
} from '../components/TavrikoIcons';

/** Arkadaş davet modalındaki satır (FriendsScreen tipinin sade hali). */
interface LobbyFriendItem {
  id: string;
  name: string;
  displayName?: string;
  avatarUrl?: string;
  level?: number;
  online: boolean;
  isFriend?: boolean;
}

interface LobbyScreenProps {
  room: GameRoom;
  currentUserId: string;
  user?: UserProfile | null;
  onBack: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onKickPlayer?: (targetPlayerId: string) => void;
}

const CopySvgIcon = ({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="9"
      y="9"
      width="13"
      height="13"
      rx="2.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M5 15H4C2.9 15 2 14.1 2 13V4C2 2.9 2.9 2 4 2H13C14.1 2 15 2.9 15 4V5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ShareSvgIcon = ({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth="2" />
    <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth="2" />
    <Circle cx="18" cy="19" r="3" stroke={color} strokeWidth="2" />
    <Path
      d="M8.6 13.5L15.4 17.5M15.4 6.5L8.6 10.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

const CheckSvgIcon = ({ size = 18, color = '#5ADBB5' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 6L9 17L4 12"
      stroke={color}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Tavriko UI Kit 8 Lobi Reaksiyonu
const LOBBY_REACTION_EMOJIS = ['🔥', '👏', '😂', '❤️', '⚡', '🎯', '🚀'];

/* Üretilmiş lobi görselleri: sahne banner'ı ve şeffaf arka plansız soru işareti */
const LOBBY_IMG = {
  hero: cdnImage('images/lobby/lobby_hero.png'),
  questionMark: cdnImage('images/lobby/question_mark.png'),
};

/** Özel oda katılım bağlantısı: ?oda=KOD ile tıklayan doğrudan odaya katılır */
const ROOM_LINK_BASE = 'https://tavriko-app.vercel.app';
const buildRoomLink = (code: string) => `${ROOM_LINK_BASE}/?oda=${code}`;

/** Nefes alan altın parıltılı KART KENDİSİ (üst üste katman yok, tek kart) */
const CodeCardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const cardStyle = useAnimatedStyle(() => {
    const t = 0.5 + 0.5 * Math.sin(p.value * Math.PI); // 0..1 nefes
    return {
      width: '100%',
      backgroundColor: '#1E0E3D',
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: `rgba(255, 206, 80, ${0.55 + 0.45 * t})`,
      shadowColor: '#FFC837',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14 + 0.18 * t,
      shadowRadius: 10,
      elevation: 6,
    };
  });
  return <Reanimated.View style={cardStyle}>{children}</Reanimated.View>;
};

/** Basınca zıplayan emoji butonu */
const BouncyReaction: React.FC<{ emoji: string; onPress: () => void }> = ({ emoji, onPress }) => {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <TouchableOpacity
      style={styles.reactionTouch}
      activeOpacity={0.65}
      onPress={() => {
        s.value = withSequence(withTiming(1.45, { duration: 120 }), withTiming(1, { duration: 220 }));
        onPress();
      }}
    >
      <Reanimated.View style={style}>
        <Text style={styles.reactionEmojiText}>{emoji}</Text>
      </Reanimated.View>
    </TouchableOpacity>
  );
};

/** Arkadaş davet kartının nebula arka planı ve ortak davet ikonu. */
const INVITE_BG = cdnImage('images/lobby/invite_bg.png');
const INVITE_ICON = cdnImage('images/lobby/invite_icon.png');
const INVITE_FALLBACK = cdnImage('images/custom_room_3d.jpg');

const InviteArtwork: React.FC<{ variant: 'card' | 'icon'; style: React.ComponentProps<typeof Image>['style'] }> = ({
  variant, style,
}) => {
  const [failed, setFailed] = useState(false);
  const source = variant === 'card' ? INVITE_BG : INVITE_ICON;
  if (failed && variant === 'icon') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx={9} cy={7} r={3} stroke="#E6DFFF" strokeWidth={2} />
        <Path d="M3 19v-2a4 4 0 0 1 4-4h4m7-2v8m-4-4h8" stroke="#E6DFFF" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }
  return <Image source={failed ? INVITE_FALLBACK : source} style={style} resizeMode={variant === 'icon' ? 'contain' : 'cover'} accessible={false} onError={() => setFailed(true)} />;
};

/**
 * OYUN İÇİ ARKADAŞ DAVETİ — şık, animasyonlu kart:
 *  - Kart oranına göre üretilmiş nebula arka plan görseli (CDN)
 *  - Nefes alan mor parıltılı kenarlık
 *  - Nabız atan rozet + basınca hafif çökme
 */
const FriendInviteCard: React.FC<{ onPress: () => void; subtitle: string; disabled: boolean }> = ({
  onPress, subtitle, disabled,
}) => {
  const p = useSharedValue(0);
  const press = useSharedValue(1);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const borderStyle = useAnimatedStyle(() => {
    const t = 0.5 + 0.5 * Math.sin(p.value * Math.PI);
    return {
      borderColor: `rgba(155, 140, 255, ${0.45 + 0.45 * t})`,
      shadowOpacity: 0.22 + 0.26 * t,
    };
  });
  const badgeStyle = useAnimatedStyle(() => {
    const t = 0.5 + 0.5 * Math.sin(p.value * Math.PI);
    return { transform: [{ scale: 0.93 + 0.09 * t }] };
  });
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPressIn={() => {
        press.value = withTiming(0.97, { duration: 120 });
      }}
      onPressOut={() => {
        press.value = withTiming(1, { duration: 200 });
      }}
    >
      <Reanimated.View style={[styles.friendInviteCard, borderStyle, pressStyle]}>
        <InviteArtwork variant="card" style={styles.friendInviteBg} />
        {/* Yazı okunurluğu için yumuşak karartma — tam genişlik, kırpma yok */}
        <GradientFill
          colors={['rgba(14,6,32,0.18)', 'rgba(14,6,32,0.72)']}
          stops={[0, 1]}
        />
        <View style={styles.friendInviteRow}>
          <Reanimated.View style={[styles.friendInviteBadge, badgeStyle]}>
            <InviteArtwork variant="icon" style={styles.friendInviteBadgeIcon} />
          </Reanimated.View>
          <View style={styles.friendInviteInfo}>
            <Text style={styles.friendInviteTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              ARKADAŞ DAVET ET
            </Text>
            <Text style={styles.friendInviteSub} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          <Text style={styles.friendInviteChevron}>›</Text>
        </View>
      </Reanimated.View>
    </TouchableOpacity>
  );
};

/** Boş slot: sadece şeffaf (arka plansız) soru işareti + bekleniyor yazısı */
const EmptySlotCard: React.FC = () => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const glow = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.4 * Math.sin(p.value * Math.PI),
    transform: [{ scale: 0.97 + 0.04 * Math.sin(p.value * Math.PI) }],
  }));
  return (
    <Reanimated.View
      entering={FadeInDown.delay(140).duration(400)}
      style={styles.emptySlotRow}
    >
      <Reanimated.Image
        source={LOBBY_IMG.questionMark}
        style={[styles.emptySlotArt, glow]}
        resizeMode="contain"
      />
      <Text style={styles.emptySlotTextMinimal}>Oyuncu bekleniyor...</Text>
    </Reanimated.View>
  );
};

// Hızlı Mesaj Çipleri
const QUICK_CHAT_CHIPS = [
  'Selam 👋',
  'Hazırım! ⚡',
  'Hadi başla! 🚀',
  'Bol şans! 🎯',
  'Buradayım 🔥',
];

interface FloatingItemData {
  id: string;
  type: 'emoji' | 'message';
  content: string;
  senderName?: string;
  avatarSeed?: string;
  xOffset: number;
}

const FloatingLobbyItem: React.FC<{
  item: FloatingItemData;
  onComplete: () => void;
}> = ({ item, onComplete }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: item.type === 'message' ? 3600 : 1500,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => onComplete());
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 0.15, 0.75, 1],
    outputRange: [0, -50, -220, -390],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.8, 1],
    outputRange: [0, 1, 0.95, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0.7, 1.15, 1, 0.85],
  });

  if (item.type === 'emoji') {
    return (
      <Animated.View
        style={[
          styles.floatingEmojiWrap,
          {
            transform: [
              { translateX: item.xOffset },
              { translateY },
              { scale },
            ],
            opacity,
          },
        ]}
      >
        <Text style={styles.floatingEmojiText}>{item.content}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.floatingChatBubble,
        {
          transform: [
            { translateX: item.xOffset },
            { translateY },
            { scale },
          ],
          opacity,
        },
      ]}
    >
      <View style={styles.floatingChatAvatarWrap}>
        <CharacterAvatar seed={item.avatarSeed || item.senderName} size={24} />
      </View>
      <View style={styles.floatingChatTextCol}>
        <Text style={styles.floatingChatSender} numberOfLines={1}>
          {item.senderName}
        </Text>
        <Text style={styles.floatingChatBody}>{item.content}</Text>
      </View>
    </Animated.View>
  );
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  currentUserId,
  user,
  onBack,
  onToggleReady,
  onStartGame,
  onKickPlayer,
}) => {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [chatText, setChatText] = useState('');
  const [floatingItems, setFloatingItems] = useState<FloatingItemData[]>([]);

  // --- Oyun içi arkadaş daveti ---
  const [friendInviteVisible, setFriendInviteVisible] = useState(false);
  const [friendsList, setFriendsList] = useState<LobbyFriendItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState(false);
  const [friendsReload, setFriendsReload] = useState(0);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitedFriendIds, setInvitedFriendIds] = useState<Set<string>>(new Set());
  const pendingInvites = useRef(new Set<string>());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [, refreshPresence] = useState(0);

  useEffect(() => {
    if (!currentUserId || !user || user.isGuest) return;
    const controller = new AbortController();
    setFriendsLoading(true);
    setFriendsError(false);
    fetch(`${DEFAULT_API_BASE}/social/friends/${encodeURIComponent(currentUserId)}`, {
      headers: authHeaders(),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!Array.isArray(data.friends)) throw new Error();
        if (!controller.signal.aborted) {
          setFriendsList((data.friends as LobbyFriendItem[]).filter(f => f?.isFriend === true));
        }
      })
      .catch(() => { if (!controller.signal.aborted) setFriendsError(true); })
      .finally(() => { if (!controller.signal.aborted) setFriendsLoading(false); });
    return () => controller.abort();
  }, [currentUserId, user?.id, user?.isGuest, friendsReload]);

  useEffect(() => {
    const onPresence = () => refreshPresence(n => n + 1);
    const bumpFriends = () => setFriendsReload(n => n + 1);
    const unsub = [
      socketService.on('presence:snapshot', onPresence),
      socketService.on('presence:update', (presence: { userId?: string }) => {
        if (friendsList.some(friend => friend.id === presence?.userId)) onPresence();
      }),
      socketService.on('friends:update', bumpFriends),
    ];
    return () => unsub.forEach(remove => remove());
  }, [friendsList]);

  const inviteFriend = async (friendId: string) => {
    if (roomFull || room.players[friendId] || invitedFriendIds.has(friendId) || pendingInvites.current.has(friendId)) return;
    pendingInvites.current.add(friendId);
    setSendingIds(new Set(pendingInvites.current));
    setInviteError(null);
    sound.playSound('tap');
    try {
      const res = await fetch(`${DEFAULT_API_BASE}/social/rooms/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ targetUserId: friendId, roomCode: room.code }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) throw new Error(result?.error || 'Davet gönderilemedi. Tekrar deneyebilirsin.');
      setInvitedFriendIds(prev => new Set(prev).add(friendId));
    } catch (error) {
      setInviteError(error instanceof TypeError
        ? 'Bağlantı kurulamadı. İnterneti kontrol edip tekrar dene.'
        : error instanceof Error ? error.message : 'Davet gönderilemedi.');
    } finally {
      pendingInvites.current.delete(friendId);
      setSendingIds(new Set(pendingInvites.current));
    }
  };

  // İki katmanlı tekillik (deduplication) önbelleği: Ali'de ve tüm oyuncularda çift mesaj/reaksiyonu %100 engeller!
  const processedKeysRef = useRef<Set<string>>(new Set());

  const players = Object.values(room.players);
  const maxPlayers = room.maxPlayers || 4;
  const emptySlotCount = Math.max(0, maxPlayers - players.length);
  const roomFull = emptySlotCount === 0;
  const availableFriends = friendsList
    .filter(f => !room.players[f.id])
    .map(f => ({ ...f, online: socketService.getUserPresence(f.id)?.online ?? f.online }))
    .sort((a, b) => Number(b.online) - Number(a.online));
  const onlineFriendCount = availableFriends.filter(f => f.online).length;
  const isHost = currentUserId === room.hostId;
  const myPlayer = room.players[currentUserId];
  const isReady = myPlayer?.isReady ?? false;
  const canStart = players.length >= 2;

  // Real-time WebSocket Reaksiyonları ve Canlı Süzülen Mesajlar (Veritabanına kaydedilmez)
  useEffect(() => {
    const unsubEmote = socketService.onEmoteReceived((data) => {
      if (data.roomCode === room.code && data.playerId !== currentUserId) {
        // Çift render ve soket yankısını hem ID hem içerik+zaman bazlı engelle
        const idKey = data.id;
        const contentKey = `emote_${data.playerId}_${data.emote}_${Math.floor(Date.now() / 2000)}`;
        if ((idKey && processedKeysRef.current.has(idKey)) || processedKeysRef.current.has(contentKey)) {
          return;
        }
        if (idKey) processedKeysRef.current.add(idKey);
        processedKeysRef.current.add(contentKey);
        setTimeout(() => {
          if (idKey) processedKeysRef.current.delete(idKey);
          processedKeysRef.current.delete(contentKey);
        }, 4000);

        sound.playSound('tap');
        const id = idKey || `emote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const xOffset = (Math.random() - 0.5) * 160;
        setFloatingItems((prev) => [
          ...prev.slice(-12),
          { id, type: 'emoji', content: data.emote, xOffset },
        ]);
      }
    });

    const unsubChat = socketService.onLobbyMessage((data) => {
      if (data.roomCode === room.code && data.playerId !== currentUserId) {
        // Çift sohbet mesajını hem ID hem içerik+zaman bazlı engelle
        const idKey = data.id;
        const contentKey = `chat_${data.playerId}_${data.text}_${Math.floor(Date.now() / 2500)}`;
        if ((idKey && processedKeysRef.current.has(idKey)) || processedKeysRef.current.has(contentKey)) {
          return;
        }
        if (idKey) processedKeysRef.current.add(idKey);
        processedKeysRef.current.add(contentKey);
        setTimeout(() => {
          if (idKey) processedKeysRef.current.delete(idKey);
          processedKeysRef.current.delete(contentKey);
        }, 4000);

        sound.playSound('tap');
        sound.triggerHaptic('medium');
        const id = idKey || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const xOffset = (Math.random() - 0.5) * 80;
        setFloatingItems((prev) => [
          ...prev.slice(-12),
          {
            id,
            type: 'message',
            content: data.text,
            senderName: data.displayName,
            avatarSeed: data.avatarUrl || data.displayName,
            xOffset,
          },
        ]);
      }
    });

    return () => {
      unsubEmote();
      unsubChat();
    };
  }, [room.code, currentUserId]);

  const removeFloatingItem = (id: string) => {
    setFloatingItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSendReaction = (emoji: string) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');

    // Optimistik anlık render: Kullanıcı dokunduğu an ekranda süzülür!
    const emoteId = `emote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const xOffset = (Math.random() - 0.5) * 160;

    // Kendi gönderdiğimizi önbelleğe alıp soketten geri gelirse çift gösterimi engelle
    processedKeysRef.current.add(emoteId);
    setTimeout(() => processedKeysRef.current.delete(emoteId), 4000);

    setFloatingItems((prev) => [
      ...prev.slice(-12),
      { id: emoteId, type: 'emoji', content: emoji, xOffset },
    ]);

    // WebSocket ile odadaki diğer tüm oyunculara yayınla
    socketService.sendEmote(room.code, currentUserId, emoji, emoteId);
  };

  const handleSendChat = (presetText?: string) => {
    const textToSend = (presetText || chatText).trim();
    if (!textToSend) return;
    sound.playSound('tap');
    sound.triggerHaptic('medium');

    // Optimistik anlık render: Gönderen kişinin ekranında anında süzülür!
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const xOffset = (Math.random() - 0.5) * 80;

    // Kendi gönderdiğimizi önbelleğe alıp soket yankısında çiftleşmeyi önle
    processedKeysRef.current.add(chatId);
    setTimeout(() => processedKeysRef.current.delete(chatId), 4000);

    setFloatingItems((prev) => [
      ...prev.slice(-12),
      {
        id: chatId,
        type: 'message',
        content: textToSend,
        senderName: myPlayer?.displayName || 'Sen',
        avatarSeed: myPlayer?.avatarUrl || myPlayer?.displayName,
        xOffset,
      },
    ]);

    // WebSocket ile odadaki diğer oyunculara yayınla (veritabanına kaydedilmez!)
    socketService.sendLobbyChat(
      room.code,
      currentUserId,
      myPlayer?.displayName || 'Oyuncu',
      textToSend,
      myPlayer?.avatarUrl || myPlayer?.displayName,
      chatId
    );

    if (!presetText) setChatText('');
  };

  // Nefes alma (pulsing) animasyonu
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, []);

  const handleCopyCode = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    await Clipboard.setStringAsync(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roomLink = buildRoomLink(room.code);

  const handleCopyLink = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    await Clipboard.setStringAsync(roomLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareCode = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    try {
      await Share.share({
        message:
          `🎮 Tavriko bilgi yarışmasında özel odama katıl!\n\n` +
          `🔗 Oda Bağlantısı: ${roomLink}\n` +
          `📝 Oda Kodu: ${room.code}\n\n` +
          `📋 Oda Detayları:\n` +
          `• 🔒 ${room.privacy === 'public' ? 'Herkese Açık' : 'Özel Oda'}\n` +
          `• 📝 ${room.totalRounds || 7} Soru\n` +
          `• ⏱️ Soru Başına ${room.questionTimeSec || 20} Saniye\n` +
          `• ${room.penaltyForWrong ? '⚠️ Yanlışta -50 Puan Cezası' : '🛡️ Cezasız Mod'}\n\n` +
          `Bağlantıya dokunarak ya da Özel Oda ekranından kodu girerek hemen katılabilirsin!`,
      });
    } catch {}
  };

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user?.coins}
        gems={user?.gems}
        avatarSeed={user?.avatarUrl || user?.displayName}
      />

      {/* Süzülen Anlık Reaksiyonlar ve Uçuşan Mesajlar (Veritabanına kaydedilmez, sadece WebSocket) */}
      <View style={styles.floatingLayer} pointerEvents="none">
        {floatingItems.map((item) => (
          <FloatingLobbyItem
            key={item.id}
            item={item}
            onComplete={() => removeFloatingItem(item.id)}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern, Şık Animasyonlu Lobi Sahnesi (Üretilmiş görsel + başlık) */}
        <Reanimated.View
          entering={ZoomIn.duration(420)}
          style={styles.heroBanner}
        >
          <Image
            source={LOBBY_IMG.hero}
            style={styles.heroImg}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroEyebrow}>CANLI ARKADAŞ LOBİSİ</Text>
            <Text style={styles.title}>ÖZEL LOBİ</Text>
            <View style={styles.heroPillRow}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>🔒 {room.privacy === 'public' ? 'Herkese Açık' : 'Özel Oda'}</Text>
              </View>
            </View>
          </View>
        </Reanimated.View>

        {/* 1. ODA KODU KARTI (Nefes alan altın parıltılı, tek kart) */}
        <Reanimated.View entering={FadeInDown.delay(90).duration(400)} style={styles.codeCardWrap}>
          <CodeCardShell>
          <TouchableOpacity
            style={styles.codeCardInner}
            onPress={handleCopyCode}
            activeOpacity={0.85}
          >
            <View style={styles.codeInfoLeft}>
              <Text style={styles.codeLabel}>ODA KODU</Text>
              <Text style={styles.codeValueText}>{room.code.split('').join(' ')}</Text>
              <Text style={styles.codeCardSub}>{copied ? '✓ Kopyalandı!' : 'Dokun kopyala'}</Text>
            </View>

            <View style={styles.codeActionsRow}>
              {/* Kopyala Butonu */}
              <View
                style={[styles.codeIconBtn, copied && styles.codeIconBtnActive]}
              >
                {copied ? (
                  <CheckSvgIcon size={18} color="#5ADBB5" />
                ) : (
                  <CopySvgIcon size={18} color="#FFFFFF" />
                )}
              </View>

              {/* Paylaş Butonu */}
              <TouchableOpacity
                style={styles.codeIconBtn}
                onPress={handleShareCode}
                activeOpacity={0.8}
              >
                <ShareSvgIcon size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          </CodeCardShell>
        </Reanimated.View>

        {/* 1.5. DAVET BAĞLANTISI (Linke dokunan doğrudan odaya katılır) */}
        <Reanimated.View entering={FadeInDown.delay(120).duration(400)} style={styles.inviteLinkWrap}>
          <TouchableOpacity
            style={styles.inviteLinkCard}
            onPress={handleCopyLink}
            activeOpacity={0.8}
          >
            <View style={styles.inviteLinkInfo}>
              <Text style={styles.inviteLinkLabel}>DAVET BAĞLANTISI</Text>
              <Text style={styles.inviteLinkText} numberOfLines={1} ellipsizeMode="middle">
                {roomLink}
              </Text>
              <Text style={styles.inviteLinkSub}>
                {linkCopied ? '✓ Bağlantı kopyalandı!' : 'Linke dokunan arkadaşın doğrudan odaya katılır'}
              </Text>
            </View>
            <View style={[styles.codeIconBtn, linkCopied && styles.codeIconBtnActive]}>
              {linkCopied ? (
                <CheckSvgIcon size={18} color="#5ADBB5" />
              ) : (
                <CopySvgIcon size={18} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
        </Reanimated.View>

        {/* 1.6. OYUN İÇİ ARKADAŞ DAVETİ (bildirimle odaya çağırır) */}
        <Reanimated.View entering={FadeInDown.delay(140).duration(400)} style={styles.inviteLinkWrap}>
          <FriendInviteCard
            disabled={roomFull || !user || !!user.isGuest}
            subtitle={roomFull ? 'Oda dolu'
              : !user || user.isGuest ? 'Davet etmek için giriş yap'
              : friendsLoading && friendsList.length === 0 ? 'Arkadaşlar yükleniyor…'
              : friendsError ? 'Arkadaş listesini yeniden yükle'
              : availableFriends.length ? `${availableFriends.length} arkadaş · ${onlineFriendCount} çevrimiçi`
              : 'Davet edilebilecek arkadaş yok'}
            onPress={() => {
              sound.playSound('tap');
              setInviteError(null);
              setFriendsReload(n => n + 1);
              setFriendInviteVisible(true);
            }}
          />
        </Reanimated.View>

        {/* 2. ODA PARAMETRELERİ (Kademeli girişli çipler) */}
        <View style={styles.chipsRow}>
          <Reanimated.View entering={FadeInDown.delay(140).duration(380)} style={styles.specChip}>
            <Text style={styles.specChipText}>📝 {room.totalRounds || 7} Soru</Text>
          </Reanimated.View>
          <Reanimated.View entering={FadeInDown.delay(190).duration(380)} style={styles.specChip}>
            <Text style={styles.specChipText}>⏱️ {room.questionTimeSec || 20}sn</Text>
          </Reanimated.View>
          <Reanimated.View entering={FadeInDown.delay(240).duration(380)} style={styles.specChip}>
            <Text style={styles.specChipText}>
              {room.penaltyForWrong ? '⚠️ -50p Ceza' : '🛡️ Cezasız'}
            </Text>
          </Reanimated.View>
        </View>

        {/* 3. OYUNCU LİSTESİ */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.playersCountText}>
            Oyuncular ({players.length}/{maxPlayers})
          </Text>
          <Text style={styles.roomStatusTag}>
            {canStart ? '🟢 Başlamaya Hazır' : '🟡 Katılımcı Bekleniyor'}
          </Text>
        </View>

        <View style={styles.playersList}>
          {players.map((p, index) => {
            const playerIsHost = p.id === room.hostId;
            const isMe = p.id === currentUserId;

            return (
              <Reanimated.View
                key={p.id}
                entering={FadeInDown.delay(index * 80).duration(380)}
                style={[styles.playerRow, isMe && styles.playerRowMe]}
              >
                <View style={styles.playerAvatarWrap}>
                  {/* index prop'u verilirse seed çözümü atlanıp liste sırası
                      avatarı ezeliyordu; seçilen avatar her oyuncuda görünsün
                      diye index kaldırıldı (seed artık tek belirleyici). */}
                  <CharacterAvatar seed={p.avatarUrl || p.displayName} size={42} />
                  {playerIsHost && (
                    <View style={styles.hostCrown}>
                      <Text style={styles.hostCrownText}>👑</Text>
                    </View>
                  )}
                </View>

                <View style={styles.playerInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {p.displayName} {isMe ? '(Sen)' : ''}
                    </Text>
                  </View>
                  <Text style={styles.playerRoleText}>
                    {playerIsHost ? 'Oda Kurucusu' : 'Yarışmacı'}
                  </Text>
                </View>

                {/* Hazır Durumu Rozeti */}
                <View
                  style={[
                    styles.statusChip,
                    p.isReady ? styles.statusReady : styles.statusWaiting,
                  ]}
                >
                  <Text style={[styles.statusChipText, p.isReady && styles.statusChipTextReady]}>
                    {p.isReady ? '✓ HAZIR' : '⏳ BEKLİYOR'}
                  </Text>
                </View>

                {/* Kurucu Kick Butonu */}
                {isHost && !playerIsHost && onKickPlayer && (
                  <TouchableOpacity
                    style={styles.kickBtn}
                    onPress={() => {
                      sound.playSound('tap');
                      onKickPlayer(p.id);
                    }}
                  >
                    <Text style={styles.kickBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </Reanimated.View>
            );
          })}

          {/* Boş Slotlar: Üretilmiş kaide görseli + nefes alan parıltı */}
          {Array.from({ length: Math.min(4, emptySlotCount) }).map((_, idx) => (
            <EmptySlotCard key={`empty_${idx}`} />
          ))}
        </View>

        {/* 4. TAVRİKO UI KIT LOBİ REAKSİYONLARI BAR (8 Emojili Canlı WebSocket Reaksiyonları) */}
        <View style={styles.reactionsSection}>
          <Text style={styles.reactionsHeader}>LOBİ REAKSİYONLARI</Text>
          <View style={styles.reactionsPillBar}>
            {LOBBY_REACTION_EMOJIS.map((emoji) => (
              <BouncyReaction
                key={emoji}
                emoji={emoji}
                onPress={() => handleSendReaction(emoji)}
              />
            ))}
          </View>
        </View>

        {/* 4.5. ANLIK SÜZÜLEN LOBİ SOHBETİ (Veritabanına kaydedilmez, anlık süzülür) */}
        <View style={styles.quickChatContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickChipsScroll}
          >
            {QUICK_CHAT_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={styles.quickChip}
                activeOpacity={0.75}
                onPress={() => handleSendChat(chip)}
              >
                <Text style={styles.quickChipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={chatText}
              onChangeText={setChatText}
              placeholder="Lobiye mesaj yaz (anlık süzülür)..."
              placeholderTextColor="#9A8BC2"
              maxLength={70}
              returnKeyType="send"
              onSubmitEditing={() => handleSendChat()}
            />
            <TouchableOpacity
              style={[styles.chatSendBtn, !chatText.trim() && styles.chatSendBtnDisabled]}
              onPress={() => handleSendChat()}
              activeOpacity={0.8}
              disabled={!chatText.trim()}
            >
              <Text style={styles.chatSendBtnText}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. ALT BAŞLATMA ALANI (Tavriko UI Kit Birebir) */}
        <View style={styles.controlsWrap}>
          {isHost ? (
            <>
              {!canStart ? (
                <View style={styles.waitingContainer}>
                  <Text style={styles.waitingNoticeTitle}>Diğer oyuncular bekleniyor...</Text>
                  <Text style={styles.waitingSubNotice}>
                    Oyunu başlatabilmek için en az 2 oyuncu olmalıdır.
                  </Text>
                  <View style={styles.disabledStartBtn}>
                    <Text style={styles.disabledStartBtnText}>Oyunu Başlat</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.readyContainer}>
                  <Text style={styles.readyNotificationText}>
                    ✨ Lobi hazır! Yarışmayı hemen başlatabilirsiniz ({players.length}/{maxPlayers}).
                  </Text>
                  <Button3D
                    title="OYUNU BAŞLAT 🎮"
                    onPress={() => {
                      sound.playSound('tap');
                      sound.triggerHaptic('medium');
                      onStartGame();
                    }}
                    variant="gold"
                    style={{ height: 56, width: '100%' }}
                  />
                </View>
              )}
            </>
          ) : (
            <View style={styles.guestControls}>
              <TouchableOpacity
                style={[styles.readyToggleBtn, isReady && styles.readyToggleBtnActive]}
                onPress={() => {
                  sound.playSound('tap');
                  onToggleReady();
                }}
              >
                <Text style={[styles.readyToggleText, isReady && styles.readyToggleTextActive]}>
                  {isReady ? '✓ HAZIRSIN' : '⚡ HAZIR OL'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.waitingHostText}>
                Kurucunun oyunu başlatması bekleniyor...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* OYUN İÇİ ARKADAŞ DAVETİ MODALI */}
      <Modal
        visible={friendInviteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFriendInviteVisible(false)}
      >
        <View style={styles.friendModalOverlay}>
          <View style={styles.friendModalShell}>
          <View testID="lobby-friend-invite-dialog" accessibilityViewIsModal style={styles.friendModalCard}>
            <GradientFill colors={['#33216A', '#211448', '#150B31']} stops={[0, 0.42, 1]} direction="diagonal" />
            <View style={styles.friendModalHeader}>
              <InviteArtwork variant="icon" style={styles.friendModalHeaderIcon} />
              <Text style={styles.friendModalTitle}>Arkadaş Davet Et</Text>
              <TouchableOpacity
                style={styles.friendModalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Davet penceresini kapat"
                onPress={() => {
                  sound.playSound('tap');
                  setFriendInviteVisible(false);
                }}
              >
                <Text style={styles.friendModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.friendModalSub}>
              Arkadaşların bildirimdeki “Odaya Katıl” düğmesiyle bu odaya girebilir.
            </Text>
            {inviteError && <Text accessibilityLiveRegion="polite" style={styles.friendInviteError}>{inviteError}</Text>}
            {roomFull ? (
              <Text style={styles.friendModalEmptyText}>Oda dolu. Yer açıldığında tekrar davet edebilirsin.</Text>
            ) : friendsLoading && friendsList.length === 0 ? (
              <View style={styles.friendModalEmpty}>
                <ActivityIndicator color="#9B8CFF" />
              </View>
            ) : friendsError && friendsList.length === 0 ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => setFriendsReload(n => n + 1)} style={styles.friendModalEmpty}>
                <Text style={styles.friendModalEmptyText}>Arkadaşlar yüklenemedi. Yeniden dene.</Text>
              </TouchableOpacity>
            ) : availableFriends.length === 0 ? (
              <View style={styles.friendModalEmpty}>
                <Text style={styles.friendModalEmptyText}>
                  {friendsList.length ? 'Tüm arkadaşların bu odada.' : 'Davet etmek için önce arkadaş ekleyebilirsin.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableFriends}
                keyExtractor={(f) => f.id}
                testID="lobby-friend-invite-list"
                style={styles.friendModalList}
                ItemSeparatorComponent={() => <View style={styles.friendModalDivider} />}
                renderItem={({ item }) => {
                  const invited = invitedFriendIds.has(item.id);
                  const sending = sendingIds.has(item.id);
                  return (
                    <View style={styles.friendRow}>
                      <View style={styles.friendAvatarWrap}>
                        <CharacterAvatar
                          seed={item.avatarUrl || item.displayName || item.name || 'av2'}
                          size={44}
                        />
                        {item.online ? <View style={styles.friendOnlineDot} /> : null}
                      </View>
                      <View style={styles.friendRowInfo}>
                        <Text style={styles.friendRowName} numberOfLines={1}>
                          {item.displayName || item.name}
                        </Text>
                        <Text style={styles.friendRowStatus} numberOfLines={1}>
                          {item.online ? 'Çevrimiçi' : 'Çevrimdışı'}
                          {item.level ? ` · Sv. ${item.level}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.friendInviteBtn, invited && styles.friendInviteBtnDone]}
                        onPress={() => inviteFriend(item.id)}
                        disabled={invited || sending}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: invited || sending, busy: sending }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.friendInviteBtnText} numberOfLines={1} adjustsFontSizeToFit>
                          {invited ? 'Gönderildi' : sending ? 'Gönderiliyor' : 'Davet Et'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
          </View>
        </View>
      </Modal>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  headerTitleWrap: {
    marginTop: 4,
    marginBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: THEME.fonts.display,
    color: '#FFC837',
    letterSpacing: 2,
    textAlign: 'center',
  },

  // 0. Lobi Sahnesi Banner'ı (Üretilmiş görsel + animasyonlu başlık)
  heroBanner: {
    width: '100%',
    height: 170,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 55, 0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#7A3FE0',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
      web: {
        boxShadow: '0 10px 30px rgba(122, 63, 224, 0.4)',
      },
    }),
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30, 14, 61, 0.45)',
  },
  heroContent: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: '#5ADBB5',
    letterSpacing: 3,
    marginBottom: 4,
  },
  heroPillRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  heroPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  heroPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E9DFFC',
  },

  // Oda kodu kartı sarmalayıcı: nefes alan parıltı için
  codeCardWrap: {
    width: '100%',
    marginBottom: 12,
  },

  // 1. Oda Kodu Kartı (Tavriko UI Kit Altın Çerçeveli)
  codeCardInner: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeInfoLeft: {
    flex: 1,
  },
  codeLabel: {
    color: '#FFC837',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  codeValueText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: THEME.fonts.display,
    letterSpacing: 3,
  },
  codeCardSub: {
    color: '#9A8BC2',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  codeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  codeIconBtnActive: {
    borderColor: '#5ADBB5',
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
  },

  // 2. Parametre Çipleri
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    width: '100%',
  },
  specChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(58, 28, 113, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.35)',
  },
  specChipText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },

  // 3. Oyuncu Listesi
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  playersCountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
  },
  roomStatusTag: {
    color: '#FFC837',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  playersList: {
    width: '100%',
    gap: 10,
    marginBottom: 14,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E0E3D',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.25)',
  },
  playerAvatarWrap: {
    position: 'relative',
  },
  hostCrown: {
    position: 'absolute',
    top: -10,
    left: -2,
    fontSize: 13,
  },
  hostCrownText: {
    fontSize: 13,
  },
  playerRowMe: {
    borderColor: '#FFC837',
    backgroundColor: 'rgba(255, 200, 55, 0.06)',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
    maxWidth: 160,
  },
  crownBadge: {
    fontSize: 13,
  },
  playerRoleText: {
    color: '#9A8BC2',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 1,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusReady: {
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
  },
  statusWaiting: {
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  statusChipText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  statusChipTextReady: {
    color: '#5ADBB5',
  },
  kickBtn: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 65, 108, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 65, 108, 0.4)',
  },
  kickBtnText: {
    color: '#FF416C',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Boş Oyuncu Slotu (Arka plansız, sadece şeffaf soru işareti)
  emptySlotRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 14,
    backgroundColor: 'transparent',
  },
  emptySlotArt: {
    width: 46,
    height: 46,
  },
  emptySlotTextMinimal: {
    color: '#8A7BAF',
    fontSize: 13,
    fontFamily: THEME.fonts.medium,
  },

  // 1.5. Davet Bağlantısı Kartı
  inviteLinkWrap: {
    width: '100%',
    marginBottom: 12,
  },
  // ---- Arkadaş Davet Kartı (animasyonlu, arka plan görselli) ----
  friendInviteCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#150A38',
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  friendInviteBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  friendInviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  friendInviteInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 2,
  },
  friendInviteBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 92, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(186, 150, 255, 0.45)',
    shadowColor: '#9B8CFF',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  friendInviteBadgeIcon: {
    width: 30,
    height: 30,
  },
  friendInviteTitle: {
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  friendInviteSub: {
    color: '#B7A8DC',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 1,
  },
  friendInviteChevron: {
    fontSize: 26,
    lineHeight: 28,
    color: 'rgba(200, 185, 255, 0.9)',
    fontFamily: THEME.fonts.black,
  },
  friendModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 1, 16, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  friendModalShell: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    borderRadius: 22,
    backgroundColor: '#150B3B',
    shadowColor: '#6B3CFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 14,
  },
  friendModalCard: {
    flexShrink: 1,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#6551A4',
    padding: 16,
  },
  friendModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#6954A5',
  },
  friendModalHeaderIcon: {
    width: 30,
    height: 30,
  },
  friendModalTitle: {
    fontSize: 17,
    fontFamily: THEME.fonts.extraBold,
    color: '#FFFFFF',
    flex: 1,
  },
  friendModalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  friendModalCloseText: {
    color: '#CDB9E4',
    fontSize: 14,
  },
  friendModalSub: {
    fontSize: 13,
    fontFamily: THEME.fonts.body,
    color: '#DED2F5',
    marginBottom: 8,
    lineHeight: 19,
  },
  friendModalList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  friendInviteError: {
    color: '#FFB5BF',
    fontSize: 12,
    marginBottom: 8,
  },
  friendModalEmpty: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendModalEmptyText: {
    color: '#CDB9E4',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  friendModalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(155, 140, 255, 0.14)',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  friendAvatarWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(155, 140, 255, 0.14)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(155, 140, 255, 0.35)',
    shadowColor: '#9B8CFF',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  friendOnlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#5ADBB5',
    borderWidth: 2,
    borderColor: '#1B0E45',
  },
  friendRowInfo: {
    flex: 1,
    minWidth: 0,
  },
  friendRowName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.medium,
  },
  friendRowStatus: {
    color: '#BFB1EE',
    fontSize: 12,
    marginTop: 2,
  },
  friendInviteBtn: {
    borderRadius: 12,
    width: 88,
    minHeight: 44,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6747DC',
    borderWidth: 1,
    borderColor: 'rgba(186, 150, 255, 0.6)',
  },
  friendInviteBtnDone: {
    backgroundColor: 'rgba(90, 219, 181, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(90, 219, 181, 0.5)',
    shadowOpacity: 0,
    elevation: 0,
  },
  friendInviteBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  inviteLinkCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(23, 11, 51, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(90, 219, 181, 0.35)',
  },
  inviteLinkInfo: {
    flex: 1,
    marginRight: 10,
  },
  inviteLinkLabel: {
    color: '#5ADBB5',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  inviteLinkText: {
    color: '#E9DFFC',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(90, 219, 181, 0.6)',
  },
  inviteLinkSub: {
    color: '#9A8BC2',
    fontSize: 10.5,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  emptySlotCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(154, 107, 255, 0.35)',
    backgroundColor: 'rgba(23, 11, 51, 0.4)',
  },
  emptySlotPlusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  emptySlotPlusText: {
    color: '#5ADBB5',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  emptySlotTextCol: {
    flex: 1,
  },
  emptySlotTitle: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  emptySlotSub: {
    color: '#8A7BAF',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 1,
  },

  // 4. Lobi Reaksiyonları Bar
  reactionsSection: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
  },
  reactionsHeader: {
    color: '#9A8BC2',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  reactionsPillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E0E3D',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: '100%',
  },
  reactionTouch: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  reactionEmojiText: {
    fontSize: 22,
  },

  // 4.5. Hızlı ve Özel Sohbet
  quickChatContainer: {
    width: '100%',
    marginVertical: 4,
  },
  quickChipsScroll: {
    paddingVertical: 4,
    gap: 6,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  quickChipText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    width: '100%',
  },
  chatInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#1E0E3D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.3)',
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.medium,
  },
  chatSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#5ADBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendBtnDisabled: {
    opacity: 0.4,
  },
  chatSendBtnText: {
    color: '#0C3A33',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // 5. Alt Kontroller
  controlsWrap: {
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  waitingContainer: {
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#1E0E3D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.3)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  waitingNoticeTitle: {
    color: '#D9CDF5',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
    marginBottom: 4,
  },
  disabledStartBtn: {
    width: '100%',
    height: 52,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledStartBtnText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 16,
    fontFamily: THEME.fonts.bold,
  },
  waitingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  waitingIcon: {
    fontSize: 16,
  },
  waitingPulsingText: {
    color: '#FFC837',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
  },
  waitingSubNotice: {
    color: '#9A8BC2',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
    marginBottom: 12,
  },
  inviteShareBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#5ADBB5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#5ADBB5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 14px rgba(90, 219, 181, 0.35)',
      },
    }),
  },
  inviteShareBtnText: {
    color: '#0B2E28',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    letterSpacing: 1,
  },
  readyContainer: {
    width: '100%',
    alignItems: 'center',
  },
  readyNotificationText: {
    color: '#5ADBB5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginBottom: 10,
  },
  guestControls: {
    width: '100%',
    alignItems: 'center',
  },
  readyToggleBtn: {
    width: '100%',
    height: 52,
    borderRadius: 24,
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
    borderWidth: 1.5,
    borderColor: '#5ADBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyToggleBtnActive: {
    backgroundColor: '#5ADBB5',
  },
  readyToggleText: {
    color: '#5ADBB5',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    letterSpacing: 1,
  },
  readyToggleTextActive: {
    color: '#0B2E28',
  },
  waitingHostText: {
    color: '#9A8BC2',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    marginTop: 8,
  },

  // Süzülme Animasyon Katmanı
  floatingLayer: {
    position: 'absolute',
    top: 60,
    bottom: 120,
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  floatingEmojiWrap: {
    position: 'absolute',
    bottom: 40,
  },
  floatingEmojiText: {
    fontSize: 38,
  },
  floatingChatBubble: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(23, 11, 51, 0.94)',
    borderWidth: 1.5,
    borderColor: '#5ADBB5',
    maxWidth: 280,
    ...Platform.select({
      ios: {
        shadowColor: '#5ADBB5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 16px rgba(90, 219, 181, 0.35)',
      },
    }),
  },
  floatingChatAvatarWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
  },
  floatingChatTextCol: {
    flexShrink: 1,
  },
  floatingChatSender: {
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
    color: '#FFC837',
  },
  floatingChatBody: {
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    color: '#FFFFFF',
  },
});
