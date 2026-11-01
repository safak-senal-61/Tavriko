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
import * as Clipboard from 'expo-clipboard';
import { CustomRoomSettings, QuestionCategory, QuestionDifficulty } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
} from '../components/TavrikoIcons';

interface CustomRoomScreenProps {
  onBack: () => void;
  onCreateRoom: (settings: CustomRoomSettings) => void;
  onJoinRoom: (roomCode: string) => void;
  avatarSeed?: string;
  coins?: number;
}

const PLAYER_OPTIONS = [2, 4, 6, 8, 10];
const QUESTION_OPTIONS = [5, 10, 15, 20, 30];
const TIME_OPTIONS = [10, 15, 20, 30];
const DIFFICULTY_OPTIONS: { id: QuestionDifficulty | 'mixed'; label: string }[] = [
  { id: 'mixed', label: 'Karışık' },
  { id: 'easy', label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard', label: 'Zor' },
  { id: 'expert', label: 'Uzman' },
];

interface CategoryMeta {
  id: QuestionCategory | 'mixed';
  name: string;
  icon: string;
}

const CATEGORY_LIST: CategoryMeta[] = [
  { id: 'mixed', name: 'Karışık', icon: '🎲' },
  { id: 'general_culture', name: 'Genel Kültür', icon: '🌍' },
  { id: 'history', name: 'Tarih', icon: '🏛️' },
  { id: 'geography', name: 'Coğrafya', icon: '🗺️' },
  { id: 'science_tech', name: 'Bilim & Teknoloji', icon: '🔬' },
  { id: 'cinema_tv', name: 'Sinema & Dizi', icon: '🎬' },
  { id: 'music', name: 'Müzik', icon: '🎵' },
  { id: 'sports', name: 'Spor', icon: '⚽' },
  { id: 'literature_art', name: 'Edebiyat & Sanat', icon: '📚' },
  { id: 'gaming', name: 'Oyun Dünyası', icon: '🎮' },
  { id: 'mythology', name: 'Mitoloji', icon: '⚡' },
  { id: 'food_cuisine', name: 'Yemek & Mutfak', icon: '🍕' },
  { id: 'nature_animals', name: 'Doğa & Hayvanlar', icon: '🐾' },
  { id: 'philosophy', name: 'Felsefe & Düşünce', icon: '💡' },
  { id: 'cars_vehicles', name: 'Arabalar & Araçlar', icon: '🏎️' },
  { id: 'space_astronomy', name: 'Uzay & Astronomi', icon: '🚀' },
  { id: 'languages_words', name: 'Diller & Kelimeler', icon: '🗣️' },
  { id: 'comic_anime', name: 'Çizgi Roman & Anime', icon: '💥' },
  { id: 'fashion_design', name: 'Moda & Tasarım', icon: '🎨' },
];

export const CustomRoomScreen: React.FC<CustomRoomScreenProps> = ({
  onBack,
  onCreateRoom,
  onJoinRoom,
  avatarSeed,
  coins,
}) => {
  // Room code to join
  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const codeInputRef = useRef<any>(null);

  // Custom Settings
  const [maxPlayers, setMaxPlayers] = useState<number>(6);
  const [totalRounds, setTotalRounds] = useState<number>(10);
  const [questionTimeSec, setQuestionTimeSec] = useState<number>(15);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'mixed'>('mixed');
  const [penaltyForWrong, setPenaltyForWrong] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | 'mixed'>('mixed');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');

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

    const categories: QuestionCategory[] =
      selectedCategory === 'mixed'
        ? ['general_culture']
        : [selectedCategory as QuestionCategory];

    const settings: CustomRoomSettings = {
      maxPlayers,
      totalRounds,
      questionTimeSec,
      difficulty,
      penaltyForWrong,
      categories,
      mixedCategories: selectedCategory === 'mixed',
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
        <Text style={styles.title}>ÖZEL ODA</Text>

        {/* Create Room Card */}
        <View style={styles.glassCard}>
          <Text style={styles.cardHeading}>Oda Oluştur</Text>

          {/* Oyuncu Sayısı */}
          <Text style={styles.settingLabel}>OYUNCU SAYISI ({maxPlayers} Kişi)</Text>
          <View style={styles.optionsRow}>
            {PLAYER_OPTIONS.map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.optionBtn, maxPlayers === num && styles.optionBtnActive]}
                onPress={() => {
                  sound.playSound('tap');
                  setMaxPlayers(num);
                }}
              >
                <Text style={[styles.optionBtnText, maxPlayers === num && styles.optionBtnTextActive]}>
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Soru Sayısı */}
          <Text style={styles.settingLabel}>SORU SAYISI ({totalRounds} Soru)</Text>
          <View style={styles.optionsRow}>
            {QUESTION_OPTIONS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.optionBtn, totalRounds === q && styles.optionBtnActive]}
                onPress={() => {
                  sound.playSound('tap');
                  setTotalRounds(q);
                }}
              >
                <Text style={[styles.optionBtnText, totalRounds === q && styles.optionBtnTextActive]}>
                  {q}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Soru Süresi */}
          <Text style={styles.settingLabel}>SORU SÜRESİ ({questionTimeSec} Sn)</Text>
          <View style={styles.optionsRow}>
            {TIME_OPTIONS.map((sec) => (
              <TouchableOpacity
                key={sec}
                style={[styles.optionBtn, questionTimeSec === sec && styles.optionBtnActive]}
                onPress={() => {
                  sound.playSound('tap');
                  setQuestionTimeSec(sec);
                }}
              >
                <Text style={[styles.optionBtnText, questionTimeSec === sec && styles.optionBtnTextActive]}>
                  {sec}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Zorluk */}
          <Text style={styles.settingLabel}>ZORLUK DERECESİ</Text>
          <View style={styles.optionsRow}>
            {DIFFICULTY_OPTIONS.map((diff) => (
              <TouchableOpacity
                key={diff.id}
                style={[styles.optionBtn, difficulty === diff.id && styles.optionBtnActive]}
                onPress={() => {
                  sound.playSound('tap');
                  setDifficulty(diff.id);
                }}
              >
                <Text style={[styles.optionBtnText, difficulty === diff.id && styles.optionBtnTextActive]}>
                  {diff.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Kategori Seçimi (Horizontal Scroll) */}
          <Text style={styles.settingLabel}>KATEGORİ SEÇİMİ</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORY_LIST.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                  onPress={() => {
                    sound.playSound('tap');
                    setSelectedCategory(cat.id);
                  }}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Yanlış Cevap Cezası Toggle */}
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
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#6FE3C1' }}
              thumbColor={penaltyForWrong ? '#12052C' : '#D9CDF5'}
            />
          </View>

          <Button3D
            title="ODA OLUŞTUR"
            onPress={handleCreateRoomPress}
            style={{ marginTop: 14 }}
          />
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>VEYA</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Join Room Card */}
        <View style={styles.glassCard}>
          <Text style={styles.cardHeading}>Odaya Katıl</Text>

          {/* 6 Digit Boxes */}
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
              const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
              if (cleaned.length <= 6) {
                setRoomCode(cleaned);
                if (cleaned.length > 0) sound.playSound('tap');
              }
            }}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <View style={styles.joinActionsRow}>
            <TouchableOpacity
              style={styles.pasteBtn}
              onPress={async () => {
                sound.playSound('tap');
                try {
                  const clip = await Clipboard.getStringAsync();
                  const cleaned = clip.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
                  if (cleaned.length >= 4) {
                    setRoomCode(cleaned.slice(0, 6));
                    sound.playSound('reward');
                  }
                } catch {}
              }}
            >
              <Text style={styles.pasteBtnText}>📋 Yapıştır</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={handleJoinPress}
            >
              <Text style={styles.joinBtnText}>KATIL</Text>
            </TouchableOpacity>
          </View>

          {joinError && <Text style={styles.errorText}>{joinError}</Text>}
        </View>
      </ScrollView>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 80,
    paddingHorizontal: 12,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFC43D',
    letterSpacing: 2,
    textAlign: 'center',
    marginVertical: 10,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 16,
    marginBottom: 12,
  },
  cardHeading: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  settingLabel: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 11,
    color: '#D9CDF5',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBtnActive: {
    backgroundColor: 'rgba(107, 60, 255, 0.6)',
    borderColor: '#FFC43D',
  },
  optionBtnText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 12,
    color: '#D9CDF5',
  },
  optionBtnTextActive: {
    color: '#FFFFFF',
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(107, 60, 255, 0.5)',
    borderColor: '#FFC43D',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryName: {
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    color: '#D9CDF5',
  },
  categoryNameSelected: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 4, 24, 0.5)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  switchLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  switchSub: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    color: '#D9CDF5',
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 12,
    color: '#D9CDF5',
  },
  digitsWrapper: {
    marginVertical: 10,
  },
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  digitBox: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 4, 24, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitBoxFilled: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
  },
  digitText: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#FFFFFF',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  joinActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  pasteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteBtnText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    color: '#D9CDF5',
  },
  joinBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 14,
    color: '#12052C',
  },
  errorText: {
    color: '#FF5C77',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 8,
  },
});
