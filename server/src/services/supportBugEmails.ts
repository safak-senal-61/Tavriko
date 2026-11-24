import type { PrismaClient } from '@prisma/client';
import { getOneSignalEmailConfig, sendOneSignalSupportEmail } from './oneSignalEmail';
import { logger } from '../utils/logger';
import { renderSupportEmail } from './supportEmailTemplate';

// Keep the existing support case schema, queue and permissions on older clients.
export const BUG_REPORT_PREFIX = '[HATA] ';
export const isBugReport = (ticket: { kind: string; subject: string }) =>
  ticket.kind === 'support' && ticket.subject.startsWith(BUG_REPORT_PREFIX);

type Ticket = { id: string; accountId: string; subject: string; attachmentCount?: number };
export type BugPlayerEmail = Ticket & { text: string; event: 'reply' | 'resolved' };
type MailOutcome = 'accepted' | 'failed' | 'not_applicable';
const safeEmail = (address: string | null | undefined) => {
  const email = address?.trim();
  return email && email.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? email : null;
};
export async function notifyOwnerOfBug(client: Pick<PrismaClient, 'user'>, ticket: Ticket): Promise<void> {
  try {
    const config = getOneSignalEmailConfig();
    const email = safeEmail(process.env.PORTAL_ADMIN_EMAIL);
    if (!config || !email) {
      logger.warn('SYSTEM', 'Hata bildirimi için yönetici e-postası yapılandırılmamış.');
      return;
    }
    const reporter = await client.user.findUnique({ where: { id: ticket.accountId }, select: { username: true } });
    await sendOneSignalSupportEmail(config, email, renderSupportEmail({
      kind: 'report', subject: ticket.subject.slice(BUG_REPORT_PREFIX.length),
      username: reporter?.username, accountId: ticket.accountId, ticketId: ticket.id,
      attachmentCount: ticket.attachmentCount,
    }));
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
    const accepted = await sendOneSignalSupportEmail(config, email, renderSupportEmail({
      kind: notice.event, subject: notice.subject.slice(BUG_REPORT_PREFIX.length), text: notice.text,
    }));
    return accepted ? 'accepted' : 'failed';
  } catch {
    logger.warn('SYSTEM', 'Hata bildirimi güncellemesi oyuncuya e-posta ile iletilemedi.');
    return 'failed';
  }
}
