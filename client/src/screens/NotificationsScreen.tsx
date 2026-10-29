import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { ArrowLeft, Bell, Gift, Trophy, Swords } from 'lucide-react-native';

interface NotificationsScreenProps {
  onBack: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onBack }) => {
  const notifications = [
    {
      id: 'n1',
      title: 'Haftalık Sezon Ödülü!',
      desc: 'Lig sıralamanıza göre 250 Altın hesabınıza tanımlandı.',
      time: '10 dk önce',
      icon: Gift,
      color: THEME.colors.gold,
    },
    {
      id: 'n2',
      title: 'Meydan Okuma Daveti',
      desc: 'Zeynep Kaya seni 1v1 Coğrafya maçına davet etti.',
      time: '1 saat önce',
      icon: Swords,
      color: THEME.colors.primary,
    },
    {
      id: 'n3',
      title: 'Yeni Başarım Açıldı',
      desc: '"Hız Tutkunu" başarımını tamamladın.',
      time: 'Dün',
      icon: Trophy,
      color: THEME.colors.correct,
    },
  ];

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
        <Text style={styles.headerTitle}>Bildirimler</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {notifications.map((n) => {
          const Icon = n.icon;
          return (
            <View key={n.id} style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: `${n.color}22` }]}>
                <Icon size={20} color={n.color} />
              </View>
              <View style={styles.info}>
                <View style={styles.topRow}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.time}>{n.time}</Text>
                </View>
                <Text style={styles.desc}>{n.desc}</Text>
              </View>
            </View>
          );
        })}
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
  list: {
    padding: THEME.spacing.lg,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  time: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  desc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
});
