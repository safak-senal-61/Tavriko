import React from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import type { JokerId } from '@trivia/shared';
import { JokerArtwork } from './JokerArtwork';

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
} satisfies Record<Exclude<JokerId, 'joker_initial' | 'joker_word_count'>, ImageSourcePropType>;

export function WalletArtwork({ kind, size = 88, tier = 1 }: { kind: WalletArt; size?: number; tier?: number }) {
  if (kind === 'joker_initial' || kind === 'joker_word_count') return <JokerArtwork kind={kind} size={size} />;
  const isJoker = kind !== 'diamonds' && kind !== 'gold';
  const source = isJoker ? JOKER_POSTERS[kind] : WALLET_PACKS[kind][tier - 1] ?? WALLET_PACKS[kind][0];

  return (
    <Image
      source={source}
      style={{ width: size, height: size, borderRadius: isJoker ? size / 6 : 0 }}
      resizeMode="contain"
      fadeDuration={0}
      accessible={false}
      aria-hidden
      testID={`wallet-art-${kind}`}
    />
  );
}
