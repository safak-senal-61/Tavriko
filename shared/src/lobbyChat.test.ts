import { describe, expect, it } from 'vitest';
import { isLobbyQuickMessage, isLobbyReaction, LOBBY_QUICK_MESSAGES, LOBBY_REACTIONS } from './lobbyChat';

describe('lobby preset allowlists', () => {
  it('accepts exactly the published choices and rejects arbitrary or malformed payloads', () => {
    for (const choice of LOBBY_QUICK_MESSAGES) expect(isLobbyQuickMessage(choice)).toBe(true);
    for (const choice of LOBBY_REACTIONS) expect(isLobbyReaction(choice)).toBe(true);
    for (const value of [null, {}, ['🔥'], 0, 'Serbest metin', '🔥 ', 'Selam 👋!']) {
      expect(isLobbyQuickMessage(value)).toBe(false);
      expect(isLobbyReaction(value)).toBe(false);
    }
  });
});
