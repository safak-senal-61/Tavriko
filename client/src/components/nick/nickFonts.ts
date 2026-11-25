/**
 * NickRenderer'ın Skia ile çizebildiği yazı tipleri. RN <Text> ile aynı TTF
 * dosyaları kullanılır; böylece görünmez yerleşim metni ile Skia çizimi aynı
 * genişlikte olur.
 */
export const NICK_FONT_FILES: Record<string, number> = {
  Nunito_400Regular: require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'),
  Nunito_600SemiBold: require('@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf'),
  Nunito_700Bold: require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
  Nunito_800ExtraBold: require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
  Nunito_900Black: require('@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf'),
};

export const NICK_DEFAULT_FONT = 'Nunito_800ExtraBold';

/** fontWeight → Nunito ailesi (fontFamily verilmemiş stiller için) */
export function nickFontFor(fontFamily?: string, fontWeight?: string | number): string | null {
  if (fontFamily) return NICK_FONT_FILES[fontFamily] ? fontFamily : null;
  const w = Number(fontWeight === 'bold' ? 700 : fontWeight === 'normal' ? 400 : fontWeight);
  if (!Number.isFinite(w) || w === 0) return NICK_DEFAULT_FONT;
  if (w >= 900) return 'Nunito_900Black';
  if (w >= 800) return 'Nunito_800ExtraBold';
  if (w >= 700) return 'Nunito_700Bold';
  if (w >= 600) return 'Nunito_600SemiBold';
  return 'Nunito_400Regular';
}
