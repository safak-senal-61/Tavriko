import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop, Circle } from 'react-native-svg';
import type { JokerId } from '@trivia/shared';

const colors: Record<JokerId, [string, string, string]> = {
  joker_eliminate: ['#793760', '#321D42', '#FFABCA'],
  joker_half: ['#4D4693', '#25204D', '#CFB8FF'],
  joker_initial: ['#256577', '#172D4D', '#8DF2E0'],
  joker_word_count: ['#80543C', '#3E2841', '#FFDA91'],
};

export function JokerArtwork({ kind, size }: { kind: JokerId; size: number }) {
  const gradientId = `joker-${useId().replace(/[^a-z0-9-]/gi, '')}`;
  const [light, dark, ink] = colors[kind];
  const half = kind === 'joker_half';
  const elimination = kind === 'joker_eliminate' || half;
  return <View pointerEvents="none" accessible={false} aria-hidden testID={`wallet-art-${kind}`}>
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={light} />
          <Stop offset="100%" stopColor={dark} />
        </LinearGradient>
      </Defs>
      <Rect x={23} y={12} width={53} height={73} rx={12} fill={dark} stroke={light} strokeWidth={2} transform="rotate(13 49 49)" />
      <Rect x={15} y={9} width={58} height={76} rx={12} fill={`url(#${gradientId})`} stroke={ink} strokeWidth={2.5} />
      <Path d="M24 20h10M55 74h10" stroke={ink} opacity={.65} strokeWidth={2.5} strokeLinecap="round" />
      {elimination ? <G strokeLinecap="round" strokeLinejoin="round">
        {[29, 40, 51, 62].map((y, row) => {
          const removed = row === 1 || (half && row === 3);
          return <G key={y} opacity={removed ? 1 : .62}>
            <Rect x={25} y={y - 4} width={39} height={8} rx={4} fill="#16142A" opacity={.63} />
            {removed
              ? <Path d={`M30 ${y - 2}l4 4m0-4l-4 4M40 ${y}h16`} stroke={ink} strokeWidth={2.3} />
              : <><Circle cx={32} cy={y} r={1.8} fill={ink} /><Path d={`M40 ${y}h15`} stroke={ink} strokeWidth={1.9} /></>}
          </G>;
        })}
      </G> : kind === 'joker_initial' ? <G stroke={ink} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <Circle cx={42} cy={43} r={16} fill={dark} strokeWidth={3} />
        <Path d="m53 56 9 9M36 48l6-13 6 13m-9-5h6" strokeWidth={3.2} />
      </G> : <G fill={ink}>
        <Rect x={25} y={32} width={15} height={8} rx={3} />
        <Rect x={44} y={32} width={19} height={8} rx={3} opacity={.75} />
        <Rect x={25} y={46} width={38} height={8} rx={3} />
        <Path d="M25 59v4h38v-4" fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </G>}
    </Svg>
  </View>;
}
