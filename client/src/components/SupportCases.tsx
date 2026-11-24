import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_ATTACHMENTS, formatBytes, openRemoteAttachment, pickFileAttachment, pickImageAttachment, type PickedAttachment, type RemoteAttachment } from '../utils/supportAttachments';
import { PageShimmer } from './LoadingShimmer';
import { useGameStore } from '../store/gameStore';
import { PAGE_TTL, pageDataCache } from '../utils/pageDataCache';
import { usePageData } from '../utils/usePageData';

type Case = { id: string; subject: string; message: string; status: keyof typeof statuses; createdAt: string; resolution: string | null; waitingForPlayer?: boolean; attachments?: RemoteAttachment[] };
type Event = { id: string; action: 'warn' | 'restrict'; createdAt: string };
const statuses = { open: 'Açık', in_progress: 'İnceleniyor', resolved: 'Sonuçlandı' };
const date = (value: string) => new Date(value).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
const BUG_SUBJECT_LIMIT = 73; // The server adds the [HATA] prefix to the stored subject.

export function SupportCases({ api, token, owner }: { api: string; token: string; owner: string }) {
  const [expanded, setExpanded] = useState(false);
  const [appeal, setAppeal] = useState<string | null>(null);
  const [bug, setBug] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<{ uri: string; name: string } | null>(null);
  const sendRef = useRef<AbortController | null>(null);
  const endpoint = `${api.replace(/\/+$/, '')}/support`;
  const headers = { Authorization: `Bearer ${token}` };
  const subjectLimit = bug ? BUG_SUBJECT_LIMIT : 80;
  const invalid = (!appeal && (subject.trim().length < 4 || subject.trim().length > subjectLimit)) || message.trim().length < 12;

  const { data, loading, error, read } = usePageData<{ cases: Case[]; events: Event[]; more: boolean }>(
    expanded ? `${endpoint}?page=${page}` : null, PAGE_TTL.support, owner, token);
  const items = data?.cases ?? [];
  const events = data?.events ?? [];
  useEffect(() => () => { sendRef.current?.abort(); }, [owner, token]);
  useEffect(() => {
    if (data) setAppeal(old => data.events.some(event => event.id === old) ? old : null);
  }, [data]);

  async function addAttachment(source: 'image' | 'file') {
    if (picking || attachments.length >= MAX_ATTACHMENTS) return;
    setPicking(true); setAttachmentNotice('');
    try {
      const result = source === 'image' ? await pickImageAttachment() : await pickFileAttachment();
      if (result.error) setAttachmentNotice(result.error);
      else if (result.attachment) {
        const picked = result.attachment;
        setAttachments(list => list.length >= MAX_ATTACHMENTS ? list : [...list, picked]);
      }
    } finally {
      setPicking(false);
    }
  }

  async function openAttachment(caseId: string, file: RemoteAttachment) {
    setAttachmentNotice('');
    const result = await openRemoteAttachment({ api, token, caseId, attachment: file });
    if (result.imageUri) setPreview({ uri: result.imageUri, name: file.name });
    else if (result.error) setNotice(result.error);
  }

  async function send() {
    if (sendRef.current || invalid) return;
    const controller = new AbortController();
    sendRef.current = controller;
    setSending(true); setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ kind: appeal ? 'appeal' : bug ? 'bug' : 'support', ...(appeal ? { moderationId: appeal } : { subject }), message,
          ...(!appeal && attachments.length ? { attachments: attachments.map(file => ({ name: file.name, mime: file.mime, data: file.base64 })) } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Talep gönderilemedi.');
      if (useGameStore.getState().user?.id === owner && useGameStore.getState().token === token) {
        pageDataCache.invalidateWhere((url, scope) => scope === owner && url.startsWith(`${endpoint}?page=`));
      }
      if (controller.signal.aborted) return;
      setSubject(''); setMessage(''); setAppeal(null); setAttachments([]); setAttachmentNotice('');
      setNotice(bug ? 'Hata bildiriminiz kaydedildi.' : 'Talebiniz kaydedildi.');
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
    }}><Text style={s.title}>Destek, hata bildirimi ve itirazlar</Text></Pressable>
    {expanded && <>
      <Text style={s.secondary}>Destek talebi açın, hata bildirin veya son 30 gündeki bir moderasyon işlemine itiraz edin. Parola ve ödeme bilgisi yazmayın.</Text>
      <View accessibilityRole="radiogroup" style={s.group}>
        <Pressable accessibilityRole="radio" disabled={sending} accessibilityState={{ checked: !appeal && !bug }} style={[s.choice, !appeal && !bug && s.selected]}
          onPress={() => { setAppeal(null); setBug(false); }}><Text style={s.body}>Genel destek talebi</Text></Pressable>
        <Pressable accessibilityRole="radio" disabled={sending} accessibilityState={{ checked: bug }} style={[s.choice, bug && s.selected]}
          onPress={() => { setAppeal(null); setBug(true); }}><Text style={s.body}>Hata bildir</Text></Pressable>
        {events.map(event => <Pressable key={event.id} accessibilityRole="radio" accessibilityState={{ checked: appeal === event.id }}
          disabled={sending} style={[s.choice, appeal === event.id && s.selected]} onPress={() => { setBug(false); setAppeal(event.id); }}>
          <Text style={s.body}>{date(event.createdAt)} · {event.action === 'warn' ? 'Uyarıya itiraz et' : 'Kısıtlamaya itiraz et'}</Text>
        </Pressable>)}
      </View>
      {!appeal && <TextInput accessibilityLabel={bug ? 'Hata konusu' : 'Talep konusu'} placeholder={bug ? 'Hata konusu' : 'Talep konusu'} placeholderTextColor="#AEA0C3"
        value={subject} onChangeText={setSubject} maxLength={subjectLimit} style={s.input} editable={!sending} />}
      {bug && subject.trim().length > subjectLimit && <Text style={s.secondary}>Hata konusu en fazla {subjectLimit} karakter olabilir.</Text>}
      <TextInput accessibilityLabel="Talep açıklaması" placeholder="Ne oldu? En az 12 karakter." placeholderTextColor="#AEA0C3"
        value={message} onChangeText={setMessage} maxLength={1200} multiline style={[s.input, s.message]} editable={!sending} />
      {!appeal && <>
        <View style={s.attachmentBar}>
          <Pressable accessibilityRole="button" disabled={sending || picking || attachments.length >= MAX_ATTACHMENTS}
            style={({ pressed }) => [s.attachmentButton, { opacity: sending || picking || attachments.length >= MAX_ATTACHMENTS ? 0.55 : pressed ? 0.8 : 1 }]}
            onPress={() => void addAttachment('image')}><Text style={s.attachmentAction}>Fotoğraf veya ekran görüntüsü ekle</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={sending || picking || attachments.length >= MAX_ATTACHMENTS}
            style={({ pressed }) => [s.attachmentButton, { opacity: sending || picking || attachments.length >= MAX_ATTACHMENTS ? 0.55 : pressed ? 0.8 : 1 }]}
            onPress={() => void addAttachment('file')}><Text style={s.attachmentAction}>Dosya ekle</Text></Pressable>
        </View>
        {attachments.map(file => <View key={file.id} style={s.attachmentChip}>
          <Text style={s.attachmentName} numberOfLines={1}>{file.name} · {formatBytes(file.size)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${file.name} ekini kaldır`} disabled={sending}
            onPress={() => setAttachments(list => list.filter(item => item.id !== file.id))}>
            <Text style={s.attachmentRemove}>Kaldır</Text></Pressable>
        </View>)}
        <Text style={s.secondary}>En fazla {MAX_ATTACHMENTS} dosya, her biri 3 MB: ekran görüntüsü, fotoğraf, PDF, metin veya ZIP.</Text>
        {!!attachmentNotice && <Text accessibilityLiveRegion="polite" style={s.body}>{attachmentNotice}</Text>}
      </>}
      <Pressable accessibilityRole="button" disabled={sending || invalid}
        style={({ pressed }) => [s.button, s.primary, { opacity: sending || invalid ? 0.55 : pressed ? 0.8 : 1 }]}
        onPress={() => void send()}><Text style={s.primaryText}>{sending ? 'Gönderiliyor' : bug ? 'Hata bildirimini gönder' : 'Talebi gönder'}</Text></Pressable>
      {!!notice && <Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text>}
      <View style={s.header}>
        <Text style={s.title}>Taleplerim</Text>
        <Pressable accessibilityRole="button" style={s.button} onPress={() => void read(true).catch(() => {})}><Text style={s.body}>Yenile</Text></Pressable>
      </View>
      {loading && <PageShimmer label="Talepler yükleniyor" rows={2} />}
      {error && <Text accessibilityLiveRegion="polite" style={s.body}>Talepler yüklenemedi. Yeniden deneyin.</Text>}
      {data && items.length === 0 && <Text style={s.secondary}>Henüz bir talep görünmüyor.</Text>}
      {items.map(item => <View key={item.id} style={s.choice}>
        <Text style={s.title}>{item.subject}</Text>
        <Text style={s.secondary}>{date(item.createdAt)} · {item.waitingForPlayer ? 'Yanıtınız bekleniyor' : statuses[item.status]}</Text>
        <Text style={s.body}>{item.message}</Text>
        {!!item.attachments?.length && <View style={s.attachmentList}>{item.attachments.map(file =>
          <Pressable key={file.id} accessibilityRole="button" accessibilityLabel={`${file.name} ekini aç`}
            style={({ pressed }) => [s.attachmentChip, { opacity: pressed ? 0.75 : 1 }]} onPress={() => void openAttachment(item.id, file)}>
            <Text style={s.attachmentName} numberOfLines={1}>{file.mime.startsWith('image/') ? 'Görsel' : 'Dosya'}: {file.name} · {formatBytes(file.size)}</Text>
          </Pressable>)}</View>}
        {!!item.resolution && <Text style={s.body}>Destek yanıtı: {item.resolution}</Text>}
        <CaseConversation endpoint={`${endpoint}/${encodeURIComponent(item.id)}/replies`} listEndpoint={endpoint} token={token} owner={owner} />
      </View>)}
      {(page > 1 || data?.more) && <View style={s.header}>
        {page > 1 && <Pressable accessibilityRole="button" style={s.button} onPress={() => setPage(page - 1)}><Text style={s.body}>Önceki</Text></Pressable>}
        {data?.more && <Pressable accessibilityRole="button" style={s.button} onPress={() => setPage(page + 1)}><Text style={s.body}>Sonraki</Text></Pressable>}
      </View>}
    </>}
    <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
      <View style={s.previewBackdrop}>
        {preview && <Image accessibilityLabel={preview.name} resizeMode="contain" source={{ uri: preview.uri }} style={s.previewImage} />}
        {preview && <Text style={s.previewName} numberOfLines={2}>{preview.name}</Text>}
        <Pressable accessibilityRole="button" style={[s.button, s.primary]} onPress={() => setPreview(null)}>
          <Text style={s.primaryText}>Kapat</Text></Pressable>
      </View>
    </Modal>
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
      {loading && <PageShimmer label="Konuşma yükleniyor" shape="lines" rows={2} />}
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
  attachmentBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attachmentButton: { borderColor: '#665183', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, minHeight: 40, justifyContent: 'center', flexGrow: 1 },
  attachmentAction: { color: '#FFE092', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  attachmentList: { gap: 6 },
  attachmentChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderColor: '#594477', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  attachmentName: { color: '#F4ECFF', fontSize: 13, flexShrink: 1 },
  attachmentRemove: { color: '#FFB4B4', fontSize: 13, fontWeight: '700' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(9,4,20,0.94)', padding: 20, gap: 12, justifyContent: 'center' },
  previewImage: { width: '100%', height: '70%' },
  previewName: { color: '#CDBEE0', fontSize: 13, textAlign: 'center' },
  primaryText: { color: '#231630', fontWeight: '800' },
});
