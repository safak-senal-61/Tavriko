"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralService = exports.ReferralError = exports.validReferralToken = exports.REFERRAL_REWARD = void 0;
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
exports.REFERRAL_REWARD = 100;
const validReferralToken = (value) => typeof value === 'string' && /^[a-f0-9]{48}$/.test(value);
exports.validReferralToken = validReferralToken;
class ReferralError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.ReferralError = ReferralError;
// Public previews deliberately exclude email, phone, balances and friend lists.
const previewSelect = {
    id: true, displayName: true, username: true, avatarUrl: true, level: true,
    rankTitle: true, xp: true,
};
class ReferralService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async personalLink(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!user)
            throw new ReferralError(401, 'Önce hesabına giriş yap.');
        const link = await this.prisma.referralLink.upsert({
            where: { inviterId: userId }, update: {},
            create: { inviterId: userId, token: (0, crypto_1.randomBytes)(24).toString('hex') },
        });
        const result = await this.prisma.referralRedemption.aggregate({
            where: { inviterId: userId }, _count: true, _sum: { rewardCoins: true },
        });
        return {
            token: link.token,
            url: `https://tavriko-app.vercel.app/app?invite=${link.token}`,
            rewardCoins: exports.REFERRAL_REWARD,
            joinedCount: result._count, earnedCoins: result._sum.rewardCoins || 0,
        };
    }
    async preview(token) {
        if (!(0, exports.validReferralToken)(token))
            throw new ReferralError(400, 'Davet bağlantısı geçersiz.');
        const link = await this.prisma.referralLink.findUnique({ where: { token } });
        const inviter = link && await this.prisma.user.findUnique({
            where: { id: link.inviterId }, select: previewSelect,
        });
        if (!inviter)
            throw new ReferralError(404, 'Bu davet artık kullanılamıyor.');
        return { inviter, rewardCoins: exports.REFERRAL_REWARD };
    }
    async confirm(inviteeId, token) {
        if (!(0, exports.validReferralToken)(token))
            throw new ReferralError(400, 'Davet bağlantısı geçersiz.');
        // Retry serialization/deadlock races. Never fall back to memory on DB failure.
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await this.prisma.$transaction(async (tx) => {
                    const link = await tx.referralLink.findUnique({ where: { token } });
                    if (!link)
                        throw new ReferralError(404, 'Bu davet artık kullanılamıyor.');
                    if (link.inviterId === inviteeId)
                        throw new ReferralError(400, 'Kendi davetini kullanamazsın.');
                    // Stable lock order protects read/merge/write of the existing JSON friend lists.
                    const ids = [inviteeId, link.inviterId].sort();
                    await tx.$queryRaw `SELECT id FROM public.users WHERE id IN (${ids[0]}, ${ids[1]}) ORDER BY id FOR UPDATE`;
                    const [invitee, inviter] = await Promise.all([
                        tx.user.findUnique({ where: { id: inviteeId } }),
                        tx.user.findUnique({ where: { id: link.inviterId } }),
                    ]);
                    if (!invitee || !inviter)
                        throw new ReferralError(404, 'Oyuncu hesabı bulunamadı.');
                    const friendIds = (value) => Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
                    const mine = friendIds(invitee.friendIds), theirs = friendIds(inviter.friendIds);
                    const alreadyFriends = mine.includes(inviter.id) || theirs.includes(invitee.id);
                    const previous = await tx.referralRedemption.findUnique({ where: { inviteeId } });
                    const rewardCoins = !previous && !alreadyFriends && invitee.createdAt >= link.createdAt
                        ? exports.REFERRAL_REWARD : 0;
                    if (!previous)
                        await tx.referralRedemption.create({
                            data: { inviteeId, inviterId: inviter.id, token, rewardCoins },
                        });
                    await tx.user.update({ where: { id: inviteeId }, data: {
                            friendIds: [...new Set([...mine, inviter.id])],
                        } });
                    await tx.user.update({ where: { id: inviter.id }, data: {
                            friendIds: [...new Set([...theirs, inviteeId])],
                            ...(rewardCoins ? { coins: { increment: rewardCoins } } : {}),
                        } });
                    // Resolve pre-existing pending requests, rather than leaving stale accept buttons.
                    await tx.userNotification.updateMany({
                        where: { type: 'friend_request', handled: null, OR: [
                                { userId: inviteeId, senderId: inviter.id },
                                { userId: inviter.id, senderId: inviteeId },
                            ] }, data: { handled: 'accepted', sub: 'Davet bağlantısıyla artık arkadaşsınız.' },
                    });
                    let notification = null;
                    if (!alreadyFriends) {
                        notification = await tx.userNotification.create({ data: {
                                id: `referral_${(0, crypto_1.randomBytes)(16).toString('hex')}`, userId: inviter.id,
                                type: 'system', title: `${invitee.displayName} arkadaşlarına katıldı`,
                                sub: rewardCoins ? `Davet ödülün: +${rewardCoins} altın. Birlikte oynamaya hazırsınız!`
                                    : 'Davet bağlantın onaylandı. Artık birlikte oynayabilirsiniz.',
                                timeText: 'Az önce', handled: 'accepted',
                            } });
                    }
                    return {
                        success: true, inviterId: inviter.id, friend: {
                            id: inviter.id, displayName: inviter.displayName, avatarUrl: inviter.avatarUrl,
                        }, rewardCoins, alreadyFriends, notification,
                        message: alreadyFriends ? 'Zaten arkadaşsınız.' : 'Davet gönderildi. Artık arkadaşsınız!',
                    };
                }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
            }
            catch (error) {
                // Prisma wraps serialization failures from raw locking queries as P2010.
                const conflict = error?.code === 'P2034'
                    || (error?.code === 'P2010' && ['40001', '40P01'].includes(error?.meta?.code));
                if (conflict && attempt < 2)
                    continue;
                throw error;
            }
        }
        throw new ReferralError(503, 'Davet şu anda tamamlanamadı. Tekrar dene.');
    }
}
exports.ReferralService = ReferralService;
