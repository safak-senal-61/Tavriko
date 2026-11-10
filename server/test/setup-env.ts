// Test environment setup: provides deterministic secrets so that token
// signing/verification works in tests WITHOUT any hardcoded fallback in
// production code. Production deployments must set JWT_SECRET explicitly.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_only_jwt_secret';
process.env.INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'test_only_internal_secret';
process.env.TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'test_only_webhook_secret';
