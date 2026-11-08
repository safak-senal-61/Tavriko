import { useGameStore, resolveCorrectCount } from '../src/store/gameStore';

const makePlayer = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  username: id,
  displayName: id,
  avatarUrl: 'av1',
  score: 0,
  currentStreak: 0,
  isReady: true,
  isHost: id === 'me',
  isConnected: true,
  hasAnsweredCurrentRound: false,
  totalResponseTimeMs: 0,
  correctAnswersCount: 0,
  ...extra,
});

const makeRoom = (status: string, players: Record<string, any>, currentRound = 1): any => ({
  code: 'DUEL1',
  mode: 'duel',
  hostId: 'me',
  status,
  category: 'mixed',
  difficulty: 'medium',
  maxPlayers: 2,
  currentRound,
  totalRounds: 5,
  questionTimeSec: 15,
  penaltyForWrong: false,
  players,
  scores: Object.fromEntries(Object.keys(players).map((k) => [k, players[k].score || 0])),
});

const makeResult = (roundNumber: number, answers: Record<string, boolean>, cumulative: Record<string, number>): any => ({
  roundNumber,
  correctOptionId: 'a',
  explanation: '',
  playerAnswers: Object.fromEntries(
    Object.entries(answers).map(([pid, ok]) => [
      pid,
      { selectedOptionId: ok ? 'a' : 'b', isCorrect: ok, pointsEarned: ok ? 100 : 0, speedBonus: 0, streak: 0, timeMs: 1000 },
    ])
  ),
  leaderboard: Object.entries(cumulative).map(([pid, c], i) => ({
    playerId: pid,
    displayName: pid,
    score: c * 100,
    rank: i + 1,
    streak: 0,
    isHost: pid === 'me',
    correctAnswersCount: c,
  })),
});

const correctOf = (pid: string) => useGameStore.getState().activeRoom?.players[pid]?.correctAnswersCount;

describe('Zirve Yarışı ilerlemesi', () => {
  beforeEach(() => {
    useGameStore.getState().setActiveRoom(null);
  });

  it('doğru cevap tur sonunda tam 1 adım ilerletir ve çift sayılmaz', () => {
    const store = useGameStore.getState();
    store.setActiveRoom(makeRoom('countdown', { me: makePlayer('me'), op: makePlayer('op') }));
    // Tur bitişinde sunucu önce STATE_SYNC, sonra ROUND_RESULT gönderir
    store.setActiveRoom(
      makeRoom('round_result', {
        me: makePlayer('me', { correctAnswersCount: 1, hasAnsweredCurrentRound: true }),
        op: makePlayer('op', { correctAnswersCount: 0, hasAnsweredCurrentRound: true }),
      })
    );
    store.setRoundResult(makeResult(1, { me: true, op: false }, { me: 1, op: 0 }));
    expect(correctOf('me')).toBe(1);
    expect(correctOf('op')).toBe(0);
    // Aynı sonuç tekrar gelse bile sayı artmaz
    store.setRoundResult(makeResult(1, { me: true, op: false }, { me: 1, op: 0 }));
    expect(correctOf('me')).toBe(1);
  });

  it('tur açıkken cevap veren oyuncu rakipten önce ilerlemez', () => {
    const store = useGameStore.getState();
    store.setActiveRoom(makeRoom('countdown', { me: makePlayer('me'), op: makePlayer('op') }));
    store.setActiveRoom(
      makeRoom('question_active', {
        me: makePlayer('me', { correctAnswersCount: 1, hasAnsweredCurrentRound: true }),
        op: makePlayer('op'),
      })
    );
    expect(correctOf('me')).toBe(0);
  });

  it('kaçırılan turlar yeniden bağlanınca sunucu sayısıyla telafi edilir', () => {
    const store = useGameStore.getState();
    store.setActiveRoom(makeRoom('countdown', { me: makePlayer('me'), op: makePlayer('op') }));
    store.setRoundResult(makeResult(1, { me: true, op: true }, { me: 1, op: 1 }));
    // 2. ve 3. turların sonuçları kaçırıldı; 4. tur sonucu geliyor
    store.setRoundResult(makeResult(4, { me: true, op: false }, { me: 4, op: 2 }));
    expect(correctOf('me')).toBe(4);
    expect(correctOf('op')).toBe(2);
    // Yeniden bağlanınca gelen oda durumu (5. tur açık, ben cevapladım)
    store.setActiveRoom(
      makeRoom(
        'question_active',
        {
          me: makePlayer('me', { correctAnswersCount: 5, hasAnsweredCurrentRound: true }),
          op: makePlayer('op', { correctAnswersCount: 2 }),
        },
        5
      )
    );
    expect(correctOf('me')).toBe(4);
    expect(correctOf('op')).toBe(2);
  });

  it('resolveCorrectCount sunucu sayısını tur kapandığında olduğu gibi kullanır', () => {
    expect(resolveCorrectCount({}, 'me', { correctAnswersCount: 3, hasAnsweredCurrentRound: true }, 'round_result')).toBe(3);
    expect(resolveCorrectCount({}, 'me', { correctAnswersCount: 3, hasAnsweredCurrentRound: false }, 'question_active')).toBe(3);
  });
});
