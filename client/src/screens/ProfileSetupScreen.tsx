import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { compressAvatarImageAsync } from '../utils/avatarImage';
import {
  TavrikoScreen,
  Button3D,
  CharacterAvatar,
  AVATAR_PRESETS,
} from '../components/TavrikoIcons';
let ImagePickerModule: any = null;
try {
  ImagePickerModule = require('expo-image-picker');
} catch {
  ImagePickerModule = null;
}

/*
 * Avatarlar nadirlik sırasına göre dizilir (Nadir → Epik → Efsanevi) ve
 * soldan sağa kademeli yaylı giriş animasyonuyla belirir (react-native-reanimated).
 */
const RARITY_ORDER: Record<string, number> = { Nadir: 0, Epik: 1, Efsanevi: 2 };
const SORTED_AVATAR_PRESETS = AVATAR_PRESETS.map((preset, origIdx) => ({
  ...preset,
  origIdx,
})).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
interface ProfileSetupScreenProps {
  initialDisplayName?: string;
  initialAvatarUrl?: string;
  onSave: (displayName: string, avatarSeedOrUri: string) => void;
}
export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  initialDisplayName = 'DenizPro',
  initialAvatarUrl,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState(
    initialDisplayName === 'Misafir Oyuncu' ? 'DenizPro' : initialDisplayName
  );
  // Seçim artık index değil, avatar kimliği (id) üzerinden yapılır
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
    return 'av_1';
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
  const handlePickGalleryPhoto = async () => {
    sound.playSound('tap');

    // 1. Web & Mobile Browser File Input Handler
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
                setCustomPhotoUri(await compressAvatarImageAsync(base64Uri));
                sound.playSound('reward');
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

    // 2. React Native Expo Image Picker Handler
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
          setCustomPhotoUri(await compressAvatarImageAsync(rawUri));
          sound.playSound('reward');
        }
      } catch {
        // Ignore cancel
      }
    }
  };
  const finalAvatarValue =
    customPhotoUri ||
    AVATAR_PRESETS.find((p) => p.id === selectedId)?.id ||
    'av_1';
  return (
    <TavrikoScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>PROFİLİNİ OLUŞTUR</Text>
        <Text style={styles.subtitle}>
          Bir karakter seç, fotoğraf yükle ve adını yaz
        </Text>
        {/* Custom Profile Photo Upload Card */}
        <TouchableOpacity
          style={[
            styles.photoUploadCard,
            customPhotoUri && styles.photoUploadCardActive,
          ]}
          onPress={handlePickGalleryPhoto}
          activeOpacity={0.85}
        >
          <CharacterAvatar seed={finalAvatarValue} size={58} />
          <View style={{ flex: 1 }}>
            <Text style={styles.photoUploadTitle}>
              {customPhotoUri
                ? 'Özel Profil Fotoğrafı Seçildi'
                : 'Galeriden Kendi Fotoğrafını Yükle'}
            </Text>
            <Text style={styles.photoUploadSub}>
              Fotoğraf seçmek veya değiştirmek için buraya dokun
            </Text>
          </View>
        </TouchableOpacity>
        {/* 10 Character Avatar Grid (rarity: Nadir → Epik → Efsanevi) with left→right staggered entrance animation */}
        <View style={styles.avatarGrid}>
          {SORTED_AVATAR_PRESETS.map((preset, idx) => {
            const isSelected = !customPhotoUri && preset.id === selectedId;
            return (
              <Animated.View
                key={preset.id}
                entering={FadeInDown.delay(idx * 45)
                  .springify()
                  .damping(15)
                  .stiffness(120)}
              >
                <TouchableOpacity
                  style={[
                    styles.avatarSlot,
                    isSelected && styles.avatarSlotSelected,
                  ]}
                  onPress={() => {
                    sound.playSound('tap');
                    sound.triggerHaptic('light');
                    setCustomPhotoUri(null);
                    setSelectedId(preset.id);
                  }}
                  activeOpacity={0.85}
                >
                  {/* Karakterler künye listesindeki orijinal sırayla çizilir */}
                  <CharacterAvatar index={preset.origIdx} size={54} />
                  <Text style={styles.avatarNameText} numberOfLines={1}>
                    {preset.name}
                  </Text>
                  <View style={[styles.avatarRarityBadge, { backgroundColor: preset.badgeBg }]}>
                    <Text style={[styles.avatarRarityText, { color: preset.badgeFg }]}>
                      {preset.rarity}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
        {/* Username Glass Input */}
        <View style={{ marginTop: 18 }}>
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Kullanıcı adı</Text>
            <TextInput
              style={styles.textInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="DenizPro"
              placeholderTextColor="#9A8BC2"
              maxLength={20}
            />
          </View>
          <Text style={styles.availableText}>
            {displayName.trim().length >= 2
              ? 'Bu ad kullanılabilir ✓'
              : 'En az 2 karakter girin'}
          </Text>
        </View>
        <View style={{ marginTop: 22 }}>
          <Button3D
            title={initialAvatarUrl || initialDisplayName !== 'Misafir Oyuncu' ? 'KAYDET' : 'BAŞLA'}
            onPress={() => {
              sound.playSound('victory');
              onSave(displayName.trim() || 'DenizPro', finalAvatarValue);
            }}
            disabled={displayName.trim().length < 2}
            style={{ height: 58 }}
            textStyle={{ fontSize: 22 }}
          />
        </View>
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
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 14,
  },
  photoUploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 14,
  },
  photoUploadCardActive: {
    borderWidth: 2,
    borderColor: '#FFC43D',
  },
  photoUploadTitle: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  photoUploadSub: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.body,
    marginTop: 2,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  avatarSlot: {
    width: '31%',
    height: 116,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  avatarSlotSelected: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.1)',
    ...Platform.select({
      web: { boxShadow: '0 0 16px rgba(255, 196, 61, 0.4)' },
      default: { elevation: 6 },
    }),
  },
  avatarNameText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    marginTop: 4,
  },
  avatarRarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 3,
  },
  avatarRarityText: {
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '900',
  },
  inputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  inputLabel: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
    padding: 0,
  },
  availableText: {
    color: '#7CFC8A',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
});