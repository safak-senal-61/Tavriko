import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ChevronDown, Gift, Link2, Send, X } from 'lucide-react-native';
import { CharacterAvatar, Button3D } from './TavrikoIcons';
import { GradientFill } from './TavrikoGradient';
import { DiscoveryArtwork, DISCOVERY_IMG } from './DiscoveryArtwork';
import { THEME } from '../theme/tokens';
import { socketService } from '../services/socketService';

type Props = { base: string; token?: string | null; userId?: string; pendingToken?: string | null;
  onClear: () => void; onConnected: () => void };
export function ReferralCards({ base, token, userId, pendingToken, onClear, onConnected }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [link, setLink] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadPreview, setReloadPreview] = useState(0);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  useEffect(() => {
    let active = true;
    setPreview(null); setPreviewError('');
    if (!pendingToken) return;
    setPreviewLoading(true);
    fetch(`${base}/referrals/preview/${encodeURIComponent(pendingToken)}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Davet yüklenemedi.');
        if (active) setPreview(data);
      }).catch(e => { if (active) setPreviewError(e.message || 'Davet yüklenemedi.'); })
      .finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [base, pendingToken, reloadPreview]);
  useEffect(() => { setLink(null); setExpanded(false); setError(''); setNotice(''); }, [userId]);
  const loadLink = async () => {
    setExpanded(true); setLoading(true); setError(''); setNotice('');
    try {
      const res = await fetch(`${base}/referrals/me`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bağlantı hazırlanamadı.');
      setLink(data);
    } catch (e: any) { setError(e.message || 'Bağlantı hazırlanamadı. Tekrar dene.'); }
    finally { setLoading(false); }
  };
  const confirm = async () => {
    if (sending || !pendingToken || !token) return;
    setSending(true); setPreviewError(''); setNotice('');
    try {
      const res = await fetch(`${base}/referrals/confirm`, {
        method: 'POST', headers, body: JSON.stringify({ token: pendingToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Davet gönderilemedi.');
      // Existing edge gateway transport makes the inviter refresh without waiting for polling.
      socketService.notifyUserRealtime(data.inviterId, 'friends:update', { friendId: userId });
      setNotice(data.message); onClear(); onConnected();
    } catch (e: any) { setPreviewError(e.message || 'Davet gönderilemedi. Tekrar dene.'); }
    finally { setSending(false); }
  };
  const copy = async () => {
    try { await Clipboard.setStringAsync(link.url); setNotice('Davet bağlantın kopyalandı.'); }
    catch { setError('Kopyalanamadı. Aşağıdaki bağlantıyı seçip kopyalayabilirsin.'); }
  };
  const share = async () => {
    try { await Share.share({ message: `Tavriko’da birlikte oynayalım! Girişten sonra profil kartımdaki “Daveti gönder” düğmesine dokun.\n${link.url}` }); }
    catch { setError('Paylaşım açılamadı. Bağlantıyı kopyalayabilirsin.'); }
  };
  const self = preview?.inviter?.id === userId;
  return <>
    {pendingToken && <View style={s.pending}>
      <View style={s.row}><Text style={s.eyebrow}>SANA BİR DAVET VAR</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Daveti kapat" disabled={sending} onPress={onClear} style={s.close}><X size={20} color="#E1D5F9" /></TouchableOpacity>
      </View>
      {previewLoading && <View style={s.loading}><ActivityIndicator color="#FFC43D" /><Text style={s.body}>Davet sahibinin profili yükleniyor...</Text></View>}
      {preview && <View style={s.person}>
        <CharacterAvatar seed={preview.inviter.avatarUrl || preview.inviter.displayName} size={58} />
        <View style={{ flex: 1, minWidth: 0 }}><Text style={s.name}>{preview.inviter.displayName}</Text>
          <Text style={s.body}>@{preview.inviter.username} · Seviye {preview.inviter.level}</Text>
          <Text style={s.gold}>{self ? 'Bu senin davet bağlantın' : 'Arkadaş olmaya bir adım kaldı'}</Text>
        </View>
      </View>}
      {preview && !self && <>
        <Text style={s.body}>Henüz arkadaş değilsiniz. “Daveti gönder” dediğinde ikinizin Arkadaşlarım listesi de güncellenir.</Text>
        <Button3D title={sending ? 'GÖNDERİLİYOR...' : 'DAVETİ GÖNDER'} variant="mint" disabled={sending} onPress={confirm} style={{ marginTop: 14 }} />
      </>}
      {!!previewError && <><Text accessibilityRole="alert" style={s.error}>{previewError}</Text>
        {!preview && <Button3D title="TEKRAR DENE" variant="purple" onPress={() => setReloadPreview(v => v + 1)} />}</>}
    </View>}
    <View style={s.card}>
      <GradientFill colors={['#3F2467', '#271546', '#263246']} direction="diagonal" />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Arkadaş davet et kazan" accessibilityState={{ expanded }} activeOpacity={0.9}
        onPress={() => expanded ? setExpanded(false) : void loadLink()} style={s.hero}>
        <View style={{ flex: 1, minWidth: 0 }}><View style={s.row}><Gift size={15} color="#FFD270" /><Text style={s.eyebrow}>BİRLİKTE DAHA GÜZEL</Text></View>
          <Text style={s.title}>Arkadaşını çağır.{'\n'}Birlikte kazan.</Text>
          <Text style={s.body}>Sana özel bağlantını paylaş, ekibini büyüt.</Text>
        </View>
        <DiscoveryArtwork source={DISCOVERY_IMG.social} size={88} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={expanded ? 'Davet bağlantısını gizle' : 'Davet bağlantımı aç'}
        onPress={() => expanded ? setExpanded(false) : void loadLink()} style={s.footer}>
        <Text style={s.gold}>Yeni arkadaş başına +100 altın</Text><ChevronDown size={18} color="#FFD270" style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </TouchableOpacity>
      {expanded && <View style={s.details}>
        {loading && <View style={s.loading}><ActivityIndicator color="#FFC43D" /><Text style={s.body}>Özel bağlantın hazırlanıyor...</Text></View>}
        {link && !loading && <>
          <View style={s.stats}><Text style={s.body}>{link.joinedCount} onaylanan davet</Text><Text style={s.gold}>{link.earnedCoins} altın kazandın</Text></View>
          <View style={s.link}><Link2 size={18} color="#BFA3EF" /><Text selectable style={[s.body,
            { flex: 1, minWidth: 0, flexShrink: 1 },
            Platform.OS === 'web' && ({ wordBreak: 'break-all', overflowWrap: 'anywhere' } as any),
          ]}>{link.url}</Text></View>
          <View style={s.actions}><Button3D title="KOPYALA" variant="mint" onPress={copy} style={{ flex: 1 }} textStyle={{ fontSize: 12 }} />
            <Button3D title="PAYLAŞ" variant="gold" onPress={share} style={{ flex: 1 }} textStyle={{ fontSize: 12 }} /></View>
          <View style={s.rule}><Send size={17} color="#BFA3EF" /><Text style={[s.body, { flex: 1 }]}>Bağlantı açılır, giriş yapılır, profil kartından davet onaylanır. Arkadaşlık sadece bu son adımda kurulur.</Text></View>
          <Text style={s.fine}>100 altın, bağlantın oluşturulduktan sonra yeni hesap açan ve daveti onaylayan her kişi için sana bir kez verilir. Mevcut hesaplar da arkadaş olabilir; tekrar ödül verilmez.</Text>
        </>}
        {!!error && <><Text accessibilityRole="alert" style={s.error}>{error}</Text>{!link && <Button3D title="TEKRAR DENE" variant="purple" onPress={loadLink} />}</>}
      </View>}
    </View>
    {!!notice && <Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}
  </>;
}
const s = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#715295', marginBottom: 16 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'space-between' },
  eyebrow: { color: '#F3D58B', fontFamily: THEME.fonts.extraBold, fontSize: 12, letterSpacing: 0.8 },
  title: { color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 23, lineHeight: 28, marginVertical: 9 },
  body: { color: '#E1D5F9', fontFamily: THEME.fonts.bold, fontSize: 12, lineHeight: 19 },
  gold: { color: '#FFD270', fontFamily: THEME.fonts.extraBold, fontSize: 12, lineHeight: 19 },
  footer: { borderTopWidth: 1, borderTopColor: '#70508F', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
  details: { padding: 16, paddingTop: 8, gap: 14 },
  link: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 14, backgroundColor: '#211337', padding: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  actions: { flexDirection: 'row', gap: 10 },
  rule: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  fine: { color: '#D1BEDF', fontFamily: THEME.fonts.body, fontSize: 12, lineHeight: 18 },
  error: { color: '#FFC0C8', fontFamily: THEME.fonts.bold, fontSize: 13, lineHeight: 19, marginVertical: 8 },
  success: { color: '#91F1D1', fontFamily: THEME.fonts.bold, fontSize: 13, padding: 12, backgroundColor: '#173F39', borderRadius: 12, marginBottom: 14 },
  pending: { backgroundColor: '#30204D', borderColor: '#5ADBB5', borderWidth: 1, borderRadius: 24, padding: 16, marginBottom: 16 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  name: { color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 20 },
  close: { padding: 8, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  loading: { paddingVertical: 20, gap: 12, alignItems: 'center' },
});
