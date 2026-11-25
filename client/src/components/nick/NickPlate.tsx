/**
 * NickPlate — paketin kendi plaka arka planı (Expo Linear Gradient).
 * Mağaza kartı, envanter ve önizleme yüzeylerinde nickin arkasında durur;
 * paletin plaka renkleri + nadirlik renginde ince bir parlama kenarı.
 */
import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getNickStyle, NICK_RARITY_COLORS } from '@trivia/shared';
import { withAlpha } from './nickColor';

export const NickPlate = memo(function NickPlate({
  styleId,
  style,
  children,
  radius = 14,
  dimmed = false,
}: {
  styleId: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  radius?: number;
  /** Kilitli paketlerde plaka biraz söner */
  dimmed?: boolean;
}) {
  const def = getNickStyle(styleId);
  const plate = def?.palette.plate ?? ['#1B0B3A', '#2A1157'];
  const rarity = def ? NICK_RARITY_COLORS[def.rarity].main : '#8A7BAF';
  const glow = def?.palette.glow ?? '#8B5CF6';
  return (
    <View style={[styles.wrap, { borderRadius: radius, borderColor: withAlpha(rarity, dimmed ? 0.25 : 0.55) }, style]}>
      <LinearGradient
        colors={[plate[0], plate[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        colors={[withAlpha(glow, dimmed ? 0.08 : 0.22), withAlpha(glow, 0)]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
