export const LOBBY_QUICK_MESSAGES = [
  'Selam 👋', 'Hazırım! ⚡', 'Hadi başla! 🚀', 'Bol şans! 🎯', 'Buradayım 🔥',
] as const;

export const LOBBY_REACTIONS = ['🔥', '👏', '😂', '❤️', '⚡', '🎯', '🚀'] as const;

export function isLobbyQuickMessage(value: unknown): value is typeof LOBBY_QUICK_MESSAGES[number] {
  return LOBBY_QUICK_MESSAGES.some((message) => message === value);
}

export function isLobbyReaction(value: unknown): value is typeof LOBBY_REACTIONS[number] {
  return LOBBY_REACTIONS.some((reaction) => reaction === value);
}
