/**
 * Animated Nick — SkSL shader kaynakları
 * --------------------------------------
 * Her NickFill türü için Skia RuntimeEffect kaynağı. Shader'lar yalnızca
 * harflerin kapladığı pikselleri boyar (Glyphs çizimine shader olarak bağlanır),
 * bu yüzden maliyetleri metin alanıyla sınırlıdır.
 *
 * Ortak uniform'lar:
 *   iRes  : float2  — metin kutusunun boyutu (px)
 *   iOrig : float2  — metin kutusunun tuval içindeki sol-üst köşesi
 *   iTime : float   — saniye (görünür olduğu sürece ilerler)
 *   iSpeed: float   — 1 / döngü süresi (sn)
 *   c0..c5: float4  — palet renkleri (0..1 RGBA)
 *   n     : float   — kullanılan palet rengi sayısı (2..6)
 *
 * Saf metin dosyası; hem native Skia hem testlerde (canvaskit) derlenebilir.
 */
import type { NickFill } from '@trivia/shared';

const PRELUDE = `
uniform float2 iRes;
uniform float2 iOrig;
uniform float iTime;
uniform float iSpeed;
uniform float4 c0;
uniform float4 c1;
uniform float4 c2;
uniform float4 c3;
uniform float4 c4;
uniform float4 c5;
uniform float n;

float4 pickColor(float i) {
  if (i < 0.5) return c0;
  if (i < 1.5) return c1;
  if (i < 2.5) return c2;
  if (i < 3.5) return c3;
  if (i < 4.5) return c4;
  return c5;
}

// Döngüsel palet: t ∈ [0,1) tüm renkleri dolaşıp başa döner
float4 cyclic(float t) {
  float x = fract(t) * n;
  float i = floor(x);
  float j = i + 1.0;
  if (j > n - 0.5) j = 0.0;
  return mix(pickColor(i), pickColor(j), smoothstep(0.0, 1.0, x - i));
}

// Doğrusal palet: t=0 ilk renk, t=1 son renk
float4 ramp(float t) {
  float x = clamp(t, 0.0, 1.0) * (n - 1.0);
  float i = floor(x);
  float j = min(i + 1.0, n - 1.0);
  return mix(pickColor(i), pickColor(j), x - i);
}

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 4; k++) {
    v += a * noise(p);
    p = p * 2.03 + float2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

float2 uvOf(float2 p) {
  return (p - iOrig) / max(iRes, float2(1.0, 1.0));
}

// En-boy oranından bağımsız "harf boyu" koordinatı (yükseklik = 1)
float2 emOf(float2 p) {
  return (p - iOrig) / max(iRes.y, 1.0);
}
`;

const BODIES: Record<NickFill, string> = {
  // Akan iki-üç renk neon + parlak çekirdek
  neon: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float2 em = emOf(p);
  float4 col = cyclic(em.x * 0.18 - iTime * iSpeed);
  // tüpün ortası daha parlak (dikey merkez)
  float core = 1.0 - abs(uv.y - 0.55) * 1.6;
  col.rgb = mix(col.rgb, float3(1.0), clamp(core, 0.0, 1.0) * 0.38);
  float flick = 0.94 + 0.06 * sin(iTime * 23.0) * step(0.97, fract(iTime * 0.37));
  return half4(col.rgb * flick, 1.0);
}`,

  // Metalik bantlar + kayan çapraz ışık yansıması
  metal: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float2 em = emOf(p);
  // dikey metal bantları: koyu → açık → koyu
  float band = uv.y + 0.08 * sin(em.x * 2.2);
  float4 col = ramp(0.5 + 0.5 * sin(band * 5.6 - 1.2));
  // ışık yansıması: soldan sağa çapraz bant
  float span = iRes.x / max(iRes.y, 1.0) + 2.0;
  float pos = fract(iTime * iSpeed) * span - 1.0;
  float d = abs((em.x + uv.y * 0.55) - pos);
  float spec = smoothstep(0.42, 0.0, d);
  col.rgb += float3(1.0, 0.97, 0.85) * spec * 0.85;
  // ince fırçalanmış metal dokusu
  col.rgb *= 0.95 + 0.05 * noise(float2(em.x * 40.0, uv.y * 3.0));
  return half4(min(col.rgb, float3(1.0)), 1.0);
}`,

  // Holografik: açıya bağlı gökkuşağı + parlak şeritler
  holo: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float2 em = emOf(p);
  float t = iTime * iSpeed;
  float ang = em.x * 0.32 + uv.y * 0.55 + 0.12 * sin(t * 6.2831 + em.x * 0.8);
  float4 col = cyclic(ang - t);
  float stripes = 0.5 + 0.5 * sin((em.x * 2.4 - uv.y * 3.0) * 3.1416 + t * 12.566);
  col.rgb = mix(col.rgb, float3(1.0), pow(stripes, 6.0) * 0.55);
  float sheen = smoothstep(0.35, 0.0, abs(fract(em.x * 0.12 - t * 0.7) - 0.5) - 0.12);
  col.rgb += sheen * 0.18;
  return half4(min(col.rgb, float3(1.0)), 1.0);
}`,

  // Alev: aşağıdan yukarı akan gürültü, alt kısım daha sıcak
  flame: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float2 em = emOf(p);
  float t = iTime * (0.6 + iSpeed * 1.6);
  float f = fbm(float2(em.x * 3.2, uv.y * 2.6 + t * 1.9));
  float f2 = noise(float2(em.x * 7.0 - t * 0.4, uv.y * 5.0 + t * 3.1));
  float heat = (uv.y * 1.05) + (f - 0.5) * 0.95 + (f2 - 0.5) * 0.35;
  float4 col = ramp(0.16 + clamp(heat, 0.0, 1.0) * 0.84);
  float flick = 0.9 + 0.1 * sin(t * 17.0 + em.x * 3.0);
  return half4(col.rgb * flick, 1.0);
}`,

  // Buz: kristal hücre kenarları + soldan sağa yayılan donma
  frost: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float2 em = emOf(p);
  float t = iTime * iSpeed;
  float4 base = ramp(0.08 + 0.42 * uv.y + 0.14 * sin(em.x * 1.7 + t * 6.2831));
  // basit voronoi: en yakın iki kristal merkezi
  float2 g = em * 3.4;
  float2 cell = floor(g);
  float d1 = 9.0;
  float d2 = 9.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float2 o = float2(float(x), float(y));
      float2 c = cell + o + float2(hash(cell + o), hash(cell + o + 7.1));
      float d = length(g - c);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  float edge = smoothstep(0.12, 0.0, d2 - d1);
  // donma cephesi: periyodik olarak soldan sağa ilerler
  float span = iRes.x / max(iRes.y, 1.0) + 1.0;
  float front = fract(t) * span - 0.5;
  float frozen = smoothstep(front + 0.6, front - 0.2, em.x);
  float3 col = mix(base.rgb, float3(1.0), edge * (0.2 + 0.5 * frozen));
  col = mix(col, float3(0.88, 0.97, 1.0), frozen * 0.28);
  float glint = step(0.992, hash(floor(em * 14.0) + floor(iTime * 3.0)));
  col += glint * 0.6;
  return half4(min(col, float3(1.0)), 1.0);
}`,

  // Galaksi: kayan nebula bulutu + titreşen yıldızlar
  nebula: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float2 em = emOf(p);
  float t = iTime * iSpeed;
  float neb = fbm(em * 1.6 + float2(t * 1.3, -t * 0.6));
  float neb2 = fbm(em * 3.1 - float2(t * 0.8, t * 0.4) + 4.0);
  float4 col = cyclic(neb * 0.9 + neb2 * 0.35 + em.x * 0.05 - t * 0.25);
  col.rgb *= 0.8 + 0.5 * neb2;
  // okunabilirlik: koyu nebula tonlarını aydınlat
  col.rgb = max(col.rgb, float3(0.32, 0.24, 0.55));
  // yıldızlar
  float2 sg = em * 11.0;
  float2 sc = floor(sg);
  float h = hash(sc);
  float star = step(0.9, h);
  float2 sp = fract(sg) - 0.5 - (float2(hash(sc + 3.3), hash(sc + 9.1)) - 0.5) * 0.6;
  float tw = 0.5 + 0.5 * sin(iTime * (2.0 + h * 4.0) + h * 40.0);
  float s = star * smoothstep(0.16, 0.0, length(sp)) * tw;
  col.rgb += float3(s);
  return half4(min(col.rgb, float3(1.0)), 1.0);
}`,

  // Elmas: faset yansımaları, kırılma renkleri ve keskin pırıltı
  prism: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float2 em = emOf(p);
  float t = iTime * iSpeed;
  // üçgen fasetler: 60° döndürülmüş ızgara
  float2 q = float2(em.x * 2.6 + em.y * 1.5, em.y * 3.0);
  float2 id = floor(q);
  float tri = step(fract(q.x), fract(q.y));
  float h = hash(id + tri * 5.7);
  float lum = 0.55 + 0.45 * sin(h * 6.2831 + t * 6.2831);
  float4 col = ramp(h);
  col.rgb = mix(col.rgb * 0.75, float3(1.0), lum * 0.55);
  // faset kenarlarında ışık kırılması (gökkuşağı dağılımı)
  float2 fq = fract(q);
  float e = min(min(fq.x, fq.y), abs(fq.x - fq.y));
  float edge = smoothstep(0.08, 0.0, e);
  float3 disp = 0.5 + 0.5 * cos(6.2831 * (em.x * 0.35 - t + float3(0.0, 0.33, 0.67)));
  col.rgb = mix(col.rgb, disp, edge * 0.5);
  // kayan beyaz parlama
  float span = iRes.x / max(iRes.y, 1.0) + 2.0;
  float pos = fract(t * 0.8) * span - 1.0;
  float spec = smoothstep(0.3, 0.0, abs(em.x - uv.y * 0.4 - pos));
  col.rgb += spec * 0.7;
  return half4(min(col.rgb, float3(1.0)), 1.0);
}`,

  // Glitch: tarama çizgileri + bozulma anlarında yatay dilim kayması rengi
  glitch: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float t = iTime * iSpeed;
  float ph = fract(t);
  float burst = step(ph, 0.07) + step(0.52, ph) * step(ph, 0.56);
  float slice = floor(uv.y * 7.0);
  float sh = hash(float2(slice, floor(iTime * 24.0)));
  float3 col = c0.rgb;
  col *= 0.88 + 0.12 * sin(p.y * 2.1 + iTime * 8.0);
  float tint = burst * step(0.55, sh);
  col = mix(col, mix(c1.rgb, c2.rgb, step(0.78, sh)), tint * 0.85);
  col *= 1.0 - burst * step(0.9, sh) * 0.6;
  return half4(col, 1.0);
}`,

  // Gökkuşağı: harfler boyunca sürekli kayan renkler + yumuşak parlama
  rainbow: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float2 em = emOf(p);
  float t = iTime * iSpeed;
  float4 col = cyclic(em.x * 0.16 + uv.y * 0.08 - t);
  float sheen = 1.0 - smoothstep(0.0, 0.5, abs(uv.y - 0.32));
  col.rgb = mix(col.rgb, float3(1.0), sheen * 0.18);
  return half4(col.rgb, 1.0);
}`,

  // Gölge: koyu gövde içinde dolaşan mor ışık dalgası
  shadow: `
half4 main(float2 p) {
  float2 uv = uvOf(p);
  float2 em = emOf(p);
  float t = iTime * iSpeed;
  float smoke = fbm(float2(em.x * 2.0 - t * 1.5, uv.y * 2.0 + t * 0.9));
  float wave = 0.5 + 0.5 * sin(em.x * 1.6 - t * 6.2831 + smoke * 2.5);
  float4 col = ramp(clamp(wave * 0.75 + smoke * 0.35 + (1.0 - uv.y) * 0.15, 0.0, 1.0));
  float rim = smoothstep(0.75, 1.0, wave) * 0.35;
  col.rgb += float3(0.65, 0.5, 1.0) * rim;
  return half4(min(col.rgb, float3(1.0)), 1.0);
}`,

  // Klasik akan gradyan
  gradient: `
half4 main(float2 p) {
  float2 em = emOf(p);
  float4 col = cyclic(em.x * 0.2 - iTime * iSpeed);
  return half4(col.rgb, 1.0);
}`,
};

export const NICK_SHADER_FILLS = Object.keys(BODIES) as NickFill[];

/** Verilen dolgu türü için tam SkSL kaynağını döndürür. */
export function nickShaderSource(fill: NickFill): string {
  return PRELUDE + (BODIES[fill] ?? BODIES.gradient);
}

/** '#RRGGBB' / '#RRGGBBAA' → [r,g,b,a] (0..1) */
export function hexToVec4(hex: string): [number, number, number, number] {
  const h = (hex || '#ffffff').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const a = full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  return [r || 0, g || 0, b || 0, Number.isFinite(a) ? a : 1];
}

/** Palet renklerini shader uniform'larına çevirir (en fazla 6 renk). */
export function paletteUniforms(colors: string[]) {
  const list = (colors.length ? colors : ['#ffffff']).slice(0, 6);
  while (list.length < 2) list.push(list[0]);
  const v = list.map(hexToVec4);
  const pad = (i: number) => v[Math.min(i, v.length - 1)];
  return {
    c0: pad(0),
    c1: pad(1),
    c2: pad(2),
    c3: pad(3),
    c4: pad(4),
    c5: pad(5),
    n: list.length,
  };
}
