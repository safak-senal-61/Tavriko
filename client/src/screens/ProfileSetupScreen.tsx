import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { Check, Sparkles } from 'lucide-react-native';

const PRESET_AVATARS = [
  { id: 'av1', seed: 'trivia_king', label: 'Şampiyon' },
  { id: 'av2', seed: 'astro_girl', label: 'Kozmik' },
  { id: 'av3', seed: 'cyber_owl', label: 'Bilge' },
  { id: 'av4', seed: 'speedy_fox', label: 'Atik' },
  { id: 'av5', seed: 'matrix_bot', label: 'Siber' },
  { id: 'av6', seed: 'neon_rider', label: 'Efsane' },
];

interface ProfileSetupProps {
  initialDisplayName: string;
  onSave: (displayName: string, avatarSeed: string) => void;
}

export const ProfileSetupScreen: React.FC<ProfileSetupProps> = ({ initialDisplayName, onSave }) => {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0].seed);

  const handleSave = () => {
    sound.playSound('tap');
    if (!displayName.trim()) return;
    onSave(displayName.trim(), selectedAvatar);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Sparkles size={24} color={THEME.colors.primaryLight} />
          <Text style={styles.title}>Profilini Özelleştir</Text>
          <Text style={styles.subtitle}>Arenada rakiplerine karşı tarzını yansıt</Text>
        </View>

        <Text style={styles.sectionLabel}>Avatar Seçimi</Text>
        <View style={styles.avatarGrid}>
          {PRESET_AVATARS.map((av) => {
            const isSelected = selectedAvatar === av.seed;
            return (
              <TouchableOpacity
                key={av.id}
                style={[styles.avatarBox, isSelected && styles.avatarBoxSelected]}
                onPress={() => {
                  sound.playSound('tap');
                  setSelectedAvatar(av.seed);
                }}
              >
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{av.label.charAt(0)}</Text>
                </View>
                <Text style={styles.avatarLabel}>{av.label}</Text>
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Check size={12} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.sectionLabel}>Görünen Adın</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Kullanıcı Adı"
            placeholderTextColor={THEME.colors.textMuted}
            maxLength={20}
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Arenaya Gir</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    padding: THEME.spacing.lg,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  header: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: THEME.spacing.xl,
  },
  avatarBox: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: THEME.colors.backgroundSecondary,
    borderRadius: THEME.radius.lg,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    position: 'relative',
  },
  avatarBoxSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.cardHover,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  avatarLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: THEME.spacing.xl,
  },
  input: {
    backgroundColor: THEME.colors.backgroundSecondary,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
