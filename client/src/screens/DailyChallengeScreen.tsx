import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Check, Target, CalendarDays, ChevronRight } from 'lucide-react-native';
import { UserProfile, DailyChallengeConfig, getDailyChallengeConfig } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { TavrikoScreen, TavrikoTopBar, Button3D, CoinIcon, GemIcon, ChestIcon } from '../components/TavrikoIcons';
import { DiscoveryArtwork, DISCOVERY_IMG } from '../components/DiscoveryArtwork';
import { GradientFill } from '../components/TavrikoGradient';

interface DailyChallengeScreenProps {
  user?: UserProfile;
  onBack: () => void;
  onStartDaily: (config: DailyChallengeConfig) => void;
}
export const DailyChallengeScreen: React.FC<DailyChallengeScreenProps> = ({ user, onBack, onStartDaily }) => {
  const streak = Math.max(1, user?.dailyStreak ?? 1);
  const completed = Boolean(user?.dailyChallenge?.completedToday);
  const cfg = getDailyChallengeConfig(streak);
  const next = getDailyChallengeConfig(streak + 1);
  return <TavrikoScreen>
    <TavrikoTopBar leftType="back" onLeftPress={onBack} coins={user?.coins ?? 0} gems={user?.gems ?? 0}
      avatarSeed={user?.avatarUrl || user?.displayName} />
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.heading}><CalendarDays size={18} color="#FFD270" /><Text style={s.eyebrow}>GÜNLÜK MEYDAN OKUMA</Text></View>
      <View style={s.hero}>
        <GradientFill colors={['#49305E', '#321C50', '#25213F']} direction="diagonal" />
        <View style={s.heroRow}>
          <View style={s.heroCopy}><Text style={s.heroKicker}>{completed ? 'BUGÜNKÜ HEDEF TAMAM' : 'HER GÜN YENİ BİR HEDEF'}</Text>
            <Text style={s.heroTitle}>{completed ? 'Serin korundu.\nHarika oynadın.' : 'Bugün de\nbir adım öne.'}</Text>
            <Text style={s.body}>{completed ? 'Ödüllerin hesabına işlendi. Yeni hedefin yarın seni bekliyor.' : 'Bilgini test et, serini sürdür.\nHer gün büyüyen ödülleri topla.'}</Text>
          </View>
          <DiscoveryArtwork source={DISCOVERY_IMG.streak} size={100} />
        </View>
        <View style={s.heroFooter}><Text style={s.gold}>{streak} günlük seri</Text><Text style={s.body}>En iyi: {user?.stats?.bestStreak ?? 0}</Text></View>
      </View>

      <View style={s.sectionHeading}><Text style={s.sectionTitle}>7 günlük yolculuğun</Text><Text style={s.gold}>{cfg.dayNumber} / 7</Text></View>
      <View style={s.week}>
        {Array.from({ length: 7 }, (_, index) => {
          const day = index + 1, done = completed ? day <= cfg.dayNumber : day < cfg.dayNumber;
          const today = day === cfg.dayNumber;
          return <View key={day} style={s.day} accessibilityLabel={`${day}. gün, ${done ? 'tamamlandı' : today ? 'bugün' : 'sırada'}`}>
            <View style={[s.circle, today && s.today, done && s.done]}>
              {done ? <Check size={18} color="#193D37" strokeWidth={3} /> : <Text style={[s.dayNumber, today && { color: '#FFD270' }]}>{day}</Text>}
            </View>
            <Text style={[s.dayLabel, today && { color: '#FFD270' }]}>{today ? 'Bugün' : `${day}. gün`}</Text>
          </View>;
        })}
      </View>

      <View style={[s.mission, completed && s.completed]}>
        <View style={s.missionTop}><View style={s.status}><Target size={15} color={completed ? '#87EBC9' : '#FFD270'} />
          <Text style={completed ? s.mint : s.gold}>{completed ? 'BUGÜN TAMAMLANDI' : `${cfg.dayNumber}. GÜNÜN GÖREVİ`}</Text></View>
          <Text style={s.small}>{cfg.totalQuestions} SORU</Text></View>
        <Text style={s.missionTitle}>{completed ? 'Bugünkü hedef tamamlandı!' : cfg.description}</Text>
        <Text style={s.body}>{completed ? 'Aynı gün tekrar oynayabilirsin; ikinci kez ödül verilmez.' : `En az ${cfg.requiredCorrect} doğru cevapla günlük ödülünü kazan. Hazırsan başlayalım.`}</Text>
        <View style={s.divider} />
        <Text style={s.rewardCaption}>{completed ? 'KAZANILAN ÖDÜLLER' : 'SENİ BEKLEYEN ÖDÜLLER'}</Text>
        <View style={s.rewards}>
          <View style={s.reward}><DiscoveryArtwork source={DISCOVERY_IMG.speed} size={34} animated={false} /><Text style={s.rewardValue}>+{cfg.rewardXp}</Text><Text style={s.small}>XP</Text></View>
          <View style={s.reward}><CoinIcon size={32} /><Text style={s.rewardValue}>+{cfg.rewardCoins}</Text><Text style={s.small}>Altın</Text></View>
          <View style={s.reward}><GemIcon size={32} /><Text style={s.rewardValue}>+{cfg.rewardGems}</Text><Text style={s.small}>Elmas</Text></View>
        </View>
        {cfg.rewardChest && <View style={s.chest}><ChestIcon size={32} /><View style={{ flex: 1 }}><Text style={s.gold}>{cfg.rewardChest === 'mega_chest' ? 'Mega Sandık' : 'Bonus Sandık'}</Text><Text style={s.body}>Günlük ödüllerine ek olarak</Text></View></View>}
        <Button3D title={completed ? 'TEKRAR PRATİK YAP (ÖDÜLSÜZ)' : 'MEYDAN OKUMAYA BAŞLA'} variant={completed ? 'mint' : 'gold'} onPress={() => onStartDaily(cfg)} textStyle={{ fontSize: 13 }} />
      </View>
      <View style={s.tomorrow}><View style={s.tomorrowArt}><DiscoveryArtwork source={completed ? DISCOVERY_IMG.victory : DISCOVERY_IMG.collector} size={60} /></View>
        <View style={{ flex: 1 }}><Text style={s.rewardCaption}>{completed ? `YARIN · ${next.dayNumber}. GÜN` : 'SERİNİ SÜRDÜR'}</Text>
          <Text style={s.tomorrowTitle}>{completed ? next.description : '7. günde büyük final'}</Text>
          <Text style={s.body}>{completed ? `+${next.rewardXp} XP · ${next.rewardCoins} altın · ${next.rewardGems} elmas` : 'Her gün oyna, Mega Sandık hedefine yaklaş.'}</Text></View>
        <ChevronRight size={18} color="#C8B7DF" />
      </View>
    </ScrollView>
  </TavrikoScreen>;
};
const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 36, gap: 16 },
  heading: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  eyebrow: { color: '#F3D58B', fontFamily: THEME.fonts.extraBold, fontSize: 12, letterSpacing: 1 },
  hero: { borderRadius: 26, borderColor: '#75518A', borderWidth: 1, overflow: 'hidden' },
  heroRow: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: { color: '#EBD2AE', fontFamily: THEME.fonts.extraBold, fontSize: 12, letterSpacing: 0.7 },
  heroTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 26, lineHeight: 30, marginTop: 10, marginBottom: 10 },
  body: { color: '#E1D5EF', fontFamily: THEME.fonts.bold, fontSize: 12, lineHeight: 19 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: '#735284', backgroundColor: '#281C3D' },
  gold: { color: '#FFD270', fontFamily: THEME.fonts.extraBold, fontSize: 12 },
  mint: { color: '#87EBC9', fontFamily: THEME.fonts.extraBold, fontSize: 12 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.extraBold, fontSize: 16 },
  week: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8, backgroundColor: '#2C1C47', borderRadius: 20, borderWidth: 1, borderColor: '#5A3B76' },
  day: { flex: 1, alignItems: 'center', gap: 8 },
  circle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3C2857', borderColor: '#72558D', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  today: { backgroundColor: '#4D382D', borderColor: '#FFD270', borderWidth: 2 },
  done: { backgroundColor: '#87EBC9', borderColor: '#87EBC9' },
  dayNumber: { color: '#DDCDEB', fontFamily: THEME.fonts.extraBold, fontSize: 12 },
  dayLabel: { color: '#DDCDEB', fontFamily: THEME.fonts.bold, fontSize: 12 },
  mission: { padding: 18, borderRadius: 24, backgroundColor: '#30204B', borderColor: '#9B7041', borderWidth: 1, gap: 13 },
  completed: { borderColor: '#4A9A82' },
  missionTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { color: '#DDCDEB', fontFamily: THEME.fonts.bold, fontSize: 12 },
  missionTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 22, lineHeight: 28 },
  divider: { height: 1, backgroundColor: '#5B4074', marginVertical: 2 },
  rewardCaption: { color: '#D1BCE5', fontFamily: THEME.fonts.extraBold, fontSize: 12, letterSpacing: 1 },
  rewards: { flexDirection: 'row', gap: 8, marginBottom: 3 },
  reward: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#241637', borderRadius: 16, paddingVertical: 12, gap: 5 },
  rewardValue: { color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 20 },
  chest: { backgroundColor: '#453042', borderRadius: 14, flexDirection: 'row', padding: 12, alignItems: 'center', gap: 12 },
  tomorrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  tomorrowArt: { backgroundColor: '#33204B', borderRadius: 18 },
  tomorrowTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.extraBold, fontSize: 14, lineHeight: 20, marginVertical: 5 },
});
