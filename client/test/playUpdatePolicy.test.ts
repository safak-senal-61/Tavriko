import { describe, expect, it } from 'vitest';
import {
  classifyPlayError, decideUpdate, decideWithoutPlay, deferFlexiblePrompt, flexiblePromptDue,
  FOREGROUND_CHECK_INTERVAL_MS, INITIAL_FLEXIBLE_PROMPT, parseFlexiblePrompt, RETRY_AFTER_ERROR_MS,
  REQUIRED_RECHECK_MS, shouldCheck, type PlayUpdateInfo,
} from '../src/services/playUpdatePolicy';

const info = (over: Partial<PlayUpdateInfo> = {}): PlayUpdateInfo => ({
  updateAvailable: true, immediateInProgress: false, immediateAllowed: true, flexibleAllowed: true,
  availableVersionCode: 29, stalenessDays: 0, priority: 0, installStatus: 'unknown',
  bytesDownloaded: 0, totalBytesToDownload: 0, ...over,
});

describe('decideUpdate', () => {
  it('güncelleme yoksa hiçbir şey göstermez', () => {
    expect(decideUpdate(info({ updateAvailable: false }), 28, 0)).toEqual({ kind: 'none' });
  });
  it('normal yeni sürüm isteğe bağlıdır', () => {
    expect(decideUpdate(info(), 28, 0)).toEqual({ kind: 'optional' });
  });
  it('öncelik 4+ zorunludur', () => {
    expect(decideUpdate(info({ priority: 4 }), 28, 0)).toEqual({ kind: 'required', via: 'play', resume: false });
    expect(decideUpdate(info({ priority: 5 }), 28, 0).kind).toBe('required');
    expect(decideUpdate(info({ priority: 3 }), 28, 0).kind).toBe('optional');
  });
  it('minimum sürümün altı zorunludur', () => {
    expect(decideUpdate(info(), 28, 29).kind).toBe('required');
    expect(decideUpdate(info(), 29, 29).kind).toBe('optional');
  });
  it('IMMEDIATE izinli değilse mağaza sayfasına yönlendirir', () => {
    expect(decideUpdate(info({ priority: 5, immediateAllowed: false }), 28, 0)).toEqual({ kind: 'required', via: 'store', resume: false });
  });
  it('yarıda kalan IMMEDIATE güncellemeyi sürdürür', () => {
    expect(decideUpdate(info({ updateAvailable: false, immediateInProgress: true }), 28, 0)).toEqual({ kind: 'required', via: 'play', resume: true });
  });
  it('FLEXIBLE indirme durumlarını ayırt eder', () => {
    expect(decideUpdate(info({ installStatus: 'downloading' }), 28, 0).kind).toBe('downloading');
    expect(decideUpdate(info({ installStatus: 'downloaded' }), 28, 0).kind).toBe('downloaded');
  });
});

describe('decideWithoutPlay', () => {
  it('Play yoksa yalnızca minimum sürüm altında engeller', () => {
    expect(decideWithoutPlay(28, 0).kind).toBe('none');
    expect(decideWithoutPlay(28, 28).kind).toBe('none');
    expect(decideWithoutPlay(27, 28)).toEqual({ kind: 'required', via: 'store', resume: false });
  });
});

describe('classifyPlayError', () => {
  it('Play erişilemez hatalarını ayırır', () => {
    expect(classifyPlayError('E_PLAY_UPDATE_APP_NOT_OWNED')).toBe('play_unavailable');
    expect(classifyPlayError('E_PLAY_UPDATE_PLAY_STORE_NOT_FOUND')).toBe('play_unavailable');
    expect(classifyPlayError('E_PLAY_UPDATE_NETWORK_ERROR')).toBe('transient');
    expect(classifyPlayError(undefined)).toBe('transient');
  });
});

describe('shouldCheck', () => {
  const base = { lastCheckAt: 1_000_000, lastFailed: false, required: false, playUnavailable: false };
  it('açılışta her zaman kontrol eder', () => {
    expect(shouldCheck('launch', base, base.lastCheckAt + 1)).toBe(true);
  });
  it('ön plana dönüşte sık kontrol etmez', () => {
    expect(shouldCheck('foreground', base, base.lastCheckAt + FOREGROUND_CHECK_INTERVAL_MS - 1)).toBe(false);
    expect(shouldCheck('foreground', base, base.lastCheckAt + FOREGROUND_CHECK_INTERVAL_MS)).toBe(true);
  });
  it('hata sonrası daha kısa aralıkla tekrar dener', () => {
    const failed = { ...base, lastFailed: true };
    expect(shouldCheck('online', failed, base.lastCheckAt + RETRY_AFTER_ERROR_MS - 1)).toBe(false);
    expect(shouldCheck('online', failed, base.lastCheckAt + RETRY_AFTER_ERROR_MS)).toBe(true);
  });
  it('Play kullanılamıyorsa ön planda tekrar denemez', () => {
    expect(shouldCheck('foreground', { ...base, playUnavailable: true }, base.lastCheckAt + 10 * FOREGROUND_CHECK_INTERVAL_MS)).toBe(false);
  });
  it('zorunlu ekranda kısa aralıkla yeniden kontrol eder', () => {
    const req = { ...base, required: true };
    expect(shouldCheck('foreground', req, base.lastCheckAt + REQUIRED_RECHECK_MS - 1)).toBe(false);
    expect(shouldCheck('foreground', req, base.lastCheckAt + REQUIRED_RECHECK_MS)).toBe(true);
  });
});

describe('isteğe bağlı öneri sıklığı', () => {
  const H = 3_600_000;
  it('ertelemeler giderek uzar ve yeni sürümde sıfırlanır', () => {
    let pref = deferFlexiblePrompt(INITIAL_FLEXIBLE_PROMPT, 29, 0);
    expect(pref).toEqual({ versionCode: 29, dismissed: 1, nextAt: 24 * H });
    expect(flexiblePromptDue(pref, 29, 24 * H - 1)).toBe(false);
    expect(flexiblePromptDue(pref, 29, 24 * H)).toBe(true);
    pref = deferFlexiblePrompt(pref, 29, 0);
    expect(pref.nextAt).toBe(48 * H);
    pref = deferFlexiblePrompt(deferFlexiblePrompt(pref, 29, 0), 29, 0);
    expect(pref.nextAt).toBe(72 * H);
    expect(flexiblePromptDue(pref, 30, 0)).toBe(true);
    expect(deferFlexiblePrompt(pref, 30, 0).dismissed).toBe(1);
  });
  it('bozuk tercihi güvenle yok sayar', () => {
    expect(parseFlexiblePrompt('{bozuk')).toEqual(INITIAL_FLEXIBLE_PROMPT);
    expect(parseFlexiblePrompt(null)).toEqual(INITIAL_FLEXIBLE_PROMPT);
  });
});
