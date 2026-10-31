import { SOCKET_EVENTS, SocketEventName } from '@trivia/shared';

export interface WsMessage<T = any> {
  event: string;
  requestId?: string;
  payload: T;
  timestamp: number;
}

export function encodeWsMessage<T = any>(
  event: SocketEventName | string,
  payload: T,
  requestId?: string
): string {
  const envelope: WsMessage<T> = {
    event,
    payload,
    timestamp: Date.now(),
    ...(requestId ? { requestId } : {}),
  };
  return JSON.stringify(envelope);
}

export function decodeWsMessage(raw: string | ArrayBuffer): WsMessage | null {
  try {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.event !== 'string') {
      return null;
    }
    return {
      event: parsed.event,
      requestId: typeof parsed.requestId === 'string' ? parsed.requestId : undefined,
      payload: parsed.payload !== undefined ? parsed.payload : {},
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
    };
  } catch {
    return null;
  }
}

export function createWsError(
  message: string,
  code: string = 'BAD_REQUEST',
  requestId?: string
): string {
  return encodeWsMessage(
    SOCKET_EVENTS.ERROR,
    { message, code },
    requestId
  );
}
