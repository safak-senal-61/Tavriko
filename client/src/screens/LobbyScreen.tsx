import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CharacterAvatar,
  CrownIcon,
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

// Crisp SVG Icons
const CopySvgIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
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

const ShareSvgIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
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

const CheckSvgIcon = ({ size = 20, color = '#5ADBB5' }: { size?: number; color?: string }) => (
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

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  currentUserId,
  onBack,
  onToggleReady,
  onStartGame,
  onKickPlayer,
}) => {
  const [copied, setCopied] = useState(false);
  const players = Object.values(room.players);
  const maxPlayers = room.maxPlayers || 4;
  const emptySlotCount = Math.max(0, maxPlayers - players.length);
  const isHost = currentUserId === room.hostId;
  const myPlayer = room.players[currentUserId];
  const isReady = myPlayer?.isReady ?? false;
  const canStart = players.length >= 2;

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Üst Başlık */}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.badgeLabel}>ÖZEL ARENA</Text>
          <Text style={styles.title}>ÖZEL LOBİ</Text>
        </View>

        {/* 1. ODA KODU KARTI (Tavriko Cyber-Obsidian Kartı) */}
        <View style={styles.codeCard}>
          <View style={styles.codeInfoLeft}>
            <Text style={styles.codeCardLabel}>ODA KODU</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCopyCode}
              style={styles.codeRowTouch}
            >
              <Text style={styles.codeValueText}>{room.code}</Text>
              <Text style={styles.codeHintText}>
                {copied ? '✓ Kopyalandı!' : 'Dokun kopyala'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionBtnsRow}>
            {/* Kopyala Butonu */}
            <TouchableOpacity
              style={[styles.actionSquircleBtn, copied && styles.actionSquircleBtnActive]}
              onPress={handleCopyCode}
              activeOpacity={0.8}
            >
              {copied ? (
                <CheckSvgIcon size={20} color="#5ADBB5" />
              ) : (
                <CopySvgIcon size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            {/* Paylaş Butonu */}
            <TouchableOpacity
              style={styles.actionSquircleBtn}
              onPress={handleShareCode}
              activeOpacity={0.8}
            >
              <ShareSvgIcon size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. ODA PARAMETRELERİ ROZETLERİ (Soru, Süre, Ceza, Kategori) */}
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
            {canStart ? '🟢 Başlamaya Hazır' : '🟡 Katılımcı Bekleniyor'}
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
                <View style={styles.avatarBorderWrap}>
                  <CharacterAvatar seed={p.avatarUrl || p.displayName} index={index} size={42} />
                </View>

                <View style={styles.playerInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {p.displayName} {isMe ? '(Sen)' : ''}
                    </Text>
                    {playerIsHost && (
                      <View style={styles.hostCrownBadge}>
                        <CrownIcon size={16} />
                      </View>
                    )}
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
              </View>
            );
          })}

          {/* Boş Oyuncu Slotları (Tıklanabilir Arkadaş Daveti) */}
          {Array.from({ length: Math.min(4, emptySlotCount) }).map((_, idx) => (
            <TouchableOpacity
              key={`empty_${idx}`}
              style={styles.emptySlotTouch}
              activeOpacity={0.8}
              onPress={handleShareCode}
            >
              <View style={styles.emptyPlusIcon}>
                <Text style={styles.emptyPlusText}>+</Text>
              </View>
              <View style={styles.emptySlotInfo}>
                <Text style={styles.emptySlotTitle}>Boş Oyuncu Slotu</Text>
                <Text style={styles.emptySlotSub}>Arkadaşını odaya davet etmek için dokun 🔗</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 4. LOBİ İÇİ REAKSİYON ÇUBUĞU */}
        <LobbyReactions />

        {/* 5. BAŞLATMA VE AKSİYON ALANI */}
        <View style={styles.controlsWrap}>
          {isHost ? (
            <>
              {!canStart ? (
                <View style={styles.waitingContainer}>
                  {/* Nefes alan durum metni */}
                  <Animated.Text style={[styles.waitingPulsingText, { opacity: pulseAnim }]}>
                    👥 Diğer oyuncular bekleniyor...
                  </Animated.Text>
                  <Text style={styles.waitingSubNotice}>
                    Oyunu başlatabilmek için en az 2 oyuncu olmalıdır ({players.length}/{maxPlayers}).
                  </Text>

                  {/* Birincil Aksiyon: Arkadaş Daveti */}
                  <TouchableOpacity
                    style={styles.inviteShareBtn}
                    onPress={handleShareCode}
                    activeOpacity={0.85}
                  >
                    <ShareSvgIcon size={18} color="#0C3A33" />
                    <Text style={styles.inviteShareBtnText}>DAVET LİNKİNİ PAYLAŞ</Text>
                  </TouchableOpacity>

                  {/* Devre Dışı Başlatma Rozeti */}
                  <View style={styles.disabledStartPill}>
                    <Text style={styles.disabledStartText}>🔒 Oyunu Başlat (En az 2 kişi)</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.readyContainer}>
                  <Text style={styles.readyNotificationText}>
                    🎉 Lobi hazır! Yarışmayı hemen başlatabilirsiniz.
                  </Text>
                  <Button3D
                    title="OYUNU BAŞLAT 🎮"
                    onPress={() => {
                      sound.playSound('tap');
                      sound.triggerHaptic('medium');
                      onStartGame();
                    }}
                    variant="gold"
                    style={{ height: 58, width: '100%' }}
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
                  {isReady ? '✓ HAZIRSIN (BEKLEMEDEYSİN)' : '⚡ HEMEN HAZIR OL'}
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
    paddingBottom: 50,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  badgeLabel: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '900',
    color: '#5ADBB5',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFE27A',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  codeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E0E3D',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFC43D',
    paddingHorizontal: 18,
    paddingVertical: 14,
    width: '100%',
    maxWidth: 390,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#FFC43D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0px 6px 20px rgba(255, 196, 61, 0.25)',
      },
    }),
  },
  codeInfoLeft: {
    flex: 1,
  },
  codeCardLabel: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  codeRowTouch: {
    marginTop: 2,
  },
  codeValueText: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 5,
  },
  codeHintText: {
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    color: '#5ADBB5',
    marginTop: 1,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionSquircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSquircleBtnActive: {
    backgroundColor: 'rgba(90, 219, 181, 0.2)',
    borderColor: '#5ADBB5',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 390,
    marginBottom: 14,
  },
  specChip: {
    flex: 1,
    backgroundColor: 'rgba(107, 60, 255, 0.2)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.4)',
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
    maxWidth: 390,
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
    maxWidth: 390,
    gap: 8,
    marginBottom: 6,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.35)',
  },
  playerRowMe: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.08)',
  },
  avatarBorderWrap: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#6B3CFF',
    padding: 2,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
  },
  hostCrownBadge: {
    marginLeft: 2,
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
    borderWidth: 1.5,
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
  emptySlotTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.35)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(24, 11, 52, 0.45)',
  },
  emptyPlusIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPlusText: {
    color: '#5ADBB5',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  emptySlotInfo: {
    marginLeft: 12,
  },
  emptySlotTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
  },
  emptySlotSub: {
    color: '#A79BC4',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  controlsWrap: {
    width: '100%',
    maxWidth: 390,
    marginTop: 10,
  },
  waitingContainer: {
    alignItems: 'center',
    width: '100%',
  },
  waitingPulsingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  waitingSubNotice: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  inviteShareBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5ADBB5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#5ADBB5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 14px rgba(90, 219, 181, 0.4)',
      },
    }),
  },
  inviteShareBtnText: {
    color: '#0C3A33',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  disabledStartPill: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledStartText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
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
});
