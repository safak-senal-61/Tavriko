"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPasswordResetEmail = renderPasswordResetEmail;
function renderPasswordResetEmail({ code, validMinutes }) {
    // Only the server-generated digits and expiry may be interpolated into the HTML.
    if (!/^[0-9]{6}$/.test(code) || !Number.isSafeInteger(validMinutes) || validMinutes < 1) {
        throw new Error('Invalid password reset email data');
    }
    return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Tavriko şifre sıfırlama kodunuz</title>
</head>
<body bgcolor="#0E0422" style="margin:0;padding:0;background-color:#0E0422;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0E0422" style="width:100%;background-color:#0E0422;background-image:linear-gradient(160deg,#2E1165 0%,#1B0A3E 48%,#0E0422 100%);">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <!--[if mso]><table role="presentation" width="520" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:520px;">
          <tr>
            <td align="center" style="padding:0 0 22px 0;">
              <p style="margin:0;color:#FFFFFF;font-size:32px;line-height:38px;font-weight:800;letter-spacing:-1px;">Tavriko</p>
              <p style="margin:4px 0 0;color:#D9CDF5;font-size:11px;line-height:16px;font-weight:700;letter-spacing:2px;">CANLI BİLGİ &amp; DÜELLO</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#241050" style="background-color:#241050;border:1px solid #583B87;border-top:4px solid #FFC43D;border-radius:18px;padding:28px 24px;">
              <p style="margin:0 0 10px;color:#FFC43D;font-size:11px;line-height:16px;font-weight:700;letter-spacing:2px;">HESAP GÜVENLİĞİ</p>
              <h1 style="margin:0;color:#FFFFFF;font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.4px;">Şifrenizi yenileyin</h1>
              <p style="margin:12px 0 22px;color:#D9CDF5;font-size:15px;line-height:23px;">Aşağıdaki kodu Tavriko’da <strong style="color:#FFFFFF;">Şifremi Unuttum</strong> ekranına girin ve yeni şifrenizi belirleyin.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
                <tr>
                  <td align="center" bgcolor="#130932" style="background-color:#130932;border:1px solid #6C4A7C;border-radius:14px;padding:18px 6px;">
                    <p style="margin:0 0 6px;color:#D9CDF5;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.4px;">6 HANELİ DOĞRULAMA KODU</p>
                    <p dir="ltr" style="margin:0;color:#FFC43D;font-family:'Courier New',monospace;font-size:40px;line-height:48px;font-weight:700;letter-spacing:6px;white-space:nowrap;">${code}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;color:#C4F5E7;font-size:13px;line-height:20px;text-align:center;">Tek kullanımlık bu kod <strong>${validMinutes} dakika</strong> geçerlidir.</p>
              <p style="margin:22px 0 0;padding:16px 0 0;border-top:1px solid #583B87;color:#D9CDF5;font-size:13px;line-height:20px;">Güvenliğiniz için kodu kimseyle paylaşmayın. Bu isteği siz yapmadıysanız e-postayı yok sayabilirsiniz.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 0 0;">
              <p style="margin:0;color:#CBBFE8;font-size:12px;line-height:18px;">Bu e-posta otomatik olarak gönderildi.</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
