import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { THEME } from '../theme/tokens';
import { TavrikoScreen, Button3D } from '../components/TavrikoIcons';
interface ReconnectScreenProps {
  onRetry: () => void;
  onExitToHome: () => void;
}
export const ReconnectScreen: React.FC<ReconnectScreenProps> = ({
  onRetry,
  onExitToHome,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(10);
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <TavrikoScreen style={styles.centerAll}>
      {/* Circular Countdown Ring */}
      <View style={styles.ringWrap}>
        <Svg width={150} height={150} viewBox="0 0 150 150">
          <Circle
            cx="75"
            cy="75"
            r="64"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="12"
          />
          <Circle
            cx="75"
            cy="75"
            r="64"
            fill="none"
            stroke="#FF9B2F"
            strokeWidth="12"
            strokeDasharray="402"
            strokeDashoffset={402 * (1 - secondsLeft / 10)}
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.ringNumberWrap}>
          <Text style={styles.ringNumber}>{secondsLeft}</Text>
        </View>
      </View>
      <Text style={styles.title}>BAĞLANTI KOPTU</Text>
      <Text style={styles.subtitle}>
        Yeniden bağlanıyoruz. 10 saniye içinde dönemezsen maçtan düşersin.
      </Text>
      <Button3D
        title="YENİDEN DENE"
        variant="mint"
        onPress={onRetry}
        style={{ width: 240 }}
      />
      <TouchableOpacity
        style={styles.leaveBtn}
        onPress={onExitToHome}
        activeOpacity={0.85}
      >
        <Text style={styles.leaveBtnText}>Maçtan ayrıl</Text>
      </TouchableOpacity>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  centerAll: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringNumberWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNumber: {
    fontFamily: THEME.fonts.display,
    fontSize: 56,
    color: '#FFFFFF',
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    marginTop: 22,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 8,
    marginBottom: 28,
  },
  leaveBtn: {
    width: 240,
    height: 50,
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
});