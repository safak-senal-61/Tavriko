import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
} from '../components/TavrikoIcons';
interface CustomRoomScreenProps {
  onBack: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  avatarSeed?: string;
  coins?: number;
}
export const CustomRoomScreen: React.FC<CustomRoomScreenProps> = ({
  onBack,
  onCreateRoom,
  onJoinRoom,
  avatarSeed,
  coins,
}) => {
  // Starts completely empty (no pre-filled code!)
  const [roomCode, setRoomCode] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('Karışık');
  const [joinError, setJoinError] = useState<string | null>(null);
  const codeInputRef = useRef<any>(null);
  const chips = ['Karışık', 'Orta', '6 oyuncu', '10 soru'];
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
          <View style={styles.chipsRow}>
            {chips.map((c) => {
              const isOn = selectedPreset === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, isOn && styles.chipOn]}
                  onPress={() => {
                    sound.playSound('tap');
                    sound.triggerHaptic('light');
                    setSelectedPreset(c);
                  }}
                >
                  <Text style={styles.chipText}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Button3D title="ODA KUR" onPress={onCreateRoom} />
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
          {/* 6 Digit Boxes + Tappable Input */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              sound.playSound('tap');
              codeInputRef.current?.focus();
            }}
            style={styles.digitBoxesWrap}
          >
            {digits.map((char, i) => {
              const filled = char.length > 0;
              const isCurrentSlot = i === roomCode.length;
              return (
                <View
                  key={i}
                  style={[
                    styles.digitBox,
                    !filled && styles.digitBoxEmpty,
                    isCurrentSlot && styles.digitBoxActive,
                  ]}
                >
                  <Text
                    style={
                      filled
                        ? styles.digitTextFilled
                        : styles.digitTextPlaceholder
                    }
                  >
                    {filled ? char.toUpperCase() : '·'}
                  </Text>
                </View>
              );
            })}
            <TextInput
              ref={codeInputRef}
              style={styles.hiddenInput}
              value={roomCode}
              onChangeText={(txt) => {
                sound.playSound('tap');
                setJoinError(null);
                setRoomCode(
                  txt.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
                );
              }}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </TouchableOpacity>
          {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}
          <TouchableOpacity
            style={styles.pasteBtn}
            onPress={async () => {
              const clip = await Clipboard.getStringAsync();
              if (clip) {
                const clean = clip.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
                if (clean) {
                  setRoomCode(clean);
                  setJoinError(null);
                  sound.playSound('tap');
                }
              }
            }}
          >
            <Text style={styles.pasteBtnText}>📋 Panodan Kodu Yapıştır</Text>
          </TouchableOpacity>
          <Button3D
            title="KATIL"
            variant="mint"
            onPress={handleJoinPress}
          />
          <Text style={styles.hintText}>
            Kutulara dokunarak 6 haneli oda kodunu gir
          </Text>
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
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    padding: 16,
  },
  cardHeading: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  chipOn: {
    backgroundColor: '#6B3CFF',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dividerText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  digitBoxesWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    position: 'relative',
  },
  digitBox: {
    width: 46,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitBoxEmpty: {
    borderStyle: 'dashed',
  },
  digitBoxActive: {
    borderColor: '#FFC43D',
    borderWidth: 2,
  },
  digitTextFilled: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
    color: '#FFC43D',
  },
  digitTextPlaceholder: {
    fontSize: 24,
    color: '#CBBFE8',
    fontWeight: '800',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    color: 'transparent',
  },
  errorText: {
    color: '#FF7A8A',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 10,
  },
  pasteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  pasteBtnText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  hintText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 10,
  },
});