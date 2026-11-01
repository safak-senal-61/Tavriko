import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
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

interface LobbyScreenProps {
  room: GameRoom;
  currentUserId: string;
  onBack: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onKickPlayer?: (targetPlayerId: string) => void;
}

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
  const maxPlayers = room.maxPlayers || 6;
  const emptySlotCount = Math.max(0, maxPlayers - players.length);
  const isHost = currentUserId === room.hostId;
  const myPlayer = room.players[currentUserId];
  const isReady = myPlayer?.isReady ?? false;
  const canStart = players.length >= 2;

  const handleCopyCode = async () => {
    sound.playSound('tap');
    await Clipboard.setStringAsync(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareCode = async () => {
    sound.playSound('tap');
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
        <Text style={styles.title}>ÖZEL LOBİ</Text>

        {/* Room Info & Code */}
        <View style={styles.codeBox}>
          <View>
            <Text style={styles.codeLabel}>ODA KODU</Text>
            <Text style={styles.codeText}>{room.code}</Text>
          </View>
          <View style={styles.actionBtnsRow}>
            <TouchableOpacity
              style={styles.copyIconBtn}
              onPress={handleCopyCode}
              activeOpacity={0.8}
            >
              <Text style={styles.copyIconText}>{copied ? '✓' : '📋'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.copyIconBtn}
              onPress={handleShareCode}
              activeOpacity={0.8}
            >
              <Text style={styles.copyIconText}>🔗</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Room Settings Summary Pill */}
        <View style={styles.settingsSummary}>
          <Text style={styles.settingsSummaryText}>
            ⚙️ {room.totalRounds || 10} Soru · {room.questionTimeSec || 15}s Süre · {room.penaltyForWrong ? 'Cezalı' : 'Cezasız'}
          </Text>
        </View>

        {/* Player Count */}
        <Text style={styles.playersCountText}>
          Oyuncular ({players.length}/{maxPlayers})
        </Text>

        {/* Active Players List */}
        <View style={styles.playersList}>
          {players.map((p, index) => {
            const playerIsHost = p.id === room.hostId;
            const isMe = p.id === currentUserId;

            return (
              <View
                key={p.id}
                style={[styles.playerRow, isMe && styles.playerRowMe]}
              >
                <CharacterAvatar seed={p.avatarUrl || p.displayName} index={index} size={38} />
                <View style={styles.playerInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {p.displayName} {isMe ? '(Sen)' : ''}
                    </Text>
                    {playerIsHost && <CrownIcon size={18} />}
                  </View>
                  <Text style={styles.playerRoleText}>
                    {playerIsHost ? 'Oda Kurucusu' : 'Oyuncu'}
                  </Text>
                </View>

                {/* Ready Status Chip */}
                <View
                  style={[
                    styles.statusChip,
                    p.isReady ? styles.statusReady : styles.statusWaiting,
                  ]}
                >
                  <Text style={[styles.statusChipText, p.isReady && styles.statusChipTextReady]}>
                    {p.isReady ? 'HAZIR' : 'BEKLİYOR'}
                  </Text>
                </View>

                {/* Host Kick Button */}
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

          {/* Empty Dashed Slots */}
          {Array.from({ length: Math.min(4, emptySlotCount) }).map((_, idx) => (
            <View key={`empty_${idx}`} style={styles.emptySlot}>
              <Text style={styles.emptySlotText}>Oyuncu bekleniyor...</Text>
            </View>
          ))}
        </View>

        {/* Host vs Guest Controls */}
        <View style={styles.controlsWrap}>
          {isHost ? (
            <>
              {!canStart && (
                <Text style={styles.warningText}>
                  ⚠️ Oyunu başlatmak için en az 2 oyuncu gereklidir.
                </Text>
              )}
              <Button3D
                title="MAÇI BAŞLAT"
                onPress={() => {
                  if (canStart) {
                    sound.playSound('tap');
                    sound.triggerHaptic('medium');
                    onStartGame();
                  } else {
                    sound.playSound('wrong');
                  }
                }}
                disabled={!canStart}
                style={{ height: 56, opacity: canStart ? 1 : 0.6 }}
              />
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
                  {isReady ? 'HAZIRSIN (İPTAL ET)' : 'HAZIR OL'}
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
    paddingBottom: 32,
    paddingHorizontal: 12,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 32,
    color: '#FFC43D',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 2,
  },
  codeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 4, 24, 0.7)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFC43D',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginVertical: 10,
  },
  codeLabel: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  codeText: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  copyIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyIconText: {
    fontSize: 18,
  },
  settingsSummary: {
    backgroundColor: 'rgba(107, 60, 255, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 60, 255, 0.5)',
    marginBottom: 12,
  },
  settingsSummaryText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  playersCountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    marginBottom: 8,
    marginLeft: 4,
  },
  playersList: {
    gap: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  playerRowMe: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.1)',
  },
  playerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  playerRoleText: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.medium,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusReady: {
    backgroundColor: 'rgba(111, 227, 193, 0.2)',
    borderWidth: 1,
    borderColor: '#6FE3C1',
  },
  statusWaiting: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusChipText: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  statusChipTextReady: {
    color: '#6FE3C1',
  },
  kickBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 92, 119, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF5C77',
    marginLeft: 4,
  },
  kickBtnText: {
    color: '#FF5C77',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  emptySlot: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    color: '#8A7BB3',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
  },
  controlsWrap: {
    marginTop: 18,
  },
  warningText: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginBottom: 8,
  },
  guestControls: {
    alignItems: 'center',
    gap: 8,
  },
  readyToggleBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  readyToggleBtnActive: {
    backgroundColor: '#6FE3C1',
    borderColor: '#6FE3C1',
  },
  readyToggleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  readyToggleTextActive: {
    color: '#12052C',
  },
  waitingHostText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    marginTop: 4,
  },
});
