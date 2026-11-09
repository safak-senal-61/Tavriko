import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Image, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Bot, Check, Radio, ShieldCheck, Swords, Volume2, VolumeX, X } from 'lucide-react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DISCOVERY_IMG, DiscoveryArtwork, useReducedMotion } from '../components/DiscoveryArtwork';
import { GradientFill } from '../components/TavrikoGradient';
import { TavrikoScreen, CharacterAvatar } from '../components/TavrikoIcons';

interface DuelVersusScreenProps {
  myProfile: { displayName: string; avatarUrl?: string; rankTitle?: string };
  opponentProfile: { displayName: string; avatarUrl?: string; rankTitle?: string; isBot?: boolean };
  categoryName?: string;
  onCancel?: () => void;
}

export const DuelVersusScreen: React.FC<DuelVersusScreenProps> = ({
  myProfile, opponentProfile, categoryName = 'Hızlı Düello', onCancel,
}) => {
  const isBot = !!opponentProfile.isBot;
  const compact = useWindowDimensions().height < 760;
  const reduced = useReducedMotion();
  const [countdown, setCountdown] = useState(3);
  const [audio, setAudio] = useState(sound.isSoundEnabled());
  const entrance = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    sound.playSound('match_found');
    sound.triggerHaptic('success');
    const start = Date.now();
    const timer = setInterval(() => {
      const remaining = Math.max(0, 3 - Math.floor((Date.now() - start) / 1000));
      setCountdown(remaining);
      if (remaining > 0) sound.playSound('timer_tick');
      else clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    entrance.setValue(reduced ? 1 : 0);
    const enter = Animated.spring(entrance, { toValue: 1, damping: 18, stiffness: 160, useNativeDriver: Platform.OS !== 'web' });
    const fill = Animated.timing(progress, { toValue: 1, duration: 3000, useNativeDriver: false });
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 1500, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(breath, { toValue: 0, duration: 1500, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    enter.start();
    fill.start();
    if (!reduced) loop.start();
    else breath.setValue(0);
    return () => { enter.stop(); fill.stop(); loop.stop(); };
  }, [entrance, progress, breath, reduced]);

  return (
    <TavrikoScreen>
      <View style={styles.top}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Eşleşmeden çık" style={styles.iconButton}
          onPress={() => { sound.playSound('tap'); onCancel?.(); }}>
          <X size={20} color="#F1E7FF" />
        </TouchableOpacity>
        <View style={styles.mode}>
          {isBot ? <Bot size={15} color="#FFE2A4" /> : <Radio size={15} color="#ADF0D8" />}
          <Text style={[styles.modeText, !isBot && { color: '#ADF0D8' }]}>{isBot ? 'BOT KARŞILAŞMASI' : 'CANLI KARŞILAŞMA'}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={audio ? 'Sesi kapat' : 'Sesi aç'}
          accessibilityState={{ selected: audio }} aria-pressed={audio} style={styles.iconButton}
          onPress={() => { const enabled = !audio; sound.setSoundEnabled(enabled); setAudio(enabled); }}>
          {audio ? <Volume2 size={19} color="#F1E7FF" /> : <VolumeX size={19} color="#F1E7FF" />}
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, compact && { gap: 12, paddingVertical: 12 }]}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>EŞLEŞME TAMAMLANDI</Text>
          <Text accessibilityRole="header" style={styles.title}>{isBot ? 'Bilgiye meydan oku.' : 'Rakibin hazır.'}</Text>
          <Text style={styles.subtitle}>{categoryName} · 1v1 Düello</Text>
        </View>

        <View style={[styles.stage, compact && { height: 140 }]}>
          <Image source={DISCOVERY_IMG.arena} style={styles.stageBackground} resizeMode="cover" />
          <GradientFill colors={['#21113C00', '#21113CAA', '#21113C']} />
          <Animated.View pointerEvents="none" style={[styles.orbit, {
            opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
            transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.04] }) }],
          }]} />
          {isBot ? <DiscoveryArtwork source={DISCOVERY_IMG.robot} size={compact ? 104 : 128} />
            : <Swords size={104} color="#B7F5E1" strokeWidth={1.1} />}
          <View style={styles.stageCaption}>
            {isBot ? <Bot size={14} color="#FFE2A4" /> : <Radio size={14} color="#ADF0D8" />}
            <Text style={styles.captionText}>{isBot ? 'Gerçek oyuncu bulunamadı. Bot rakip bağlandı.' : 'Gerçek zamanlı. Gerçek rakip.'}</Text>
          </View>
        </View>

        <View style={styles.players}>
          <Animated.View style={[styles.playerCard, { transform: [{ translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [-38, 0] }) }] }]}>
            <GradientFill colors={['#49306E', '#2B1A46']} direction="diagonal" />
            <View style={[styles.avatarRing, styles.myRing]}><CharacterAvatar seed={myProfile.avatarUrl || myProfile.displayName} size={62} /></View>
            <Text style={styles.playerLabel}>SEN</Text>
            <Text style={styles.playerName} numberOfLines={2}>{myProfile.displayName || 'Oyuncu'}</Text>
            <Text style={styles.rank} numberOfLines={1}>{myProfile.rankTitle || 'Acemi Kaşif'}</Text>
            <View style={styles.ready}><Check size={13} color="#ADF0D8" /><Text style={styles.readyText}>Hazır</Text></View>
          </Animated.View>
          <View style={styles.vs}><Text style={styles.vsText}>VS</Text></View>
          <Animated.View style={[styles.playerCard, styles.opponentCard, { transform: [{ translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [38, 0] }) }] }]}>
            <GradientFill colors={isBot ? ['#493122', '#2E1D3A'] : ['#1F4944', '#1C2C3B']} direction="diagonal" />
            <View style={[styles.avatarRing, isBot ? styles.botRing : styles.liveRing]}>
              {isBot ? <Image source={DISCOVERY_IMG.robot} style={styles.botAvatar} resizeMode="contain" />
                : <CharacterAvatar seed={opponentProfile.avatarUrl || opponentProfile.displayName} size={62} />}
            </View>
            <Text style={[styles.playerLabel, { color: isBot ? '#FFE2A4' : '#ADF0D8' }]}>{isBot ? 'BİLGİSAYAR RAKİP' : 'CANLI RAKİP'}</Text>
            <Text style={styles.playerName} numberOfLines={2}>{opponentProfile.displayName || (isBot ? 'Zekaküpü' : 'Rakip Oyuncu')}</Text>
            <Text style={styles.rank} numberOfLines={1}>{isBot ? 'Yapay zekâ düellosu' : opponentProfile.rankTitle || 'Düellocu'}</Text>
            <View style={styles.ready}><Check size={13} color="#ADF0D8" /><Text style={styles.readyText}>Hazır</Text></View>
          </Animated.View>
        </View>

        <View style={styles.countdownPanel}>
          <View style={styles.countdownRow}>
            <View style={styles.countBubble}>
              {countdown > 0 ? <Text style={styles.countNumber}>{countdown}</Text> : <ActivityIndicator size="small" color="#FFE2A4" />}
            </View>
            <View style={styles.countCopy}>
              <Text accessibilityLiveRegion="polite" style={styles.countTitle}>{countdown > 0 ? 'Düello başlıyor' : 'Arena hazırlanıyor'}</Text>
              <Text style={styles.countSubtitle}>{countdown > 0 ? 'İlk soruya hazırlan. Sıra sende.' : 'Sorular geldiğinde otomatik başlayacak.'}</Text>
            </View>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 3, now: 3 - countdown }} aria-valuemin={0} aria-valuemax={3} aria-valuenow={3 - countdown}
            accessibilityLabel="Düello hazırlığı" style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
        </View>
        <View style={styles.fairplay}><ShieldCheck size={15} color="#ADF0D8" /><Text style={styles.fairplayText}>Aynı sorular. Eşit şans. Bilgin konuşsun.</Text></View>
      </ScrollView>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  iconButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#28183D', borderWidth: 1, borderColor: '#57416C', alignItems: 'center', justifyContent: 'center' },
  mode: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  modeText: { color: '#FFE2A4', fontFamily: THEME.fonts.extraBold, fontSize: 12, letterSpacing: 0.5 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 16, width: '100%', maxWidth: 580, alignSelf: 'center' },
  heading: { gap: 6, alignItems: 'center' },
  eyebrow: { color: '#ADF0D8', fontFamily: THEME.fonts.extraBold, fontSize: 12, letterSpacing: 1.3 },
  title: { color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 28, lineHeight: 34, textAlign: 'center' },
  subtitle: { color: '#D7CBF1', fontFamily: THEME.fonts.bold, fontSize: 13 },
  stage: { width: '100%', height: 168, alignItems: 'center', justifyContent: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: '#21113C', borderWidth: 1, borderColor: '#604577' },
  stageBackground: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.7 },
  orbit: { width: 132, height: 132, position: 'absolute', top: 1, borderWidth: 1, borderColor: '#B7F5E1', borderRadius: 90 },
  stageCaption: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 8, marginBottom: 8 },
  captionText: { color: '#EADFF5', fontFamily: THEME.fonts.bold, fontSize: 12, textAlign: 'center', flexShrink: 1 },
  players: { width: '100%', flexDirection: 'row', gap: 16, alignItems: 'stretch' },
  playerCard: { flex: 1, minWidth: 0, borderRadius: 24, borderWidth: 1, borderColor: '#8966B7', paddingHorizontal: 8, paddingVertical: 12, alignItems: 'center', overflow: 'hidden', gap: 4 },
  opponentCard: { borderColor: '#977B53' },
  avatarRing: { borderWidth: 2, borderRadius: 40, padding: 3, width: 72, height: 72, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  myRing: { borderColor: '#C5A1F0' },
  botRing: { borderColor: '#FFC43D' },
  liveRing: { borderColor: '#85E6C6' },
  botAvatar: { width: 65, height: 65 },
  playerLabel: { color: '#D6BAF7', fontFamily: THEME.fonts.extraBold, fontSize: 12, textAlign: 'center' },
  playerName: { color: '#FFFFFF', fontFamily: THEME.fonts.extraBold, fontSize: 16, lineHeight: 21, textAlign: 'center', minHeight: 21 },
  rank: { color: '#D7CBF1', fontFamily: THEME.fonts.body, fontSize: 12 },
  ready: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 2 },
  readyText: { color: '#ADF0D8', fontFamily: THEME.fonts.extraBold, fontSize: 12 },
  vs: { position: 'absolute', left: '50%', top: 42, marginLeft: -21, width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFC43D', borderWidth: 4, borderColor: '#21113C', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  vsText: { color: '#382044', fontFamily: THEME.fonts.display, fontSize: 18 },
  countdownPanel: { alignSelf: 'stretch', borderRadius: 20, borderWidth: 1, borderColor: '#59446D', padding: 16, backgroundColor: '#251838', gap: 14 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countBubble: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#443147', alignItems: 'center', justifyContent: 'center' },
  countNumber: { color: '#FFE2A4', fontFamily: THEME.fonts.display, fontSize: 32, lineHeight: 38 },
  countCopy: { flex: 1, minWidth: 0, gap: 4 },
  countTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.extraBold, fontSize: 16 },
  countSubtitle: { color: '#D7CBF1', fontFamily: THEME.fonts.body, fontSize: 12, lineHeight: 18 },
  progressTrack: { height: 6, backgroundColor: '#160D25', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#FFC43D', borderRadius: 4 },
  fairplay: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  fairplayText: { color: '#D7CBF1', fontFamily: THEME.fonts.body, fontSize: 12, flexShrink: 1 },
});
