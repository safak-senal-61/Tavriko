"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletRateLimitOptions = void 0;
const express_rate_limit_1 = require("express-rate-limit");
const node_net_1 = require("node:net");
exports.walletRateLimitOptions = {
    windowMs: 60_000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
        const forwarded = process.env.VERCEL === '1' ? req.get('x-forwarded-for')?.trim() : undefined;
        const ip = forwarded && (0, node_net_1.isIP)(forwarded) ? forwarded : req.ip || req.socket.remoteAddress;
        return ip && (0, node_net_1.isIP)(ip) ? (0, express_rate_limit_1.ipKeyGenerator)(ip) : 'unknown';
    },
};
