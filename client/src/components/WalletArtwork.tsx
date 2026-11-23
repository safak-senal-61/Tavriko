import React from 'react';
import { Image, type ImageSourcePropType } from 'react-native';

export type WalletArt = 'diamonds' | 'gold' | 'joker_eliminate' | 'joker_half';

// Bundle the original store PNGs so the artwork works without a CDN connection.
const WALLET_PACKS: Record<'diamonds' | 'gold', readonly ImageSourcePropType[]> = {
  diamonds: [
    require('../../assets/images/store/gems_s.png'),
    require('../../assets/images/store/gems_m.png'),
    require('../../assets/images/store/gems_l.png'),
    require('../../assets/images/store/gems_xl.png'),
  ],
  gold: [
    require('../../assets/images/store/coins_s.png'),
    require('../../assets/images/store/coins_m.png'),
    require('../../assets/images/store/coins_l.png'),
    require('../../assets/images/store/coins_xl.png'),
  ],
};

const JOKER_ART: Record<'joker_eliminate' | 'joker_half', ImageSourcePropType> = {
  joker_eliminate: require('../../bundled/jokers/joker_eliminate.png'),
  joker_half: require('../../bundled/jokers/joker_half.png'),
};

export function WalletArtwork({ kind, size = 88, tier = 1 }: { kind: WalletArt; size?: number; tier?: number }) {
  const source = kind === 'diamonds' || kind === 'gold'
    ? WALLET_PACKS[kind][tier - 1] ?? WALLET_PACKS[kind][0]
    : JOKER_ART[kind];

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
