import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { DEFAULT_API_BASE } from '../config';
import { CharacterAvatar, TrophyIcon } from './TavrikoIcons';
import { sound } from '../services/soundService';

interface UserProfileModalProps {
  visible: boolean;
  userId: string | null;
  currentUserId?: string;
  onClose: () => void;
  apiBaseUrl?: string;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  userId,
  currentUserId,
  onClose,
  apiBaseUrl,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) {
      setProfile(null);
      setError(null);
      return;
    }

    const base = apiBaseUrl || DEFAULT_API_BASE;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`${base}/social/profile/${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Profil yüklenemedi');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setProfile(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Profil yüklenemedi');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, userId, apiBaseUrl]);

  if (!visible) return null;

  const isMe = userId === currentUserId;
  const stats = profile?.stats;
  const matches = stats?.matchesPlayed || 0;
  const wins = stats?.wins || 0;
  const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
  const correct = stats?.correctAnswers || 0;
  const wrong = stats?.wrongAnswers || 0;
  const totalAnswers = correct + wrong;
  const accuracy = totalAnswers > 0 ? Math.round((correct / totalAnswers) * 100) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>
                {isMe ? 'SENİN PROFİLİN' : 'OYUNCU PROFİLİ'}
              </Text>
              {isMe && <View style={styles.meTag}><Text style={styles.meTagText}>SEN</Text></View>}
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                sound.playSound('tap');
                onClose();
              }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#FFC43D" size="large" />
              <Text style={styles.loadingText}>Profil yükleniyor...</Text>
            </View>
          ) : error || !profile ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error || 'Profil bulunamadı'}</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Avatar & Identifiers */}
              <View style={styles.avatarWrap}>
                <View style={styles.avatarGlow}>
                  <CharacterAvatar
                    seed={profile.avatarUrl || profile.displayName}
                    size={80}
                  />
                </View>
                {profile.equippedBadge && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>⭐ {profile.equippedBadge}</Text>
                  </View>
                )}
                <Text style={styles.displayName}>{profile.displayName}</Text>
                {profile.username && (
                  <Text style={styles.username}>@{profile.username}</Text>
                )}
                <View style={styles.titlePill}>
                  <Text style={styles.titlePillText}>{profile.rankTitle || 'Acemi Kaşif'}</Text>
                </View>
              </View>

              {/* Rank & Level Bar */}
              <View style={styles.rankLevelRow}>
                <View style={styles.rankLevelItem}>
                  <Text style={styles.rankLevelLabel}>SEVİYE</Text>
                  <Text style={styles.rankLevelVal}>Lv. {profile.level || 1}</Text>
                </View>
                <View style={styles.rankLevelDivider} />
                <View style={styles.rankLevelItem}>
                  <Text style={styles.rankLevelLabel}>LİG PUANI</Text>
                  <View style={styles.trophyRow}>
                    <TrophyIcon size={16} />
                    <Text style={[styles.rankLevelVal, { color: '#FFC43D' }]}>
                      {profile.rankPoints || 1000}
                    </Text>
                  </View>
                </View>
                <View style={styles.rankLevelDivider} />
                <View style={styles.rankLevelItem}>
                  <Text style={styles.rankLevelLabel}>TOPLAM XP</Text>
                  <Text style={styles.rankLevelVal}>{profile.xp || 0}</Text>
                </View>
              </View>

              {/* 4 Key Stat Cards */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statVal}>{matches}</Text>
                  <Text style={styles.statLabel}>Toplam Maç</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statVal, { color: '#6FE3C1' }]}>{wins}</Text>
                  <Text style={styles.statLabel}>Galibiyet</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statVal, { color: '#FFC43D' }]}>%{winRate}</Text>
                  <Text style={styles.statLabel}>Kazanma Oranı</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statVal, { color: '#FF708F' }]}>{stats?.bestStreak || 0}</Text>
                  <Text style={styles.statLabel}>En İyi Seri</Text>
                </View>
              </View>

              {/* Accuracy Bar */}
              <View style={styles.accuracyCard}>
                <View style={styles.accuracyHeader}>
                  <Text style={styles.accuracyTitle}>Cevap İsabeti</Text>
                  <Text style={styles.accuracyPercent}>%{accuracy}</Text>
                </View>
                <View style={styles.accuracyTrack}>
                  <View
                    style={[
                      styles.accuracyFill,
                      { width: `${Math.min(100, Math.max(0, accuracy))}%` },
                    ]}
                  />
                </View>
                <View style={styles.accuracyFooter}>
                  <Text style={styles.accuracyDetail}>✓ {correct} Doğru</Text>
                  <Text style={styles.accuracyDetail}>✕ {wrong} Yanlış</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 2, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#1E0E3E',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.35)',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFC43D',
    letterSpacing: 1,
  },
  meTag: {
    backgroundColor: '#6B3CFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  meTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.bold,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  errorWrap: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  errorText: {
    color: '#FF5C77',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarGlow: {
    padding: 4,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    borderWidth: 2,
    borderColor: '#FFC43D',
    marginBottom: 8,
  },
  badgePill: {
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 6,
  },
  badgeText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  displayName: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
  },
  username: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: '#D9CDF5',
    marginTop: 2,
  },
  titlePill: {
    backgroundColor: 'rgba(107, 60, 255, 0.3)',
    borderWidth: 1,
    borderColor: '#6B3CFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  titlePillText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  rankLevelRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  rankLevelItem: {
    flex: 1,
    alignItems: 'center',
  },
  rankLevelLabel: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 2,
  },
  rankLevelVal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
  },
  rankLevelDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  trophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statVal: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#FFFFFF',
  },
  statLabel: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  accuracyCard: {
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  accuracyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  accuracyTitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  accuracyPercent: {
    color: '#6FE3C1',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
  },
  accuracyTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  accuracyFill: {
    height: '100%',
    backgroundColor: '#6FE3C1',
    borderRadius: 4,
  },
  accuracyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accuracyDetail: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
  },
});
