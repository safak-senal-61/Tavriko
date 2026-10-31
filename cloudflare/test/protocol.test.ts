import { encodeWsMessage, decodeWsMessage, createWsError } from '../src/websocket/protocol';
import { sanitizeString, sanitizeRoomCode, isValidPlayerId, RateLimiter } from '../src/websocket/validation';
import { SOCKET_EVENTS } from '@trivia/shared';

describe('WebSocket Protocol & Validation', () => {
  it('correctly encodes a structured WebSocket envelope', () => {
    const raw = encodeWsMessage(SOCKET_EVENTS.SUBMIT_ANSWER, { selectedOptionId: 'opt_1' }, 'req-123');
    const parsed = JSON.parse(raw);

    expect(parsed.event).toBe('game:submit_answer');
    expect(parsed.requestId).toBe('req-123');
    expect(parsed.payload.selectedOptionId).toBe('opt_1');
    expect(typeof parsed.timestamp).toBe('number');
  });

  it('decodes text WebSocket payload correctly', () => {
    const jsonStr = JSON.stringify({
      event: SOCKET_EVENTS.TOGGLE_READY,
      payload: { isReady: true },
      timestamp: 12345678,
    });

    const decoded = decodeWsMessage(jsonStr);
    expect(decoded).not.toBeNull();
    expect(decoded?.event).toBe('room:toggle_ready');
    expect(decoded?.payload).toEqual({ isReady: true });
    expect(decoded?.timestamp).toBe(12345678);
  });

  it('gracefully handles malformed JSON or invalid envelope', () => {
    expect(decodeWsMessage('not-json')).toBeNull();
    expect(decodeWsMessage(JSON.stringify({ notAnEvent: 123 }))).toBeNull();
  });

  it('creates standardized error message envelopes', () => {
    const raw = createWsError('Soru aktif değil', 'ROUND_INACTIVE', 'req-456');
    const parsed = JSON.parse(raw);
    expect(parsed.event).toBe('system:error');
    expect(parsed.payload.message).toBe('Soru aktif değil');
    expect(parsed.payload.code).toBe('ROUND_INACTIVE');
    expect(parsed.requestId).toBe('req-456');
  });

  it('sanitizes strings and room codes safely', () => {
    expect(sanitizeString('<script>alert("xss")</script>Hello')).toBe('scriptalert("xss")/scriptHello');
    expect(sanitizeRoomCode(' room-123!@# ')).toBe('ROOM-123');
    expect(isValidPlayerId('usr_12345')).toBe(true);
    expect(isValidPlayerId('')).toBe(false);
  });

  it('enforces rate limits per connection', () => {
    const limiter = new RateLimiter(3, 1000);
    expect(limiter.check()).toBe(true);
    expect(limiter.check()).toBe(true);
    expect(limiter.check()).toBe(true);
    expect(limiter.check()).toBe(false); // 4th call within window exceeded
  });
});
