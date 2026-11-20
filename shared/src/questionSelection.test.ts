import { uniqueQuestions } from './questionSelection';

describe('unique quiz questions', () => {
  it('drops aliases, duplicate IDs, and equivalent Turkish prompts', () => {
    const first = { id: 'q1', text: 'İSTİKLAL MARŞI’NIN şairi kimdir?' };
    const next = { id: 'q2', text: 'Ankara hangi bölgededir?' };
    expect(uniqueQuestions([
      first,
      { id: 'q1_cycle_1', text: "İstiklal Marşı'nın  şairi kimdir !" },
      { id: 'q1', text: 'A different prompt with the same ID' },
      next,
    ], 10)).toEqual([first, next]);
  });

  it('keeps mathematical signs that change the meaning of a question', () => {
    expect(uniqueQuestions([
      { id: 'pos', text: '5 + 3 kaçtır?' },
      { id: 'neg', text: '-5 + 3 kaçtır?' },
    ])).toHaveLength(2);
  });

  it('ignores punctuation at the end but keeps punctuation within the prompt', () => {
    const first = { id: 'q1', text: 'Dur! Sonra ne oldu?...… ' };
    const distinct = { id: 'q2', text: 'Dur. Sonra ne oldu?' };
    expect(uniqueQuestions([
      first,
      { id: 'alias', text: 'Dur! Sonra ne oldu?' },
      { id: 'blank', text: '...!?…' },
      distinct,
    ])).toEqual([first, distinct]);
  });
});
