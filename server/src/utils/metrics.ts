import { Request, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';

/**
 * Prometheus metrik katmani (Vercel Serverless ve Docker uyumlu).
 * prom-client kurulu degilse sessizce no-op olarak calisir, asla 500 firlatmaz.
 */

let promClient: any = null;
let register: any = null;
let tavrikoHttpRequestsTotal: any = null;
let tavrikoHttpRequestDurationSeconds: any = null;
let tavrikoSocketioClientsGauge: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  promClient = require('prom-client');
  register = new promClient.Registry();
  promClient.collectDefaultMetrics({ register, prefix: 'tavriko_node_' });

  tavrikoHttpRequestsTotal = new promClient.Counter({
    name: 'tavriko_http_requests_total',
    help: 'Toplam HTTP istek sayisi',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [register],
  });

  tavrikoHttpRequestDurationSeconds = new promClient.Histogram({
    name: 'tavriko_http_request_duration_seconds',
    help: 'HTTP istek sureleri (saniye)',
    labelNames: ['method', 'route'] as const,
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  });

  tavrikoSocketioClientsGauge = new promClient.Gauge({
    name: 'tavriko_socketio_clients_connected',
    help: 'Suan bagli Socket.IO istemci sayisi',
    registers: [register],
  });
} catch {
  // Serverless ortamda prom-client paketi yoksa no-op olarak devam et
}

let ioRef: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer) {
  ioRef = io;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!register || req.path === '/metrics' || req.path === '/health' || req.path === '/api/health') {
    return next();
  }
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    try {
      const route = req.path || 'unknown';
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      tavrikoHttpRequestDurationSeconds?.labels(req.method, route).observe(durationSec);
      tavrikoHttpRequestsTotal?.labels(req.method, route, String(res.statusCode)).inc();
    } catch {
      // ignore metric recording errors
    }
  });
  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  if (!register) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.end('# metrics disabled in serverless runtime\n');
    return;
  }
  try {
    tavrikoSocketioClientsGauge?.set(ioRef ? ioRef.engine.clientsCount : 0);
  } catch {
    // istemci sayilamasa da metrik export'u engellemesin
  }
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

export default { metricsMiddleware, metricsHandler, setSocketServer };
