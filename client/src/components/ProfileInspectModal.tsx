import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Reanimated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { calculateLevelFromXp, UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DISCOVERY_IMG } from '../components/DiscoveryArtwork';
import { GradientFill } from '../components/TavrikoGradient';
import { CharacterAvatar, Button3D } from '../components/TavrikoIcons';

export interface PublicProfileCard {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  friendCode?: string;
  xp?: number;
  stats?: any;
  settings?: { equippedTitle?: string };
  online?: boolean;
  isFriend?: boolean;
}

interface ProfileInspectModalProps {
  visible: boolean;
  profile: PublicProfileCard | null;
  loading?: boolean;
  isSelf?: boolean;
  currentUserId?: string | null;
  onClose: () => void;
  onChallenge?: (p: PublicProfileCard) => void;
  onAddFriend?: (p: PublicProfileCard) => void;
  onRemoveFriend?: (p: PublicProfileCard) => void;
  removingFriend?: boolean;
  confirmRemoveId?: string | null;
  setConfirmRemoveId?: (id: string | null) => void;
}

/**
 * Herkese açık oyuncu profilini gösteren modern, animasyonlu modal.
 * Hem FriendsScreen hem de paylaşılan profil bağlantıları (?profil=KOD) tarafından kullanılır.
 */
export const ProfileInspectModal: React.FC<ProfileInspectModalProps> = ({
  visible,
  profile,
  loading = false,
  currentUserId,
  onClose,
  onChallenge,
  onAddFriend,
  onRemoveFriend,
  removingFriend = false,
  confirmRemoveId = null,
  setConfirmRemoveId,
}) => {
  if (!visible) return null;
  const isSelf = !!(currentUserId && profile && currentUserId === profile.id);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Reanimated.Image
            entering={FadeIn.duration(200)}
            source={DISCOVERY_IMG.arena}
            style={styles.heroBg}
            resizeMode="cover"
          />
          <GradientFill colors={['#1E0E4500', '#1E0E45CC', '#1E0E45']} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Profili kapat"
            style={styles.closeBtn}
            onPress={() => { sound.playSound('tap'); onClose(); }}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.eyebrow}>OYUNCU PROFİLİ</Text>

          {!profile ? (
            <ActivityIndicator color="#FFC43D" size="large" style={{ marginTop: 60, marginBottom: 60 }} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', paddingBottom: 8 }}
            >
              {/* Avatar + çevrimiçi durumu */}
              <Reanimated.View entering={ZoomIn.springify().damping(16)} style={styles.avatarWrap}>
                <CharacterAvatar seed={profile.avatarUrl || profile.displayName || 'oyuncu'} size={78} />
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: profile.online ? '#123927' : '#2C234B',
                      borderColor: profile.online ? '#3FD08A' : '#736B92',
                    },
                  ]}
                >
                  <Text style={[styles.statusText, { color: profile.online ? '#3FD08A' : '#D9CDF5' }]}>
                    {profile.online ? '● ÇEVRİMİÇİ' : '○ ÇEVRİMDIŞI'}
                  </Text>
                </View>
              </Reanimated.View>

              <Reanimated.Text entering={FadeInDown.delay(60)} style={styles.displayName} numberOfLines={1}>
                {profile.displayName || 'Oyuncu'}
              </Reanimated.Text>
              <Reanimated.Text entering={FadeInDown.delay(90)} style={styles.username}>
                @{profile.username || 'oyuncu'}
                {profile.friendCode ? ` · Kod: ${profile.friendCode}` : ''}
              </Reanimated.Text>

              {/* Seviye & Unvan */}
              {(() => {
                const xp = Number(profile.xp ?? 0);
                const prog = calculateLevelFromXp(xp);
                const title = profile.settings?.equippedTitle || prog.rankTitle;
                return (
                  <Reanimated.View entering={FadeInDown.delay(120)} style={styles.levelPill}>
                    <Text style={styles.levelText}>
                      Seviye {prog.level} · {title}
                    </Text>
                  </Reanimated.View>
                );
              })()}

              {/* XP ilerlemesi */}
              {(() => {
                const xp = Number(profile.xp ?? 0);
                const prog = calculateLevelFromXp(xp);
                return (
                  <Reanimated.View entering={FadeInDown.delay(150)} style={styles.xpBox}>
                    <View style={styles.xpHeader}>
                      <Text style={styles.xpLabel}>SEVİYE İLERLEMESİ</Text>
                      <Text style={styles.xpValue}>
                        {prog.currentLevelXp} / {prog.nextLevelXpRequired} XP (%{prog.progressPct})
                      </Text>
                    </View>
                    <View style={styles.xpTrack}>
                      <View style={[styles.xpBar, { width: `${Math.min(100, prog.progressPct)}%` }]} />
                    </View>
                  </Reanimated.View>
                );
              })()}

              {/* İstatistik ızgarası */}
              {(() => {
                const s = profile.stats || {};
                const rawMatches = Math.max(0, Number(s.totalMatches ?? 0));
                const rawWins = Math.max(0, Number(s.wins ?? 0));
                const safeWins = Math.min(rawMatches, rawWins);
                const rawTotalAns = Math.max(0, Number(s.totalAnswers ?? rawMatches * 5));
                const safeTotalAnswers =
                  rawMatches === 0 ? 0 : Math.min(Math.max(rawMatches * 5, rawTotalAns), rawMatches * 10);
                const rawCorrect = Math.max(0, Number(s.correctAnswers ?? 0));
                const safeCorrect = rawMatches === 0 ? 0 : Math.min(safeTotalAnswers, rawCorrect);
                const accuracyPct =
                  safeTotalAnswers > 0 ? Math.min(100, Math.round((safeCorrect / safeTotalAnswers) * 100)) : 0;
                const safeStreak = Math.min(safeCorrect, Math.max(0, Number(s.bestStreak ?? 0)));

                const statCells: Array<{ val: string; lbl: string; color: string }> = [
                  { val: String(rawMatches), lbl: 'Toplam Maç', color: '#FFFFFF' },
                  { val: String(safeWins), lbl: 'Galibiyet', color: '#3FD08A' },
                  { val: `${safeCorrect}/${safeTotalAnswers}`, lbl: `Doğru (%${accuracyPct})`, color: '#FFC43D' },
                  { val: `${safeStreak}x`, lbl: 'En İyi Seri', color: '#38BDF8' },
                ];

                return (
                  <Reanimated.View entering={FadeInDown.delay(180)} style={styles.statsGrid}>
                    {statCells.map((c) => (
                      <View key={c.lbl} style={styles.statCard}>
                        <Text style={[styles.statVal, { color: c.color }]}>{c.val}</Text>
                        <Text style={styles.statLbl}>{c.lbl}</Text>
                      </View>
                    ))}
                  </Reanimated.View>
                );
              })()}

              {/* Aksiyonlar */}
              {!isSelf && (
                <Reanimated.View entering={FadeInDown.delay(210)} style={{ width: '100%', gap: 10, marginTop: 12 }}>
                  {onChallenge && (
                    <Button3D
                      title="1V1 DÜELLOYA DAVET ET"
                      variant="gold"
                      onPress={() => { sound.playSound('tap'); onChallenge(profile); }}
                      style={{ width: '100%' }}
                      textStyle={{ fontSize: 13 }}
                    />
                  )}
                  {onAddFriend && !profile.isFriend && (
                    <Button3D
                      title="+ ARKADAŞ OLARAK EKLE"
                      variant="mint"
                      onPress={() => { sound.playSound('tap'); onAddFriend(profile); }}
                      style={{ width: '100%' }}
                      textStyle={{ fontSize: 13 }}
                    />
                  )}
                  {onRemoveFriend && profile.isFriend && (
                    confirmRemoveId === profile.id ? (
                      <View style={styles.removeConfirmBox}>
                        <Text style={styles.removeConfirmText}>
                          {profile.displayName} arkadaş listenden çıkarılsın mı?
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <Button3D
                            title={removingFriend ? 'ÇIKARILIYOR...' : 'EVET, ÇIKAR'}
                            variant="red"
                            disabled={removingFriend}
                            onPress={() => onRemoveFriend(profile)}
                            style={{ flex: 1, minHeight: 38 }}
                            textStyle={{ fontSize: 12 }}
                          />
                          <Button3D
                            title="VAZGEÇ"
                            variant="purple"
                            disabled={removingFriend}
                            onPress={() => setConfirmRemoveId?.(null)}
                            style={{ flex: 1, minHeight: 38 }}
                            textStyle={{ fontSize: 12 }}
                          />
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.removeOutlineBtn}
                        activeOpacity={0.82}
                        onPress={() => { sound.playSound('tap'); setConfirmRemoveId?.(profile.id); }}
                      >
                        <Text style={styles.removeOutlineText}>Arkadaşlıktan Çıkar</Text>
                      </TouchableOpacity>
                    )
                  )}
                </Reanimated.View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 3, 20, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: '#1E0E45',
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255, 196, 61, 0.55)',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 160,
    opacity: 0.35,
  },
  closeBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  closeText: { color: '#FFFFFF', fontSize: 16, fontFamily: THEME.fonts.bold },
  eyebrow: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFC43D',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  statusBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E0E45',
  },
  statusText: { color: '#FFFFFF', fontSize: 9, fontFamily: THEME.fonts.extraBold },
  displayName: {
    fontFamily: THEME.fonts.display,
    fontSize: 23,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
  },
  username: {
    fontSize: 12,
    color: '#D9CDF5',
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  levelPill: {
    backgroundColor: 'rgba(107, 60, 255, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.4)',
    marginBottom: 12,
  },
  levelText: { color: '#FFC43D', fontSize: 13, fontFamily: THEME.fonts.extraBold },
  xpBox: {
    width: '100%',
    backgroundColor: 'rgba(8, 3, 20, 0.65)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 14,
  },
  xpHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpLabel: {
    color: '#A992E2',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.8,
  },
  xpValue: { color: '#FFFFFF', fontSize: 11, fontFamily: THEME.fonts.extraBold },
  xpTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpBar: { height: '100%', backgroundColor: '#FFC43D', borderRadius: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 6 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  statVal: { fontFamily: THEME.fonts.display, fontSize: 18, color: '#FFFFFF' },
  statLbl: { color: '#D9CDF5', fontSize: 11, fontFamily: THEME.fonts.bold, marginTop: 2 },
  removeConfirmBox: {
    width: '100%',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 92, 119, 0.12)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 92, 119, 0.55)',
  },
  removeConfirmText: {
    color: '#FFD1DA',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  removeOutlineBtn: {
    width: '100%',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 92, 119, 0.5)',
    backgroundColor: 'rgba(255, 92, 119, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeOutlineText: { color: '#FF8598', fontSize: 12.5, fontFamily: THEME.fonts.extraBold },
});
