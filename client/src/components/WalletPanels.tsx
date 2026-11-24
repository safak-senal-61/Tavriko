import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { canUseJoker, ClientQuestion, JOKERS, JOKER_GROUPS, JokerGroup, JokerId, JokerTactics, QuestionOption, UserProfile } from '@trivia/shared';
import { CloseXIcon, CoinIcon } from './TavrikoIcons';
import { WalletArtwork } from './WalletArtwork';
import { THEME } from '../theme/tokens';

export const walletAmount = (n: number) => n.toLocaleString('tr-TR');

export function JokerGroupTabs({ selected, onChange }: { selected: JokerGroup | null; onChange: (group: JokerGroup | null) => void }) {
  return <View style={s.groups}>
    {[{ id: null, label: 'Tümü' }, ...JOKER_GROUPS].map(({ id, label }) =>
      <Pressable key={id ?? 'all'} onPress={() => onChange(id)} accessibilityRole="button" accessibilityState={{ selected: selected === id }}
        style={[s.group, selected === id && s.groupSelected]}><Text style={s.itemTitle}>{label}</Text></Pressable>)}
  </View>;
}

function Panel({ title, onClose, children, instant }: React.PropsWithChildren<{ title: string; onClose: () => void; instant?: boolean }>) {
  return <Modal visible transparent animationType={instant ? 'none' : 'fade'} onRequestClose={onClose}>
    <View style={s.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <View style={s.panel} accessibilityViewIsModal>
        <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Kapat">
          <CloseXIcon size={16} color="#D9CDEC" />
        </Pressable>
        <Text accessibilityRole="header" style={s.title}>{title}</Text>
        {children}
      </View>
    </View>
  </Modal>;
}

export function LowWalletPanel({ kind, amount, onClose, onStore }: {
  kind: 'diamonds' | 'gold'; amount: number; onClose: () => void; onStore: () => void;
}) {
  const diamonds = kind === 'diamonds';
  return <Panel title={diamonds ? 'Elmas bakiyen düşük' : 'Altın bakiyen düşük'} onClose={onClose}>
    <View style={s.art}><WalletArtwork kind={kind} size={108} tier={2} /></View>
    <Text style={s.balance}>{walletAmount(amount)} {diamonds ? 'elmas' : 'altın'}</Text>
    <Text style={s.desc}>{diamonds ? 'Kozmetikler ve altın paketleri için elmas paketlerine göz at.' : 'Quizlerde altın kazanabilir veya mağazada elmaslarını altına çevirebilirsin.'}</Text>
    <Pressable style={s.primary} onPress={onStore} accessibilityRole="button">
      <Text style={s.primaryText}>{diamonds ? 'Elmas paketlerini gör' : 'Altın paketlerini gör'}</Text>
    </Pressable>
    <Pressable onPress={onClose} style={s.secondary} accessibilityRole="button"><Text style={s.desc}>Şimdi değil</Text></Pressable>
  </Panel>;
}

export function JokerPurchasePanel({ user, options, live, tactics, capabilities, lightningAvailable, buying, error, onBuy, onClose }: {
  user: UserProfile; buying?: JokerId; error?: string;
  options: QuestionOption[]; onBuy: (id: JokerId) => void; onClose: () => void;
  live?: boolean; tactics?: JokerTactics; capabilities?: ClientQuestion['jokerCapabilities']; lightningAvailable?: boolean;
}) {
  const [group, setGroup] = useState<JokerGroup | null>(null);
  const stock = new Map(user.inventory?.map(item => [item.id, item.qty]));
  const available = JOKERS.filter(joker => (stock.get(joker.id) ?? 0) <= 0 &&
    (!group || joker.group === group) && canUseJoker(joker.id, options, { live, tactics, capabilities, lightningAvailable }));
  return <Panel title="Joker satın al" onClose={onClose} instant>
    <View style={s.wallet}><CoinIcon size={17} /><Text style={s.balance}>{walletAmount(user.coins ?? 0)} altın</Text></View>
    <Text style={s.desc}>Bu soruya uygun, sende olmayan jokerler. Sayaç işlemeye devam eder.</Text>
    <JokerGroupTabs selected={group} onChange={setGroup} />
    {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <ScrollView showsVerticalScrollIndicator={false} style={s.catalog} contentContainerStyle={s.catalogContent}>
    {!available.length && <Text style={s.desc}>Bu grupta satın alabileceğin joker yok.</Text>}
    {available.map(joker => {
      const canBuy = user.coins >= joker.price;
      return <View key={joker.id} style={s.joker}>
        <WalletArtwork kind={joker.id} size={38} />
        <View style={s.detail}>
          <Text style={s.itemTitle}>{joker.name}</Text>
          <Text style={s.itemDesc}>{joker.desc}</Text>
        </View>
        <Pressable style={[s.buy, !canBuy && s.disabled]} disabled={!!buying || !canBuy} onPress={() => onBuy(joker.id)}
          accessibilityRole="button" accessibilityLabel={`${joker.name} satın al: ${joker.price} altın`}
          accessibilityState={{ busy: buying === joker.id, disabled: !!buying || !canBuy }}>
          <CoinIcon size={15} /><Text style={s.buyText}>{buying === joker.id ? 'Alınıyor…' : `${joker.price} · Al`}</Text>
        </Pressable>
      </View>;
    })}
    </ScrollView>
  </Panel>;
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#080713B8', alignItems: 'center', justifyContent: 'center', padding: 18 },
  panel: { width: '100%', maxWidth: 414, maxHeight: '100%', minHeight: 0, backgroundColor: '#211A36', borderColor: '#5B4A78', borderWidth: 1, borderRadius: 24, padding: 20, gap: 10 },
  catalog: { flexGrow: 0, flexShrink: 1 },
  catalogContent: { gap: 8 },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 7 },
  group: { borderWidth: 1, borderColor: '#5B4A78', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, justifyContent: 'center', minHeight: 36 },
  groupSelected: { borderColor: '#FFCE67', backgroundColor: '#4B3761' },
  close: { position: 'absolute', right: 9, top: 9, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  title: { color: '#FAF4FF', fontSize: 23, fontFamily: THEME.fonts.extraBold, textAlign: 'center', paddingHorizontal: 22 },
  art: { alignItems: 'center' },
  balance: { color: '#F7D197', fontFamily: THEME.fonts.extraBold, fontSize: 16, textAlign: 'center' },
  desc: { color: '#D3C6E4', fontFamily: THEME.fonts.bold, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  primary: { backgroundColor: '#F4C687', borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  primaryText: { color: '#27182C', fontFamily: THEME.fonts.extraBold, fontSize: 14 },
  secondary: { minHeight: 40, justifyContent: 'center' },
  wallet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  joker: { flexDirection: 'row', backgroundColor: '#2B2243', borderColor: '#4B3B64', borderWidth: 1, borderRadius: 12, padding: 9, alignItems: 'center', gap: 8 },
  detail: { flex: 1, gap: 4 },
  itemTitle: { color: '#F8F2FF', fontSize: 15, fontFamily: THEME.fonts.extraBold },
  itemDesc: { color: '#CBBEDD', fontSize: 12, fontFamily: THEME.fonts.bold },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 5, borderColor: '#8F6F60', borderWidth: 1, minHeight: 40, paddingHorizontal: 10, borderRadius: 8 },
  disabled: { opacity: .55 },
  buyText: { color: '#FFE2AC', fontFamily: THEME.fonts.extraBold, fontSize: 13 },
  error: { color: '#FFB7C9', fontSize: 13, textAlign: 'center' },
});
