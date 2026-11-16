import { shuffleOptionsForPlayer } from './optionShuffle';

const options = [
  { id: 'opt_a', text: 'Elma' },
  { id: 'opt_b', text: 'Armut' },
  { id: 'opt_c', text: 'Kiraz' },
  { id: 'opt_d', text: 'Vişne' },
];

describe('Oyuncuya özel şık sırası', () => {
  it('aynı oyuncu aynı soruda hep aynı sırayı görür (yeniden bağlanma güvenli)', () => {
    const first = shuffleOptionsForPlayer(options, 'player-1', 'q-42-3');
    for (let i = 0; i < 5; i++) {
      expect(shuffleOptionsForPlayer(options, 'player-1', 'q-42-3')).toEqual(first);
    }
  });

  it('farklı oyuncular farklı sıralar görür', () => {
    const a = shuffleOptionsForPlayer(options, 'player-1', 'q-42-3');
    const b = shuffleOptionsForPlayer(options, 'player-2', 'q-42-3');
    const c = shuffleOptionsForPlayer(options, 'player-3', 'q-42-3');
    const orders = new Set([a.map(o => o.id).join('|'), b.map(o => o.id).join('|'), c.map(o => o.id).join('|')]);
    expect(orders.size).toBeGreaterThan(1);
  });

  it('şıkların tamamı korunur, hiçbiri kaybolmaz veya çoğalmaz', () => {
    for (const player of ['p1', 'p2', 'p3', 'p4']) {
      const shuffled = shuffleOptionsForPlayer(options, player, 'q-9-1');
      expect(shuffled.map(o => o.id).sort()).toEqual(['opt_a', 'opt_b', 'opt_c', 'opt_d']);
      expect(shuffled).toHaveLength(options.length);
    }
  });

  it('girdi dizisini değiştirmez', () => {
    const original = options.map(o => o.id);
    shuffleOptionsForPlayer(options, 'player-1', 'q-1-1');
    expect(options.map(o => o.id)).toEqual(original);
  });

  it('0-1 şıklı sorularda sıra korunur', () => {
    expect(shuffleOptionsForPlayer([], 'p', 'q')).toEqual([]);
    expect(shuffleOptionsForPlayer([{ id: 'only' }], 'p', 'q')).toEqual([{ id: 'only' }]);
  });

  it('karıştırma tesadüfen orijinal sırayla aynıysa ilk iki şık yer değiştirir', () => {
    // Tohum deneyerek "orijinalle aynı" çıkan bir oyuncu bul (küçük olasılık,
    // deterministik olduğundan koşul sabittir).
    let identicalSeedPlayer: string | null = null;
    for (let i = 0; i < 500; i++) {
      const player = `probe-${i}`;
      const shuffled = shuffleOptionsForPlayer(options, player, 'q-7-1');
      if (shuffled.every((o, idx) => o.id === options[idx].id)) {
        identicalSeedPlayer = player;
        break;
      }
    }
    if (identicalSeedPlayer) {
      const shuffled = shuffleOptionsForPlayer(options, identicalSeedPlayer, 'q-7-1');
      expect(shuffled.map(o => o.id)).not.toEqual(options.map(o => o.id));
    }
  });
});
