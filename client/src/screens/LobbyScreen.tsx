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
} from 'react-native';
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

/* Üretilmiş lobi görselleri: sahne banner'ı ve boş slot kaidesi */
const LOBBY_IMG = {
  hero: require('../../assets/images/lobby/lobby_hero.png'),
  emptySlot: require('../../assets/images/lobby/empty_slot.png'),
};

/** Nefes alan altın parıltı: oda kodu kartının çerçevesi için */
const GlowingBorder: React.FC<{ color: string; borderRadius: number }> = ({ color, borderRadius }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: borderRadius + 2,
    borderWidth: 1.5,
    borderColor: color,
    opacity: 0.35 + 0.5 * Math.sin(p.value * Math.PI),
  }));
  return <Reanimated.View style={style} pointerEvents="none" />;
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

/** Boş slot: üretilmiş kaide görseli + nefes alan parıltı */
const EmptySlotCard: React.FC = () => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const glow = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.4 * Math.sin(p.value * Math.PI),
    transform: [{ scale: 0.97 + 0.04 * Math.sin(p.value * Math.PI) }],
  }));
  return (
    <Reanimated.View
      entering={FadeInDown.delay(140).duration(400)}
      style={[styles.emptySlotCardMinimal]}
    >
      <Reanimated.Image
        source={LOBBY_IMG.emptySlot}
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
  const [chatText, setChatText] = useState('');
  const [floatingItems, setFloatingItems] = useState<FloatingItemData[]>([]);

  // İki katmanlı tekillik (deduplication) önbelleği: Ali'de ve tüm oyuncularda çift mesaj/reaksiyonu %100 engeller!
  const processedKeysRef = useRef<Set<string>>(new Set());

  const players = Object.values(room.players);
  const maxPlayers = room.maxPlayers || 4;
  const emptySlotCount = Math.max(0, maxPlayers - players.length);
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

  const handleShareCode = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    try {
      await Share.share({
        message: `Tavriko bilgi yarışmasında özel odama katıl! 🎮\nOda Kodum: ${room.code}\nÖzel Oda ekranından bu kodu girerek hemen oyuna katıl!`,
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

        {/* 1. ODA KODU KARTI (Nefes alan altın parıltılı) */}
        <Reanimated.View entering={FadeInDown.delay(90).duration(400)} style={styles.codeCardWrap}>
          <GlowingBorder color="#FFC837" borderRadius={20} />
          <TouchableOpacity
            style={styles.codeCard}
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
                  <CharacterAvatar seed={p.avatarUrl || p.displayName} index={index} size={42} />
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
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
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
  codeCard: {
    width: '100%',
    backgroundColor: '#1E0E3D',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFC837',
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#FFC837',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 16px rgba(255, 200, 55, 0.25)',
      },
    }),
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

  // Boş Oyuncu Slotu (Sade ve Şık Kesikli Slot)
  emptySlotCardMinimal: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(154, 107, 255, 0.25)',
    backgroundColor: 'rgba(23, 11, 51, 0.35)',
    gap: 12,
  },
  emptySlotArt: {
    width: 52,
    height: 52,
  },
  emptySlotTextMinimal: {
    color: '#8A7BAF',
    fontSize: 13,
    fontFamily: THEME.fonts.medium,
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
