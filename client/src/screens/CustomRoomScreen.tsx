import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { CustomRoomSettings, CategoryId, DifficultyLevel } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { socketService } from '../services/socketService';
import { getApiBaseUrl, getRealtimeUrl } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CategorySquircleIcon,
  ModeSquircleIcon,
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
  onJoinRoom: (roomCode: string, password?: string) => void;
  avatarSeed?: string;
  coins?: number;
  gems?: number;
  apiBaseUrl?: string;
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
  hasPassword?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  general_culture: 'Genel Kültür',
  genel_kultur: 'Genel Kültür',
  science_tech: 'Bilim & Teknoloji',
  bilim: 'Bilim & Teknoloji',
  history: 'Tarih',
  tarih: 'Tarih',
  geography: 'Coğrafya',
  cografya: 'Coğrafya',
  sports: 'Spor',
  spor: 'Spor',
  cinema_tv: 'Sinema & TV',
  sinema: 'Sinema & TV',
  art_culture: 'Sanat & Kültür',
  sanat: 'Sanat & Kültür',
  mixed: 'Karışık',
};

const FAKE_ROOM_CODES = new Set([
  'DNZ720',
  'ECE40S',
  'BRK8SP',
  'GLK20S',
  'T4R9A1',
  'EGE992',
  'BUR771',
  'GLX883',
]);

export const CustomRoomScreen: React.FC<CustomRoomScreenProps> = ({
  onBack,
  onCreateRoom,
  onJoinRoom,
  avatarSeed,
  coins,
  gems,
  apiBaseUrl,
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
  const [hasRoomPassword, setHasRoomPassword] = useState<boolean>(false);
  const [roomPassword, setRoomPassword] = useState<string>('');
  const [joinPassword, setJoinPassword] = useState<string>('');

  const [passwordModalVisible, setPasswordModalVisible] = useState<boolean>(false);
  const [targetRoomCode, setTargetRoomCode] = useState<string>('');
  const [enteredPassword, setEnteredPassword] = useState<string>('');
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);

  // Kategori Seçimi State
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | 'mixed'>('mixed');
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);

  // Canlı Veritabanı ve WebSocket Odaları (Sahte/mock odalar kaldırıldı)
  const [publicRooms, setPublicRooms] = useState<PublicRoomItem[]>([]);
  const [isLoadingPublicRooms, setIsLoadingPublicRooms] = useState(false);

  const normalizeRoomItem = (r: any): PublicRoomItem | null => {
    const code = String(r?.code || '').trim().toUpperCase();
    if (!code || FAKE_ROOM_CODES.has(code)) return null;
    const players = Number(r?.players ?? r?.playerCount ?? 0);
    const maxPlayers = Math.max(2, Number(r?.maxPlayers ?? 4));
    if (players <= 0 || players >= maxPlayers) return null;
    const rawCat = String(r?.category || r?.categoryId || 'genel_kultur');
    const categoryName =
      CATEGORY_LABELS[rawCat] ||
      CATEGORY_LABELS[String(r?.categoryName || '').toLowerCase()] ||
      r?.categoryName ||
      'Genel Kültür';
    const hostName = r?.hostName || r?.host || 'Oyuncu';
    const hasPassword = Boolean(r?.hasPassword || r?.password);
    return {
      id: code,
      code,
      title: r?.name || `${hostName} Odası`,
      categoryKey: rawCat,
      categoryName,
      totalRounds: Math.max(1, Number(r?.totalRounds ?? r?.rounds ?? 7)),
      timeSec: Math.max(5, Number(r?.questionTimeSec ?? r?.timeSec ?? 20)),
      players,
      maxPlayers,
      hasPassword,
    };
  };

  const fetchPublicRooms = async () => {
    try {
      setIsLoadingPublicRooms(true);
      const base = apiBaseUrl || getApiBaseUrl();
      const cleanBase = base.replace(/\/+$/, '');
      const rtUrl = getRealtimeUrl()
        .replace(/^wss:\/\//i, 'https://')
        .replace(/^ws:\/\//i, 'http://')
        .replace(/\/+$/, '');

      const [apiRes, rtRes] = await Promise.all([
        fetch(`${cleanBase}/trivia/rooms/public`).catch(() => null),
        fetch(`${rtUrl}/rooms/public`).catch(() => null),
      ]);

      const byCode = new Map<string, PublicRoomItem>();

      if (rtRes && rtRes.ok) {
        const rtData = await rtRes.json().catch(() => null);
        if (rtData && Array.isArray(rtData.rooms)) {
          for (const r of rtData.rooms) {
            const item = normalizeRoomItem(r);
            if (item) byCode.set(item.code, item);
          }
        }
      }

      if (apiRes && apiRes.ok) {
        const apiData = await apiRes.json().catch(() => null);
        if (apiData && Array.isArray(apiData.rooms)) {
          for (const r of apiData.rooms) {
            const item = normalizeRoomItem(r);
            if (item && !byCode.has(item.code)) {
              byCode.set(item.code, item);
            }
          }
        }
      }

      setPublicRooms(Array.from(byCode.values()));
    } catch {
      setPublicRooms([]);
    } finally {
      setIsLoadingPublicRooms(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'join') {
      fetchPublicRooms();
      const interval = setInterval(fetchPublicRooms, 4000);
      const unsub = socketService.onPublicRoomsUpdate((rooms) => {
        if (Array.isArray(rooms)) {
          const valid = rooms
            .map((r: any) => normalizeRoomItem(r))
            .filter((item): item is PublicRoomItem => Boolean(item));
          setPublicRooms(valid);
        }
      });
      socketService.getPublicRooms();

      return () => {
        clearInterval(interval);
        unsub();
      };
    }
  }, [activeTab, apiBaseUrl]);

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
    onJoinRoom(clean, joinPassword.trim() || undefined);
  };

  const handleCreateRoomPress = () => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');

    if (hasRoomPassword && !roomPassword.trim()) {
      sound.playSound('wrong');
      setJoinError('Lütfen oda şifresi belirleyin veya şifreyi kapatın.');
      return;
    }

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
      password: hasRoomPassword ? roomPassword.trim() : undefined,
      hasPassword: hasRoomPassword,
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
        gems={gems}
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

            {/* Oda Şifresi */}
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Oda Şifresi</Text>
                <Text style={styles.switchSub}>
                  {hasRoomPassword ? 'Şifreli Giriş (Sadece Şifreyi Bilenler)' : 'Şifresiz (Herkes Katılabilir)'}
                </Text>
              </View>
              <Switch
                value={hasRoomPassword}
                onValueChange={(val) => {
                  sound.playSound('tap');
                  setHasRoomPassword(val);
                  if (!val) setRoomPassword('');
                }}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#FFC43D' }}
                thumbColor={hasRoomPassword ? '#12052C' : '#D9CDF5'}
              />
            </View>

            {hasRoomPassword && (
              <View style={styles.passwordSettingBox}>
                <Text style={styles.passwordSettingLabel}>Oda Şifresi / PIN (4-8 Karakter):</Text>
                <TextInput
                  style={styles.passwordSettingInput}
                  value={roomPassword}
                  onChangeText={setRoomPassword}
                  placeholder="Örn: 1234"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  maxLength={8}
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* 6. TAVRİKO 3D ODA OLUŞTUR BUTONU */}
            <Button3D
              title="ODAYI OLUŞTUR"
              onPress={handleCreateRoomPress}
              variant="gold"
              style={{ height: 56, marginTop: 10 }}
            />
          </View>
        ) : (
          /* ODAYA KATIL KARTI (Tavriko UI Kit Screen 08) */
          <View style={styles.roomSetupCard}>
            <View style={styles.joinCodeHeaderRow}>
              <ModeSquircleIcon mode="custom_room" size={38} />
              <View style={styles.joinCodeHeaderTextCol}>
                <Text style={styles.joinCodeTitle}>Oda Kodunu Gir</Text>
                <Text style={styles.joinCodeSub}>Arkadaşının paylaştığı 6 haneli kod</Text>
              </View>
            </View>

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

            {/* Oda Şifresi (Şifreli odalar için KATIL butonundan önce girilir) */}
            <View style={{ marginTop: 10, marginBottom: 12 }}>
              <Text style={styles.passwordSettingLabel}>🔒 Oda Şifresi (Oda şifreli ise):</Text>
              <TextInput
                style={styles.passwordSettingInput}
                value={joinPassword}
                onChangeText={setJoinPassword}
                placeholder="Şifre (şifresiz ise boş bırakın)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                maxLength={8}
                autoCapitalize="none"
              />
            </View>

            {/* UI Kit Odaya Katıl Aksiyon Satırı: [ 📋 Yapıştır | KATIL ] */}
            <View style={styles.joinActionRow}>
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
                <Text style={styles.pasteButtonText}>📋 Yapıştır</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.joinPrimaryBtn}
                activeOpacity={0.88}
                onPress={handleJoinPress}
              >
                <Text style={styles.joinPrimaryBtnText}>KATIL</Text>
              </TouchableOpacity>
            </View>

            {/* HERKESE AÇIK ODALAR (Canlı Veritabanı & WebSocket Senkronizasyonu) */}
            <View style={styles.publicRoomsHeaderRow}>
              <View style={styles.publicRoomsDivider} />
              <Text style={styles.publicRoomsSectionTitle}>HERKESE AÇIK ODALAR</Text>
              <TouchableOpacity
                onPress={fetchPublicRooms}
                style={styles.refreshIconBtn}
                activeOpacity={0.7}
              >
                {isLoadingPublicRooms ? (
                  <ActivityIndicator size="small" color="#5ADBB5" />
                ) : (
                  <Text style={styles.refreshIconText}>🔄</Text>
                )}
              </TouchableOpacity>
              <View style={styles.publicRoomsDivider} />
            </View>

            <View style={styles.publicRoomsList}>
              {publicRooms.length === 0 ? (
                <View style={styles.emptyPublicRoomsBox}>
                  <Text style={styles.emptyPublicRoomsEmoji}>🏟️</Text>
                  <Text style={styles.emptyPublicRoomsTitle}>
                    {isLoadingPublicRooms ? 'Aktif Odalar Taranıyor...' : 'Şu An Açık Oda Yok'}
                  </Text>
                  <Text style={styles.emptyPublicRoomsSub}>
                    Herkese açık bekleyen bir oda bulunmuyor. Kendi odanı kurup diğer oyuncuları bekleyebilirsin!
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyCreateShortcutBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      sound.playSound('tap');
                      setActiveTab('create');
                    }}
                  >
                    <Text style={styles.emptyCreateShortcutBtnText}>+ Hemen Oda Kur</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                publicRooms.map((room) => (
                  <View key={room.id} style={styles.publicRoomCard}>
                    <View style={styles.publicRoomIconWrap}>
                      <CategorySquircleIcon category={room.categoryKey} size={42} />
                    </View>
                    <View style={styles.publicRoomInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.publicRoomTitle} numberOfLines={1}>
                          {room.title}
                        </Text>
                        {room.hasPassword && (
                          <Text style={{ fontSize: 13 }} accessibilityLabel="Şifreli Oda">
                            🔒
                          </Text>
                        )}
                      </View>
                      <Text style={styles.publicRoomSub} numberOfLines={1}>
                        {room.categoryName} · {room.totalRounds} soru · {room.timeSec}sn
                      </Text>
                    </View>
                    <View style={styles.publicRoomPill}>
                      <Text style={styles.publicRoomPillText}>
                        {room.players}/{room.maxPlayers} Kişi
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.publicRoomJoinBtn}
                      activeOpacity={0.85}
                      onPress={() => {
                        sound.playSound('tap');
                        sound.triggerHaptic('medium');
                        if (room.hasPassword) {
                          setTargetRoomCode(room.code);
                          setEnteredPassword('');
                          setPasswordModalError(null);
                          setPasswordModalVisible(true);
                        } else {
                          onJoinRoom(room.code);
                        }
                      }}
                    >
                      <Text style={styles.publicRoomJoinBtnText}>KATIL</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ŞİFRE İSTEME MODALI */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.passwordModalOverlay}
        >
          <View style={styles.passwordModalCard}>
            <Text style={styles.passwordModalTitle}>🔒 Şifreli Oda</Text>
            <Text style={styles.passwordModalSub}>
              {targetRoomCode} kodlu odaya katılmak için lütfen şifreyi girin:
            </Text>

            <TextInput
              style={[styles.passwordSettingInput, { marginTop: 14 }]}
              value={enteredPassword}
              onChangeText={(t) => {
                setEnteredPassword(t);
                if (passwordModalError) setPasswordModalError(null);
              }}
              placeholder="Oda Şifresi"
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoFocus
              maxLength={8}
              autoCapitalize="none"
            />

            {passwordModalError && (
              <Text style={styles.errorText}>{passwordModalError}</Text>
            )}

            <View style={styles.passwordModalBtnRow}>
              <TouchableOpacity
                style={styles.passwordModalCancelBtn}
                onPress={() => {
                  sound.playSound('tap');
                  setPasswordModalVisible(false);
                }}
              >
                <Text style={styles.passwordModalCancelText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.passwordModalConfirmBtn}
                onPress={() => {
                  if (!enteredPassword.trim()) {
                    sound.playSound('wrong');
                    setPasswordModalError('Lütfen şifreyi giriniz.');
                    return;
                  }
                  sound.playSound('tap');
                  sound.triggerHaptic('medium');
                  setPasswordModalVisible(false);
                  onJoinRoom(targetRoomCode, enteredPassword.trim());
                }}
              >
                <Text style={styles.passwordModalConfirmText}>Giriş Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    paddingBottom: 150,
    alignItems: 'center',
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
    backgroundColor: '#F59E0B',
  },
  tabButtonActiveJoin: {
    backgroundColor: '#10B981',
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
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.35)',
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
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
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
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 3,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: '#F59E0B',
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
    backgroundColor: '#1E293B',
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
  joinCodeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  joinCodeHeaderTextCol: {
    flex: 1,
  },
  joinCodeTitle: {
    fontSize: 16,
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
  },
  joinCodeSub: {
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    color: '#9A8BC2',
    marginTop: 2,
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
    backgroundColor: '#1E293B',
    borderWidth: 1.8,
    borderColor: 'rgba(255, 255, 255, 0.18)',
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
  joinActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  pasteButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteButtonText: {
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  joinPrimaryBtn: {
    flex: 1.5,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#5ADBB5',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#5ADBB5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 14px rgba(90, 219, 181, 0.4)',
      },
    }),
  },
  joinPrimaryBtnText: {
    color: '#082520',
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    letterSpacing: 1,
  },
  refreshIconBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIconText: {
    fontSize: 14,
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
  emptyPublicRoomsBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  emptyPublicRoomsEmoji: {
    fontSize: 26,
    marginBottom: 2,
  },
  emptyPublicRoomsTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyPublicRoomsSub: {
    color: '#A79BC4',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 280,
  },
  emptyCreateShortcutBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 60, 255, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.55)',
  },
  emptyCreateShortcutBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '800',
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
  passwordSettingBox: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.3)',
  },
  passwordSettingLabel: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    marginBottom: 6,
  },
  passwordSettingInput: {
    backgroundColor: 'rgba(10, 4, 24, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.5)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  passwordModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 2, 14, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  passwordModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E1038',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#FFC43D',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  passwordModalTitle: {
    color: '#FFC43D',
    fontSize: 18,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    textAlign: 'center',
  },
  passwordModalSub: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
    marginTop: 6,
  },
  passwordModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  passwordModalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordModalCancelText: {
    color: '#D9CDF5',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
  },
  passwordModalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFC43D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordModalConfirmText: {
    color: '#12052C',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
  },
});
