# Tavriko password reset via OneSignal

The existing Auth screen sends a request to `/api/auth/forgot-password`. The Express backend looks up the password account in PostgreSQL and sends a Turkish transactional email to the stored mailbox using [OneSignal Email](https://documentation.onesignal.com/reference/email). OneSignal delivers the code; it does not generate or verify it. The response never contains the email on record, the code, or a session token.

## Set up production

1. Complete [OneSignal Email setup](https://documentation.onesignal.com/docs/en/email-setup). Set a default sender, authenticate its sending domain, and complete the trust review for delivery beyond test inboxes.
2. In the `tavriko` Vercel project's Production environment, set `ONESIGNAL_APP_ID` to the OneSignal App ID and `ONESIGNAL_APP_API_KEY` to the app-scoped key from [Keys & IDs](https://documentation.onesignal.com/docs/en/keys-and-ids), without the `Key ` prefix. Keep the key server-only; do not add it to Git, client config, or `EXPO_PUBLIC_*`. The backend also needs its existing `DATABASE_URL` and `JWT_SECRET` (or `SUPABASE_JWT_SECRET`); no new database migration is needed.
3. Deploy with these variables and test a dedicated password account and inbox that you control. Check that the message arrives, the OTP resets the password once, and only the new password works on another device or session. Never test by changing a real user's password or using a production key in local tests.

## Behavior and troubleshooting

- The email goes only to the registered address. Valid-looking requests for missing accounts and Google-only accounts return the same message as eligible requests. If OneSignal is not configured, code requests return a service-unavailable message.
- One code is active at a time per account. It expires in 15 minutes, can be used once, becomes unusable after five incorrect guesses, and is replaced by a new code when a resend is accepted after 60 seconds. Password and mailbox changes invalidate the active code. PostgreSQL serializes concurrent requests and stores only an scrypt verifier with a server-keyed salt, not the code.
- Sending uses the default OneSignal sender, without a template or a marketing segment. This is [transactional email](https://documentation.onesignal.com/docs/en/setup-transactional-emails), so it is permitted for recipients who opted out of marketing. OneSignal can create an email subscription for a new address; do not use the reset flow's recipients as implicit marketing consent.
- On the public screen, the generic message is not a delivery receipt. Check OneSignal's message activity and the Vercel server warnings if a test message does not arrive. The server does not log the OTP, provider credentials, or reset request body.
