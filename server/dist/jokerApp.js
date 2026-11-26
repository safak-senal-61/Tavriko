"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJokerApp = createJokerApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const webCors_1 = require("./middleware/webCors");
const jokerRoutes_1 = __importDefault(require("./routes/jokerRoutes"));
// No question bank, Redis round trip, admin routes or main server initialization
// on the latency-sensitive path. The router retains auth and rate limiting.
function createJokerApp() {
    const app = (0, express_1.default)();
    const allowWebCors = (0, webCors_1.makeWebCorsPolicy)();
    app.disable('x-powered-by');
    app.use((0, cors_1.default)((req, done) => done(null, { origin: allowWebCors(req.get('Origin'), req.path) })));
    app.use((_req, res, next) => {
        res.set({
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'X-Tavriko-Joker-Path': 'fast',
        });
        next();
    });
    app.use('/api', express_1.default.json({ limit: '96kb' }), jokerRoutes_1.default);
    const bodyError = (error, _req, res, next) => {
        if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
            res.status(error.status).json({ error: 'Geçersiz joker isteği.' });
            return;
        }
        next(error);
    };
    app.use(bodyError);
    return app;
}
