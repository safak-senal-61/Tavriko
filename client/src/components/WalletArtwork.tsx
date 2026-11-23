import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type WalletArt = 'diamonds' | 'gold' | 'joker_eliminate' | 'joker_half';

export function WalletArtwork({ kind, size = 88, tier = 1 }: { kind: WalletArt; size?: number; tier?: number }) {
  const jewel = (x: number, y: number, scale: number) => (
    <G key={`${x}:${y}`} transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path d="M12 5h34l12 15-29 32L0 20z" fill="url(#walletBlue)" stroke="#97D9F3" strokeWidth="1.5" />
      <Path d="m12 5 8 15L29 5l10 15 7-15M1 20h56M20 20l9 31 10-31" fill="none" stroke="#BAF0FF" strokeOpacity=".85" />
      <Path d="m29 51 10-31h18z" fill="#2F58AE" opacity=".62" />
    </G>
  );
  const coin = (x: number, y: number) => (
    <G key={`${x}:${y}`} transform={`translate(${x} ${y})`}>
      <Path d="M-20 0v6c0 6 9 11 20 11s20-5 20-11V0" fill="#AE602D" stroke="#F3B860" />
      <Ellipse rx="20" ry="11" fill="url(#walletGold)" stroke="#FFE3A2" />
      <Ellipse rx="14" ry="7" fill="none" stroke="#BE7434" />
      <Path d="m-4 1 4-4 4 4-4 3z" fill="#B97637" />
    </G>
  );
  const isJoker = kind === 'joker_eliminate' || kind === 'joker_half';
  return (
    <Svg width={size} height={size} viewBox="0 0 120 108" aria-hidden>
      <Defs>
        <LinearGradient id="walletBlue" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#B4F1FF" /><Stop offset=".44" stopColor="#5AA9E1" /><Stop offset="1" stopColor="#5040A4" />
        </LinearGradient>
        <LinearGradient id="walletGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE4A0" /><Stop offset="1" stopColor="#E9A553" />
        </LinearGradient>
        <LinearGradient id="walletInk" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#344269" /><Stop offset="1" stopColor="#181D34" />
        </LinearGradient>
      </Defs>
      <Circle cx="60" cy="52" r="43" fill={kind === 'diamonds' ? '#1C3552' : '#352C36'} stroke={kind === 'diamonds' ? '#345875' : '#54414A'} />
      <Circle cx="60" cy="52" r="36" fill="none" stroke="#B0A0C5" strokeOpacity=".22" strokeDasharray="2 4" />
      <Ellipse cx="60" cy="89" rx="36" ry="5" fill="#10101C" opacity=".55" />
      {kind === 'diamonds' && <>
        {tier >= 2 && jewel(20, 48, .54)}
        {tier >= 3 && jewel(73, 50, .46)}
        {tier >= 4 && jewel(44, 66, .48)}
        {jewel(34, 28, .91)}
      </>}
      {kind === 'gold' && <>
        {tier >= 2 && coin(80, 65)}
        {tier >= 3 && coin(80, 57)}
        {tier >= 4 && coin(80, 49)}
        {coin(50, 71)}{coin(50, 62)}{coin(50, 53)}
      </>}
      {isJoker && <>
        <G transform="rotate(-13 56 51)">
          <Rect x="32" y="22" width="38" height="58" rx="6" fill="#6D534B" stroke="#D99E62" />
        </G>
        <G transform="rotate(9 65 54)">
          <Rect x="47" y="25" width="38" height="58" rx="6" fill="url(#walletInk)" stroke="#F4C488" strokeWidth="1.5" />
          <Rect x="51" y="29" width="30" height="50" rx="4" fill="none" stroke="#9D785F" />
          <Path d="M66 38l13 16-13 16-13-16z" fill="#DBA266" />
          <Path d={kind === 'joker_half' ? 'M60 51h12m-12 6h12' : 'M60 54h12'} stroke="#292137" strokeWidth="2.5" strokeLinecap="round" />
        </G>
      </>}
      <Path d="M20 47v8m-4-4h8m76 9v8m-4-4h8" stroke={kind === 'diamonds' ? '#80C5F3' : '#F3BE81'} strokeWidth="1.4" />
    </Svg>
  );
}
