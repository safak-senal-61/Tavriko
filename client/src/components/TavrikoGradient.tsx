import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

let gradientSeq = 0;

/**
 * Ebeveyninin tamamını kaplayan SVG doğrusal gradyan katmanı.
 * Ebeveyn `overflow: 'hidden'` ve `borderRadius` ile köşeleri keser.
 * (Projede expo-linear-gradient olmadığı için react-native-svg kullanılır.)
 */
export const GradientFill: React.FC<{
  colors: string[];
  /** 0..1 arası durak noktaları; verilmezse eşit dağıtılır */
  stops?: number[];
  /** Yön: 'vertical' (yukarıdan aşağı), 'horizontal' (soldan sağa), 'diagonal' */
  direction?: 'vertical' | 'horizontal' | 'diagonal';
  opacity?: number;
  style?: ViewStyle;
}> = ({ colors, stops, direction = 'vertical', opacity = 1, style }) => {
  const idRef = React.useRef<string>('');
  if (!idRef.current) {
    gradientSeq += 1;
    idRef.current = `tvgrad${gradientSeq}`;
  }
  const id = idRef.current;
  const x2 = direction === 'vertical' ? '0' : '1';
  const y2 = direction === 'horizontal' ? '0' : '1';
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
            {colors.map((c, i) => (
              <Stop
                key={`${c}-${i}`}
                offset={String(
                  stops?.[i] ?? (colors.length === 1 ? 0 : i / (colors.length - 1))
                )}
                stopColor={c}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
      </Svg>
    </View>
  );
};

/** 1250 -> "1.250" (Türkçe binlik ayırıcı; Intl'e bağımlı değil) */
export const formatNumberTR = (value: number | undefined | null): string => {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
