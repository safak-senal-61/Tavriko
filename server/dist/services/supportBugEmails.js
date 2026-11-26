"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBugReport = exports.BUG_REPORT_PREFIX = void 0;
exports.notifyOwnerOfBug = notifyOwnerOfBug;
exports.notifyPlayerOfBugUpdate = notifyPlayerOfBugUpdate;
const oneSignalEmail_1 = require("./oneSignalEmail");
const logger_1 = require("../utils/logger");
const supportEmailTemplate_1 = require("./supportEmailTemplate");
// Keep the existing support case schema, queue and permissions on older clients.
exports.BUG_REPORT_PREFIX = '[HATA] ';
const isBugReport = (ticket) => ticket.kind === 'support' && ticket.subject.startsWith(exports.BUG_REPORT_PREFIX);
exports.isBugReport = isBugReport;
const safeEmail = (address) => {
    const email = address?.trim();
    return email && email.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? email : null;
};
async function notifyOwnerOfBug(client, ticket) {
    try {
        const config = (0, oneSignalEmail_1.getOneSignalEmailConfig)();
        const email = safeEmail(process.env.PORTAL_ADMIN_EMAIL);
        if (!config || !email) {
            logger_1.logger.warn('SYSTEM', 'Hata bildirimi için yönetici e-postası yapılandırılmamış.');
            return;
        }
        const reporter = await client.user.findUnique({ where: { id: ticket.accountId }, select: { username: true } });
        await (0, oneSignalEmail_1.sendOneSignalSupportEmail)(config, email, (0, supportEmailTemplate_1.renderSupportEmail)({
            kind: 'report', subject: ticket.subject.slice(exports.BUG_REPORT_PREFIX.length),
            username: reporter?.username, accountId: ticket.accountId, ticketId: ticket.id,
            attachmentCount: ticket.attachmentCount,
        }));
    }
    catch {
        logger_1.logger.warn('SYSTEM', 'Hata bildirimi yöneticiye e-posta ile iletilemedi.');
    }
}
async function notifyPlayerOfBugUpdate(client, notice) {
    if (!notice)
        return 'not_applicable';
    try {
        const config = (0, oneSignalEmail_1.getOneSignalEmailConfig)();
        if (!config)
            return 'failed';
        const player = await client.user.findUnique({ where: { id: notice.accountId }, select: { email: true } });
        const email = safeEmail(player?.email);
        if (!email)
            return 'failed';
        const accepted = await (0, oneSignalEmail_1.sendOneSignalSupportEmail)(config, email, (0, supportEmailTemplate_1.renderSupportEmail)({
            kind: notice.event, subject: notice.subject.slice(exports.BUG_REPORT_PREFIX.length), text: notice.text,
        }));
        return accepted ? 'accepted' : 'failed';
    }
    catch {
        logger_1.logger.warn('SYSTEM', 'Hata bildirimi güncellemesi oyuncuya e-posta ile iletilemedi.');
        return 'failed';
    }
}
