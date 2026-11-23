import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { duelFunnelPreference } from '../services/duelFunnel';

export function DuelFunnelPreference({ api, account, token }: { api: string; account: string; token: string }) {
  const [value, setValue] = useState<{ optedIn: boolean; canEnroll: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  async function refresh(event?: 'enroll' | 'withdraw') {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); setError('');
    try {
      const next = await duelFunnelPreference(api, account, token, event, controller.signal);
      if (!controller.signal.aborted) setValue(next);
    } catch { if (!controller.signal.aborted) setError('Ölçüm tercihi kaydedilemedi veya yüklenemedi. Tekrar deneyin.'); }
    finally { if (request.current === controller) request.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  useEffect(() => { void refresh(); return () => { request.current?.abort(); request.current = null; }; }, [api, account, token]);
  if (!value && !error) return null;
  if (value && !value.optedIn && !value.canEnroll) return null;
  return <View style={s.panel}>
    {value && <>
      <Text style={s.title}>İlk Düello ölçümü</Text>
      <Text style={s.copy}>İstersen ilk yedi gündeki Hızlı Düello seçimi, eşleşme ve tamamlanma adımlarını Tavriko’da toplu sayılara dahil et. Katılmamak oyunu etkilemez. İzni kaldırırsan ölçüm kayıtların silinir.</Text>
    </>}
    {!!error && <Text style={s.copy} accessibilityLiveRegion="polite">{error}</Text>}
    <Pressable style={s.button} disabled={busy} accessibilityRole="button"
      onPress={() => void refresh(value ? value.optedIn ? 'withdraw' : 'enroll' : undefined)}>
      <Text style={s.label}>{busy ? 'Kaydediliyor' : !value ? 'Tekrar dene' : value.optedIn ? 'Ölçüm iznini kaldır' : 'Ölçüme katıl'}</Text>
    </Pressable>
  </View>;
}

const s = StyleSheet.create({
  panel: { backgroundColor: '#211735', borderColor: '#523E6B', borderWidth: 1, borderRadius: 16, padding: 12, gap: 8, marginBottom: 12 },
  title: { color: '#FFE092', fontSize: 16, fontWeight: '700' }, copy: { color: '#F4ECFF', fontSize: 14, lineHeight: 21 },
  button: { minHeight: 44, justifyContent: 'center', borderColor: '#665183', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  label: { color: '#FFE092', fontSize: 14, fontWeight: '700' },
});
