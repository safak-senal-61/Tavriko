import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoSecondaryBottomNav,
  SecondaryNavTab,
  TavrikoProgressBar,
  ChestIcon,
  TrophyIcon,
  GiftIcon,
  BadgeShieldIcon,
  GemIcon,
} from '../components/TavrikoIcons';
interface EventsScreenProps {
  user?: UserProfile;
  onBack?: () => void;
  onNavigateSecondary?: (tab: SecondaryNavTab) => void;
  onNotifications?: () => void;
  onProfile?: () => void;
  onStartEvent?: () => void;
}
export const EventsScreen: React.FC<EventsScreenProps> = ({
  user,
  onBack,
  onNavigateSecondary,
  onNotifications,
  onProfile,
  onStartEvent,
}) => {
  const matchesPlayed = user?.stats?.totalMatches ?? 0;
  const matchesWon = user?.stats?.wins ?? 0;
  const rankPoints = user?.rankPoints ?? 1000;
  const handleEventPress = () => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    if (onStartEvent) onStartEvent();
  };
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType={onBack ? 'back' : 'bell'}
        onLeftPress={onBack || onNotifications}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
        onAvatarPress={onProfile}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>ETKİNLİKLER</Text>
        <Text style={styles.subtitle}>Canlı Görev ve Turnuvalar (Veritabanı)</Text>
        {/* Treasure Hunt Hero Card Matching WhatsApp Image 2 */}
        <TouchableOpacity
          style={styles.heroCard}
          activeOpacity={0.88}
          onPress={handleEventPress}
        >
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>AKTİF TURNUVA</Text>
          </View>
          <Text style={styles.heroTitle}>HAZİNE AVI</Text>
          <TavrikoProgressBar
            progress={Math.min(100, Math.round((matchesPlayed / 10) * 100))}
            height={10}
            style={{ marginVertical: 8 }}
          />
          <Text style={styles.heroSub}>
            {matchesPlayed} / 10 maç tamamlandı (Veritabanı)
          </Text>
          <View style={styles.heroIconWrap}>
            <ChestIcon size={56} />
          </View>
        </TouchableOpacity>
        {/* Event Cards List */}
        <View style={styles.listWrap}>
          {/* Hafta Sonu Kupası */}
          <TouchableOpacity
            style={styles.eventCard}
            onPress={handleEventPress}
            activeOpacity={0.85}
          >
            <View style={styles.eventIconCircle}>
              <TrophyIcon size={38} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>Hafta Sonu Kupası</Text>
              <Text style={styles.eventSub}>
                Hedef: 1.500 Lig Puanı · Şu an: {rankPoints}
              </Text>
              <TavrikoProgressBar
                progress={Math.min(100, Math.round((rankPoints / 1500) * 100))}
                height={8}
                style={{ marginTop: 6 }}
              />
            </View>
            <View style={styles.rewardPill}>
              <ChestIcon size={28} />
            </View>
          </TouchableOpacity>
          {/* Şanslı Çekiliş */}
          <TouchableOpacity
            style={styles.eventCard}
            onPress={handleEventPress}
            activeOpacity={0.85}
          >
            <View style={styles.eventIconCircle}>
              <GiftIcon size={38} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>Şanslı Çekiliş</Text>
              <Text style={styles.eventSub}>
                3 maç oyna ({Math.min(3, matchesPlayed)}/3)
              </Text>
              <TavrikoProgressBar
                progress={Math.min(100, Math.round((matchesPlayed / 3) * 100))}
                height={8}
                style={{ marginTop: 6 }}
              />
            </View>
            <View style={styles.rewardPill}>
              <GemIcon size={26} />
            </View>
          </TouchableOpacity>
          {/* Düello Ustası */}
          <TouchableOpacity
            style={styles.eventCard}
            onPress={handleEventPress}
            activeOpacity={0.85}
          >
            <View style={styles.eventIconCircle}>
              <BadgeShieldIcon size={38} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>Düello Ustası</Text>
              <Text style={styles.eventSub}>
                5 düello kazan ({Math.min(5, matchesWon)}/5)
              </Text>
              <TavrikoProgressBar
                progress={Math.min(100, Math.round((matchesWon / 5) * 100))}
                height={8}
                style={{ marginTop: 6 }}
              />
            </View>
            <View style={styles.rewardPill}>
              <ChestIcon size={28} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <TavrikoSecondaryBottomNav
        activeTab="events"
        onSelectTab={(tab) => onNavigateSecondary && onNavigateSecondary(tab)}
      />
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 14,
  },
  heroCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#7A3FE0',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.45)',
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#6B3CFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  heroBadge: {
    backgroundColor: '#FFC43D',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  heroBadgeText: {
    color: '#2A1558',
    fontSize: 10,
    fontFamily: THEME.fonts.display,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroSub: {
    color: '#F0E6FF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },
  heroIconWrap: {
    position: 'absolute',
    right: 16,
    top: 20,
  },
  listWrap: {
    gap: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 12, 62, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  eventIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 16,
    color: '#FFFFFF',
  },
  eventSub: {
    color: '#D9CDF5',
    fontSize: 11.5,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },
  rewardPill: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});