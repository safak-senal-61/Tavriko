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
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { CustomRoomSettings, CategoryId, DifficultyLevel } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CategorySquircleIcon,
} from '../components/TavrikoIcons';
import {
  CategorySelectModal,
} from '../components/CategorySelectModal';
import {
  CategoryData,
  GENERAL_CATEGORIES,
} from '../components/CategorySquircleCard';

interface CustomRoomScreenProps {
  onBack: () => void;
  onCreateRoom: (settings: CustomRoomSettings) => void;
  onJoinRoom: (roomCode: string) => void;
  avatarSeed?: string;
  coins?: number;
}

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

interface PublicRoomItem {
  id: string;
  code: string;
  title: string;
  categoryKey: string;
  categoryName: string;
  totalRounds: number;
  timeSec: number;
  players: number;
  maxPlayers: number;
}

const PUBLIC_ROOMS: PublicRoomItem[] = [
  {
    id: 'pub1',
    code: 'DNZ720',
    title: "Deniz'in Odası",
    categoryKey: 'bilim',
    categoryName: 'Bilim',
    totalRounds: 7,
    timeSec: 20,
    players: 3,
    maxPlayers: 4,
  },
  {
    id: 'pub2',
    code: 'ECE40S',
    title: 'Ece Arena',
    categoryKey: 'genel_kultur',
    categoryName: 'Karışık',
    totalRounds: 14,
    timeSec: 40,
    players: 2,
    maxPlayers: 6,
  },
  {
    id: 'pub3',
    code: 'BRK8SP',
    title: 'Burak Challenge',
    categoryKey: 'spor',
    categoryName: 'Spor',
    totalRounds: 7,
    timeSec: 20,
    players: 5,
    maxPlayers: 8,
  },
  {
    id: 'pub4',
    code: 'GLK20S',
    title: 'Galaksi Turu',
    categoryKey: 'uzay',
    categoryName: 'Uzay',
    totalRounds: 21,
    timeSec: 20,
    players: 1,
    maxPlayers: 4,
  },
];

export const CustomRoomScreen: React.FC<CustomRoomScreenProps> = ({
  onBack,
  onCreateRoom,
  onJoinRoom,
  avatarSeed,
  coins,
}) => {
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
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');

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
      privacy,
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
        {/* Tavriko Neon Sekme Seçici (Oda Kur | Odaya Katıl - UI Kit Design) */}
        <View style={styles.tabToggleRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'create' && styles.tabButtonActiveCreate]}
            activeOpacity={0.85}
            onPress={() => {
              sound.playSound('tap');
              setActiveTab('create');
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 64 64" style={{ marginRight: 6 }}>
              <Rect x="27" y="3" width="10" height="6" rx="2" fill="#b8c2d8" />
              <Path d="M49 13l4 4" stroke="#b8c2d8" strokeWidth="4" strokeLinecap="round" />
              <Circle cx="32" cy="36" r="22" fill="#4A9BFF" />
              <Circle cx="32" cy="36" r="17" fill="#fff" opacity={0.18} />
              <Path d="M36 21L24 38h8l-3 13 14-19h-8z" fill="#FFC43D" />
            </Svg>
            <Text style={[styles.tabButtonText, activeTab === 'create' && styles.tabButtonTextActive]}>
              ODA KUR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'join' && styles.tabButtonActiveJoin]}
            activeOpacity={0.85}
            onPress={() => {
              sound.playSound('tap');
              setActiveTab('join');
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 64 64" style={{ marginRight: 6 }}>
              <Circle cx="20" cy="20" r="13" fill="#FFC43D" />
              <Circle cx="20" cy="20" r="5.5" fill="#2a1558" />
              <Path d="M29 29l24 24M43 43l7-7M50 50l6-6" stroke="#f5a300" strokeWidth="7" strokeLinecap="round" fill="none" />
              <Path d="M12 14a10 10 0 016-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity={0.7} />
            </Svg>
            <Text style={[styles.tabButtonText, activeTab === 'join' && styles.tabButtonTextActive]}>
              ODAYA KATIL
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'create' ? (
          /* TAVRİKO ÖZGÜN ODA KURMA KARTI */
          <View style={styles.roomSetupCard}>
            {/* 1. KATEGORİ SEÇİCİ DROPDOWN */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>KATEGORİ</Text>
              <Text style={styles.sectionBadge}>
                {selectedCategory === 'mixed' ? '🎲 KARIŞIK MOD' : '🎯 TEK BRANŞ'}
              </Text>
            </View>

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
                <View
                  style={[
                    styles.categoryDropdownIconWrap,
                    selectedCategory !== 'mixed' && {
                      borderColor: selectedCategory.neonBorder,
                    },
                  ]}
                >
                  {selectedCategory === 'mixed' ? (
                    <CategorySquircleIcon category="genel_kultur" size={26} />
                  ) : (
                    <CategorySquircleIcon category={selectedCategory.id} size={26} />
                  )}
                </View>
                <View>
                  <Text style={styles.categoryDropdownText}>
                    {selectedCategory === 'mixed' ? 'Tüm Kategoriler (Karışık)' : selectedCategory.name}
                  </Text>
                  <Text style={styles.categoryDropdownSub}>
                    {selectedCategory === 'mixed'
                      ? 'Dengeli çoklu branş soruları'
                      : selectedCategory.badge}
                  </Text>
                </View>
              </View>

              <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 9L12 15L18 9"
                  stroke="#FFC43D"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mixedQuickToggle}
              activeOpacity={0.8}
              onPress={() => {
                sound.playSound('tap');
                setSelectedCategory(selectedCategory === 'mixed' ? GENERAL_CATEGORIES[0] : 'mixed');
              }}
            >
              <Text style={styles.mixedQuickText}>
                {selectedCategory === 'mixed' ? '🎯 Tek Kategori Seç' : '🎲 Karışık Moduna Dön'}
              </Text>
            </TouchableOpacity>

            {/* 2. PARAMETRELER: SORU SAYISI & SÜRE */}
            <View style={styles.paramGridRow}>
              {/* Soru Sayısı */}
              <View style={styles.paramColumn}>
                <Text style={styles.sectionHeader}>SORU SAYISI</Text>
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

              {/* Süre */}
              <View style={styles.paramColumn}>
                <Text style={styles.sectionHeader}>SÜRE</Text>
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
            <Text style={styles.sectionHeader}>OYUNCU SAYISI ({maxPlayers} Kişi)</Text>
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
            <Text style={styles.sectionHeader}>ZORLUK DERECESİ</Text>
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

            {/* 5. GİZLİLİK & CEZA AYARLARI */}
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Oda Gizliliği</Text>
                <Text style={styles.switchSub}>
                  {privacy === 'public' ? 'Herkese Açık (Lobiye Katılabilir)' : 'Özel (Yalnızca Kod İle)'}
                </Text>
              </View>
              <Switch
                value={privacy === 'public'}
                onValueChange={(val) => {
                  sound.playSound('tap');
                  setPrivacy(val ? 'public' : 'private');
                }}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#5ADBB5' }}
                thumbColor={privacy === 'public' ? '#12052C' : '#D9CDF5'}
              />
            </View>

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
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#FF6BC4' }}
                thumbColor={penaltyForWrong ? '#12052C' : '#D9CDF5'}
              />
            </View>

            {/* 6. TAVRİKO 3D ODA OLUŞTUR BUTONU */}
            <Button3D
              title="ODAYI OLUŞTUR"
              onPress={handleCreateRoomPress}
              variant="gold"
              style={{ height: 56, marginTop: 10 }}
            />
          </View>
        ) : (
          /* ODAYA KATIL KARTI */
          <View style={styles.roomSetupCard}>
            <Text style={styles.sectionHeader}>6 HANELİ ODA KODU</Text>
            <Text style={styles.joinSubText}>
              Arkadaşınızın paylaştığı oda kodunu girerek lobiye anında katılın.
            </Text>

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

            <Button3D
              title="ODAYA KATIL"
              onPress={handleJoinPress}
              variant="mint"
              style={{ height: 56, marginTop: 24 }}
            />

            {/* HERKESE AÇIK ODALAR (Tavriko UI Kit - Public Rooms) */}
            <View style={styles.publicRoomsHeaderRow}>
              <View style={styles.publicRoomsDivider} />
              <Text style={styles.publicRoomsSectionTitle}>HERKESE AÇIK ODALAR</Text>
              <View style={styles.publicRoomsDivider} />
            </View>

            <View style={styles.publicRoomsList}>
              {PUBLIC_ROOMS.map((room) => (
                <View key={room.id} style={styles.publicRoomCard}>
                  <View style={styles.publicRoomIconWrap}>
                    <CategorySquircleIcon category={room.categoryKey} size={42} />
                  </View>
                  <View style={styles.publicRoomInfo}>
                    <Text style={styles.publicRoomTitle} numberOfLines={1}>{room.title}</Text>
                    <Text style={styles.publicRoomSub}>
                      {room.categoryName} · {room.totalRounds} soru · {room.timeSec}sn
                    </Text>
                  </View>
                  <View style={styles.publicRoomPill}>
                    <Text style={styles.publicRoomPillText}>{room.players}/{room.maxPlayers}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.publicRoomJoinBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      sound.playSound('tap');
                      sound.triggerHaptic('medium');
                      onJoinRoom(room.code);
                    }}
                  >
                    <Text style={styles.publicRoomJoinBtnText}>KATIL</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* KATEGORİ SEÇİM MODALI */}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderRadius: 24,
    padding: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.3)',
    marginBottom: 16,
    width: '100%',
    maxWidth: 380,
  },
  tabButton: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  tabButtonActiveCreate: {
    backgroundColor: '#6B3CFF',
  },
  tabButtonActiveJoin: {
    backgroundColor: '#5ADBB5',
  },
  tabButtonText: {
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    color: '#D9CDF5',
    letterSpacing: 1,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  roomSetupCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.35)',
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#6B3CFF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0px 10px 30px rgba(107, 60, 255, 0.25)',
      },
    }),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  sectionBadge: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '900',
    color: '#5ADBB5',
    letterSpacing: 0.8,
  },
  categoryDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18, 7, 44, 0.92)',
    borderRadius: 22,
    borderWidth: 1.8,
    borderColor: '#6B3CFF',
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
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFC43D',
  },
  categoryDropdownText: {
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  categoryDropdownSub: {
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    fontWeight: '700',
    color: '#D9CDF5',
    marginTop: 2,
  },
  mixedQuickToggle: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  mixedQuickText: {
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    fontWeight: '800',
    color: '#5ADBB5',
    textDecorationLine: 'underline',
  },
  paramGridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  paramColumn: {
    flex: 1,
  },
  chipGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 4, 30, 0.75)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1.2,
    borderColor: 'rgba(154, 107, 255, 0.25)',
    width: '100%',
    justifyContent: 'space-around',
    marginTop: 6,
  },
  chipPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipPillActive: {
    backgroundColor: '#6B3CFF',
    ...Platform.select({
      ios: {
        shadowColor: '#6B3CFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      web: {
        filter: 'drop-shadow(0px 2px 8px rgba(107, 60, 255, 0.6))',
      },
    }),
  },
  chipPillText: {
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
    color: '#CBBFE8',
  },
  chipPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  chipRowFull: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 4, 30, 0.75)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1.2,
    borderColor: 'rgba(154, 107, 255, 0.25)',
    marginTop: 6,
    marginBottom: 14,
    justifyContent: 'space-between',
  },
  chipPillSmall: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 7, 44, 0.65)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  switchSub: {
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    fontWeight: '600',
    color: '#CBBFE8',
    marginTop: 2,
  },
  joinSubText: {
    fontSize: 13,
    fontFamily: THEME.fonts.medium,
    fontWeight: '600',
    color: '#D9CDF5',
    textAlign: 'center',
    marginBottom: 16,
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
    borderRadius: 14,
    backgroundColor: 'rgba(10, 4, 30, 0.85)',
    borderWidth: 1.8,
    borderColor: 'rgba(154, 107, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitBoxFilled: {
    borderColor: '#5ADBB5',
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
  },
  digitText: {
    fontSize: 22,
    fontFamily: THEME.fonts.display,
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
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 6,
  },
  pasteButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
  },
  pasteButtonText: {
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  publicRoomsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    marginBottom: 12,
  },
  publicRoomsDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  publicRoomsSectionTitle: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 1.2,
  },
  publicRoomsList: {
    width: '100%',
    gap: 8,
  },
  publicRoomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  publicRoomIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicRoomInfo: {
    flex: 1,
  },
  publicRoomTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
  },
  publicRoomSub: {
    color: '#A79BC4',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  publicRoomPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  publicRoomPillText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  publicRoomJoinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#5ADBB5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicRoomJoinBtnText: {
    color: '#082520',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
