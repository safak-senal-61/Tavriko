import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { PAGE_TTL, pageDataCache } from '../utils/pageDataCache';
import { usePageData } from '../utils/usePageData';

type Case = { id: string; subject: string; message: string; status: keyof typeof statuses; createdAt: string; resolution: string | null; waitingForPlayer?: boolean };
type Event = { id: string; action: 'warn' | 'restrict'; createdAt: string };
const statuses = { open: 'Açık', in_progress: 'İnceleniyor', resolved: 'Sonuçlandı' };
const date = (value: string) => new Date(value).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });

export function SupportCases({ api, token, owner }: { api: string; token: string; owner: string }) {
  const [expanded, setExpanded] = useState(false);
  const [appeal, setAppeal] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const sendRef = useRef<AbortController | null>(null);
  const endpoint = `${api.replace(/\/+$/, '')}/support`;
  const headers = { Authorization: `Bearer ${token}` };

  const { data, loading, error, read } = usePageData<{ cases: Case[]; events: Event[]; more: boolean }>(
    expanded ? `${endpoint}?page=${page}` : null, PAGE_TTL.support, owner, token);
  const items = data?.cases ?? [];
  const events = data?.events ?? [];
  useEffect(() => () => { sendRef.current?.abort(); }, [owner, token]);
  useEffect(() => {
    if (data) setAppeal(old => data.events.some(event => event.id === old) ? old : null);
  }, [data]);

  async function send() {
    if (sendRef.current || (!appeal && subject.trim().length < 4) || message.trim().length < 12) return;
    const controller = new AbortController();
    sendRef.current = controller;
    setSending(true); setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ kind: appeal ? 'appeal' : 'support', ...(appeal ? { moderationId: appeal } : { subject }), message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Talep gönderilemedi.');
      if (useGameStore.getState().user?.id === owner && useGameStore.getState().token === token) {
        pageDataCache.invalidateWhere((url, scope) => scope === owner && url.startsWith(`${endpoint}?page=`));
      }
      if (controller.signal.aborted) return;
      setSubject(''); setMessage(''); setAppeal(null); setNotice('Talebiniz kaydedildi.');
      setPage(1);
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : 'Talep gönderilemedi.');
    } finally {
      sendRef.current = null;
      if (!controller.signal.aborted) setSending(false);
    }
  }

  return <View style={s.panel}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={s.button} onPress={() => {
      setExpanded(!expanded);
      if (!expanded) setPage(1);
    }}><Text style={s.title}>Destek talepleri ve itirazlar</Text></Pressable>
    {expanded && <>
      <Text style={s.secondary}>Hesabınızla ilgili bir talep açın veya son 30 gündeki bir moderasyon işlemine itiraz edin. Parola ve ödeme bilgisi yazmayın.</Text>
      <View accessibilityRole="radiogroup" style={s.group}>
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: appeal === null }} style={[s.choice, !appeal && s.selected]}
          onPress={() => setAppeal(null)}><Text style={s.body}>Genel destek talebi</Text></Pressable>
        {events.map(event => <Pressable key={event.id} accessibilityRole="radio" accessibilityState={{ checked: appeal === event.id }}
          style={[s.choice, appeal === event.id && s.selected]} onPress={() => setAppeal(event.id)}>
          <Text style={s.body}>{date(event.createdAt)} · {event.action === 'warn' ? 'Uyarıya itiraz et' : 'Kısıtlamaya itiraz et'}</Text>
        </Pressable>)}
      </View>
      {!appeal && <TextInput accessibilityLabel="Talep konusu" placeholder="Talep konusu" placeholderTextColor="#AEA0C3"
        value={subject} onChangeText={setSubject} maxLength={80} style={s.input} editable={!sending} />}
      <TextInput accessibilityLabel="Talep açıklaması" placeholder="Ne oldu? En az 12 karakter." placeholderTextColor="#AEA0C3"
        value={message} onChangeText={setMessage} maxLength={1200} multiline style={[s.input, s.message]} editable={!sending} />
      <Pressable accessibilityRole="button" disabled={sending || (!appeal && subject.trim().length < 4) || message.trim().length < 12}
        style={({ pressed }) => [s.button, s.primary, { opacity: sending || (!appeal && subject.trim().length < 4) || message.trim().length < 12 ? 0.55 : pressed ? 0.8 : 1 }]}
        onPress={() => void send()}><Text style={s.primaryText}>{sending ? 'Gönderiliyor' : 'Talebi gönder'}</Text></Pressable>
      {!!notice && <Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text>}
      <View style={s.header}>
        <Text style={s.title}>Taleplerim</Text>
        <Pressable accessibilityRole="button" style={s.button} onPress={() => void read(true).catch(() => {})}><Text style={s.body}>Yenile</Text></Pressable>
      </View>
      {loading && <ActivityIndicator color="#FFD273" accessibilityLabel="Talepler yükleniyor" />}
      {error && <Text accessibilityLiveRegion="polite" style={s.body}>Talepler yüklenemedi. Yeniden deneyin.</Text>}
      {data && items.length === 0 && <Text style={s.secondary}>Henüz bir talep görünmüyor.</Text>}
      {items.map(item => <View key={item.id} style={s.choice}>
        <Text style={s.title}>{item.subject}</Text>
        <Text style={s.secondary}>{date(item.createdAt)} · {item.waitingForPlayer ? 'Yanıtınız bekleniyor' : statuses[item.status]}</Text>
        <Text style={s.body}>{item.message}</Text>
        {!!item.resolution && <Text style={s.body}>Destek yanıtı: {item.resolution}</Text>}
        <CaseConversation endpoint={`${endpoint}/${encodeURIComponent(item.id)}/replies`} listEndpoint={endpoint} token={token} owner={owner} />
      </View>)}
      {(page > 1 || data?.more) && <View style={s.header}>
        {page > 1 && <Pressable accessibilityRole="button" style={s.button} onPress={() => setPage(page - 1)}><Text style={s.body}>Önceki</Text></Pressable>}
        {data?.more && <Pressable accessibilityRole="button" style={s.button} onPress={() => setPage(page + 1)}><Text style={s.body}>Sonraki</Text></Pressable>}
      </View>}
    </>}
  </View>;
}

type Conversation = {
  items: Array<{ id: string; sender: 'staff' | 'player'; body: string; createdAt: string }>;
  revision: number; status: Case['status']; waitingForPlayer: boolean;
};

function CaseConversation({ endpoint, listEndpoint, token, owner }: { endpoint: string; listEndpoint: string; token: string; owner: string }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error, read } = usePageData<Conversation>(open ? endpoint : null, PAGE_TTL.support, owner, token);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => { inFlight.current?.abort(); }, [endpoint, token]);
  async function sendReply() {
    if (inFlight.current || !data || draft.trim().length < 3) return;
    const controller = new AbortController();
    inFlight.current = controller; setBusy(true); setFeedback('');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: data.revision, body: draft }), signal: controller.signal });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Yanıt gönderilemedi.');
      if (useGameStore.getState().user?.id === owner && useGameStore.getState().token === token) {
        pageDataCache.invalidate(endpoint, owner);
        pageDataCache.invalidateWhere((url, scope) => scope === owner && url.startsWith(`${listEndpoint}?page=`));
      }
      if (!controller.signal.aborted) { setDraft(''); setFeedback('Yanıtınız gönderildi.'); }
    } catch (error) {
      if (!controller.signal.aborted) setFeedback(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
    } finally {
      inFlight.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <View style={s.group}>
    <Pressable style={s.button} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => {
      setOpen(!open);
    }}><Text style={s.secondary}>{open ? 'Konuşmayı gizle' : 'Konuşmayı aç'}</Text></Pressable>
    {open && <>
      {data?.waitingForPlayer && <Text style={s.title}>Destek ekibi yanıtınızı bekliyor</Text>}
      {data?.items.map(item => <View key={item.id} style={s.choice}>
        <Text style={s.secondary}>{item.sender === 'staff' ? 'Tavriko destek' : 'Siz'} · {date(item.createdAt)}</Text>
        <Text style={s.body}>{item.body}</Text>
      </View>)}
      {data && !data.items.length && <Text style={s.secondary}>Henüz ek mesaj yok.</Text>}
      {loading && <ActivityIndicator color="#FFD273" accessibilityLabel="Konuşma yükleniyor" />}
      {error && <Text accessibilityLiveRegion="polite" style={s.body}>Konuşma yüklenemedi. Yeniden deneyin.</Text>}
      <Pressable style={s.button} disabled={busy} accessibilityRole="button" onPress={() => void read(true).catch(() => {})}>
        <Text style={s.secondary}>Konuşmayı yenile</Text></Pressable>
      {!!feedback && <Text accessibilityLiveRegion="polite" style={s.body}>{feedback}</Text>}
      {data && data.status !== 'resolved' && <>
        <TextInput accessibilityLabel="Talebe yanıt" placeholder="Yanıtınızı yazın" placeholderTextColor="#AEA0C3"
          value={draft} onChangeText={setDraft} maxLength={1200} multiline editable={!busy} style={[s.input, s.message]} />
        <Pressable style={[s.button, s.primary, { opacity: busy || draft.trim().length < 3 ? 0.55 : 1 }]}
          disabled={busy || draft.trim().length < 3} accessibilityRole="button" onPress={() => void sendReply()}>
          <Text style={s.primaryText}>Yanıt gönder</Text></Pressable>
      </>}
    </>}
  </View>;
}

const s = StyleSheet.create({
  panel: { backgroundColor: '#211735', borderColor: '#523E6B', borderWidth: 1, borderRadius: 16, padding: 12, gap: 10, marginTop: 12 },
  header: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#FFE092', fontSize: 16, fontWeight: '700' },
  body: { color: '#F4ECFF', fontSize: 14, lineHeight: 21 },
  secondary: { color: '#CDBEE0', fontSize: 13, lineHeight: 20 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  group: { gap: 6 },
  choice: { borderColor: '#594477', borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  selected: { borderColor: '#F8C85D', backgroundColor: '#352549' },
  input: { borderColor: '#665183', borderWidth: 1, borderRadius: 10, padding: 10, color: '#F4ECFF', minHeight: 44 },
  message: { minHeight: 96, textAlignVertical: 'top' },
  primary: { backgroundColor: '#F8C85D', borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#231630', fontWeight: '800' },
});
