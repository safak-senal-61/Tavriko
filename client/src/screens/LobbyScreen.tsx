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
}
export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  currentUserId,
  onBack,
  onToggleReady,
  onStartGame,
}) => {
  const [copied, setCopied] = useState(false);
  const players = Object.values(room.players);
  const maxPlayers = 6;
  const emptySlotCount = Math.max(0, maxPlayers - players.length);
  return (
    <TavrikoScreen>
      <TavrikoTopBar leftType="back" onLeftPress={onBack} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>LOBİ</Text>
        <Text style={styles.subtitle}>Oda kodu</Text>
        {/* Room Code Box */}
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{room.code}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.copyIconBtn}
              onPress={async () => {
                await Clipboard.setStringAsync(room.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.copyIconText}>{copied ? '✓' : '📋'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.copyIconBtn}
              onPress={async () => {
                try {
                  await Share.share({
                    message: `Tavriko bilgi yarışmasında özel odama katıl! 🎮\nOda Kodum: ${room.code}\nÖzel Oda ekranından bu kodu girerek hemen oyuna katıl!`,
                  });
                } catch {}
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.copyIconText}>🔗</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.playersCountText}>
          Oyuncular {players.length}/{maxPlayers}
        </Text>
        {/* Active Players */}
        {players.map((p, index) => {
          const isHost = p.id === room.hostId;
          return (
            <TouchableOpacity
              key={p.id}
              style={styles.playerRow}
              onPress={p.id === currentUserId ? onToggleReady : undefined}
              activeOpacity={0.85}
            >
              <CharacterAvatar seed={p.avatarUrl || p.displayName} index={index} size={36} />
              <Text style={styles.playerName} numberOfLines={1}>
                {p.displayName}
              </Text>
              {isHost && <CrownIcon size={20} />}
              <View
                style={[
                  styles.statusChip,
                  p.isReady ? styles.statusReady : styles.statusWaiting,
                ]}
              >
                <Text style={styles.statusChipText}>
                  {p.isReady ? 'HAZIR' : 'BEKLİYOR'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {/* Empty Dashed Slots */}
        {Array.from({ length: Math.min(2, emptySlotCount) }).map((_, idx) => (
          <View key={`empty_${idx}`} style={styles.emptySlot}>
            <Text style={styles.emptySlotText}>Oyuncu bekleniyor...</Text>
          </View>
        ))}
        <View style={{ marginTop: 12 }}>
          <Button3D
            title="MAÇI BAŞLAT"
            onPress={onStartGame}
            style={{ height: 56 }}
          />
        </View>
      </ScrollView>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 14,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  codeText: {
    fontFamily: THEME.fonts.display,
    fontSize: 36,
    letterSpacing: 6,
    color: '#FFC43D',
  },
  copyIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  playersCountText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 8,
  },
  playerRow: {
    height: 58,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  playerName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  statusReady: {
    backgroundColor: '#1F9A5A',
  },
  statusWaiting: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  statusChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  emptySlot: {
    height: 58,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptySlotText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
});