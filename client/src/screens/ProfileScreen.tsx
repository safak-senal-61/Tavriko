import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { UserProfile, calculateLevelFromXp } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  TavrikoProgressBar,
  CharacterAvatar,
  TrophyIcon,
  SpeedBoltIcon,
  StreakFlameIcon,
  BadgeShieldIcon,
  CrownIcon,
  ChestIcon,
  ModeSquircleIcon,
} from '../components/TavrikoIcons';
let ImagePickerModule: any = null;
try {
  ImagePickerModule = require('expo-image-picker');
} catch {
  ImagePickerModule = null;
}
interface ProfileScreenProps {
  user: UserProfile;
  onBack: () => void;
  onEditProfile: () => void;
  onUpdateAvatar?: (uri: string) => void;
  onNavigateTab?: (tab: 'play' | 'explore' | 'leaders' | 'friends' | 'profile') => void;
  onSettings?: () => void;
}
export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onBack,
  onEditProfile,
  onUpdateAvatar,
  onNavigateTab,
  onSettings,
}) => {
  const handlePickPhotoDirect = async () => {
    sound.playSound('tap');
    if (onUpdateAvatar && ImagePickerModule?.launchImageLibraryAsync) {
      try {
        const res = await ImagePickerModule.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.75,
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          onUpdateAvatar(res.assets[0].uri);
          sound.playSound('reward');
          return;
        }
      } catch {
        // Fallback to profile edit screen
      }
    }
    onEditProfile();
  };
  const totalMatches = user.stats?.totalMatches || 0;
  const wins = user.stats?.wins || 0;
  const correctAnswers = user.stats?.correctAnswers || 0;
  const totalAnswers = user.stats?.totalAnswers || 0;
  const winRate =
    totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const accuracyRate =
    totalAnswers > 0
      ? Math.round((correctAnswers / totalAnswers) * 100)
      : 0;
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user.coins ?? 0}
        gems={user.gems ?? 0}
        avatarSeed={user.avatarUrl || user.displayName}
        onAvatarPress={onEditProfile}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Center Avatar with Gold Ring */}
        <View style={styles.avatarHeader}>
          <TouchableOpacity
            style={styles.goldAvatarRing}
            onPress={handlePickPhotoDirect}
            activeOpacity={0.85}
          >
            <CharacterAvatar
              seed={user.avatarUrl || user.displayName}
              size={84}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editPhotoPill}
            onPress={onEditProfile}
            activeOpacity={0.85}
          >
            <Text style={styles.editPhotoPillText}>
              Profili & Fotoğrafı Düzenle
            </Text>
          </TouchableOpacity>
          <Text style={styles.displayName}>
            {user.fullName || user.displayName}
          </Text>
          {(() => {
            const prog = calculateLevelFromXp(user.xp ?? 0);
            return (
              <Text style={styles.levelSub}>
                @{user.username} · Seviye {prog.level} ({prog.currentLevelXp} / {prog.nextLevelXpRequired} XP) · {prog.rankTitle}
              </Text>
            );
          })()}
          {user.bio ? <Text style={styles.bioText}>"{user.bio}"</Text> : null}
        </View>
        {/* Real Database Statistics Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>%{winRate}</Text>
            <Text style={styles.statLabel}>Kazanma ({wins}/{totalMatches})</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>%{accuracyRate}</Text>
            <Text style={styles.statLabel}>
              İsabet ({correctAnswers}/{totalAnswers})
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{user.stats?.bestStreak || 0}</Text>
            <Text style={styles.statLabel}>En iyi seri</Text>
          </View>
        </View>
        {/* Supabase User Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.detailsHeaderRow}>
            <Text style={styles.sectionTitle}>Hesap & Kişisel Bilgiler</Text>
            <Text style={styles.completionBadge}>
              Profil %{user.profileCompletionPct || 85}
            </Text>
          </View>
          <TavrikoProgressBar
            progress={user.profileCompletionPct || 85}
            height={8}
            style={{ marginBottom: 12 }}
          />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kullanıcı Adı</Text>
            <Text style={styles.infoVal}>@{user.username}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ad Soyad</Text>
            <Text style={styles.infoVal}>
              {user.fullName || user.displayName}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>E-posta Adresi</Text>
            <Text style={styles.infoVal}>
              {user.email || `${user.username}@tavriko.app`}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ülke</Text>
            <Text style={styles.infoVal}>
              {user.countryName || 'Türkiye'} ({user.countryCode || 'TR'})
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Telefon</Text>
            <Text style={styles.infoVal}>
              {user.phone || 'Belirtilmedi'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Doğum Tarihi</Text>
            <Text style={styles.infoVal}>
              {user.birthDate || 'Belirtilmedi'}
            </Text>
          </View>
          {user.gender ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Cinsiyet</Text>
              <Text style={styles.infoVal}>{user.gender}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Başarılar</Text>
          {onSettings && (
            <TouchableOpacity
              style={styles.settingsChip}
              onPress={() => {
                sound.playSound('tap');
                onSettings();
              }}
            >
              <ModeSquircleIcon mode="settings" size={22} />
              <Text style={styles.settingsChipText}>Ayarlar</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* 3x2 Achievements Grid */}
        <View style={styles.badgeGrid}>
          <View style={[styles.badgeCard, wins < 1 && { opacity: 0.45 }]}>
            <TrophyIcon size={38} />
            <Text style={styles.badgeName}>İlk Zafer</Text>
          </View>
          <View style={styles.badgeCard}>
            <SpeedBoltIcon size={38} />
            <Text style={styles.badgeName}>Hız Ustası</Text>
          </View>
          <View
            style={[
              styles.badgeCard,
              (user.stats?.bestStreak || 0) < 3 && { opacity: 0.45 },
            ]}
          >
            <StreakFlameIcon size={38} />
            <Text style={styles.badgeName}>Seri Kralı</Text>
          </View>
          <View
            style={[styles.badgeCard, correctAnswers < 10 && { opacity: 0.45 }]}
          >
            <BadgeShieldIcon size={38} />
            <Text style={styles.badgeName}>100 Doğru</Text>
          </View>
          <View
            style={[styles.badgeCard, (user.level || 1) < 5 && { opacity: 0.45 }]}
          >
            <CrownIcon size={38} />
            <Text style={styles.badgeName}>Uzman</Text>
          </View>
          <View style={[styles.badgeCard, { opacity: 0.45 }]}>
            <ChestIcon size={38} />
            <Text style={styles.badgeName}>Koleksiyoncu</Text>
          </View>
        </View>
      </ScrollView>
      <TavrikoBottomNav
        activeTab="profile"
        onSelectTab={(tab) => {
          if (tab === 'play') onBack();
          else if (onNavigateTab) onNavigateTab(tab);
        }}
      />
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
  },
  avatarHeader: {
    alignItems: 'center',
    marginTop: 10,
  },
  goldAvatarRing: {
    padding: 4,
    borderRadius: 50,
    backgroundColor: '#FFB21E',
  },
  editPhotoPill: {
    marginTop: 8,
    backgroundColor: 'rgba(107, 60, 255, 0.35)',
    borderWidth: 1,
    borderColor: '#FFC43D',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  editPhotoPillText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  displayName: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
    color: '#FFFFFF',
    marginTop: 6,
  },
  levelSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  bioText: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.body,
    marginTop: 4,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 14,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
  },
  statLabel: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  completionBadge: {
    color: '#7CFC8A',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoLabel: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  infoVal: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFFFFF',
  },
  settingsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  settingsChipText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  badgeCard: {
    width: '31.5%',
    height: 90,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  badgeName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
});