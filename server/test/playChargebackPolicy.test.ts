import { describe, expect, it } from 'vitest';
import {
  clawbackPlan, consumptionMilliunits, isAbusiveVoid, playPurchaseBlock, purchaseNotification, refundPreference, voidReasonName,
} from '../src/services/playChargebackPolicy';

describe('ters ibraz politikası', () => {
  it('elmasların tamamını geri alır, yetmeyen kısmı borç yazar', () => {
    expect(clawbackPlan(100, 100)).toEqual({ removedNow: 100, debt: 0, balanceAfter: 0 });
    expect(clawbackPlan(70, 100)).toEqual({ removedNow: 70, debt: 30, balanceAfter: -30 });
    expect(clawbackPlan(0, 100)).toEqual({ removedNow: 0, debt: 100, balanceAfter: -100 });
    expect(clawbackPlan(-20, 100)).toEqual({ removedNow: 0, debt: 100, balanceAfter: -120 });
    expect(clawbackPlan(500, 100)).toEqual({ removedNow: 100, debt: 0, balanceAfter: 400 });
  });
  it('tüketim yüzdesini hesaplar ve tercihi belirler', () => {
    expect(consumptionMilliunits('gems', 100, 100, false)).toBe(0);
    expect(consumptionMilliunits('gems', 100, 70, false)).toBe(30_000);
    expect(consumptionMilliunits('gems', 100, 0, false)).toBe(100_000);
    expect(consumptionMilliunits('gems', 100, -50, false)).toBe(100_000);
    expect(consumptionMilliunits('pass', 0, 0, true)).toBe(100_000);
    expect(refundPreference(0)).toBe('NEUTRAL');
    expect(refundPreference(9_999)).toBe('NEUTRAL');
    expect(refundPreference(10_000)).toBe('DECLINE');
  });
  it('kötüye kullanımı ayırt eder ve satın almayı kısıtlar', () => {
    expect(voidReasonName(7)).toBe('chargeback');
    expect(voidReasonName(1)).toBe('remorse');
    expect(voidReasonName(99)).toBe('unknown');
    expect(isAbusiveVoid('friendly_fraud')).toBe(true);
    expect(isAbusiveVoid('remorse')).toBe(false);
    expect(playPurchaseBlock({ abusiveVoids: 0, balance: -100 })).toBeNull();
    expect(playPurchaseBlock({ abusiveVoids: 1, balance: 0 })).toBeNull();
    expect(playPurchaseBlock({ abusiveVoids: 1, balance: -1 })).toBe('debt');
    expect(playPurchaseBlock({ abusiveVoids: 2, balance: 50 })).toBe('repeated');
  });
  it('satın alma bildiriminde ürün, İstanbul saati ve sipariş numarası olur', () => {
    const note = purchaseNotification({ kind: 'pass', gems: 0, orderId: 'GPA.7', test: false, createdAt: new Date('2026-11-27T11:32:00Z') });
    expect(note.sub).toBe('Sezon Premium Pass hesabında açıldı. Ürün: Sezon Premium Pass · Tarih: 27.11.2026 14:32 · Sipariş: GPA.7');
  });
});
