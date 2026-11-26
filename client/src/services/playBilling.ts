/**
 * Web, iOS ve test ortamı için Google Play Billing yer tutucusu. Play satın
 * alması yalnızca Android build'inde çalışır (bkz. playBilling.android.ts).
 */
export const playBillingSupported = false;

export type PlayBuyResult =
  | { status: 'granted' | 'already_processed'; gems?: number; pass?: boolean }
  | { status: 'pending' | 'pass_owned' | 'cancelled' }
  | { status: 'error'; message: string };

export interface PlayBillingState { enabled: boolean; prices: Record<string, string> }

export async function preparePlayBilling(_base: string): Promise<PlayBillingState> {
  return { enabled: false, prices: {} };
}

export async function buyWithPlay(_base: string, _productId: string): Promise<PlayBuyResult> {
  return { status: 'error', message: 'Bu cihazda uygulama içi satın alma desteklenmiyor.' };
}

export async function restorePlayPurchases(_base: string): Promise<number> {
  return 0;
}
