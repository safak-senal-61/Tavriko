import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Alt menü ölçüleri (TavrikoIcons ile aynı). Menü, ekranın altına mutlak
 * konumlandığı için kaydırma alanlarının alt boşluğu bu değerlere göre
 * hesaplanır.
 */
export const NAV_BAR_HEIGHT = 66;
export const NAV_BAR_MARGIN = 14;
/** Menünün kapladığı toplam yükseklik (boşluklar dahil). */
export const NAV_BAR_SPACE = NAV_BAR_HEIGHT + NAV_BAR_MARGIN * 2;

/**
 * Cihazın sistem çubuğu (gesture bar / tablet görev çubuğu) için alt boşluk.
 * Android 15+ ve tabletlerde uygulama kenardan kenara çizildiği için menü ve
 * içerik sistem çubuğunun altında kalmamalı.
 */
export const useNavInset = (): number => {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'web') return 0;
  return Math.max(insets.bottom, 0);
};

/** Yatay sistem boşluğu (yatay modda çentik / sistem çubuğu). */
export const useSideInset = (): number => {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'web') return 0;
  return Math.max(insets.left, insets.right, 0);
};

/**
 * Kaydırılabilir sekme ekranları için alt boşluk: menünün kapladığı alan +
 * cihazın sistem çubuğu.
 */
export const useNavBottomPad = (base: number): number => {
  const inset = useNavInset();
  return base + inset;
};
