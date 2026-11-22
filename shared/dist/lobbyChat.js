"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOBBY_REACTIONS = exports.LOBBY_QUICK_MESSAGES = void 0;
exports.isLobbyQuickMessage = isLobbyQuickMessage;
exports.isLobbyReaction = isLobbyReaction;
exports.LOBBY_QUICK_MESSAGES = [
    'Selam 👋', 'Hazırım! ⚡', 'Hadi başla! 🚀', 'Bol şans! 🎯', 'Buradayım 🔥',
];
exports.LOBBY_REACTIONS = ['🔥', '👏', '😂', '❤️', '⚡', '🎯', '🚀'];
function isLobbyQuickMessage(value) {
    return exports.LOBBY_QUICK_MESSAGES.some((message) => message === value);
}
function isLobbyReaction(value) {
    return exports.LOBBY_REACTIONS.some((reaction) => reaction === value);
}
