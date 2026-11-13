import { describe, expect, it, beforeEach } from 'vitest';
import { useNetStatus, OFFLINE_GAME_GRACE_MS } from '../src/store/netStatus';

describe('İnternet durumu store', () => {
  beforeEach(() => {
    useNetStatus.setState({
      online: true,
      offlineSince: null,
      graceEndsAt: null,
      reconnectedAt: null,
    });
  });

  it('koruma süresi sabiti 20 saniyedir', () => {
    expect(OFFLINE_GAME_GRACE_MS).toBe(20000);
  });

  it('çevrimdışı geçişte offlineSince dolar ve koruma süresi sıfırlanır', () => {
    const before = Date.now();
    useNetStatus.getState().setOnline(false);
    const state = useNetStatus.getState();
    expect(state.online).toBe(false);
    expect(state.offlineSince).not.toBeNull();
    expect(state.offlineSince as number).toBeGreaterThanOrEqual(before);
    expect(state.graceEndsAt).toBeNull();
    expect(state.reconnectedAt).toBeNull();
  });

  it('bağlantı dönünce offlineSince temizlenir ve geri geldi bildirimi tetiklenir', () => {
    useNetStatus.getState().setOnline(false);
    useNetStatus.getState().setGraceEndsAt(Date.now() + 1000);
    useNetStatus.getState().setOnline(true);
    const state = useNetStatus.getState();
    expect(state.online).toBe(true);
    expect(state.offlineSince).toBeNull();
    // Koruma süresi bağlantı dönünce otomatik iptal edilir
    expect(state.graceEndsAt).toBeNull();
    expect(state.reconnectedAt).not.toBeNull();
  });

  it('aynı duruma tekrar set edilince durum değişmez', () => {
    useNetStatus.getState().setOnline(true);
    const before = useNetStatus.getState().reconnectedAt;
    useNetStatus.getState().setOnline(true);
    expect(useNetStatus.getState().reconnectedAt).toBe(before);
  });

  it('graceEndsAt bağımsız güncellenebilir', () => {
    const endsAt = Date.now() + OFFLINE_GAME_GRACE_MS;
    useNetStatus.getState().setGraceEndsAt(endsAt);
    expect(useNetStatus.getState().graceEndsAt).toBe(endsAt);
    useNetStatus.getState().setGraceEndsAt(null);
    expect(useNetStatus.getState().graceEndsAt).toBeNull();
  });
});
