/**
 * Web ve test ortamı için reklam servisi. Ödüllü reklamlar yalnızca Android/iOS
 * native build'lerinde çalışır (bkz. ads.native.ts).
 */
export const adsSupported = false;

export type RewardedAdResult = 'earned' | 'dismissed' | 'unavailable';

export async function refreshAdsConsent(): Promise<void> {}
export async function hasAdPrivacyOptions(): Promise<boolean> { return false; }
export async function openAdPrivacyOptions(): Promise<void> {}

export function showRewardedAd(_attemptId: string): Promise<RewardedAdResult> {
  return Promise.resolve('unavailable');
}
