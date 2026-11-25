/**
 * NickPreviewModal — canlı nick önizlemesi.
 * Kullanıcı satın almadan / uygulamadan önce kendi nickinin profil, liderlik
 * tablosu, sohbet, maç ve arkadaş listesinde nasıl görüneceğini canlı görür.
 * Kalite seçici ile düşük donanım (Hafif) ve animasyon kapalı (Statik)
 * görünümleri de denenebilir. Gösterilen tüm nickler gerçek NickRenderer'dır.
 */
import React, { memo, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { getNickStyle, type NickOwnership } from '@trivia/shared';
import { THEME } from '../../theme/tokens';
import { CharacterAvatar } from '../TavrikoAvatars';
import { NickRenderer } from './NickRenderer';
import { NickRarityChip, NickOwnershipBadge } from './NickBadges';
import { NickPlate } from './NickPlate';
import { SKIA_AVAILABLE } from './NickSkiaLayer';
import type { NickQuality } from './nickQualityCore';
import { withAlpha } from './nickColor';

export interface NickPreviewModalProps {
  visible: boolean;
  styleId: string;
  /** Kullanıcının gerçek nicki */
  name?: string;
  seed?: string;
  level?: number;
  ownership?: NickOwnership;
  /** Ek bilgi satırı (ör. "45 Elmas · 1 saat") */
  priceLabel?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  onClose: () => void;
}

const QUALITY_OPTIONS: { id: NickQuality; label: string }[] = [
  { id: 'full', label: 'Tam' },
  { id: 'lite', label: 'Hafif' },
  { id: 'static', label: 'Statik' },
];

export const NickPreviewModal = memo(function NickPreviewModal({
  visible,
  styleId,
  name,
  seed,
  level,
  ownership,
  priceLabel,
  actionLabel,
  actionDisabled,
  onAction,
  onClose,
}: NickPreviewModalProps) {
  const def = getNickStyle(styleId);
  const [draft, setDraft] = useState(name || 'Oyuncu');
  const [quality, setQuality] = useState<NickQuality>(SKIA_AVAILABLE ? 'full' : 'lite');
  useEffect(() => {
    if (visible) setDraft(name || 'Oyuncu');
  }, [visible, name]);
  if (!def) return null;
  const nick = draft.trim() || name || 'Oyuncu';
  const qualities = SKIA_AVAILABLE ? QUALITY_OPTIONS : QUALITY_OPTIONS.filter((q) => q.id !== 'full');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Önizlemeyi kapat" />
        <Animated.View entering={ZoomIn.duration(240)} style={styles.sheet}>
          <LinearGradient colors={[def.palette.plate[0], '#120728']} style={StyleSheet.absoluteFill} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.topRow}>
              <NickRarityChip rarity={def.rarity} />
              {ownership && <NickOwnershipBadge state={ownership} />}
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Kapat">
                <Text style={styles.closeText}>Kapat</Text>
              </TouchableOpacity>
            </View>

            {/* Profil kahramanı */}
            <NickPlate styleId={def.styleId} radius={20} style={styles.hero}>
              <View style={[styles.heroAvatar, { borderColor: withAlpha(def.palette.glow, 0.8) }]}>
                <CharacterAvatar seed={seed} size={84} />
              </View>
              <NickRenderer
                styleId={def.styleId}
                text={nick}
                variant="hero"
                quality={quality}
                numberOfLines={1}
                style={styles.heroName}
              />
              {typeof level === 'number' && <Text style={styles.heroLevel}>Seviye {level}</Text>}
            </NickPlate>

            <Text style={styles.packName}>
              {def.icon} {def.name}
            </Text>
            <Text style={styles.packDesc}>{def.desc}</Text>
            {!!priceLabel && <Text style={styles.price}>{priceLabel}</Text>}

            {/* Kalite seçici */}
            <View style={styles.segment} accessibilityRole="tablist">
              {qualities.map((q) => (
                <TouchableOpacity
                  key={q.id}
                  onPress={() => setQuality(q.id)}
                  style={[styles.segBtn, quality === q.id && styles.segBtnOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: quality === q.id }}
                >
                  <Text style={[styles.segText, quality === q.id && styles.segTextOn]}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              value={draft}
              onChangeText={(v) => setDraft(v.slice(0, 20))}
              placeholder="Nickini dene"
              placeholderTextColor="rgba(217,205,245,0.45)"
              style={styles.input}
              maxLength={20}
              accessibilityLabel="Önizleme nicki"
            />

            <Animated.View entering={FadeIn.delay(120)} style={styles.contexts}>
              <Text style={styles.ctxTitle}>Liderlik tablosu</Text>
              <View style={styles.lbRow}>
                <Text style={styles.lbRank}>1</Text>
                <CharacterAvatar seed={seed} size={30} />
                <NickRenderer styleId={def.styleId} text={nick} quality={quality} numberOfLines={1} style={styles.lbName} />
                <Text style={styles.lbScore}>12.480</Text>
              </View>

              <Text style={styles.ctxTitle}>Maç ekranı</Text>
              <View style={styles.vsRow}>
                <View style={styles.vsSide}>
                  <CharacterAvatar seed={seed} size={40} />
                  <NickRenderer styleId={def.styleId} text={nick} quality={quality} numberOfLines={1} style={styles.vsName} />
                </View>
                <Text style={styles.vs}>VS</Text>
                <View style={styles.vsSide}>
                  <CharacterAvatar seed="rakip" size={40} />
                  <Text style={styles.vsName} numberOfLines={1}>Rakip</Text>
                </View>
              </View>

              <Text style={styles.ctxTitle}>Sohbet</Text>
              <View style={styles.chat}>
                <NickRenderer styleId={def.styleId} text={nick} quality={quality} numberOfLines={1} style={styles.chatName} />
                <Text style={styles.chatMsg}>Hazır mısınız? Bu tur benim!</Text>
              </View>

              <Text style={styles.ctxTitle}>Arkadaş listesi</Text>
              <View style={styles.friendRow}>
                <CharacterAvatar seed={seed} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <NickRenderer styleId={def.styleId} text={nick} quality={quality} numberOfLines={1} style={styles.friendName} />
                  <Text style={styles.friendSub}>Çevrimiçi</Text>
                </View>
              </View>
            </Animated.View>

            {!!actionLabel && onAction && (
              <TouchableOpacity
                onPress={onAction}
                disabled={actionDisabled}
                style={[styles.action, actionDisabled && { opacity: 0.5 }]}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
              >
                <Text style={styles.actionText}>{actionLabel}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,2,14,0.82)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  content: { padding: 18, paddingBottom: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  close: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  closeText: { color: '#F5F0FF', fontFamily: THEME.fonts.extraBold, fontSize: 12 },
  hero: { paddingVertical: 22, paddingHorizontal: 16 },
  heroAvatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heroName: { marginTop: 14, fontSize: 30, fontFamily: THEME.fonts.black, textAlign: 'center', maxWidth: 320 },
  heroLevel: { marginTop: 4, color: 'rgba(226,218,255,0.7)', fontFamily: THEME.fonts.bold, fontSize: 12 },
  packName: { marginTop: 16, color: '#FFFFFF', fontFamily: THEME.fonts.black, fontSize: 18 },
  packDesc: { marginTop: 4, color: 'rgba(226,218,255,0.78)', fontFamily: THEME.fonts.bold, fontSize: 13, lineHeight: 18 },
  price: { marginTop: 6, color: '#FFD86B', fontFamily: THEME.fonts.extraBold, fontSize: 13 },
  segment: { flexDirection: 'row', marginTop: 14, backgroundColor: 'rgba(10,4,24,0.6)', borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  segBtnOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  segText: { color: 'rgba(226,218,255,0.6)', fontFamily: THEME.fonts.extraBold, fontSize: 12 },
  segTextOn: { color: '#FFFFFF' },
  input: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(10,4,24,0.55)',
    color: '#FFFFFF',
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  contexts: { marginTop: 6 },
  ctxTitle: { marginTop: 12, marginBottom: 6, color: 'rgba(226,218,255,0.55)', fontFamily: THEME.fonts.extraBold, fontSize: 11, letterSpacing: 0.6 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)' },
  lbRank: { width: 20, color: '#FFD86B', fontFamily: THEME.fonts.black, fontSize: 15, textAlign: 'center' },
  lbName: { flex: 1, fontSize: 15, fontFamily: THEME.fonts.extraBold, color: '#FFFFFF' },
  lbScore: { color: 'rgba(226,218,255,0.85)', fontFamily: THEME.fonts.extraBold, fontSize: 13 },
  vsRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)' },
  vsSide: { flex: 1, alignItems: 'center', gap: 6, minWidth: 0 },
  vsName: { fontSize: 16, fontFamily: THEME.fonts.black, color: '#FFFFFF', maxWidth: 140 },
  vs: { color: '#FF6BC4', fontFamily: THEME.fonts.black, fontSize: 16, marginHorizontal: 8 },
  chat: { padding: 10, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'flex-start', maxWidth: '90%' },
  chatName: { fontSize: 12, fontFamily: THEME.fonts.black, color: '#FFFFFF' },
  chatMsg: { marginTop: 2, color: '#F5F0FF', fontFamily: THEME.fonts.bold, fontSize: 13 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)' },
  friendName: { fontSize: 14, fontFamily: THEME.fonts.extraBold, color: '#FFFFFF' },
  friendSub: { color: '#86EFAC', fontFamily: THEME.fonts.bold, fontSize: 11 },
  action: { marginTop: 18, backgroundColor: '#FFC43D', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  actionText: { color: '#2A1500', fontFamily: THEME.fonts.black, fontSize: 16 },
});
