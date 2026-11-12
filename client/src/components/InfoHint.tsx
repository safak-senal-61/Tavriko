import React, { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  DIFFICULTY_XP_LABEL,
  LEAGUE_START_POINTS,
  LP_LOSS,
  LP_MIN_WIN_GAIN,
  LP_PER_CORRECT_ON_WIN,
  LP_WIN_BASE,
  LP_WRONG_ANSWER_PENALTY,
  getXpRequiredForLevel,
} from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';

export type InfoTopic = 'lp' | 'xp';

interface InfoSection {
  heading: string;
  lines: string[];
}

interface InfoContent {
  title: string;
  summary: string;
  sections: InfoSection[];
}

/**
 * LP ve XP açıklamaları. Sayılar doğrudan @trivia/shared sabitlerinden gelir; böylece
 * oyunun gerçek kuralları değiştiğinde bu metin de otomatik güncel kalır.
 */
export const INFO_CONTENT: Record<InfoTopic, InfoContent> = {
  lp: {
    title: 'Lig Puanı (LP) nedir?',
    summary:
      'LP, dereceli düellolardaki gücünü gösteren puandır. Liderler tablosundaki "Lig Puanı" sıralaması buna göre yapılır.',
    sections: [
      {
        heading: 'Nasıl kazanılır?',
        lines: [
          `Herkes ${LEAGUE_START_POINTS} LP ile başlar.`,
          `Dereceli düelloyu kazanırsan +${LP_WIN_BASE} LP alırsın, her doğru cevap için ekstra +${LP_PER_CORRECT_ON_WIN} LP.`,
          `Kaybedersen -${LP_LOSS} LP kaybedersin.`,
          `Kazanılan bir maçın net getirisi en az +${LP_MIN_WIN_GAIN} LP olur.`,
        ],
      },
      {
        heading: 'Yanlış cevap kesintisi',
        lines: [
          `Ayarlar > Oyun > "Yanlış Cevap Puan Kesintisi" açıksa, dereceli maçta her yanlış veya boş cevap -${LP_WRONG_ANSWER_PENALTY} LP götürür.`,
          'Kapalıysa yalnızca mağlubiyet cezası uygulanır.',
        ],
      },
      {
        heading: 'Hangi maçlar sayılır?',
        lines: [
          'Gerçek bir rakiple oynadığın hızlı eşleşme / 1v1 düellolar.',
          'Tek kişilik pratik, Keşfet, günlük görev, özel oda, arkadaş düellosu ve yapay zeka rakipli maçlar LP değiştirmez.',
          'LP hiçbir zaman 0 altına inmez.',
        ],
      },
    ],
  },
  xp: {
    title: 'XP (Deneyim Puanı) nedir?',
    summary:
      'XP, oynadıkça biriken deneyimdir. Seviyeni belirler ve "Toplam XP" sıralamasında yerini gösterir. XP hiçbir zaman azalmaz.',
    sections: [
      {
        heading: 'Nasıl kazanılır?',
        lines: [
          'Tek kişilik oyunda: her doğru cevap +4 XP, galibiyet +8 XP bonus (en fazla 25 XP). Zorluk çarpanı uygulanır: ' +
            `Kolay ${DIFFICULTY_XP_LABEL.easy}, Orta ${DIFFICULTY_XP_LABEL.medium}, Zor ${DIFFICULTY_XP_LABEL.hard}, Uzman ${DIFFICULTY_XP_LABEL.expert}.`,
          'Çok oyunculu maçta: kazanırsan doğru cevap başına +5 XP ve +10 XP bonus (en fazla 35 XP); kaybedersen doğru cevap başına +3 XP (en fazla 15 XP).',
          'Hiç doğru cevap vermediğin maçta XP verilmez.',
          'Günlük görev, etkinlik ve sezon ödülleri de XP verebilir. 2x XP artırıcı aktifken maç XP\'si ikiye katlanır.',
        ],
      },
      {
        heading: 'Seviye atlama',
        lines: [
          `Seviye 1 için ${getXpRequiredForLevel(1)} XP, seviye 2 için ${getXpRequiredForLevel(2)} XP, seviye 3 için ${getXpRequiredForLevel(3)} XP gerekir; her seviye bir öncekinden daha zordur.`,
          'Üstteki ilerleme çubuğu, bir sonraki seviyeye ne kadar yaklaştığını gösterir.',
        ],
      },
    ],
  },
};

interface InfoHintProps {
  topic: InfoTopic;
  size?: number;
  color?: string;
  /** Erişilebilirlik etiketi; verilmezse konuya göre otomatik oluşturulur */
  label?: string;
  style?: any;
}

/** Küçük "!" düğmesi: dokununca LP veya XP'nin ne olduğunu ve nasıl kazanıldığını anlatan pencere açar. */
export const InfoHint: React.FC<InfoHintProps> = ({ topic, size = 20, color = '#FFC43D', label, style }) => {
  const [open, setOpen] = useState(false);
  const content = INFO_CONTENT[topic];
  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label || content.title}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
        onPress={(e: any) => {
          e?.stopPropagation?.();
          sound.playSound('tap');
          sound.triggerHaptic('light');
          setOpen(true);
        }}
        style={[
          styles.badge,
          { width: size, height: size, borderRadius: size / 2, borderColor: color },
          style,
        ]}
      >
        <Text style={[styles.badgeText, { color, fontSize: Math.round(size * 0.65), lineHeight: size }]}>!</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Dokunuşlar üstteki bileşene (örn. sekme düğmesi) sızmasın */}
        <View style={styles.overlay} onStartShouldSetResponder={() => true}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={[styles.headerBadge, { borderColor: color }]}>
                <Text style={[styles.headerBadgeText, { color }]}>!</Text>
              </View>
              <Text style={styles.title} accessibilityRole="header">
                {content.title}
              </Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.summary}>{content.summary}</Text>
              {content.sections.map((section) => (
                <View key={section.heading} style={styles.section}>
                  <Text style={styles.sectionHeading}>{section.heading}</Text>
                  {section.lines.map((line) => (
                    <View key={line} style={styles.lineRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.lineText}>{line}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.closeBtn}
              activeOpacity={0.85}
              onPress={() => {
                sound.playSound('tap');
                setOpen(false);
              }}
            >
              <Text style={styles.closeBtnText}>ANLADIM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
  },
  badgeText: { fontFamily: THEME.fonts.black, textAlign: 'center' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 3, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E0E45',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    padding: 20,
    ...Platform.select({
      web: { boxShadow: '0 16px 48px rgba(0,0,0,0.6)' } as any,
      default: { elevation: 8 },
    }),
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  headerBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: { fontFamily: THEME.fonts.black, fontSize: 18, lineHeight: 22 },
  title: { flex: 1, color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 19 },
  summary: {
    color: '#E6DDF7',
    fontFamily: THEME.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  sectionHeading: {
    color: '#FFC43D',
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    marginBottom: 6,
  },
  lineRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  bullet: { color: '#FFC43D', fontFamily: THEME.fonts.extraBold, fontSize: 13, lineHeight: 19 },
  lineText: { flex: 1, color: '#FFFFFF', fontFamily: THEME.fonts.body, fontSize: 12.5, lineHeight: 19 },
  closeBtn: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#2D1C40', fontFamily: THEME.fonts.black, fontSize: 14, letterSpacing: 0.5 },
});
