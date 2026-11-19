import mobileAds, {
  AdEventType,
  AdsConsent,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

/** "Reklam izle, jeton kazan" ödüllü reklam birimi (AdMob). */
const REWARDED_AD_UNIT_ID = 'ca-app-pub-9520105697678442/5338495031';

/** Geliştirmede gerçek reklam istenmez; AdMob politikası gereği test kimliği kullanılır. */
const rewardedUnitId = __DEV__ ? TestIds.REWARDED : REWARDED_AD_UNIT_ID;

export const adsSupported = true;

let initPromise: Promise<boolean> | null = null;

/**
 * Reklam iznini (UMP / GDPR) toplar ve Mobile Ads SDK'yı başlatır. Bir kez çalışır.
 * Dönüş: reklam istenebilir mi (canRequestAds).
 */
export function initAds(): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      let canRequestAds = true;
      try {
        const info = await AdsConsent.gatherConsent();
        canRequestAds = info.canRequestAds;
      } catch (err) {
        // İzin formu yüklenemezse önceki oturumdan kalan izin durumu kullanılır.
        console.warn('[ads] consent error', err);
        try {
          canRequestAds = (await AdsConsent.getConsentInfo()).canRequestAds;
        } catch {
          canRequestAds = false;
        }
      }
      if (canRequestAds) {
        await mobileAds().initialize();
      }
      return canRequestAds;
    })().catch((err) => {
      console.warn('[ads] init error', err);
      initPromise = null;
      return false;
    });
  }
  return initPromise;
}

export type RewardedAdResult = 'earned' | 'dismissed' | 'unavailable';

/**
 * Ödüllü reklamı yükleyip gösterir. Kullanıcı reklamı ödül alacak kadar izlerse
 * 'earned', erken kapatırsa 'dismissed', reklam yüklenemezse 'unavailable' döner.
 */
export async function showRewardedAd(timeoutMs = 15000): Promise<RewardedAdResult> {
  const canRequest = await initAds();
  if (!canRequest) return 'unavailable';

  const ad = RewardedAd.createForAdRequest(rewardedUnitId);

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
