import type { PrismaClient } from '@prisma/client';
import { getOneSignalEmailConfig, sendOneSignalSupportEmail } from './oneSignalEmail';
import { logger } from '../utils/logger';

// Keep the existing support case schema, queue and permissions on older clients.
export const BUG_REPORT_PREFIX = '[HATA] ';
export const isBugReport = (ticket: { kind: string; subject: string }) =>
  ticket.kind === 'support' && ticket.subject.startsWith(BUG_REPORT_PREFIX);

type Ticket = { id: string; accountId: string; subject: string };
export type BugPlayerEmail = Ticket & { text: string; event: 'reply' | 'resolved' };
type MailOutcome = 'accepted' | 'failed' | 'not_applicable';
const SITE = 'https://tavriko-app.vercel.app';
const safeEmail = (address: string | null | undefined) => {
  const email = address?.trim();
  return email && email.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? email : null;
};
const entities: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;',
};
const escapeHtml = (text: string) => text.replace(/[&<>"'{}]/g, value => entities[value]).replace(/\r?\n/g, '<br>');
const paragraph = (text: string) => `<p style="line-height:1.55">${escapeHtml(text)}</p>`;

function emailBody(title: string, lines: string[], link: { label: string; path: string }) {
  return `<!doctype html><html lang="tr"><meta charset="utf-8"><body style="font:16px Arial,sans-serif;color:#221539">
    <main style="max-width:560px;margin:auto;padding:24px"><h1>${escapeHtml(title)}</h1>${lines.map(paragraph).join('')}
    <p><a href="${SITE}${link.path}">${escapeHtml(link.label)}</a></p><p>Tavriko Destek</p></main></body></html>`;
}

export async function notifyOwnerOfBug(client: Pick<PrismaClient, 'user'>, ticket: Ticket): Promise<void> {
  try {
    const config = getOneSignalEmailConfig();
    const email = safeEmail(process.env.PORTAL_ADMIN_EMAIL);
    if (!config || !email) {
      logger.warn('SYSTEM', 'Hata bildirimi için yönetici e-postası yapılandırılmamış.');
      return;
    }
    const reporter = await client.user.findUnique({ where: { id: ticket.accountId }, select: { username: true } });
    await sendOneSignalSupportEmail(config, email, {
      email_subject: 'Tavriko | Yeni hata bildirimi',
      email_preheader: 'Ayrıntıları Tavriko yönetim panelinde inceleyin.',
      email_body: emailBody('Yeni hata bildirimi', [
        `Konu: ${ticket.subject.slice(BUG_REPORT_PREFIX.length)}`,
        ...(reporter ? [`Oyuncu: @${reporter.username}`] : []),
        `Hesap kimliği: ${ticket.accountId}`,
        `Talep kimliği: ${ticket.id}`,
      ], { label: 'Destek kuyruğunu aç', path: '/admin/kullanicilar#cases-panel' }),
    });
  } catch {
    logger.warn('SYSTEM', 'Hata bildirimi yöneticiye e-posta ile iletilemedi.');
  }
}

export async function notifyPlayerOfBugUpdate(client: Pick<PrismaClient, 'user'>, notice: BugPlayerEmail | null): Promise<MailOutcome> {
  if (!notice) return 'not_applicable';
  try {
    const config = getOneSignalEmailConfig();
    if (!config) return 'failed';
    const player = await client.user.findUnique({ where: { id: notice.accountId }, select: { email: true } });
    const email = safeEmail(player?.email);
    if (!email) return 'failed';
    const title = notice.event === 'resolved' ? 'Hata bildiriminiz sonuçlandı' : 'Hata bildiriminize yanıt geldi';
    const accepted = await sendOneSignalSupportEmail(config, email, {
      email_subject: `Tavriko | ${title}`,
      email_preheader: 'Tavriko destek ekibinden bir güncelleme var.',
      email_body: emailBody(title, [
        `Konu: ${notice.subject.slice(BUG_REPORT_PREFIX.length)}`,
        notice.text,
      ], { label: 'Tavriko’yu aç', path: '/app' }),
    });
    return accepted ? 'accepted' : 'failed';
  } catch {
    logger.warn('SYSTEM', 'Hata bildirimi güncellemesi oyuncuya e-posta ile iletilemedi.');
    return 'failed';
  }
}
