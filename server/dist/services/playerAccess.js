"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGuestIdentity = exports.validPlayerId = void 0;
exports.checkPlayerAccess = checkPlayerAccess;
exports.socketIdentity = socketIdentity;
const prismaClient_1 = require("../db/prismaClient");
const adminAccountOperations_1 = require("./adminAccountOperations");
exports.validPlayerId = /^[a-z0-9_-]{1,128}$/i;
const isGuestIdentity = (id) => /^guest_[a-z0-9_-]{1,110}$/i.test(id) || /^guest:[a-z0-9_-]{1,110}$/i.test(id);
exports.isGuestIdentity = isGuestIdentity;
async function checkPlayerAccess(id) {
    if (!(0, adminAccountOperations_1.restrictionsEnabled)() || (0, exports.isGuestIdentity)(id))
        return 'allowed';
    if (!exports.validPlayerId.test(id))
        return 'unavailable';
    try {
        const account = await prismaClient_1.db.rawClient.user.findUnique({ where: { id }, select: { restrictedUntil: true } });
        if (!account)
            return 'unavailable';
        return account.restrictedUntil && account.restrictedUntil > new Date() ? 'restricted' : 'allowed';
    }
    catch {
        return 'unavailable';
    }
}
function socketIdentity(token, requested) {
    if (typeof token === 'string') {
        const payload = prismaClient_1.db.verifyToken(token);
        if (typeof payload?.userId === 'string' && exports.validPlayerId.test(payload.userId))
            return payload.userId;
    }
    return typeof requested === 'string' && (0, exports.isGuestIdentity)(requested) ? requested : null;
}
