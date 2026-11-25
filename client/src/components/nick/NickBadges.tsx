/**
 * Nadirlik çipi ve sahiplik rozeti (Kilitli / Sahipsin / Aktif).
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NICK_RARITY_COLORS, NICK_RARITY_LABELS, type NickOwnership, type NickRarity } from '@trivia/shared';
import { THEME } from '../../theme/tokens';

export const NickRarityChip = memo(function NickRarityChip({ rarity, small }: { rarity: NickRarity; small?: boolean }) {
  const c = NICK_RARITY_COLORS[rarity];
  return (
    <View style={[styles.chip, small && styles.chipSmall, { backgroundColor: c.soft, borderColor: c.main }]}>
      <Text style={[styles.chipText, small && styles.chipTextSmall, { color: c.main }]}>{NICK_RARITY_LABELS[rarity].toUpperCase()}</Text>
    </View>
  );
});

const OWNERSHIP: Record<NickOwnership, { label: string; fg: string; bg: string; border: string }> = {
  locked: { label: 'Kilitli', fg: 'rgba(226,218,255,0.75)', bg: 'rgba(10,4,24,0.72)', border: 'rgba(255,255,255,0.16)' },
  owned: { label: 'Sahipsin', fg: '#86EFAC', bg: 'rgba(22,101,52,0.35)', border: 'rgba(134,239,172,0.6)' },
  active: { label: 'Aktif', fg: '#1A0B00', bg: '#FFC43D', border: '#FFE08A' },
};

export const NickOwnershipBadge = memo(function NickOwnershipBadge({ state }: { state: NickOwnership }) {
  const o = OWNERSHIP[state];
  return (
    <View
      style={[styles.own, { backgroundColor: o.bg, borderColor: o.border }]}
      accessibilityLabel={`Durum: ${o.label}`}
    >
      <Text style={[styles.ownText, { color: o.fg }]}>
        {state === 'locked' ? '🔒 ' : state === 'active' ? '● ' : '✓ '}
        {o.label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  chipSmall: { paddingHorizontal: 6, paddingVertical: 2 },
  chipText: { fontFamily: THEME.fonts.black, fontSize: 10, letterSpacing: 0.8 },
  chipTextSmall: { fontSize: 8.5, letterSpacing: 0.6 },
  own: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  ownText: { fontFamily: THEME.fonts.extraBold, fontSize: 10 },
});
