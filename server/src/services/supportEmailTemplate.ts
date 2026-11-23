const SITE = 'https://tavriko-app.vercel.app';
const variants = {
  report: {
    title: 'Yeni hata bildirimi', eyebrow: 'YÖNETİM BİLDİRİMİ', status: 'YENİ KAYIT',
    intro: 'Bir oyuncu Tavriko’da karşılaştığı bir hatayı bildirdi. Ayrıntıları ve konuşmayı yönetim panelinde inceleyebilirsin.',
    preheader: 'Yeni hata bildiriminin ayrıntılarını yönetim panelinde incele.',
    button: 'Destek kuyruğunu aç', path: '/admin/kullanicilar#cases-panel', accent: '#FFD478',
  },
  reply: {
    title: 'Hata bildiriminize yanıt geldi', eyebrow: 'TAVRİKO DESTEK', status: 'YENİ YANIT',
    intro: 'Bize haber verdiğin için teşekkürler. Destek ekibinin yanıtı aşağıda.',
    preheader: 'Tavriko destek ekibi hata bildirimine yanıt verdi.',
    button: 'Tavriko’yu aç', path: '/app', accent: '#DCC5FF',
  },
  resolved: {
    title: 'Hata bildiriminiz sonuçlandı', eyebrow: 'TAVRİKO DESTEK', status: 'SONUÇLANDI',
    intro: 'Bize haber verdiğin için teşekkürler. Hata bildiriminle ilgili sonucu aşağıda bulabilirsin.',
    preheader: 'Tavriko’daki hata bildirimin için sonuç hazır.',
    button: 'Tavriko’yu aç', path: '/app', accent: '#A7F3D0',
  },
} as const;

type SupportEmail = { subject: string } & (
  | { kind: 'report'; username?: string; accountId: string; ticketId: string }
  | { kind: 'reply' | 'resolved'; text: string }
);

const entities: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;',
};
const escapeHtml = (text: string) => text.replace(/[&<>"'{}]/g, value => entities[value]).replace(/\r?\n/g, '<br>');
const field = (label: string, value: string) => `
  <tr><td style="padding:0 0 4px;color:#D9C8F5;font-size:12px;font-weight:700;letter-spacing:.6px;">${label}</td></tr>
  <tr><td dir="auto" style="padding:0 0 14px;color:#FFFFFF;font-size:15px;line-height:23px;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(value)}</td></tr>`;

/** Use table layout and inline styling for email clients; all dynamic text is escaped. */
export function renderSupportEmail(data: SupportEmail) {
  const variant = variants[data.kind];
  const fields = data.kind === 'report'
    ? `${data.username ? field('OYUNCU', `@${data.username}`) : ''}${field('HESAP KİMLİĞİ', data.accountId)}${field('TALEP KİMLİĞİ', data.ticketId)}`
    : field(data.kind === 'reply' ? 'DESTEK YANITI' : 'TALEP SONUCU', data.text);
  return {
    email_subject: `Tavriko | ${variant.title}`,
    email_preheader: variant.preheader,
    email_body: `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${variant.title}</title></head>
<body bgcolor="#140C25" style="margin:0;padding:0;background:#140C25;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#140C25">
<tr><td align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td align="left" style="padding:0 4px 15px;color:#FFD478;font-size:26px;font-weight:800;letter-spacing:.4px;">Tavriko</td></tr>
  <tr><td bgcolor="#272047" style="padding:24px;border:1px solid #594A82;border-top:4px solid ${variant.accent};border-radius:16px;">
    <p style="margin:0 0 10px;color:#DDCDF6;font-size:11px;font-weight:700;letter-spacing:1.5px;">${variant.eyebrow}</p>
    <span style="display:inline-block;padding:6px 10px;border-radius:20px;background:#17102B;color:${variant.accent};font-size:11px;font-weight:700;letter-spacing:.8px;">${variant.status}</span>
    <h1 style="margin:14px 0 10px;color:#FFFFFF;font-size:27px;line-height:34px;">${variant.title}</h1>
    <p style="margin:0 0 20px;color:#E3D8F7;font-size:15px;line-height:23px;">${variant.intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1A1232" style="border:1px solid #554576;border-radius:12px;">
      <tr><td style="padding:16px 16px 2px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${field('BİLDİRİM KONUSU', data.subject)}${fields}
      </table></td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr><td bgcolor="#FFD478" align="center" style="border-radius:10px;mso-padding-alt:13px 18px;">
        <a href="${SITE}${variant.path}" style="display:inline-block;padding:13px 18px;color:#211332;font-size:15px;font-weight:700;text-decoration:none;">${variant.button}</a>
      </td></tr>
    </table>
    ${data.kind === 'report' ? '' : '<p style="margin:16px 0 0;color:#D9C8F5;font-size:13px;line-height:20px;">Bildirim geçmişi: Ayarlar → Hesap → Destek, hata bildirimi ve itirazlar.</p>'}
  </td></tr>
  <tr><td style="padding:16px 4px 0;color:#CAB9E5;font-size:12px;line-height:18px;">Tavriko Destek · Bu e-posta otomatik olarak gönderildi.</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}
