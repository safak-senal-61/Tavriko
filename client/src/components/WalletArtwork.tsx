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

export function WalletArtwork({ kind, size = 88, tier = 1 }: { kind: WalletArt; size?: number; tier?: number }) {
  if (kind !== 'diamonds' && kind !== 'gold') return <JokerArtwork kind={kind} size={size} />;
  const source = WALLET_PACKS[kind][tier - 1] ?? WALLET_PACKS[kind][0];

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
