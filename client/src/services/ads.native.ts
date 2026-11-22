import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

/** "Reklam izle, jeton kazan" ödüllü reklam birimi (AdMob). */
const REWARDED_AD_UNIT_ID = 'ca-app-pub-9520105697678442/5338495031';

/** Geliştirmede gerçek reklam istenmez; AdMob politikası gereği test kimliği kullanılır. */
const rewardedUnitId = __DEV__ ? TestIds.REWARDED : REWARDED_AD_UNIT_ID;

export const adsSupported = Platform.OS === 'android';

let consentUpdate: ReturnType<typeof AdsConsent.requestInfoUpdate> | undefined;
let initPromise: Promise<unknown> | undefined;

export function refreshAdsConsent() {
  if (!consentUpdate) {
    consentUpdate = AdsConsent.requestInfoUpdate().catch(error => {
      consentUpdate = undefined;
      throw error;
    });
  }
  return consentUpdate;
}

export async function hasAdPrivacyOptions() {
  if (!adsSupported) return false;
  try {
    await refreshAdsConsent();
    const info = await AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

export async function openAdPrivacyOptions() {
  await AdsConsent.showPrivacyOptionsForm();
}

/**
 * Her reklamdan önce güncel UMP izin durumunu kontrol et. SDK bir kez başlatılır.
 */
async function initAds(): Promise<boolean> {
  if (!adsSupported) return false;
  try {
    await refreshAdsConsent();
    const { canRequestAds } = await AdsConsent.loadAndShowConsentFormIfRequired();
    if (!canRequestAds) return false;
    await (initPromise ??= mobileAds().initialize());
    return true;
  } catch {
    initPromise = undefined;
    return false;
  }
}

export type RewardedAdResult = 'earned' | 'dismissed' | 'unavailable';

/**
 * Ödüllü reklamı yükleyip gösterir. Kullanıcı reklamı ödül alacak kadar izlerse
 * 'earned', erken kapatırsa 'dismissed', reklam yüklenemezse 'unavailable' döner.
 */
export async function showRewardedAd(attemptId: string, timeoutMs = 15000): Promise<RewardedAdResult> {
  const canRequest = await initAds();
  if (!canRequest) return 'unavailable';

  const ad = RewardedAd.createForAdRequest(rewardedUnitId, {
    serverSideVerificationOptions: { customData: attemptId },
  });

  return new Promise<RewardedAdResult>((resolve) => {
    let earned = false;
    let settled = false;
    const unsubs: Array<() => void> = [];
    const finish = (result: RewardedAdResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubs.forEach((u) => u());
      resolve(result);
    };
    const timer = setTimeout(() => finish('unavailable'), timeoutMs);

    unsubs.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(timer);
        ad.show().catch(() => finish('unavailable'));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned ? 'earned' : 'dismissed')),
      ad.addAdEventListener(AdEventType.ERROR, () => finish(earned ? 'earned' : 'unavailable'))
    );

    ad.load();
  });
}
