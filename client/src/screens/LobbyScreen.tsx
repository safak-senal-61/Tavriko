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
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { GameRoom } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { socketService } from '../services/socketService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CharacterAvatar,
} from '../components/TavrikoIcons';
import { LobbyReactions } from '../components/LobbyReactions';

interface LobbyScreenProps {
  room: GameRoom;
  currentUserId: string;
  onBack: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onKickPlayer?: (targetPlayerId: string) => void;
}

// Minimalist Vektörel İkonlar
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
      duration: item.type === 'message' ? 3400 : 1300,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => onComplete());
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 0.15, 0.8, 1],
    outputRange: [0, -30, -110, -180],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.12, 0.78, 1],
    outputRange: [0, 1, 0.95, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0.75, 1.08, 1, 0.9],
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
  onBack,
  onToggleReady,
  onStartGame,
  onKickPlayer,
}) => {
  const [copied, setCopied] = useState(false);
  const [chatText, setChatText] = useState('');
  const [floatingItems, setFloatingItems] = useState<FloatingItemData[]>([]);

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
      if (data.roomCode === room.code) {
        const id = `emote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const xOffset = (Math.random() - 0.5) * 160;
        setFloatingItems((prev) => [
          ...prev.slice(-12),
          { id, type: 'emoji', content: data.emote, xOffset },
        ]);
      }
    });

    const unsubChat = socketService.onLobbyMessage((data) => {
      if (data.roomCode === room.code) {
        sound.playSound('tap');
        sound.triggerHaptic('medium');
        const id = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
  }, [room.code]);

  const removeFloatingItem = (id: string) => {
    setFloatingItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSendReaction = (emoji: string) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    socketService.sendEmote(room.code, currentUserId, emoji);
  };

  const handleSendChat = (presetText?: string) => {
    const textToSend = (presetText || chatText).trim();
    if (!textToSend) return;
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    socketService.sendLobbyChat(
      room.code,
      currentUserId,
      myPlayer?.displayName || 'Oyuncu',
      textToSend,
      myPlayer?.avatarUrl || myPlayer?.displayName
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
      <TavrikoTopBar leftType="back" onLeftPress={onBack} />

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
        {/* Modern, Sade Başlık */}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>ÖZEL LOBİ</Text>
        </View>

        {/* 1. ODA KODU KARTI (Sade & Modern) */}
        <View style={styles.codeCard}>
          <View style={styles.codeInfoLeft}>
            <Text style={styles.codeCardLabel}>ODA KODU</Text>
            <Text style={styles.codeValueText}>{room.code}</Text>
          </View>

          <View style={styles.actionBtnsRow}>
            {/* Tek ve Net Kopyala Butonu */}
            <TouchableOpacity
              style={[styles.actionBtn, copied && styles.actionBtnActive]}
              onPress={handleCopyCode}
              activeOpacity={0.8}
            >
              {copied ? (
                <CheckSvgIcon size={18} color="#5ADBB5" />
              ) : (
                <CopySvgIcon size={18} color="#FFFFFF" />
              )}
              <Text style={[styles.actionBtnText, copied && styles.actionBtnTextActive]}>
                {copied ? 'Kopyalandı' : 'Kopyala'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. ODA PARAMETRELERİ (Sadeleştirilmiş Çipler) */}
        <View style={styles.chipsRow}>
          <View style={styles.specChip}>
            <Text style={styles.specChipText}>📝 {room.totalRounds || 7} Soru</Text>
          </View>
          <View style={styles.specChip}>
            <Text style={styles.specChipText}>⏱️ {room.questionTimeSec || 20}sn</Text>
          </View>
          <View style={styles.specChip}>
            <Text style={styles.specChipText}>
              {room.penaltyForWrong ? '⚠️ -50p Ceza' : '🛡️ Cezasız'}
            </Text>
          </View>
        </View>

        {/* 3. OYUNCU LİSTESİ */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.playersCountText}>
            Oyuncular ({players.length}/{maxPlayers})
          </Text>
          <Text style={styles.roomStatusTag}>
            {canStart ? '🟢 Başlamaya Hazır' : '🟡 Bekleniyor'}
          </Text>
        </View>

        <View style={styles.playersList}>
          {players.map((p, index) => {
            const playerIsHost = p.id === room.hostId;
            const isMe = p.id === currentUserId;

            return (
              <View
                key={p.id}
                style={[styles.playerRow, isMe && styles.playerRowMe]}
              >
                <CharacterAvatar seed={p.avatarUrl || p.displayName} index={index} size={42} />

                <View style={styles.playerInfo}>
                  {/* Kral ikonu kaldırıldı, sade ve modern isim görünümü */}
                  <Text style={styles.playerName} numberOfLines={1}>
                    {p.displayName} {isMe ? '(Sen)' : ''}
                  </Text>
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
              </View>
            );
          })}

          {/* Boş Slotlar: Tavriko UI Kit kesikli çizgili sade tasarım */}
          {Array.from({ length: Math.min(4, emptySlotCount) }).map((_, idx) => (
            <View key={`empty_${idx}`} style={styles.emptySlot}>
              <Text style={styles.emptySlotText}>Oyuncu bekleniyor...</Text>
            </View>
          ))}
        </View>

        {/* 4. MODERN, ŞIK VE İNCE REAKSİYON KAPSÜLÜ (WebSocket Canlı Yayın) */}
        <LobbyReactions onReactionSent={handleSendReaction} />

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

        {/* 5. ALT BAŞLATMA ALANI (Tek, net ve modern aksiyon) */}
        <View style={styles.controlsWrap}>
          {isHost ? (
            <>
              {!canStart ? (
                <View style={styles.waitingContainer}>
                  <Animated.Text style={[styles.waitingPulsingText, { opacity: pulseAnim }]}>
                    Diğer oyuncular bekleniyor...
                  </Animated.Text>
                  <Text style={styles.waitingSubNotice}>
                    Oyunu başlatabilmek için en az 2 oyuncu olmalıdır.
                  </Text>

                  {/* Tek, modern davet butonu */}
                  <TouchableOpacity
                    style={styles.singleInviteBtn}
                    onPress={handleShareCode}
                    activeOpacity={0.85}
                  >
                    <ShareSvgIcon size={18} color="#0C3A33" />
                    <Text style={styles.singleInviteBtnText}>Arkadaşını Davet Et</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.readyContainer}>
                  <Text style={styles.readyNotificationText}>
                    ✨ Lobi hazır! Yarışmayı hemen başlatabilirsiniz.
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
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
    color: '#FFE27A',
    textAlign: 'center',
    letterSpacing: 2,
  },
  codeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E0E3D',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFC43D',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    maxWidth: 380,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#FFC43D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0px 4px 14px rgba(255, 196, 61, 0.2)',
      },
    }),
  },
  codeInfoLeft: {
    justifyContent: 'center',
  },
  codeCardLabel: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  codeValueText: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    marginTop: 2,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(90, 219, 181, 0.2)',
    borderColor: '#5ADBB5',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    fontWeight: '700',
  },
  actionBtnTextActive: {
    color: '#5ADBB5',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 380,
    marginBottom: 14,
  },
  specChip: {
    flex: 1,
    backgroundColor: 'rgba(107, 60, 255, 0.18)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.35)',
  },
  specChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  playersCountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
  },
  roomStatusTag: {
    color: '#5ADBB5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
  },
  playersList: {
    width: '100%',
    maxWidth: 380,
    gap: 8,
    marginBottom: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.35)',
  },
  playerRowMe: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.08)',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
  },
  playerRoleText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.2,
  },
  statusReady: {
    backgroundColor: 'rgba(90, 219, 181, 0.2)',
    borderColor: '#5ADBB5',
  },
  statusWaiting: {
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    borderColor: '#FFC43D',
  },
  statusChipText: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '900',
    color: '#FFC43D',
  },
  statusChipTextReady: {
    color: '#5ADBB5',
  },
  kickBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 92, 119, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF5C77',
    marginLeft: 8,
  },
  kickBtnText: {
    color: '#FF5C77',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  emptySlot: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginBottom: 4,
  },
  emptySlotText: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  controlsWrap: {
    width: '100%',
    maxWidth: 380,
    marginTop: 8,
  },
  waitingContainer: {
    alignItems: 'center',
    width: '100%',
  },
  waitingPulsingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  waitingSubNotice: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 12,
  },
  singleInviteBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#5ADBB5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#5ADBB5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 4px 12px rgba(90, 219, 181, 0.35)',
      },
    }),
  },
  singleInviteBtnText: {
    color: '#0C3A33',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  readyContainer: {
    alignItems: 'center',
    width: '100%',
  },
  readyNotificationText: {
    color: '#5ADBB5',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
    textAlign: 'center',
    marginBottom: 10,
  },
  guestControls: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  readyToggleBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  readyToggleBtnActive: {
    backgroundColor: '#5ADBB5',
    borderColor: '#5ADBB5',
  },
  readyToggleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
  },
  readyToggleTextActive: {
    color: '#0C3A33',
  },
  waitingHostText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  floatingLayer: {
    position: 'absolute',
    top: 70,
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
    color: '#FFE27A',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
  },
  floatingChatBody: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: THEME.fonts.bold,
    fontWeight: '700',
  },
  quickChatContainer: {
    width: '100%',
    maxWidth: 380,
    marginTop: 6,
    marginBottom: 8,
    gap: 8,
  },
  quickChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
  },
  quickChip: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  quickChipText: {
    color: '#D9CDF5',
    fontSize: 11.5,
    fontFamily: THEME.fonts.bold,
    fontWeight: '700',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  chatInput: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(10, 4, 30, 0.75)',
    borderWidth: 1.2,
    borderColor: 'rgba(154, 107, 255, 0.35)',
    borderRadius: 21,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.medium,
  },
  chatSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#5ADBB5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendBtnDisabled: {
    opacity: 0.4,
  },
  chatSendBtnText: {
    color: '#082520',
    fontSize: 16,
    fontWeight: '900',
  },
});
