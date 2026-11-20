/**
 * Web ve test ortamı için reklam servisi. Ödüllü reklamlar yalnızca Android/iOS
 * native build'lerinde çalışır (bkz. ads.native.ts).
 */
export const adsSupported = false;

export type RewardedAdResult = 'earned' | 'dismissed' | 'unavailable';

export function initAds(): Promise<boolean> {
  return Promise.resolve(false);
}

export function showRewardedAd(): Promise<RewardedAdResult> {
  return Promise.resolve('unavailable');
}
