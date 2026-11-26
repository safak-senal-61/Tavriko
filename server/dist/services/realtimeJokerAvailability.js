"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.advancedJokersReady = advancedJokersReady;
const inviteDelivery_1 = require("./inviteDelivery");
let cached;
function advancedJokersReady() {
    const now = Date.now();
    if (cached && cached.expires > now)
        return cached.result;
    const result = (async () => {
        const endpoint = new URL('/health', process.env.REALTIME_HTTP_URL || inviteDelivery_1.DEFAULT_REALTIME_URL);
        if (endpoint.protocol !== 'https:')
            return false;
        const response = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(1500) });
        if (!response.ok)
            return false;
        const body = await response.json();
        return body?.features?.advancedQuizJokers === true;
    })().catch(() => false);
    cached = { expires: now + 30_000, result };
    return result;
}
