"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCOUNT_REMOVAL_PREHEADER = exports.ACCOUNT_REMOVAL_SUBJECT = void 0;
exports.renderAccountRemovalEmail = renderAccountRemovalEmail;
exports.renderOneSignalAccountRemovalTemplate = renderOneSignalAccountRemovalTemplate;
exports.ACCOUNT_REMOVAL_SUBJECT = 'Tavriko hesap silme doğrulama kodunuz';
exports.ACCOUNT_REMOVAL_PREHEADER = 'Hesap silme isteğinizi doğrulamak için tek kullanımlık kodunuz.';
function renderAccountRemovalEmail({ code, validMinutes }) {
    if (!/^[0-9]{6}$/.test(code) || !Number.isSafeInteger(validMinutes) || validMinutes < 1) {
        throw new Error('Invalid account removal email data');
    }
    return renderLayout(code, String(validMinutes));
}
function renderOneSignalAccountRemovalTemplate() {
    return renderLayout('{{ message.custom_data.code }}', '{{ message.custom_data.valid_minutes }}');
}
function renderLayout(code, validMinutes) {
    return `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>${exports.ACCOUNT_REMOVAL_SUBJECT}</title></head>
<body bgcolor="#100821" style="margin:0;background:#100821;color:#fff;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#100821">
<tr><td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="520"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 0 18px;color:#FFD76C;font-size:26px;font-weight:800;">Tavriko</td></tr>
<tr><td bgcolor="#24163F" style="border:1px solid #58437A;border-top:4px solid #FF9DAD;border-radius:16px;padding:24px;background:#24163F;">
<p style="margin:0 0 10px;color:#FFBAC5;font-size:12px;font-weight:700;letter-spacing:1.5px;">HESAP GÜVENLİĞİ</p>
<h1 style="margin:0 0 12px;color:#fff;font-size:26px;line-height:32px;">Hesap silme doğrulaması</h1>
<p style="margin:0 0 20px;color:#E2D8F5;font-size:15px;line-height:23px;">Bu işlemi siz başlattıysanız, aşağıdaki kodu Tavriko’daki hesap silme ekranına girin. Kod tek başına hesabınızı silmez.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" bgcolor="#160E2B" style="background:#160E2B;border:1px solid #665186;border-radius:12px;padding:16px 8px;">
<p style="margin:0 0 6px;color:#E2D8F5;font-size:12px;font-weight:700;letter-spacing:1px;">TEK KULLANIMLIK KOD</p>
<p dir="ltr" style="margin:0;color:#FFD76C;font:bold 36px/46px 'Courier New',monospace;letter-spacing:5px;">${code}</p>
</td></tr></table>
<p style="margin:14px 0;color:#E2D8F5;font-size:14px;line-height:21px;">Kod <strong>${validMinutes} dakika</strong> geçerlidir. Hesabınızı silmeyi onaylarsanız işlem geri alınamaz.</p>
<p style="margin:0;padding-top:14px;border-top:1px solid #58437A;color:#E2D8F5;font-size:14px;line-height:21px;">Kodu kimseyle paylaşmayın. İsteği siz başlatmadıysanız bu e-postayı yok sayın.</p>
</td></tr>
<tr><td style="padding-top:16px;color:#CDBFE4;font-size:12px;line-height:18px;">Bu, Tavriko tarafından otomatik gönderilen bir güvenlik e-postasıdır.</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}
