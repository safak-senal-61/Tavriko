/**
 * Animated Nick — görünürlük farkındalıklı animasyon saati.
 *
 * - Saat yalnızca `active` iken ve bileşen ekranda görünürken ilerler.
 * - Görünürlük UI thread'de `measure` ile her ~12 karede bir kontrol edilir;
 *   FlatList/ScrollView içinde ekran dışına kayan nickler kendiliğinden durur
 *   (shared value değişmediği için Skia/Reanimated yeniden çizim yapmaz).
 * - `fps` ile kare hızı sınırlanabilir (lite modda pil tasarrufu).
 * - Görünürlük değişimi JS tarafına yalnızca durum değiştiğinde bildirilir
 *   (Lottie katmanını takıp çıkarmak için).
 */
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  measure,
  runOnJS,
  useAnimatedRef,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

export function useNickClock(active: boolean, opts: { fps?: number; startAt?: number } = {}) {
  const ref = useAnimatedRef<any>();
  const time = useSharedValue(opts.startAt ?? Math.random() * 4);
  const visible = useSharedValue(1);
  const frame = useSharedValue(0);
  const acc = useSharedValue(0);
  const { width, height } = useWindowDimensions();
  const win = useSharedValue({ w: width, h: height });
  const [onScreen, setOnScreen] = useState(true);
  const minStep = opts.fps ? 1000 / opts.fps : 0;
  const step = useSharedValue(minStep);
  useEffect(() => {
    step.value = minStep;
  }, [minStep, step]);

  useEffect(() => {
    win.value = { w: width, h: height };
  }, [width, height, win]);

  const cb = useFrameCallback((info) => {
    'worklet';
    frame.value = frame.value + 1;
    if (frame.value % 12 === 1) {
      const m = measure(ref);
      let vis = 1;
      if (m) {
        const margin = 48;
        const off =
          m.pageY + m.height < -margin ||
          m.pageY > win.value.h + margin ||
          m.pageX + m.width < -margin ||
          m.pageX > win.value.w + margin ||
          m.width === 0;
        vis = off ? 0 : 1;
      }
      if (vis !== visible.value) {
        visible.value = vis;
        runOnJS(setOnScreen)(vis === 1);
      }
    }
    if (visible.value !== 1) return;
    const dt = Math.min(info.timeSincePreviousFrame ?? 16, 64);
    if (step.value > 0) {
      acc.value = acc.value + dt;
      if (acc.value < step.value) return;
      time.value = time.value + acc.value / 1000;
      acc.value = 0;
      return;
    }
    time.value = time.value + dt / 1000;
  }, false);

  useEffect(() => {
    cb.setActive(active);
    return () => cb.setActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { ref, time, onScreen: active && onScreen };
}
