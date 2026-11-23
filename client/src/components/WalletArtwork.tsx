import React from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import type { JokerId } from '@trivia/shared';

export type WalletArt = 'diamonds' | 'gold' | JokerId;

// Byte-for-byte copies of the original assets/images/store PNGs. Keep these
// small wallet assets in the app bundle so the artwork also works offline.
const WALLET_PACKS: Record<'diamonds' | 'gold', readonly ImageSourcePropType[]> = {
  diamonds: [
    require('../../bundled/wallet/gems_s.png'),
    require('../../bundled/wallet/gems_m.png'),
    require('../../bundled/wallet/gems_l.png'),
    require('../../bundled/wallet/gems_xl.png'),
  ],
  gold: [
    require('../../bundled/wallet/coins_s.png'),
    require('../../bundled/wallet/coins_m.png'),
    require('../../bundled/wallet/coins_l.png'),
    require('../../bundled/wallet/coins_xl.png'),
  ],
};
const JOKER_POSTERS = {
  joker_eliminate: require('../../bundled/jokers/poster/siklari-patlat.webp'),
  joker_half: require('../../bundled/jokers/poster/yari-yariya.webp'),
  joker_nearest: require('../../bundled/jokers/poster/hedefi-bul.webp'),
  joker_prophecy: require('../../bundled/jokers/poster/kehanet.webp'),
  joker_reveal: require('../../bundled/jokers/poster/cevap-goster.webp'),
  joker_dice: require('../../bundled/jokers/poster/sans-zari.webp'),
  joker_streak_guard: require('../../bundled/jokers/poster/seri-koruyucu.webp'),
  joker_lightning: require('../../bundled/jokers/poster/simsek-cevap.webp'),
  joker_double: require('../../bundled/jokers/poster/cifte-puan.webp'),
  joker_initial: require('../../bundled/jokers/poster/ilk-karakter.webp'),
  joker_word_count: require('../../bundled/jokers/poster/kelime-sayisi.webp'),
  joker_retry: require('../../bundled/jokers/poster/ikinci-sans.webp'),
  joker_pause: require('../../bundled/jokers/poster/zaman-molasi.webp'),
  joker_support: require('../../bundled/jokers/poster/sihirli-destek.webp'),
  joker_probe: require('../../bundled/jokers/poster/kralin-hakki.webp'),
  joker_gold_hunt: require('../../bundled/jokers/poster/altin-avi.webp'),
  joker_replace: require('../../bundled/jokers/poster/soru-degistir.webp'),
  joker_audience: require('../../bundled/jokers/poster/halk-destegi.webp'),
  joker_extra_time: require('../../bundled/jokers/poster/ek-sure.webp'),
  joker_skip: require('../../bundled/jokers/poster/pas-gec.webp'),
  joker_shield: require('../../bundled/jokers/poster/koruma-kalkani.webp'),
  joker_freeze: require('../../bundled/jokers/poster/zaman-dondurma.webp'),
} satisfies Record<JokerId, ImageSourcePropType>;

export function WalletArtwork({ kind, size = 88, tier = 1 }: { kind: WalletArt; size?: number; tier?: number }) {
  const isJoker = kind !== 'diamonds' && kind !== 'gold';
  const source = isJoker ? JOKER_POSTERS[kind] : WALLET_PACKS[kind][tier - 1] ?? WALLET_PACKS[kind][0];

  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      fadeDuration={0}
      accessible={false}
      aria-hidden
      testID={`wallet-art-${kind}`}
    />
  );
}
