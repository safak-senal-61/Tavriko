import { Response } from 'express';

export interface LogEntry {
  id: string;
  timestamp: string;
  iso: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DEBUG';
  category: 'HTTP' | 'AUTH' | 'GOOGLE' | 'DB' | 'PRISMA' | 'SOCKET' | 'CLIENT' | 'SYSTEM';
  message: string;
  details?: any;
}

class LoggerService {
  private logs: LogEntry[] = [];
  private readonly maxLogs: number = 400;
  private sseClients: Response[] = [];

  constructor() {
    this.log('SYSTEM', 'INFO', 'Tavriko Logger Service başlatıldı');
  }

  public log(
    category: LogEntry['category'],
    level: LogEntry['level'],
    message: string,
    details?: any
  ): LogEntry {
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

    const entry: LogEntry = {
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
    } else if (level === 'WARN') {
      console.warn(prefix, message, cleanDetails || '');
    } else {
      console.log(prefix, message, cleanDetails ? (typeof cleanDetails === 'object' ? JSON.stringify(cleanDetails) : cleanDetails) : '');
    }

    // Broadcast to SSE clients
    this.broadcast(entry);

    return entry;
  }

  public info(category: LogEntry['category'], message: string, details?: any) {
    return this.log(category, 'INFO', message, details);
  }

  public success(category: LogEntry['category'], message: string, details?: any) {
    return this.log(category, 'SUCCESS', message, details);
  }

  public warn(category: LogEntry['category'], message: string, details?: any) {
    return this.log(category, 'WARN', message, details);
  }

  public error(category: LogEntry['category'], message: string, details?: any) {
    return this.log(category, 'ERROR', message, details);
  }

  public getRecentLogs(limit: number = 200): LogEntry[] {
    return this.logs.slice(0, limit);
  }

  public clear() {
    this.logs = [];
    this.log('SYSTEM', 'INFO', 'Log geçmişi temizlendi');
  }

  public addSseClient(res: Response) {
    this.sseClients.push(res);
    res.on('close', () => {
      this.sseClients = this.sseClients.filter((c) => c !== res);
    });
  }

  private broadcast(entry: LogEntry) {
    if (this.sseClients.length === 0) return;
    const data = `data: ${JSON.stringify(entry)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(data);
      } catch {
        // Handled on close
      }
    }
  }
}

export const logger = new LoggerService();
