"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class LoggerService {
    logs = [];
    maxLogs = 400;
    sseClients = [];
    constructor() {
        this.log('SYSTEM', 'INFO', 'Tavriko Logger Service başlatıldı');
    }
    log(category, level, message, details) {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
        // Clean details to ensure JSON serializable
        let cleanDetails = details;
        if (details instanceof Error) {
            cleanDetails = {
                name: details.name,
                message: details.message,
                stack: details.stack,
            };
        }
        const entry = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            timestamp: timeStr,
            iso: now.toISOString(),
            level,
            category,
            message,
            details: cleanDetails,
        };
        this.logs.unshift(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        // Console output with colors
        const prefix = `[${entry.timestamp}] [${level}] [${category}]`;
        if (level === 'ERROR') {
            console.error(prefix, message, cleanDetails || '');
        }
        else if (level === 'WARN') {
            console.warn(prefix, message, cleanDetails || '');
        }
        else {
            console.log(prefix, message, cleanDetails ? (typeof cleanDetails === 'object' ? JSON.stringify(cleanDetails) : cleanDetails) : '');
        }
        // Broadcast to SSE clients
        this.broadcast(entry);
        return entry;
    }
    info(category, message, details) {
        return this.log(category, 'INFO', message, details);
    }
    success(category, message, details) {
        return this.log(category, 'SUCCESS', message, details);
    }
    warn(category, message, details) {
        return this.log(category, 'WARN', message, details);
    }
    error(category, message, details) {
        return this.log(category, 'ERROR', message, details);
    }
    getRecentLogs(limit = 200) {
        return this.logs.slice(0, limit);
    }
    clear() {
        this.logs = [];
        this.log('SYSTEM', 'INFO', 'Log geçmişi temizlendi');
    }
    addSseClient(res) {
        this.sseClients.push(res);
        res.on('close', () => {
            this.sseClients = this.sseClients.filter((c) => c !== res);
        });
    }
    broadcast(entry) {
        if (this.sseClients.length === 0)
            return;
        const data = `data: ${JSON.stringify(entry)}\n\n`;
        for (const client of this.sseClients) {
            try {
                client.write(data);
            }
            catch {
                // Handled on close
            }
        }
    }
}
exports.logger = new LoggerService();
