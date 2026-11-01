import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { CustomRoomSettings, CategoryId, DifficultyLevel } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
} from '../components/TavrikoIcons';
import {
  CategorySelectModal,
} from '../components/CategorySelectModal';
import {
  CategoryData,
  GENERAL_CATEGORIES,
  CategorySquircleIcon,
} from '../components/CategorySquircleCard';

interface CustomRoomScreenProps {
  onBack: () => void;
  onCreateRoom: (settings: CustomRoomSettings) => void;
  onJoinRoom: (roomCode: string) => void;
  avatarSeed?: string;
  coins?: number;
}

// TRT Bil Bakalım Standart Soru ve Süre Seçenekleri
const QUESTION_OPTIONS = [7, 14, 21];
const TIME_OPTIONS = [20, 40];
const PLAYER_OPTIONS = [2, 4, 6, 8];

const DIFFICULTY_OPTIONS: { id: DifficultyLevel | 'mixed'; label: string }[] = [
  { id: 'mixed', label: 'Karışık' },
  { id: 'easy', label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard', label: 'Zor' },
  { id: 'expert', label: 'Uzman' },
];

export const CustomRoomScreen: React.FC<CustomRoomScreenProps> = ({
  onBack,
  onCreateRoom,
  onJoinRoom,
  avatarSeed,
  coins,
}) => {
  // Aktif mod: Oda Kur veya Odaya Katıl
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Katılma Kodu State
  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const codeInputRef = useRef<any>(null);

  // Oda Ayarları State
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [totalRounds, setTotalRounds] = useState<number>(7);
  const [questionTimeSec, setQuestionTimeSec] = useState<number>(20);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'mixed'>('mixed');
  const [penaltyForWrong, setPenaltyForWrong] = useState<boolean>(true);

  // Kategori Seçimi State
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | 'mixed'>('mixed');
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);

  const digits = Array.from({ length: 6 }).map((_, idx) => roomCode[idx] || '');

  const handleJoinPress = () => {
    const clean = roomCode.trim().toUpperCase();
    if (clean.length < 4) {
      sound.playSound('wrong');
      setJoinError('Lütfen geçerli bir oda kodu girin.');
      codeInputRef.current?.focus();
      return;
    }
    setJoinError(null);
    onJoinRoom(clean);
  };

  const handleCreateRoomPress = () => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');

    const isMixed = selectedCategory === 'mixed';
    const categories: CategoryId[] = isMixed
      ? ['science_tech', 'history', 'geography', 'sports', 'cinema_tv', 'art_culture']
      : [selectedCategory.id as CategoryId];

    const settings: CustomRoomSettings = {
      maxPlayers,
      totalRounds,
      questionTimeSec,
      difficulty,
      penaltyForWrong,
      categories,
      mixedCategories: isMixed,
      privacy: 'public',
    };

    onCreateRoom(settings);
  };

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        avatarSeed={avatarSeed}
        coins={coins}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Üst Başlık ve Sekme Seçici (Oda Kur | Odaya Katıl) */}
        <View style={styles.tabToggleRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'create' && styles.tabButtonActive]}
            activeOpacity={0.85}
            onPress={() => {
              sound.playSound('tap');
              setActiveTab('create');
            }}
          >
            <Text style={[styles.tabButtonText, activeTab === 'create' && styles.tabButtonTextActive]}>
              Oda Kur
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'join' && styles.tabButtonActive]}
            activeOpacity={0.85}
            onPress={() => {
              sound.playSound('tap');
              setActiveTab('join');
            }}
          >
            <Text style={[styles.tabButtonText, activeTab === 'join' && styles.tabButtonTextActive]}>
              Odaya Katıl
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'create' ? (
          /* TRT BİL BAKALIM ODA KURMA ARAYÜZÜ */
          <View style={styles.roomSetupCard}>
            {/* 1. KATEGORİ SEÇİCİ DROPDOWN (TRT Görselindeki gibi) */}
            <Text style={styles.sectionHeader}>Kategori</Text>
            <TouchableOpacity
              style={styles.categoryDropdown}
              activeOpacity={0.88}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('medium');
                setCategoryModalVisible(true);
              }}
            >
              <View style={styles.categoryDropdownLeft}>
                <View style={styles.categoryDropdownIconWrap}>
                  {selectedCategory === 'mixed' ? (
                    <CategorySquircleIcon name="shuffle" size={24} color="#FFFFFF" />
                  ) : (
                    <CategorySquircleIcon name={selectedCategory.iconName} size={24} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.categoryDropdownText}>
                  {selectedCategory === 'mixed' ? 'Karışık' : selectedCategory.name}
                </Text>
              </View>

              {/* Aşağı Açılır Ok İkonu */}
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 9L12 15L18 9"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>

            {/* Hızlı Kategori Değiştir / Karışık Butonu */}
            <TouchableOpacity
              style={styles.mixedQuickToggle}
              activeOpacity={0.8}
              onPress={() => {
                sound.playSound('tap');
                setSelectedCategory(selectedCategory === 'mixed' ? GENERAL_CATEGORIES[0] : 'mixed');
              }}
            >
              <Text style={styles.mixedQuickText}>
                {selectedCategory === 'mixed' ? '🎯 Tek Kategori Seç' : '🎲 Karışık Moduna Geç'}
              </Text>
            </TouchableOpacity>

            {/* 2. PARAMETRELER: SORU SAYISI & SÜRE (TRT Çift Sütunlu Yan Yana Görseli) */}
            <View style={styles.paramGridRow}>
              {/* Soru Sayısı Sütunu */}
              <View style={styles.paramColumn}>
                <Text style={styles.sectionHeader}>Soru Sayısı</Text>
                <View style={styles.chipGroup}>
                  {QUESTION_OPTIONS.map((q) => {
                    const isSelected = totalRounds === q;
                    return (
                      <TouchableOpacity
                        key={q}
                        style={[styles.chipPill, isSelected && styles.chipPillActive]}
                        activeOpacity={0.85}
                        onPress={() => {
                          sound.playSound('tap');
                          sound.triggerHaptic('light');
                          setTotalRounds(q);
                        }}
                      >
                        <Text style={[styles.chipPillText, isSelected && styles.chipPillTextActive]}>
                          {q}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Süre Sütunu */}
              <View style={styles.paramColumn}>
                <Text style={styles.sectionHeader}>Süre</Text>
                <View style={styles.chipGroup}>
                  {TIME_OPTIONS.map((sec) => {
                    const isSelected = questionTimeSec === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        style={[styles.chipPill, isSelected && styles.chipPillActive]}
                        activeOpacity={0.85}
                        onPress={() => {
                          sound.playSound('tap');
                          sound.triggerHaptic('light');
                          setQuestionTimeSec(sec);
                        }}
                      >
                        <Text style={[styles.chipPillText, isSelected && styles.chipPillTextActive]}>
                          {sec}sn
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 3. OYUNCU SAYISI */}
            <Text style={styles.sectionHeader}>Oyuncu Sayısı ({maxPlayers} Kişi)</Text>
            <View style={styles.chipRowFull}>
              {PLAYER_OPTIONS.map((num) => {
                const isSelected = maxPlayers === num;
                return (
                  <TouchableOpacity
                    key={num}
                    style={[styles.chipPillSmall, isSelected && styles.chipPillActive]}
                    activeOpacity={0.85}
                    onPress={() => {
                      sound.playSound('tap');
                      sound.triggerHaptic('light');
                      setMaxPlayers(num);
                    }}
                  >
                    <Text style={[styles.chipPillText, isSelected && styles.chipPillTextActive]}>
                      {num} Kişi
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 4. ZORLUK SEVİYESİ */}
            <Text style={styles.sectionHeader}>Zorluk Seviyesi</Text>
            <View style={styles.chipRowFull}>
              {DIFFICULTY_OPTIONS.map((diff) => {
                const isSelected = difficulty === diff.id;
                return (
                  <TouchableOpacity
                    key={diff.id}
                    style={[styles.chipPillSmall, isSelected && styles.chipPillActive]}
                    activeOpacity={0.85}
                    onPress={() => {
                      sound.playSound('tap');
                      sound.triggerHaptic('light');
                      setDifficulty(diff.id);
                    }}
                  >
                    <Text style={[styles.chipPillText, isSelected && styles.chipPillTextActive]}>
                      {diff.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 5. YANLIŞ CEVAP CEZASI */}
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Yanlış Cevap Cezası</Text>
                <Text style={styles.switchSub}>Yanlış cevaplarda -50 puan düşer</Text>
              </View>
              <Switch
                value={penaltyForWrong}
                onValueChange={(val) => {
                  sound.playSound('tap');
                  setPenaltyForWrong(val);
                }}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#00B4DB' }}
                thumbColor={penaltyForWrong ? '#FFFFFF' : '#D9CDF5'}
              />
            </View>

            {/* 6. ODAYI BAŞLAT / KUR BUTONU */}
            <TouchableOpacity
              style={styles.createRoomButton}
              activeOpacity={0.88}
              onPress={handleCreateRoomPress}
            >
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="createBtnGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#00B4DB" />
                    <Stop offset="1" stopColor="#0083B0" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="26"
                  ry="26"
                  fill="url(#createBtnGrad)"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeOpacity={0.4}
                />
              </Svg>
              <Text style={styles.createRoomButtonText}>Odayı Oluştur</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ODAYA KATIL KARTI */
          <View style={styles.roomSetupCard}>
            <Text style={styles.sectionHeader}>Oda Kodunu Girin</Text>
            <Text style={styles.joinSubText}>
              Arkadaşınızın paylaştığı 6 haneli oda kodunu girerek hemen lobiye katılın.
            </Text>

            {/* 6 Haneli Kutu Arayüzü */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                sound.playSound('tap');
                codeInputRef.current?.focus();
              }}
              style={styles.digitsWrapper}
            >
              <View style={styles.digitsRow}>
                {digits.map((ch, idx) => (
                  <View
                    key={idx}
                    style={[styles.digitBox, !!ch && styles.digitBoxFilled]}
                  >
                    <Text style={styles.digitText}>{ch}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            {/* Gizli TextInput */}
            <TextInput
              ref={codeInputRef}
              style={styles.hiddenInput}
              value={roomCode}
              onChangeText={(text) => {
                const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                setRoomCode(clean);
                if (clean.length > 0) setJoinError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />

            {joinError && <Text style={styles.errorText}>{joinError}</Text>}

            {/* Panodan Yapıştır Butonu */}
            <TouchableOpacity
              style={styles.pasteButton}
              activeOpacity={0.8}
              onPress={async () => {
                sound.playSound('tap');
                const clip = await Clipboard.getStringAsync();
                if (clip) {
                  const clean = clip.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                  setRoomCode(clean);
                }
              }}
            >
              <Text style={styles.pasteButtonText}>📋 Panodan Yapıştır</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createRoomButton, { marginTop: 24 }]}
              activeOpacity={0.88}
              onPress={handleJoinPress}
            >
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="joinBtnGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#9A6BFF" />
                    <Stop offset="1" stopColor="#5A27C8" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="26"
                  ry="26"
                  fill="url(#joinBtnGrad)"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeOpacity={0.4}
                />
              </Svg>
              <Text style={styles.createRoomButtonText}>Odaya Katıl</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* TRT BİL BAKALIM "KATEGORİNİ SEÇ" MODALI */}
      <CategorySelectModal
        visible={isCategoryModalVisible}
        initialCategoryId={selectedCategory === 'mixed' ? 'science_tech' : selectedCategory.id}
        onClose={() => setCategoryModalVisible(false)}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
        }}
      />
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
    width: '100%',
    maxWidth: 360,
  },
  tabButton: {
    flex: 1,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  tabButtonActive: {
    backgroundColor: '#00B4DB',
  },
  tabButtonText: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '800',
    color: '#D9CDF5',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  roomSetupCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.35)',
      },
    }),
  },
  sectionHeader: {
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  categoryDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  categoryDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryDropdownIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDropdownText: {
    fontSize: 17,
    fontFamily: 'Nunito_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
  },
  mixedQuickToggle: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  mixedQuickText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
    color: '#5AE0B5',
    textDecorationLine: 'underline',
  },
  paramGridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  paramColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chipGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 4, 30, 0.65)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: '100%',
    justifyContent: 'space-around',
  },
  chipPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipPillActive: {
    backgroundColor: '#00B4DB',
  },
  chipPillText: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '800',
    color: '#CBBFE8',
  },
  chipPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  chipRowFull: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 4, 30, 0.65)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  chipPillSmall: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '800',
    color: '#FFFFFF',
  },
  switchSub: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: '600',
    color: '#CBBFE8',
    marginTop: 2,
  },
  createRoomButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#00B4DB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0px 6px 16px rgba(0, 180, 219, 0.45)',
      },
    }),
  },
  createRoomButtonText: {
    fontSize: 18,
    fontFamily: 'Nunito_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  joinSubText: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: '600',
    color: '#D9CDF5',
    textAlign: 'center',
    marginBottom: 20,
  },
  digitsWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  digitsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  digitBox: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 4, 30, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitBoxFilled: {
    borderColor: '#00B4DB',
    backgroundColor: 'rgba(0, 180, 219, 0.15)',
  },
  digitText: {
    fontSize: 22,
    fontFamily: 'Nunito_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  errorText: {
    color: '#FF5A6A',
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  pasteButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 10,
  },
  pasteButtonText: {
    fontSize: 13,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
