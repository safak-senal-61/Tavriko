/**
 * Google Play iade / ters ibraz (chargeback) politikası — saf fonksiyonlar.
 *
 * Kural: Geri alınan bir satın almanın verdiği elmasların TAMAMI geri alınır.
 *  - Elmaslar harcanmadıysa: bakiye 100 → 0.
 *  - 30 elması harcandıysa: kalan 70 hemen düşülür, 30 elmas borç olarak kalır
 *    (bakiye -30). Borç kapanana kadar elmas harcanamaz; oyundan / ödüllerden /
 *    yeni satın almalardan gelen elmaslar önce borcu kapatır.
 *  - Hepsi harcandıysa: bakiye -100 olur ve hesap kötüye kullanıma karşı korunur:
 *    borç ödenene kadar yeni Google Play satın alması kabul edilmez; 2 veya daha
 *    fazla ters ibrazda satın almalar kalıcı olarak kapanır.
 */

/** Voided Purchases API `voidedReason` değerleri. */
const VOID_REASONS: Record<number, string> = {
  0: 'other', 1: 'remorse', 2: 'not_received', 3: 'defective', 4: 'accidental_purchase',
  5: 'fraud', 6: 'friendly_fraud', 7: 'chargeback', 8: 'unacknowledged_purchase',
};
export function voidReasonName(code: unknown): string {
  return typeof code === 'number' && VOID_REASONS[code] ? VOID_REASONS[code] : 'unknown';
}
/** Kötüye kullanım sayılan geri almalar (normal iade talepleri sayılmaz). */
export const ABUSIVE_VOID_REASONS = new Set(['chargeback', 'fraud', 'friendly_fraud']);
export function isAbusiveVoid(reason: string | null | undefined) {
  return Boolean(reason && ABUSIVE_VOID_REASONS.has(reason));
}

export interface ClawbackPlan {
  /** Bakiyeden hemen düşülen (pozitif bakiyeden karşılanan) elmas. */
  removedNow: number;
  /** Bakiye yetmediği için borç olarak kalan elmas. */
  debt: number;
  balanceAfter: number;
}
export function clawbackPlan(balanceBefore: number, granted: number): ClawbackPlan {
  const grant = Math.max(0, Math.trunc(granted));
  const available = Math.max(0, Math.trunc(balanceBefore));
  const removedNow = Math.min(available, grant);
  return { removedNow, debt: grant - removedNow, balanceAfter: Math.trunc(balanceBefore) - grant };
}

/** Tüketim yüzdesi (milliunit, 100000 = %100) — ReviewRefund kanıtı için. */
export function consumptionMilliunits(kind: 'gems' | 'pass', granted: number, balance: number, hasPremiumPass: boolean) {
  if (kind === 'pass') return hasPremiumPass ? 100_000 : 0;
  if (granted <= 0) return 0;
  const spent = Math.min(granted, Math.max(0, granted - Math.max(0, balance)));
  return Math.round((spent / granted) * 100_000);
}

export type RefundPreference = 'APPROVE' | 'DECLINE' | 'NEUTRAL';
/**
 * Ürün kullanıldıysa (en az %10) iadeye itiraz edilir; hiç kullanılmadıysa
 * tarafsız kalınır (elmaslar zaten tamamen geri alınabilir).
 */
export function refundPreference(consumption: number): RefundPreference {
  return consumption >= 10_000 ? 'DECLINE' : 'NEUTRAL';
}

export interface PurchaseRisk { abusiveVoids: number; balance: number }
export type PurchaseBlock = null | 'debt' | 'repeated';
/** Yeni Google Play satın almasına izin verilip verilmeyeceği. */
export function playPurchaseBlock(risk: PurchaseRisk): PurchaseBlock {
  if (risk.abusiveVoids >= 2) return 'repeated';
  if (risk.abusiveVoids >= 1 && risk.balance < 0) return 'debt';
  return null;
}

export function blockMessage(block: Exclude<PurchaseBlock, null>) {
  return block === 'repeated'
    ? 'Tekrarlanan ödeme itirazları nedeniyle bu hesapta Google Play satın almaları kapatıldı. Destek ekibiyle iletişime geçebilirsin.'
    : 'Ödeme itirazından kalan elmas borcun kapanana kadar yeni satın alma yapılamaz. Ödemen alınmadı; Google Play ücreti iade eder.';
}

// ---- Bildirim metinleri ----
const TIME_FORMAT = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
export function formatPurchaseTime(date: Date) {
  return TIME_FORMAT.format(date);
}
export function productLabel(kind: string, gems: number) {
  return kind === 'pass' ? 'Sezon Premium Pass' : `${gems} Elmas`;
}

export function purchaseNotification(row: { kind: string; gems: number; orderId: string; test: boolean; createdAt: Date }) {
  const what = row.kind === 'pass' ? 'Sezon Premium Pass hesabında açıldı.' : `${row.gems} Elmas hesabına eklendi.`;
  return {
    type: 'reward' as const,
    title: 'Satın alma tamamlandı',
    sub: `${what} Ürün: ${productLabel(row.kind, row.gems)} · Tarih: ${formatPurchaseTime(row.createdAt)} · Sipariş: ${row.orderId}${row.test ? ' · Test satın alması' : ''}`,
  };
}

export function voidNotification(row: { kind: string; gems: number; orderId: string; createdAt: Date }, info: {
  reason: string; plan: ClawbackPlan | null; passRevoked: boolean; block: PurchaseBlock;
}) {
  const chargeback = isAbusiveVoid(info.reason);
  const title = chargeback ? 'Ödeme itirazı: satın alma geri alındı' : 'Satın alma iade edildi';
  const parts = [`${formatPurchaseTime(row.createdAt)} tarihli ${productLabel(row.kind, row.gems)} satın alman (Sipariş: ${row.orderId}) Google Play tarafından geri alındı.`];
  if (info.plan) {
    parts.push(info.plan.debt > 0
      ? `Bakiyenden ${info.plan.removedNow} elmas düşüldü; ${info.plan.debt} elmas borç olarak kaldı ve kazanacağın elmaslardan karşılanacak.`
      : `Bakiyenden ${info.plan.removedNow} elmas düşüldü.`);
  }
  if (info.passRevoked) parts.push('Premium Pass erişimi kaldırıldı.');
  if (info.block === 'repeated') parts.push('Tekrarlanan ödeme itirazları nedeniyle bu hesapta Google Play satın almaları kapatıldı.');
  else if (info.block === 'debt') parts.push('Borç kapanana kadar yeni Google Play satın alması yapılamaz.');
  return { type: 'system' as const, title, sub: parts.join(' ') };
}
