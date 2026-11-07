import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  GemIcon,
  ChestIcon,
} from '../components/TavrikoIcons';
export interface PaymentItem {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  priceNumeric: number;
  iconType?: 'gem' | 'chest' | 'pack';
}
interface PaymentScreenProps {
  user?: UserProfile;
  token?: string;
  item: PaymentItem;
  apiBaseUrl?: string;
  onBack: () => void;
  onSuccess: (updatedUser: UserProfile) => void;
}
const PAYMENT_TABS = ['Kart', 'Apple Pay', 'Google Pay'] as const;
export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  user,
  token,
  item,
  apiBaseUrl,
  onBack,
  onSuccess,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'Kart' | 'Apple Pay' | 'Google Pay'>('Kart');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date(2028, 7, 1)); // August 2028 default
  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [updatedUserResult, setUpdatedUserResult] = useState<UserProfile | null>(null);
  // Format Card Number (adds space every 4 digits)
  const handleCardNumberChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    const parts = cleaned.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join(' ') : cleaned);
    setErrorMsg(null);
  };
  // Format CVV (max 3 digits)
  const handleCvvChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 3);
    setCvv(cleaned);
    setErrorMsg(null);
  };
  // Date Picker Change Handler
  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setPickerDate(selectedDate);
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const yy = String(selectedDate.getFullYear()).slice(-2);
      setExpiryDate(`${mm} / ${yy}`);
      setErrorMsg(null);
    }
  };
  // Handle Payment Submit
  const handlePay = async () => {
    setErrorMsg('Gerçek kart ödemeleri henüz güvenli bir ödeme sağlayıcısına bağlanmadı. Kart bilgisi girmeyin; bu ekran şu anda ödeme almaz.');
    setLoading(false);
    return;

    if (selectedMethod !== 'Kart') {
      sound.playSound('tap');
      setErrorMsg(`${selectedMethod} bu cihazda şu an provizyon aşamasındadır. Lütfen Kart seçeneğiyle ödeme yapın.`);
      return;
    }
    if (!cardHolder.trim()) {
      sound.playSound('wrong');
      setErrorMsg('Lütfen kart üzerindeki ad ve soyadı girin.');
      return;
    }
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 16) {
      sound.playSound('wrong');
      setErrorMsg('Lütfen 16 haneli kart numaranızı eksiksiz girin.');
      return;
    }
    if (cvv.length < 3) {
      sound.playSound('wrong');
      setErrorMsg('Lütfen 3 haneli güvenlik kodunu (CVV) girin.');
      return;
    }
    if (!user) {
      sound.playSound('wrong');
      setErrorMsg('İşlem yapmak için giriş yapmalısınız.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    sound.playSound('tap');
    const base = apiBaseUrl || DEFAULT_API_BASE;
    try {
      const res = await fetch(`${base}/social/shop/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          userId: user.id,
          packId: item.id,
          cardHolder: cardHolder.trim(),
          last4: cleanCard.slice(-4),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ödeme işlemi onaylanamadı.');
      }
      sound.playSound('victory');
      sound.triggerHaptic('success');
      setUpdatedUserResult(data.user);
      setSuccessModalVisible(true);
    } catch (err: any) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setErrorMsg(err.message || 'Ödeme tamamlanamadı. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };
  // Formatted Card Number for Blue Card Preview
  const displayCardNumber = (() => {
    const raw = cardNumber.trim();
    if (!raw) return '•••• •••• •••• 4821';
    const clean = raw.replace(/\s/g, '');
    const last4 = clean.slice(-4) || '4821';
    return `•••• •••• •••• ${last4}`;
  })();
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header matching Ödeme@1x.png */}
        <Text style={styles.title}>ÖDEME ŞU ANDA KAPALI</Text>
        <Text style={styles.subtitle}>Gerçek para ödemeleri henüz güvenli bir ödeme sağlayıcısına bağlanmadı. Kart bilgilerinizi girmeyin; bu ekran ödeme almaz.</Text>
        {/* Selected Package Banner Card */}
        <View style={styles.packageCard}>
          <View style={styles.packageIconWrap}>
            {item.iconType === 'chest' ? (
              <ChestIcon size={40} />
            ) : (
              <GemIcon size={38} />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.packageTitle}>{item.title}</Text>
            <Text style={styles.packageSub}>{item.subtitle}</Text>
          </View>
          <Text style={styles.packagePrice}>{item.price}</Text>
        </View>
        {/* Payment Method Pills (Kart, Apple Pay, Google Pay) */}
        <View style={styles.methodsRow}>
          {PAYMENT_TABS.map((m) => {
            const isSelected = selectedMethod === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.methodPill, isSelected && styles.methodPillActive]}
                onPress={() => {
                  sound.playSound('tap');
                  setSelectedMethod(m);
                  setErrorMsg(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.methodText, isSelected && styles.methodTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Realistic 3D Blue Credit Card Preview matching Ödeme@1x.png */}
        <View style={styles.cardPreview}>
          {/* Ambient Contactless Wave Graphics */}
          <View style={styles.cardWatermarkCircle} />
          {/* Top Row: Chip and Contactless Symbol */}
          <View style={styles.cardTopRow}>
            {/* Golden Chip */}
            <View style={styles.chipGraphic}>
              <View style={styles.chipInnerGrid} />
            </View>
            {/* Contactless Signal */}
            <View style={styles.contactlessWrap}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 4C14.5 7 14.5 17 12 20"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <Path
                  d="M16 2C19.5 6 19.5 18 16 22"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <Path
                  d="M8 7C9.5 9 9.5 15 8 17"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
          </View>
          {/* Masked Card Number */}
          <Text style={styles.cardNumberText} numberOfLines={1}>
            {displayCardNumber}
          </Text>
          {/* Bottom Row: Cardholder Name & Expiry */}
          <View style={styles.cardBottomRow}>
            <Text style={styles.cardHolderName} numberOfLines={1}>
              {cardHolder.toUpperCase() || 'DENİZ YILMAZ'}
            </Text>
            <Text style={styles.cardExpiryText}>{expiryDate}</Text>
          </View>
        </View>
        {/* Input Form matching Ödeme@1x.png */}
        <View style={styles.formWrap}>
          {/* 1. Kart üzerindeki ad soyad */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Kart üzerindeki ad soyad</Text>
            <TextInput
              style={styles.textInput}
              value={cardHolder}
              onChangeText={(t) => {
                setCardHolder(t);
                setErrorMsg(null);
              }}
              placeholder="Örn: DENİZ YILMAZ"
              placeholderTextColor="rgba(217, 205, 245, 0.45)"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          {/* 2. Kart numarası */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Kart numarası</Text>
            <TextInput
              style={styles.textInput}
              value={cardNumber}
              onChangeText={handleCardNumberChange}
              placeholder="4532 1234 5678 4821"
              placeholderTextColor="rgba(217, 205, 245, 0.45)"
              keyboardType="numeric"
              maxLength={19}
            />
          </View>
          {/* 3. Son kullanma & CVV (Side by side) */}
          <View style={styles.doubleRow}>
            {/* Son kullanma (Selectable with Date Picker) */}
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Son kullanma</Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                activeOpacity={0.8}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.datePickerValueText}>{expiryDate}</Text>
                <Text style={styles.calendarIcon}>📅</Text>
              </TouchableOpacity>
            </View>
            {/* CVV */}
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>CVV</Text>
              <TextInput
                style={styles.textInput}
                value={cvv}
                onChangeText={handleCvvChange}
                placeholder="789"
                placeholderTextColor="rgba(217, 205, 245, 0.45)"
                keyboardType="numeric"
                secureTextEntry
                maxLength={3}
              />
            </View>
          </View>
        </View>
        {/* Date Picker Modal (iOS & Android) */}
        {showDatePicker && Platform.OS === 'ios' && (
          <Modal transparent animationType="fade" visible={showDatePicker}>
            <View style={styles.modalBackdrop}>
              <View style={styles.iosPickerBox}>
                <Text style={styles.iosPickerTitle}>Son Kullanma Tarihi Seçin</Text>
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  textColor="#FFFFFF"
                />
                <Button3D
                  title="TAMAM"
                  variant="gold"
                  onPress={() => setShowDatePicker(false)}
                  style={{ marginTop: 12, width: '100%' }}
                />
              </View>
            </View>
          </Modal>
        )}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
        {/* Error Banner */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        )}
        {/* Price & Summary matching Ödeme@1x.png */}
        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>Toplam</Text>
            <Text style={styles.kdvLabel}>KDV dahil</Text>
          </View>
          <Text style={styles.totalPriceText}>{item.price}</Text>
        </View>
        {/* Pay Button */}
        <Button3D
          title={loading ? 'ÖDEME YAPILIYOR... 🔒' : `${item.price} ÖDE`}
          variant="gold"
          disabled={loading}
          onPress={handlePay}
          style={{ width: '100%', minHeight: 52 }}
          textStyle={{ fontSize: 18, letterSpacing: 0.8 }}
        />
        {/* 256-bit SSL Security Note */}
        <View style={styles.securityNote}>
          <Text style={styles.securityText}>
            🔒 256-bit SSL ile korunur · Kart bilgilerin kaydedilmez
          </Text>
        </View>
      </ScrollView>
      {/* Payment Success Celebration Modal */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSuccessModalVisible(false);
          if (updatedUserResult) onSuccess(updatedUserResult);
          onBack();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.successCard}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>🎉</Text>
            <Text style={styles.successTitle}>ÖDEME BAŞARILI!</Text>
            <Text style={styles.successSubtitle}>
              {item.title} ({item.subtitle}) hesabınıza başarıyla eklendi ve veritabanına kaydedildi.
            </Text>
            <Button3D
              title="HARİKA! MAĞAZAYA DÖN"
              variant="mint"
              onPress={() => {
                setSuccessModalVisible(false);
                if (updatedUserResult) onSuccess(updatedUserResult);
                onBack();
              }}
              style={{ width: '100%', marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 1,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 16,
    marginBottom: 16,
  },
  packageIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 154, 240, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFFFFF',
  },
  packageSub: {
    color: '#A992E2',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
  packagePrice: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  methodPillActive: {
    backgroundColor: '#6B3CFF',
    borderColor: '#8A60FF',
  },
  methodText: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  methodTextActive: {
    color: '#FFFFFF',
  },
  cardPreview: {
    width: '100%',
    height: 180,
    borderRadius: 22,
    backgroundColor: '#3762E4',
    padding: 18,
    justifyContent: 'space-between',
    marginBottom: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: '#3762E4',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  cardWatermarkCircle: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipGraphic: {
    width: 36,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFD700',
    borderWidth: 1.5,
    borderColor: '#E6A800',
    padding: 3,
    justifyContent: 'center',
  },
  chipInnerGrid: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    borderRadius: 3,
  },
  contactlessWrap: {
    opacity: 0.9,
  },
  cardNumberText: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: 2.5,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardHolderName: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  cardExpiryText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  formWrap: {
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    backgroundColor: 'rgba(8, 3, 20, 0.72)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doubleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    marginBottom: 4,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
    paddingVertical: 2,
  },
  datePickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 3, 20, 0.72)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  datePickerValueText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  calendarIcon: {
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  kdvLabel: {
    color: '#A992E2',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  totalPriceText: {
    fontFamily: THEME.fonts.display,
    fontSize: 30,
    color: '#FFC43D',
  },
  securityNote: {
    marginTop: 14,
    alignItems: 'center',
  },
  securityText: {
    color: '#84D8FF',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 92, 119, 0.2)',
    borderWidth: 1,
    borderColor: '#FF5C77',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#FF8598',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 3, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iosPickerBox: {
    width: '100%',
    backgroundColor: '#1E0E45',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#6B3CFF',
  },
  iosPickerTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFC43D',
    marginBottom: 10,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#1E0E45',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFC43D',
    padding: 24,
    alignItems: 'center',
  },
  successTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 24,
    color: '#FFC43D',
    marginBottom: 6,
  },
  successSubtitle: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    lineHeight: 18,
  },
});