import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { ArrowLeft, PlusCircle, LogIn, Users } from 'lucide-react-native';

interface CustomRoomScreenProps {
  onBack: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
}

export const CustomRoomScreen: React.FC<CustomRoomScreenProps> = ({
  onBack,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [roomCode, setRoomCode] = useState('');

  const handleJoin = () => {
    sound.playSound('tap');
    if (roomCode.trim().length === 6) {
      onJoinRoom(roomCode.trim().toUpperCase());
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
        <Text style={styles.headerTitle}>Özel Oda</Text>
      </View>

      <View style={styles.content}>
        {/* Create room card */}
        <View style={styles.actionCard}>
          <View style={styles.iconCircle}>
            <PlusCircle size={28} color={THEME.colors.primaryLight} />
          </View>
          <Text style={styles.cardTitle}>Yeni Oda Oluştur</Text>
          <Text style={styles.cardSubtitle}>
            Kendi kurallarını belirle, arkadaşlarını oda kodu veya bağlantıyla davet et.
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              sound.playSound('tap');
              onCreateRoom();
            }}
          >
            <Text style={styles.buttonText}>Oda Oluştur</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>VEYA</Text>
          <View style={styles.line} />
        </View>

        {/* Join room card */}
        <View style={styles.actionCard}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
            <LogIn size={28} color={THEME.colors.secondary} />
          </View>
          <Text style={styles.cardTitle}>Mevcut Odaya Katıl</Text>
          <Text style={styles.cardSubtitle}>
            Arkadaşının paylaştığı 6 haneli oda kodunu girerek lobiye katıl.
          </Text>

          <TextInput
            style={styles.codeInput}
            placeholder="ODA KODU (ÖR: 8X4Y2Z)"
            placeholderTextColor={THEME.colors.textMuted}
            value={roomCode}
            onChangeText={(txt) => setRoomCode(txt.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
          />

          <TouchableOpacity
            style={[styles.joinButton, roomCode.length !== 6 && styles.buttonDisabled]}
            disabled={roomCode.length !== 6}
            onPress={handleJoin}
          >
            <Text style={styles.buttonText}>Odaya Katıl</Text>
          </TouchableOpacity>
        </View>
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
  content: {
    padding: THEME.spacing.lg,
  },
  actionCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  createButton: {
    width: '100%',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinButton: {
    width: '100%',
    backgroundColor: THEME.colors.secondary,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  codeInput: {
    width: '100%',
    backgroundColor: THEME.colors.backgroundSecondary,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 4,
    marginBottom: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: THEME.spacing.lg,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  dividerText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginHorizontal: 12,
  },
});
