import {
  ErrorCode, fetchProducts, finishTransaction, getAvailablePurchases, initConnection,
  purchaseErrorListener, purchaseUpdatedListener, requestPurchase,
  type Purchase,
} from 'expo-iap';
import { authHeaders } from '../utils/apiAuth';
import { useNotificationStore } from '../store/notificationStore';
import type { PlayBillingState, PlayBuyResult } from './playBilling';

export type { PlayBillingState, PlayBuyResult } from './playBilling';

/**
 * Android uygulama içi satın alma (Google Play Billing).
 *
 * Akış: sunucu açık mı diye sorulur, ürün fiyatları Play'den okunur, satın alma
 * Play ekranında yapılır ve oluşan `purchaseToken` sunucuya gönderilir. Bakiye
 * yalnızca sunucu Google'dan doğruladıktan sonra yazılır; istemci hiçbir zaman
 * kendi başına elmas veya Pass vermez.
 */
export const playBillingSupported = true;

let connection: Promise<boolean> | null = null;
function connect(): Promise<boolean> {
  connection ??= initConnection().then(Boolean).catch(() => { connection = null; return false; });
  return connection;
}

type Waiter = { productId: string; resolve: (result: PlayBuyResult) => void };
let waiter: Waiter | null = null;
let listening = false;
let currentBase = '';
const inFlight = new Map<string, Promise<PlayBuyResult>>();

async function verify(base: string, purchase: Purchase): Promise<PlayBuyResult> {
  const token = purchase.purchaseToken ?? '';
  if (!token) return { status: 'error', message: 'Satın alma bilgisi okunamadı.' };
  if (purchase.purchaseState === 'pending') return { status: 'pending' };
  const existing = inFlight.get(token);
  if (existing) return existing;
  const job = (async (): Promise<PlayBuyResult> => {
    try {
      const response = await fetch(`${base}/social/shop/play/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ productId: purchase.productId, purchaseToken: token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 202) {
        return { status: 'error', message: typeof data?.error === 'string' ? data.error : 'Satın alma doğrulanamadı.' };
      }
      if (data.status === 'granted' || data.status === 'already_processed') {
        // Sunucu ürünü Google tarafında zaten tüketti; burada yalnızca yerel önbelleği temizleriz.
        await finishTransaction({ purchase, isConsumable: true }).catch(() => {});
        // Sunucu satın alma bildirimini (ürün, saat, sipariş no) bildirim merkezine yazdı.
        if (data.status === 'granted') void useNotificationStore.getState().refresh(base, true).catch(() => {});
        return { status: data.status, gems: data.gems, pass: data.pass };
      }
      if (data.status === 'pending' || data.status === 'pass_owned') return { status: data.status };
      return { status: 'error', message: 'Satın alma doğrulanamadı.' };
    } catch {
      return { status: 'error', message: 'Bağlantı hatası. Satın alman kaybolmaz; mağazayı tekrar açınca doğrulanır.' };
    } finally {
      inFlight.delete(token);
    }
  })();
  inFlight.set(token, job);
  return job;
}

function listen() {
  if (listening) return;
  listening = true;
  purchaseUpdatedListener((purchase: Purchase) => {
    void verify(currentBase, purchase).then(result => {
      if (waiter && waiter.productId === purchase.productId) { waiter.resolve(result); waiter = null; }
    });
  });
  purchaseErrorListener((error) => {
    if (!waiter) return;
    waiter.resolve(error.code === ErrorCode.UserCancelled
      ? { status: 'cancelled' }
      : { status: 'error', message: 'Satın alma tamamlanamadı.' });
    waiter = null;
  });
}

export async function preparePlayBilling(base: string): Promise<PlayBillingState> {
  currentBase = base;
  try {
    const response = await fetch(`${base}/social/shop/play/availability`, { method: 'POST' });
    const data = response.ok ? await response.json() : null;
    const skus: string[] = Array.isArray(data?.products) ? data.products.filter((id: unknown) => typeof id === 'string') : [];
    if (data?.enabled !== true || skus.length === 0 || !await connect()) return { enabled: false, prices: {} };
    listen();
    const products = (await fetchProducts({ skus, type: 'in-app' })) ?? [];
    const prices: Record<string, string> = {};
    for (const product of products) {
      const id = (product as { id?: string }).id;
      const price = (product as { displayPrice?: string }).displayPrice;
      if (id && price) prices[id] = price;
    }
    return { enabled: Object.keys(prices).length > 0, prices };
  } catch {
    return { enabled: false, prices: {} };
  }
}

export async function buyWithPlay(base: string, productId: string): Promise<PlayBuyResult> {
  currentBase = base;
  if (waiter) return { status: 'error', message: 'Devam eden bir satın alma var.' };
  if (!await connect()) return { status: 'error', message: 'Google Play bağlantısı kurulamadı.' };
  listen();
  const account = await fetch(`${base}/social/shop/play/account`, { headers: authHeaders() })
    .then(r => r.ok ? r.json() : null).catch(() => null);
  if (typeof account?.accountId !== 'string') return { status: 'error', message: 'Satın alma için giriş yapmalısın.' };
  return new Promise<PlayBuyResult>(resolve => {
    waiter = { productId, resolve };
    requestPurchase({
      request: { google: { skus: [productId], obfuscatedAccountId: account.accountId } },
      type: 'in-app',
    }).catch((error: { code?: string }) => {
      if (!waiter) return;
      waiter = null;
      resolve(error?.code === ErrorCode.UserCancelled ? { status: 'cancelled' } : { status: 'error', message: 'Satın alma başlatılamadı.' });
    });
  });
}

/** Uygulama kapanırken yarıda kalan (ödenmiş ama doğrulanmamış) satın almaları tamamlar. */
export async function restorePlayPurchases(base: string): Promise<number> {
  currentBase = base;
  if (!await connect()) return 0;
  listen();
  try {
    const purchases = await getAvailablePurchases();
    let granted = 0;
    for (const purchase of purchases ?? []) {
      if (purchase.purchaseState !== 'purchased') continue;
      const result = await verify(base, purchase);
      if (result.status === 'granted') granted += 1;
    }
    return granted;
  } catch {
    return 0;
  }
}
