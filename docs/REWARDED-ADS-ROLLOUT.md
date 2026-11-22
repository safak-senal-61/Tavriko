# Android rewarded ads rollout

The web release can ship while rewarded ads are disabled. Without `ADMOB_REWARDED_ENABLED=true`, the client does not show the rewarded card and the server does not create attempts or credit coins.

1. Apply the checked-in Prisma migration `20261122000000_rewarded_ad_verification` using the project's normal production migration process. Vercel's build generates Prisma Client but does not migrate production.
2. In AdMob, verify the rewarded ad unit's SSV callback at `https://tavriko-app.vercel.app/api/social/ads/rewarded/admob-ssv`. For the dashboard URL check, leave the optional custom data blank. The unsigned client claim endpoint is no longer available.
3. Verify that `/app-ads.txt` is plain text and publicly reachable at the developer-domain root from the Play listing, then check app verification in AdMob. Publish the appropriate AdMob privacy messages, review the privacy/KVKK copy, and verify Play Console's Data Safety, Contains ads, and Advertising ID declarations.
4. Verify the Android AAB's final manifest version code before using the file; EAS production auto-increments the remote value. Test UMP preferences and a full end-to-end callback on an AdMob test device in a staging environment with the matching ad unit, without interacting with live ads.
5. Only then set `ADMOB_REWARDED_ENABLED=true` for production and redeploy. Check that one verified event credits a single reward, re-delivery does not increase the balance, and the UTC daily limit and cooldown hold. Unset the flag and redeploy to disable the feature without rolling back the web release.

Official references: [AdMob server-side verification](https://developers.google.com/admob/android/ssv), [Privacy and messaging](https://developers.google.com/admob/android/privacy), [Play data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure), and [Expo version management](https://docs.expo.dev/build-reference/app-versions/).
