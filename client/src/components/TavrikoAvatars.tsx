import React from 'react';
import { Image } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Ellipse,
  G,
  ClipPath,
} from 'react-native-svg';

export interface AvatarPreset {
  id: string;
  name: string;
  sub: string;
  rarity: 'Efsanevi' | 'Epik' | 'Nadir';
  badgeBg: string;
  badgeFg: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'av_0',
    name: 'Profesör',
    sub: 'Bilgelik',
    rarity: 'Efsanevi',
    badgeBg: '#ffc43d',
    badgeFg: '#3b1500',
  },
  {
    id: 'av_1',
    name: 'Baykuş',
    sub: 'Gece Kuşu',
    rarity: 'Epik',
    badgeBg: '#6b3cff',
    badgeFg: '#fff',
  },
  {
    id: 'av_2',
    name: 'Astronot',
    sub: 'Uzay Kaşifi',
    rarity: 'Epik',
    badgeBg: '#6b3cff',
    badgeFg: '#fff',
  },
  {
    id: 'av_3',
    name: 'Dedektif',
    sub: 'Sır Çözücü',
    rarity: 'Nadir',
    badgeBg: '#1f6fe0',
    badgeFg: '#fff',
  },
  {
    id: 'av_4',
    name: 'Büyücü',
    sub: 'Bilgi Sihirbazı',
    rarity: 'Efsanevi',
    badgeBg: '#ffc43d',
    badgeFg: '#3b1500',
  },
  {
    id: 'av_5',
    name: 'Robot',
    sub: 'Yapay Zeka',
    rarity: 'Nadir',
    badgeBg: '#1f6fe0',
    badgeFg: '#fff',
  },
  {
    id: 'av_6',
    name: 'Kraliçe',
    sub: 'Şampiyon',
    rarity: 'Efsanevi',
    badgeBg: '#ffc43d',
    badgeFg: '#3b1500',
  },
  {
    id: 'av_7',
    name: 'Tilki',
    sub: 'Kurnaz Zihin',
    rarity: 'Nadir',
    badgeBg: '#1f6fe0',
    badgeFg: '#fff',
  },
  {
    id: 'av_8',
    name: 'Kaşif',
    sub: 'Merak',
    rarity: 'Nadir',
    badgeBg: '#1f6fe0',
    badgeFg: '#fff',
  },
  {
    id: 'av_9',
    name: 'Kedi',
    sub: 'Gizemli',
    rarity: 'Epik',
    badgeBg: '#6b3cff',
    badgeFg: '#fff',
  },
];

// --- Profesör (Bilgelik) ---
export const AvatarGraphic_0: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av1b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#8a5cff"></Stop><Stop offset="1" stopColor="#3a1a90"></Stop></LinearGradient><LinearGradient id="av1r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av1c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av1r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av1b)"></Circle><G clipPath="url(#av1c)"><Path d="M16 122c2-26 20-34 44-34s42 8 44 34z" fill="#2a2060"></Path><Path d="M46 90l14 14 14-14-6-4H52z" fill="#fff"></Path><Rect x="52" y="76" width="16" height="16" rx="6" fill="#dcb08a"></Rect><Ellipse cx="60" cy="58" rx="24" ry="26" fill="#f1c9a5"></Ellipse><Path d="M34 62c-4-24 8-38 26-38s30 14 26 38l-6-8c-3-9-8-12-20-12s-17 3-20 12z" fill="#cfd3e6"></Path><Circle cx="50" cy="60" r="3.3" fill="#2a1a3a"></Circle><Circle cx="70" cy="60" r="3.3" fill="#2a1a3a"></Circle><Circle cx="51" cy="58.8" r="1.1" fill="#fff"></Circle><Circle cx="71" cy="58.8" r="1.1" fill="#fff"></Circle><Path d="M52 71q8 7 16 0" stroke="#8a3a3a" strokeWidth="2.6" fill="none" strokeLinecap="round"></Path><Circle cx="43" cy="68" r="4" fill="#ff7a8a" opacity=".35"></Circle><Circle cx="77" cy="68" r="4" fill="#ff7a8a" opacity=".35"></Circle><Circle cx="50" cy="60" r="9" fill="#fff" fillOpacity=".18" stroke="#ffc43d" strokeWidth="2.5"></Circle><Circle cx="70" cy="60" r="9" fill="#fff" fillOpacity=".18" stroke="#ffc43d" strokeWidth="2.5"></Circle><Path d="M59 60h2" stroke="#ffc43d" strokeWidth="2.5"></Path><Path d="M60 94l-10-6v12zM60 94l10-6v12z" fill="#e0304f"></Path><Circle cx="60" cy="94" r="3" fill="#b01030"></Circle><Path d="M26 36L60 22l34 14-34 14z" fill="#1a1530"></Path><Path d="M44 42v10c0 5 32 5 32 0V42" fill="#2a2450"></Path><Path d="M90 37v14" stroke="#ffc43d" strokeWidth="2.5"></Path><Circle cx="90" cy="53" r="3.5" fill="#ffc43d"></Circle></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);

// --- Baykuş (Gece Kuşu) ---
export const AvatarGraphic_1: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av2b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2fd0c0"></Stop><Stop offset="1" stopColor="#0a4a6a"></Stop></LinearGradient><LinearGradient id="av2r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av2c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av2r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av2b)"></Circle><G clipPath="url(#av2c)"><Ellipse cx="60" cy="112" rx="40" ry="30" fill="#8a5a2a"></Ellipse><Ellipse cx="60" cy="108" rx="24" ry="22" fill="#f4dcb0"></Ellipse><Path d="M52 100q4 4 8 0q4 4 8 0M52 110q4 4 8 0q4 4 8 0" stroke="#c9a070" strokeWidth="2" fill="none" strokeLinecap="round"></Path><Path d="M28 56c0-20 14-30 32-30s32 10 32 30c0 18-14 30-32 30S28 74 28 56z" fill="#a8703a"></Path><Path d="M32 40L30 20l16 12zM88 40l2-20-16 12z" fill="#7a4a1e"></Path><Circle cx="47" cy="58" r="16" fill="#f4dcb0"></Circle><Circle cx="73" cy="58" r="16" fill="#f4dcb0"></Circle><Circle cx="47" cy="58" r="9" fill="#ffc43d"></Circle><Circle cx="73" cy="58" r="9" fill="#ffc43d"></Circle><Circle cx="47" cy="58" r="4.5" fill="#1a1030"></Circle><Circle cx="73" cy="58" r="4.5" fill="#1a1030"></Circle><Circle cx="49" cy="56" r="1.5" fill="#fff"></Circle><Circle cx="75" cy="56" r="1.5" fill="#fff"></Circle><Path d="M60 64l-6 9 6 8 6-8z" fill="#ff9b2f"></Path><Path d="M38 28L60 18l22 10-22 10z" fill="#1a1530"></Path><Path d="M80 29v10" stroke="#ffc43d" strokeWidth="2.5"></Path><Circle cx="80" cy="41" r="3" fill="#ffc43d"></Circle></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);

// --- Astronot (Uzay Kaşifi) ---
export const AvatarGraphic_2: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av3b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#1a2a8a"></Stop><Stop offset="1" stopColor="#0a0a40"></Stop></LinearGradient><LinearGradient id="av3r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av3c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av3r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av3b)"></Circle><G clipPath="url(#av3c)"><G fill="#fff"><Circle cx="16" cy="22" r="1.6"></Circle><Circle cx="100" cy="30" r="2"></Circle><Circle cx="24" cy="86" r="1.4"></Circle><Circle cx="104" cy="74" r="1.6"></Circle><Circle cx="88" cy="14" r="1.2"></Circle></G><Path d="M16 122c2-26 20-34 44-34s42 8 44 34z" fill="#e8ecf8"></Path><Rect x="24" y="100" width="14" height="9" rx="2" fill="#e0304f"></Rect><Ellipse cx="60" cy="90" rx="28" ry="8" fill="#c6cce8"></Ellipse><Circle cx="60" cy="56" r="36" fill="#f2f4ff" stroke="#c6cce8" strokeWidth="3"></Circle><Ellipse cx="60" cy="58" rx="28" ry="24" fill="#1d2d72"></Ellipse><Ellipse cx="60" cy="50" rx="22" ry="13" fill="#3a5ad0" opacity=".45"></Ellipse><Ellipse cx="60" cy="62" rx="15" ry="16" fill="#f1c9a5"></Ellipse><Circle cx="54" cy="61" r="2.4" fill="#2a1a3a"></Circle><Circle cx="66" cy="61" r="2.4" fill="#2a1a3a"></Circle><Path d="M55 68q5 4 10 0" stroke="#8a3a3a" strokeWidth="2" fill="none" strokeLinecap="round"></Path><Path d="M42 46a22 20 0 0 1 14-9" stroke="#fff" strokeOpacity=".75" strokeWidth="4" fill="none" strokeLinecap="round"></Path></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);

// --- Dedektif (Sır Çözücü) ---
export const AvatarGraphic_3: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av4b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#ffb347"></Stop><Stop offset="1" stopColor="#c4551a"></Stop></LinearGradient><LinearGradient id="av4r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av4c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av4r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av4b)"></Circle><G clipPath="url(#av4c)"><Path d="M16 122c2-26 20-34 44-34s42 8 44 34z" fill="#b88a52"></Path><Path d="M48 90l12 12 12-12-4-4H52z" fill="#fff"></Path><Path d="M60 96l-4 6 4 14 4-14z" fill="#7a1a2a"></Path><Rect x="52" y="76" width="16" height="16" rx="6" fill="#d9a982"></Rect><Ellipse cx="60" cy="58" rx="24" ry="26" fill="#e0ac85"></Ellipse><Circle cx="50" cy="60" r="3.3" fill="#2a1a3a"></Circle><Circle cx="70" cy="60" r="3.3" fill="#2a1a3a"></Circle><Circle cx="51" cy="58.8" r="1.1" fill="#fff"></Circle><Circle cx="71" cy="58.8" r="1.1" fill="#fff"></Circle><Path d="M49 70q11-6 22 0q-7 6-11 2q-4 4-11-2z" fill="#3a2010"></Path><Ellipse cx="60" cy="42" rx="36" ry="8" fill="#6a3f20"></Ellipse><Path d="M40 42c0-18 8-26 20-26s20 8 20 26z" fill="#8a5a2a"></Path><Rect x="40" y="34" width="40" height="7" fill="#3a2010"></Rect><Circle cx="92" cy="96" r="11" fill="#9fd4ff" fillOpacity=".35" stroke="#ffc43d" strokeWidth="4"></Circle><Path d="M100 104l10 10" stroke="#ffc43d" strokeWidth="5" strokeLinecap="round"></Path></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);

// --- Büyücü (Bilgi Sihirbazı) ---
export const AvatarGraphic_4: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av5b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#6b3cff"></Stop><Stop offset="1" stopColor="#1a1050"></Stop></LinearGradient><LinearGradient id="av5r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av5c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av5r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av5b)"></Circle><G clipPath="url(#av5c)"><Path d="M16 122c2-26 20-34 44-34s42 8 44 34z" fill="#4a1fa8"></Path><Path d="M44 88h32l-4 10H48z" fill="#ffc43d"></Path><Rect x="52" y="76" width="16" height="16" rx="6" fill="#dcb08a"></Rect><Ellipse cx="60" cy="58" rx="24" ry="26" fill="#f1c9a5"></Ellipse><Path d="M35 66c0 26 10 36 25 36s25-10 25-36c-4 8-14 12-25 12s-21-4-25-12z" fill="#f4f6ff"></Path><Path d="M48 70q12-6 24 0q-8 6-12 2q-4 4-12-2z" fill="#e1e5f5"></Path><Circle cx="50" cy="60" r="3" fill="#2a1a3a"></Circle><Circle cx="70" cy="60" r="3" fill="#2a1a3a"></Circle><Path d="M44 54q6-4 12-1M64 53q6-3 12 1" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"></Path><Ellipse cx="60" cy="44" rx="34" ry="8" fill="#3a1a90"></Ellipse><Path d="M36 44L62 4l24 40z" fill="#5a27c8"></Path><Path d="M37 38h48l2 7H35z" fill="#ffc43d"></Path><Circle cx="58" cy="22" r="2.5" fill="#ffe27a"></Circle><Circle cx="67" cy="31" r="2" fill="#ffe27a"></Circle></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);

// --- Robot (Yapay Zeka) ---
export const AvatarGraphic_5: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av6b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#ff6bc4"></Stop><Stop offset="1" stopColor="#7a3fe0"></Stop></LinearGradient><LinearGradient id="av6r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av6c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av6r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av6b)"></Circle><G clipPath="url(#av6c)"><Path d="M16 122c2-26 20-34 44-34s42 8 44 34z" fill="#aab4d4"></Path><Circle cx="60" cy="106" r="7" fill="#4fe0ff"></Circle><Rect x="52" y="82" width="16" height="10" fill="#7a86a8"></Rect><Rect x="24" y="52" width="9" height="18" rx="4" fill="#7a86a8"></Rect><Rect x="87" y="52" width="9" height="18" rx="4" fill="#7a86a8"></Rect><Rect x="32" y="32" width="56" height="52" rx="16" fill="#d6def2"></Rect><Path d="M32 68h56v2a14 14 0 0 1-14 14H46a14 14 0 0 1-14-14z" fill="#b4bfdc"></Path><Rect x="40" y="42" width="40" height="28" rx="10" fill="#14183a"></Rect><Rect x="47" y="51" width="9" height="11" rx="4" fill="#4fe0ff"></Rect><Rect x="64" y="51" width="9" height="11" rx="4" fill="#4fe0ff"></Rect><Path d="M52 77h16" stroke="#7a86a8" strokeWidth="3" strokeLinecap="round"></Path><Path d="M60 32V19" stroke="#7a86a8" strokeWidth="3"></Path><Circle cx="60" cy="16" r="5" fill="#ffc43d"></Circle></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);

// --- Kraliçe (Şampiyon) ---
export const AvatarGraphic_6: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av7b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#ff7a8a"></Stop><Stop offset="1" stopColor="#a00a24"></Stop></LinearGradient><LinearGradient id="av7r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av7c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av7r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av7b)"></Circle><G clipPath="url(#av7c)"><Path d="M30 58c-4 30 2 54 10 64h40c8-10 14-34 10-64-2-20-16-32-30-32S32 38 30 58z" fill="#7a2a1a"></Path><Path d="M16 122c2-26 20-34 44-34s42 8 44 34z" fill="#6b3cff"></Path><Path d="M44 90q16 14 32 0" stroke="#ffc43d" strokeWidth="3" fill="none"></Path><Rect x="52" y="76" width="16" height="16" rx="6" fill="#dcb08a"></Rect><Ellipse cx="60" cy="58" rx="24" ry="26" fill="#f1c9a5"></Ellipse><Path d="M36 54c4-16 14-22 24-22s20 6 24 22c-8-6-16-8-24-8s-16 2-24 8z" fill="#7a2a1a"></Path><Circle cx="50" cy="60" r="3.3" fill="#2a1a3a"></Circle><Circle cx="70" cy="60" r="3.3" fill="#2a1a3a"></Circle><Circle cx="51" cy="58.8" r="1.1" fill="#fff"></Circle><Circle cx="71" cy="58.8" r="1.1" fill="#fff"></Circle><Path d="M53 71q7 6 14 0q-7 2-14 0z" fill="#d0102e"></Path><Circle cx="43" cy="68" r="4" fill="#ff7a8a" opacity=".35"></Circle><Circle cx="77" cy="68" r="4" fill="#ff7a8a" opacity=".35"></Circle><Path d="M36 40l3-18 11 9 10-16 10 16 11-9 3 18z" fill="#ffc43d"></Path><Path d="M36 40h48" stroke="#e07a00" strokeWidth="3"></Path><Circle cx="60" cy="31" r="3.5" fill="#ff4fd8"></Circle><Circle cx="46" cy="33" r="2.4" fill="#4fe0ff"></Circle><Circle cx="74" cy="33" r="2.4" fill="#4fe0ff"></Circle></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);

// --- Tilki (Kurnaz Zihin) ---
export const AvatarGraphic_7: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av8b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#4fe0a0"></Stop><Stop offset="1" stopColor="#0a5a3a"></Stop></LinearGradient><LinearGradient id="av8r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av8c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av8r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av8b)"></Circle><G clipPath="url(#av8c)"><Path d="M16 122c2-26 20-34 44-34s42 8 44 34z" fill="#1d6a4a"></Path><Path d="M46 90l14 12 14-12z" fill="#fff"></Path><Path d="M30 46L32 14l22 16zM90 46l-2-32-22 16z" fill="#ff8a2f"></Path><Path d="M35 40l1-16 12 10zM85 40l-1-16-12 10z" fill="#3a1a10"></Path><Path d="M26 50c0-18 14-26 34-26s34 8 34 26c0 22-14 38-34 38S26 72 26 50z" fill="#ff8a2f"></Path><Path d="M26 62c10 4 20 12 34 26-16 0-34-10-34-26zM94 62c-10 4-20 12-34 26 16 0 34-10 34-26z" fill="#fff3e0"></Path><Ellipse cx="48" cy="56" rx="3.5" ry="4" fill="#2a1a3a"></Ellipse><Ellipse cx="72" cy="56" rx="3.5" ry="4" fill="#2a1a3a"></Ellipse><Ellipse cx="60" cy="73" rx="5" ry="4" fill="#2a1a3a"></Ellipse><Path d="M60 77v3M54 82q6 4 12 0" stroke="#2a1a3a" strokeWidth="2" fill="none" strokeLinecap="round"></Path><Circle cx="48" cy="56" r="9" fill="none" stroke="#ffc43d" strokeWidth="2.5"></Circle><Circle cx="72" cy="56" r="9" fill="none" stroke="#ffc43d" strokeWidth="2.5"></Circle><Path d="M57 56h6" stroke="#ffc43d" strokeWidth="2.5"></Path></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);

// --- Kaşif (Merak) ---
export const AvatarGraphic_8: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av9b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#e0985a"></Stop><Stop offset="1" stopColor="#6a3a10"></Stop></LinearGradient><LinearGradient id="av9r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av9c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av9r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av9b)"></Circle><G clipPath="url(#av9c)"><Path d="M16 122c2-26 20-34 44-34s42 8 44 34z" fill="#c9a36a"></Path><Path d="M44 90q16 8 32 0l-2 10q-14 6-28 0z" fill="#e0304f"></Path><Rect x="52" y="76" width="16" height="16" rx="6" fill="#b27a55"></Rect><Ellipse cx="60" cy="58" rx="24" ry="26" fill="#c98f6a"></Ellipse><Circle cx="50" cy="60" r="3.3" fill="#2a1a3a"></Circle><Circle cx="70" cy="60" r="3.3" fill="#2a1a3a"></Circle><Circle cx="51" cy="58.8" r="1.1" fill="#fff"></Circle><Circle cx="71" cy="58.8" r="1.1" fill="#fff"></Circle><Path d="M52 71q8 7 16 0" stroke="#8a3a3a" strokeWidth="2.6" fill="none" strokeLinecap="round"></Path><Circle cx="43" cy="68" r="4" fill="#ff7a8a" opacity=".35"></Circle><Circle cx="77" cy="68" r="4" fill="#ff7a8a" opacity=".35"></Circle><Ellipse cx="60" cy="44" rx="38" ry="9" fill="#d2b87c"></Ellipse><Path d="M34 44c0-22 12-32 26-32s26 10 26 32z" fill="#e6cf9a"></Path><Rect x="34" y="36" width="52" height="7" fill="#6a3f20"></Rect><Circle cx="50" cy="26" r="6" fill="#5fd0e0" stroke="#3a2010" strokeWidth="2.5"></Circle><Circle cx="70" cy="26" r="6" fill="#5fd0e0" stroke="#3a2010" strokeWidth="2.5"></Circle><Path d="M56 26h8" stroke="#3a2010" strokeWidth="2.5"></Path></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);

// --- Kedi (Gizemli) ---
export const AvatarGraphic_9: React.FC = () => (
  <>
    <Defs>
      <LinearGradient id="av10b" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#b38bff"></Stop><Stop offset="1" stopColor="#4a1fa8"></Stop></LinearGradient><LinearGradient id="av10r" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff1a0"></Stop><Stop offset=".5" stopColor="#e0a020"></Stop><Stop offset="1" stopColor="#b8741a"></Stop></LinearGradient><ClipPath id="av10c"><Circle cx="60" cy="60" r="54"></Circle></ClipPath>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill="url(#av10r)"></Circle><Circle cx="60" cy="60" r="54" fill="url(#av10b)"></Circle><G clipPath="url(#av10c)"><Path d="M16 122c2-26 20-34 44-34s42 8 44 34z" fill="#2a2640"></Path><Path d="M48 90l12 14 12-14z" fill="#fff"></Path><Path d="M60 96l-12-7v14zM60 96l12-7v14z" fill="#ff6bc4"></Path><Circle cx="60" cy="96" r="3.5" fill="#c01f80"></Circle><Path d="M34 48L36 18l20 14zM86 48l-2-30-20 14z" fill="#2a2640"></Path><Path d="M39 40l1-14 11 8zM81 40l-1-14-11 8z" fill="#ff9ad0"></Path><Ellipse cx="60" cy="60" rx="30" ry="26" fill="#2a2640"></Ellipse><Ellipse cx="48" cy="58" rx="7" ry="8" fill="#ffc43d"></Ellipse><Ellipse cx="72" cy="58" rx="7" ry="8" fill="#ffc43d"></Ellipse><Ellipse cx="48" cy="58" rx="2.2" ry="6" fill="#1a1030"></Ellipse><Ellipse cx="72" cy="58" rx="2.2" ry="6" fill="#1a1030"></Ellipse><Circle cx="50" cy="55" r="1.4" fill="#fff"></Circle><Circle cx="74" cy="55" r="1.4" fill="#fff"></Circle><Path d="M56 68h8l-4 5z" fill="#ff9ad0"></Path><Path d="M60 73q-4 5-8 2M60 73q4 5 8 2" stroke="#ff9ad0" strokeWidth="2" fill="none" strokeLinecap="round"></Path><Path d="M36 68l-14-3M36 72l-14 3M84 68l14-3M84 72l14 3" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round"></Path></G><Path d="M16 42a48 48 0 0 1 36-28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" fill="none" strokeLinecap="round"></Path>
  </>
);


export const CharacterAvatar: React.FC<{
  index?: number;
  seed?: string;
  size?: number;
}> = ({ index, seed, size = 40 }) => {
  const [imgError, setImgError] = React.useState(false);
  const isDirectImageUri =
    !imgError &&
    typeof seed === 'string' &&
    !seed.includes('dicebear.com/7.x/bottts/svg') &&
    (seed.startsWith('http://') ||
      seed.startsWith('https://') ||
      seed.startsWith('file://') ||
      seed.startsWith('content://') ||
      seed.startsWith('data:image/'));

  if (isDirectImageUri && seed) {
    return (
      <Image
        source={{ uri: seed }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#3b6ea5',
        }}
        onError={() => setImgError(true)}
      />
    );
  }

  let resolvedIndex = index ?? 0;
  if (index === undefined && seed) {
    const s = seed.toLowerCase();
    if (s.includes('profesor') || s.includes('bilgelik') || s === 'av0' || s === 'av_0') resolvedIndex = 0;
    else if (s.includes('baykus') || s.includes('gece') || s === 'av1' || s === 'av_1') resolvedIndex = 1;
    else if (s.includes('astronot') || s.includes('uzay') || s === 'av2' || s === 'av_2') resolvedIndex = 2;
    else if (s.includes('dedektif') || s.includes('sir') || s === 'av3' || s === 'av_3') resolvedIndex = 3;
    else if (s.includes('buyucu') || s.includes('sihir') || s === 'av4' || s === 'av_4') resolvedIndex = 4;
    else if (s.includes('robot') || s.includes('zeka') || s === 'av5' || s === 'av_5') resolvedIndex = 5;
    else if (s.includes('kralice') || s.includes('sampiyon') || s === 'av6' || s === 'av_6') resolvedIndex = 6;
    else if (s.includes('tilki') || s.includes('kurnaz') || s === 'av7' || s === 'av_7') resolvedIndex = 7;
    else if (s.includes('kasif') || s.includes('merak') || s === 'av8' || s === 'av_8') resolvedIndex = 8;
    else if (s.includes('kedi') || s.includes('gizem') || s === 'av9' || s === 'av_9') resolvedIndex = 9;
    else {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) hash += seed.charCodeAt(i);
      resolvedIndex = Math.abs(hash) % AVATAR_PRESETS.length;
    }
  }

  const normalizedIndex = Math.abs(resolvedIndex) % AVATAR_PRESETS.length;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      {normalizedIndex === 0 && <AvatarGraphic_0 />}
      {normalizedIndex === 1 && <AvatarGraphic_1 />}
      {normalizedIndex === 2 && <AvatarGraphic_2 />}
      {normalizedIndex === 3 && <AvatarGraphic_3 />}
      {normalizedIndex === 4 && <AvatarGraphic_4 />}
      {normalizedIndex === 5 && <AvatarGraphic_5 />}
      {normalizedIndex === 6 && <AvatarGraphic_6 />}
      {normalizedIndex === 7 && <AvatarGraphic_7 />}
      {normalizedIndex === 8 && <AvatarGraphic_8 />}
      {normalizedIndex === 9 && <AvatarGraphic_9 />}
    </Svg>
  );
};
