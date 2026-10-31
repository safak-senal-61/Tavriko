import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CharacterAvatar,
  ChestIcon,
  TrophyIcon,
  ModeSquircleIcon,
} from '../components/TavrikoIcons';
interface NotificationsScreenProps {
  user?: UserProfile;
  onBack: () => void;
  onAcceptDuel?: () => void;
}
export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  user,
  onBack,
  onAcceptDuel,
}) => {
  const [inviteHandled, setInviteHandled] = useState<'accepted' | 'declined' | null>(null);
  const notifications = user?.notifications || [];
  const renderNotifIcon = (type: string) => {
    if (type === 'duel') return <CharacterAvatar seed="av3" size={40} />;
    if (type === 'reward') return <ChestIcon size={38} />;
    if (type === 'league') return <TrophyIcon size={38} />;
    return <ModeSquircleIcon mode="notification" size={38} />;
  };
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>BİLDİRİMLER</Text>
        {/* Live Duel Invite */}
        <View style={styles.notifCard}>
          <CharacterAvatar seed="av2" size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitle}>Canlı Düello Daveti Hazır</Text>
            <Text style={styles.notifSub}>Bilim & Genel Kültür · 5 soru</Text>
            {inviteHandled === null ? (
              <View style={styles.actionsRow}>
                <Button3D
                  title="Kabul"
                  variant="mint"
                  onPress={() => {
                    setInviteHandled('accepted');
                    if (onAcceptDuel) onAcceptDuel();
                  }}
                  style={styles.smallBtn}
                  textStyle={{ fontSize: 13 }}
                />
                <Button3D
                  title="Reddet"
                  variant="red"
                  onPress={() => setInviteHandled('declined')}
                  style={styles.smallBtn}
                  textStyle={{ fontSize: 13 }}
                />
              </View>
            ) : (
              <Text style={[styles.notifSub, { marginTop: 6, color: '#7CFC8A' }]}>
                {inviteHandled === 'accepted' ? 'Davet kabul edildi!' : 'Davet reddedildi.'}
              </Text>
            )}
          </View>
          <Text style={styles.timeText}>Şimdi</Text>
        </View>
        {/* Database Notifications */}
        {notifications.map((n) => (
          <View key={n.id} style={styles.notifCard}>
            {renderNotifIcon(n.type)}
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              <Text style={styles.notifSub}>{n.sub}</Text>
            </View>
            <Text style={styles.timeText}>{n.timeText}</Text>
          </View>
        ))}
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
    marginBottom: 14,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  notifTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  notifSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  smallBtn: {
    minHeight: 36,
    paddingHorizontal: 18,
  },
  timeText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
});