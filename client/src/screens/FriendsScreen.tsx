import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { ArrowLeft, UserPlus, Share2, Swords, Check, Copy } from 'lucide-react-native';

interface FriendsScreenProps {
  onBack: () => void;
  onInviteToMatch: (friendId: string) => void;
}

export const FriendsScreen: React.FC<FriendsScreenProps> = ({ onBack, onInviteToMatch }) => {
  const [friendCode, setFriendCode] = useState('');
  const [copied, setCopied] = useState(false);

  const friends = [
    { id: 'f1', name: 'Zeynep Kaya', level: 18, status: 'Çevrimiçi', rank: 'Stratejist' },
    { id: 'f2', name: 'Can Demir', level: 22, status: 'Maçta', rank: 'Usta Bilgin' },
    { id: 'f3', name: 'Mert Aksoy', level: 11, status: 'Çevrimdışı', rank: 'Çırak' },
  ];

  const handleShare = () => {
    sound.playSound('tap');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('TRIVIA-9921');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
        <Text style={styles.headerTitle}>Arkadaşlar & Davet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Share Invite Code Banner */}
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>SENİN ARKADAŞLIK KODUN</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>TRIVIA-9921</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleShare}>
              {copied ? (
                <Check size={18} color={THEME.colors.correct} />
              ) : (
                <Copy size={18} color={THEME.colors.primaryLight} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.inviteHint}>
            Arkadaşlarını davet et, birlikte özel maçlar düzenle ve hediye coin kazan!
          </Text>
        </View>

        {/* Add Friend Input */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Arkadaş kodu veya kullanıcı adı..."
            placeholderTextColor={THEME.colors.textMuted}
            value={friendCode}
            onChangeText={setFriendCode}
          />
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              sound.playSound('tap');
              setFriendCode('');
            }}
          >
            <UserPlus size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Friend List */}
        <Text style={styles.sectionHeader}>Arkadaş Listen ({friends.length})</Text>
        <View style={styles.friendList}>
          {friends.map((f) => (
            <View key={f.id} style={styles.friendCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{f.name.charAt(0)}</Text>
                <View
                  style={[
                    styles.statusDot,
                    f.status === 'Çevrimiçi'
                      ? styles.statusOnline
                      : f.status === 'Maçta'
                      ? styles.statusInMatch
                      : styles.statusOffline,
                  ]}
                />
              </View>

              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{f.name}</Text>
                <Text style={styles.friendMeta}>
                  Lv. {f.level} • {f.rank} • {f.status}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.duelBtn}
                onPress={() => {
                  sound.playSound('tap');
                  onInviteToMatch(f.id);
                }}
              >
                <Swords size={16} color="#FFF" />
                <Text style={styles.duelText}>Düello</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
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
  content: {
    padding: THEME.spacing.lg,
  },
  inviteCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.primaryLight,
    letterSpacing: 2,
  },
  copyBtn: {
    padding: 6,
  },
  inviteHint: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  addInput: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  friendList: {
    gap: 10,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    padding: 12,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 2,
    borderColor: THEME.colors.card,
  },
  statusOnline: {
    backgroundColor: THEME.colors.correct,
  },
  statusInMatch: {
    backgroundColor: THEME.colors.streak,
  },
  statusOffline: {
    backgroundColor: THEME.colors.textMuted,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  friendMeta: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  duelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
  },
  duelText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
