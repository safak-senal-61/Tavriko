# Tavriko account removal email

The server sends this as its own transactional email, separate from password reset. With the Tavriko OneSignal app configured, the [OneSignal Email API](https://documentation.onesignal.com/reference/email) uses the saved [Tavriko | Hesap silme OTP template](https://dashboard.onesignal.com/apps/bb6deff9-50fa-4867-a17d-bf87ab8f2338/templates/email/f67ab633-4b54-42b3-a6f0-dbeff95328af) through the existing `ONESIGNAL_APP_ID` and `ONESIGNAL_APP_API_KEY`. Other OneSignal apps use the versioned inline HTML unless a template ID is configured. No production environment changes are needed to select the saved Tavriko template.

## Recreate or override the template

Build the server and export the exact HTML, with OneSignal Liquid variables instead of a real OTP:

```sh
npm run build:server
node -e "process.stdout.write(require('./server/dist/services/accountRemovalEmail').renderOneSignalAccountRemovalTemplate())" > tavriko-account-removal.html
```

In the Tavriko OneSignal app, create an email template named `Tavriko | Hesap silme OTP`. Use the generated HTML and the following copy:

- Subject: `Tavriko hesap silme doğrulama kodunuz`
- Preheader: `Hesap silme isteğinizi doğrulamak için tek kullanımlık kodunuz.`
- Personalization: `{{ message.custom_data.code }}` and `{{ message.custom_data.valid_minutes }}`, as described in [OneSignal's custom_data documentation](https://documentation.onesignal.com/docs/en/personalization-api-custom-data).

Set a replacement template's ID as `ONESIGNAL_ACCOUNT_REMOVAL_TEMPLATE_ID` on the server and redeploy. To use the inline copy instead, set that variable to `inline`. Do not use the password-reset template ID. The sender uses the registered account address; the code is supplied as a string so leading zeros survive. For a delivery check, use a dedicated test mailbox and dummy custom data such as `{"code":"004891","valid_minutes":15}`.
