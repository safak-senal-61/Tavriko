export declare const LOBBY_QUICK_MESSAGES: readonly ["Selam 👋", "Hazırım! ⚡", "Hadi başla! 🚀", "Bol şans! 🎯", "Buradayım 🔥"];
export declare const LOBBY_REACTIONS: readonly ["🔥", "👏", "😂", "❤️", "⚡", "🎯", "🚀"];
export declare function isLobbyQuickMessage(value: unknown): value is typeof LOBBY_QUICK_MESSAGES[number];
export declare function isLobbyReaction(value: unknown): value is typeof LOBBY_REACTIONS[number];
