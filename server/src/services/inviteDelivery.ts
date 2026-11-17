import type { NotificationItem } from '@trivia/shared';
import { logger } from '../utils/logger';
import { notificationToPushPayload, sendPushToUser } from './pushService';

const DEFAULT_REALTIME_URL = 'https://tavriko-realtime.uncertainidentity8.workers.dev';

async function relayInvite(userId: string, item: NotificationItem): Promise<void> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    logger.warn('SYSTEM', 'Cloudflare davet aktarımı yapılandırılmamış (INTERNAL_API_SECRET).');
    return;
  }
  const base = process.env.REALTIME_HTTP_URL || DEFAULT_REALTIME_URL;
  const result = await fetch(`${base.replace(/\/+$/, '')}/api/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
    body: JSON.stringify({ targetUserId: userId, event: 'notification:new', data: item }),
    signal: AbortSignal.timeout(3000),
  });
  if (!result.ok) throw new Error(`Cloudflare HTTP ${result.status}`);
}

/** Invoke both transports before responding: Vercel can freeze unawaited tasks. */
export async function deliverGameInvite(userId: string, item: NotificationItem): Promise<void> {
  const results = await Promise.allSettled([
    relayInvite(userId, item),
    sendPushToUser(userId, notificationToPushPayload(item)),
  ]);
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.warn('SYSTEM', `Davet ${item.id}: ${index === 0 ? 'Cloudflare' : 'push'} aktarımı başarısız.`);
    }
  });
}
