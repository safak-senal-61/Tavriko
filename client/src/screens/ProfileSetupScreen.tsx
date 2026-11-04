import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight, ZoomIn } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { compressAvatarImageAsync } from '../utils/avatarImage';
import {
  TavrikoScreen,
  Button3D,
  CharacterAvatar,
  AVATAR_PRESETS,
  AvatarPreset,
} from '../components/TavrikoIcons';

let ImagePickerModule: any = null;
try {
  ImagePickerModule = require('expo-image-picker');
} catch {
  ImagePickerModule = null;
}

const RARITY_ORDER: Record<string, number> = { Efsanevi: 0, Epik: 1, Nadir: 2 };
const SORTED_AVATARS: Array<AvatarPreset & { origIdx: number }> = AVATAR_PRESETS.map((preset, origIdx) => ({
  ...preset,
  origIdx,
})).sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9));

const RARITY_COLORS: Record<string, { border: string; glow: string; text: string; bg: string }> = {
  Efsanevi: { border: '#FFC43D', glow: 'rgba(255, 196, 61, 0.45)', text: '#3B1500', bg: '#FFC43D' },
  Epik: { border: '#A855F7', glow: 'rgba(168, 85, 247, 0.45)', text: '#FFFFFF', bg: '#7E22CE' },
  Nadir: { border: '#38BDF8', glow: 'rgba(56, 189, 248, 0.45)', text: '#FFFFFF', bg: '#0284C7' },
};

interface ProfileSetupScreenProps {
  initialDisplayName?: string;
  initialAvatarUrl?: string;
  onSave: (displayName: string, avatarSeedOrUri: string) => void;
  onBack?: () => void;
}

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  initialDisplayName = 'DenizPro',
  initialAvatarUrl,
  onSave,
  onBack,
}) => {
  const [displayName, setDisplayName] = useState(
    initialDisplayName === 'Misafir Oyuncu' ? 'DenizPro' : initialDisplayName
  );

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialAvatarUrl) {
      const clean = initialAvatarUrl.toLowerCase().trim();
      const found = AVATAR_PRESETS.find((p) => {
        if (p.id === clean) return true;
        const digits = clean.replace(/^av_?/, '');
        if (/^\d+$/.test(digits) && p.id === `av_${digits}`) return true;
        return clean.includes(p.name.toLowerCase());
      });
      if (found) return found.id;
    }
    return 'av_1'; // Baykuş default
  });

  const [customPhotoUri, setCustomPhotoUri] = useState<string | null>(
    initialAvatarUrl &&
      !initialAvatarUrl.includes('dicebear.com') &&
      !initialAvatarUrl.startsWith('av') &&
      (initialAvatarUrl.startsWith('data:') ||
        initialAvatarUrl.startsWith('http') ||
        initialAvatarUrl.startsWith('blob:') ||
        initialAvatarUrl.startsWith('file:'))
      ? initialAvatarUrl
      : null
  );

  const [rarityFilter, setRarityFilter] = useState<'all' | 'Efsanevi' | 'Epik' | 'Nadir'>('all');
  const scrollRef = useRef<ScrollView>(null);

  const filteredAvatars = useMemo(() => {
    if (rarityFilter === 'all') return SORTED_AVATARS;
    return SORTED_AVATARS.filter((a) => a.rarity === rarityFilter);
  }, [rarityFilter]);

  const activePreset = useMemo(() => {
    return AVATAR_PRESETS.find((p) => p.id === selectedId) || AVATAR_PRESETS[1];
  }, [selectedId]);

  const finalAvatarValue =
    customPhotoUri ||
    AVATAR_PRESETS.find((p) => p.id === selectedId)?.id ||
    'av_1';

  const handlePickGalleryPhoto = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('light');

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
              const base64Uri = ev.target?.result as string;
              if (base64Uri) {
                const compressed = await compressAvatarImageAsync(base64Uri);
                setCustomPhotoUri(compressed);
                sound.playSound('reward');
                sound.triggerHaptic('success');
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
        return;
      } catch (webErr) {
        console.warn('Web file picker error:', webErr);
      }
    }

    if (ImagePickerModule?.launchImageLibraryAsync) {
      try {
        const res = await ImagePickerModule.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
          base64: true,
        } as any);
        if (!res.canceled && res.assets?.length) {
          const asset = res.assets[0];
          const rawUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
          const compressed = await compressAvatarImageAsync(rawUri);
          setCustomPhotoUri(compressed);
          sound.playSound('reward');
          sound.triggerHaptic('success');
        }
      } catch {}
    }
  };

  const handleSelectPreset = (preset: AvatarPreset & { origIdx: number }) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setCustomPhotoUri(null);
    setSelectedId(preset.id);
  };

  const activeRarityColor = customPhotoUri
    ? RARITY_COLORS.Efsanevi
    : RARITY_COLORS[activePreset.rarity] || RARITY_COLORS.Epik;

  return (
    <TavrikoScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          {onBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                sound.playSound('tap');
                onBack();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Karakterini Seç</Text>
            <Text style={styles.subtitle}>Soldan sağa kaydırarak favori avatarını belirle</Text>
          </View>
        </View>

        {/* Hero Showcase Card */}
        <Animated.View
          entering={ZoomIn.duration(350).springify()}
          key={finalAvatarValue}
          style={[styles.heroCard, { borderColor: activeRarityColor.border }]}
        >
          <View style={[styles.heroAura, { backgroundColor: activeRarityColor.glow }]} />
          <View style={[styles.heroAvatarRing, { borderColor: activeRarityColor.border }]}>
            <CharacterAvatar seed={finalAvatarValue} size={92} />
          </View>

          <View style={styles.heroDetails}>
            <View style={styles.heroBadgeRow}>
              <View
                style={[
                  styles.rarityPill,
                  { backgroundColor: activeRarityColor.bg },
                ]}
              >
                <Text style={[styles.rarityPillText, { color: activeRarityColor.text }]}>
                  {customPhotoUri ? 'ÖZEL FOTOĞRAF' : activePreset.rarity.toUpperCase()}
                </Text>
              </View>
              <View style={styles.activeCheckPill}>
                <Text style={styles.activeCheckText}>✓ SEÇİLDİ</Text>
              </View>
            </View>

            <Text style={styles.heroName}>
              {customPhotoUri ? displayName || 'Özel Profil' : activePreset.name}
            </Text>
            <Text style={styles.heroSub}>
              {customPhotoUri
                ? 'Galeriden yüklenen özel fotoğraf'
                : activePreset.sub}
            </Text>
          </View>
        </Animated.View>

        {/* Custom Photo Upload Strip */}
        <TouchableOpacity
          style={[styles.photoStrip, customPhotoUri && styles.photoStripActive]}
          onPress={handlePickGalleryPhoto}
          activeOpacity={0.85}
        >
          <View style={styles.photoStripIconWrap}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                stroke="#FFC43D"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle cx="12" cy="13.5" r="3.25" stroke="#FFC43D" strokeWidth={1.8} />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.photoStripTitle}>
              {customPhotoUri ? 'Özel Fotoğrafı Değiştir' : 'Galeriden Fotoğraf Yükle'}
            </Text>
            <Text style={styles.photoStripSub}>Kendi profil resmini kullanmak için dokun</Text>
          </View>
          {customPhotoUri ? (
            <TouchableOpacity
              onPress={() => {
                sound.playSound('tap');
                setCustomPhotoUri(null);
              }}
              style={styles.removePhotoBtn}
            >
              <Text style={styles.removePhotoText}>Kaldır</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.photoStripAction}>Seç ›</Text>
          )}
        </TouchableOpacity>

        {/* Carousel Section Header & Rarity Filter Pills */}
        <View style={styles.carouselHeaderRow}>
          <Text style={styles.sectionTitle}>Avatarlar ({filteredAvatars.length})</Text>
          <View style={styles.filterPillGroup}>
            {(
              [
                ['all', 'Tümü'],
                ['Efsanevi', 'Efsanevi'],
                ['Epik', 'Epik'],
                ['Nadir', 'Nadir'],
              ] as const
            ).map(([key, label]) => {
              const active = rarityFilter === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => {
                    sound.playSound('tap');
                    setRarityFilter(key);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* HORIZONTAL MOTION AVATAR CAROUSEL (Soldan Sağa Kaydırmalı) */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          decelerationRate="fast"
          snapToInterval={120}
        >
          {filteredAvatars.map((preset, idx) => {
            const isSelected = !customPhotoUri && preset.id === selectedId;
            const rColor = RARITY_COLORS[preset.rarity] || RARITY_COLORS.Nadir;

            return (
              <Animated.View
                key={preset.id}
                entering={FadeInRight.delay(idx * 50)
                  .springify()
                  .damping(16)
                  .stiffness(130)}
              >
                <TouchableOpacity
                  style={[
                    styles.avatarCard,
                    isSelected && [
                      styles.avatarCardSelected,
                      { borderColor: rColor.border, shadowColor: rColor.border },
                    ],
                  ]}
                  onPress={() => handleSelectPreset(preset)}
                  activeOpacity={0.85}
                >
                  {isSelected && (
                    <View style={[styles.cardSelectedBadge, { backgroundColor: rColor.border }]}>
                      <Text style={styles.cardSelectedCheck}>✓</Text>
                    </View>
                  )}

                  <View style={[styles.cardAvatarWrap, isSelected && { borderColor: rColor.border }]}>
                    <CharacterAvatar index={preset.origIdx} size={58} />
                  </View>

                  <Text style={styles.cardName} numberOfLines={1}>
                    {preset.name}
                  </Text>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {preset.sub}
                  </Text>

                  <View style={[styles.cardRarityBadge, { backgroundColor: preset.badgeBg }]}>
                    <Text style={[styles.cardRarityText, { color: preset.badgeFg }]}>
                      {preset.rarity}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Username Glass Input Field */}
        <View style={styles.inputSection}>
          <Text style={styles.inputSectionLabel}>Kullanıcı Adı</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Kullanıcı adını yaz..."
              placeholderTextColor="rgba(217, 205, 245, 0.45)"
              maxLength={22}
              autoCorrect={false}
            />
            {displayName.trim().length >= 2 && (
              <View style={styles.validCheckBadge}>
                <Text style={styles.validCheckText}>✓</Text>
              </View>
            )}
          </View>
          <Text style={styles.inputHint}>
            {displayName.trim().length >= 2
              ? '✓ Bu isim maçlarda ve liderlik tablosunda görünecektir'
              : 'En az 2 karakter girmelisiniz'}
          </Text>
        </View>

        {/* Save CTA Button */}
        <View style={styles.ctaWrapper}>
          <Button3D
            title={initialAvatarUrl || initialDisplayName !== 'Misafir Oyuncu' ? 'KAYDET' : 'BAŞLA'}
            variant="gold"
            onPress={() => {
              sound.playSound('reward');
              sound.triggerHaptic('success');
              onSave(displayName.trim() || 'DenizPro', finalAvatarValue);
            }}
            disabled={displayName.trim().length < 2}
            style={{ width: '100%', minHeight: 56 }}
            textStyle={{ fontSize: 18 }}
          />
        </View>
      </ScrollView>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: THEME.fonts.extraBold,
    marginTop: -2,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFFFFF',
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },

  // Hero Card
  heroCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 14, 56, 0.92)',
    borderWidth: 2,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.45)' },
      default: { elevation: 6 },
    }),
  },
  heroAura: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.35,
  },
  heroAvatarRing: {
    padding: 4,
    borderRadius: 60,
    borderWidth: 3,
    backgroundColor: 'rgba(10, 4, 24, 0.8)',
    marginRight: 14,
  },
  heroDetails: {
    flex: 1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  rarityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rarityPillText: {
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.5,
  },
  activeCheckPill: {
    backgroundColor: 'rgba(63, 208, 138, 0.15)',
    borderWidth: 1,
    borderColor: '#3FD08A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeCheckText: {
    color: '#3FD08A',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  heroName: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.body,
    marginTop: 2,
  },

  // Custom Photo Strip
  photoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 16,
    gap: 12,
  },
  photoStripActive: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.1)',
  },
  photoStripIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStripIcon: {
    fontSize: 20,
  },
  photoStripTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  photoStripSub: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.body,
    marginTop: 1,
  },
  photoStripAction: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    paddingRight: 4,
  },
  removePhotoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  removePhotoText: {
    color: '#F87171',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },

  // Carousel Header
  carouselHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 16,
    color: '#FFFFFF',
  },
  filterPillGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterChipActive: {
    backgroundColor: '#6B3CFF',
    borderColor: '#A855F7',
  },
  filterChipText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // Horizontal Motion Carousel
  carouselContainer: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 12,
  },
  avatarCard: {
    position: 'relative',
    width: 112,
    height: 148,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 14, 56, 0.85)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    ...Platform.select({
      web: { transition: 'transform 0.18s ease, border-color 0.18s ease' },
    }),
  },
  avatarCardSelected: {
    backgroundColor: 'rgba(38, 18, 84, 0.95)',
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(255, 196, 61, 0.35)', transform: 'translateY(-3px)' },
      default: { elevation: 8 },
    }),
  },
  cardSelectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardSelectedCheck: {
    color: '#1E0E45',
    fontSize: 12,
    fontWeight: '900',
  },
  cardAvatarWrap: {
    padding: 2,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
    textAlign: 'center',
    width: '100%',
  },
  cardSub: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.body,
    textAlign: 'center',
    marginTop: 1,
    marginBottom: 6,
    width: '100%',
  },
  cardRarityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardRarityText: {
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '900',
  },

  // Input Section
  inputSection: {
    marginTop: 18,
  },
  inputSectionLabel: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.extraBold,
    padding: 0,
  },
  validCheckBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3FD08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  validCheckText: {
    color: '#0D2818',
    fontSize: 13,
    fontWeight: '900',
  },
  inputHint: {
    color: '#3FD08A',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 6,
    paddingHorizontal: 4,
  },

  // CTA
  ctaWrapper: {
    marginTop: 20,
  },
});
