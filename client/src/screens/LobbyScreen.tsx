import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { GameRoom, Player } from '@trivia/shared';
import { ArrowLeft, Crown, Check, X, Copy, Play, Users } from 'lucide-react-native';

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
  const isHost = room.hostId === currentUserId;
  const playersList: Player[] = Object.values(room.players);
  const myPlayer = room.players[currentUserId];
  const allReady = playersList.every((p) => p.isReady || p.isHost);

  const copyCode = () => {
    sound.playSound('tap');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(room.code);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            sound.playSound('tap');
            onBack();
          }}
        >
          <ArrowLeft size={22} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Oyun Lobisi</Text>
      </View>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>ODA KODU</Text>
        <TouchableOpacity style={styles.codeRow} onPress={copyCode}>
          <Text style={styles.codeText}>{room.code}</Text>
          <Copy size={18} color={THEME.colors.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.codeHint}>Koda dokunarak kopyalayabilirsin</Text>
      </View>

      <View style={styles.playersSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Oyuncular ({playersList.length}/{room.maxPlayers})
          </Text>
          <Text style={styles.categoryBadge}>{room.category.toUpperCase()}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.playersList}>
          {playersList.map((player) => (
            <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{player.displayName.charAt(0).toUpperCase()}</Text>
                  {player.isHost && (
                    <View style={styles.hostCrown}>
                      <Crown size={12} color="#FFF" />
                    </View>
                  )}
                </View>
                <View>
                  <Text style={styles.playerName}>{player.displayName}</Text>
                  <Text style={styles.playerRole}>{player.isHost ? 'Oda Kurucusu' : 'Yarışmacı'}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.readyBadge,
                  player.isReady ? styles.readyBadgeActive : styles.readyBadgePending,
                ]}
              >
                {player.isReady ? (
                  <Check size={14} color="#FFF" />
                ) : (
                  <X size={14} color={THEME.colors.textMuted} />
                )}
                <Text
                  style={[
                    styles.readyText,
                    player.isReady ? styles.readyTextActive : styles.readyTextPending,
                  ]}
                >
                  {player.isReady ? 'HAZIR' : 'BEKLİYOR'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        {isHost ? (
          <TouchableOpacity
            style={[styles.startButton, (!allReady || playersList.length < 1) && styles.buttonDisabled]}
            disabled={!allReady || playersList.length < 1}
            onPress={() => {
              sound.playSound('match_found');
              sound.triggerHaptic('success');
              onStartGame();
            }}
          >
            <Play size={20} color="#FFF" />
            <Text style={styles.buttonText}>Oyunu Başlat</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.readyButton, myPlayer?.isReady && styles.readyButtonActive]}
            onPress={() => {
              sound.playSound('tap');
              sound.triggerHaptic('light');
              onToggleReady();
            }}
          >
            <Check size={20} color="#FFF" />
            <Text style={styles.buttonText}>
              {myPlayer?.isReady ? 'Hazır Durumunu İptal Et' : 'Hazırım!'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  codeCard: {
    margin: THEME.spacing.lg,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 6,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '900',
    color: THEME.colors.primaryLight,
    letterSpacing: 6,
  },
  codeHint: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  playersSection: {
    flex: 1,
    paddingHorizontal: THEME.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  playersList: {
    gap: 10,
  },
  playerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    padding: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  hostCrown: {
    position: 'absolute',
    top: -6,
    right: -4,
    backgroundColor: THEME.colors.gold,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  playerRole: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
  },
  readyBadgeActive: {
    backgroundColor: THEME.colors.correct,
  },
  readyBadgePending: {
    backgroundColor: THEME.colors.backgroundSecondary,
  },
  readyText: {
    fontSize: 11,
    fontWeight: '800',
  },
  readyTextActive: {
    color: '#FFF',
  },
  readyTextPending: {
    color: THEME.colors.textMuted,
  },
  footer: {
    padding: THEME.spacing.lg,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
  },
  readyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.cardHover,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  readyButtonActive: {
    backgroundColor: THEME.colors.correct,
    borderColor: THEME.colors.correct,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
