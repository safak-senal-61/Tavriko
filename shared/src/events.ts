export const SOCKET_EVENTS = {
  // Connection & Room Management
  CREATE_ROOM: 'room:create',
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',
  TOGGLE_READY: 'room:toggle_ready',
  START_GAME: 'room:start_game',
  KICK_PLAYER: 'room:kick_player',
  UPDATE_ROOM_SETTINGS: 'room:update_settings',

  // Matchmaking
  FIND_MATCH: 'matchmaking:find',
  CANCEL_MATCH: 'matchmaking:cancel',
  MATCH_FOUND: 'matchmaking:found',

  // Gameplay Flow (Server -> Client)
  ROOM_STATE_SYNC: 'room:state_sync',
  COUNTDOWN_TICK: 'game:countdown_tick',
  QUESTION_START: 'game:question_start',
  TIMER_TICK: 'game:timer_tick',
  PLAYER_ANSWERED: 'game:player_answered',
  ROUND_RESULT: 'game:round_result',
  GAME_OVER: 'game:game_over',
  PLAYER_DISCONNECTED: 'game:player_disconnected',
  PLAYER_RECONNECTED: 'game:player_reconnected',

  // Gameplay Flow (Client -> Server)
  SUBMIT_ANSWER: 'game:submit_answer',

  // Social & Chat
  SEND_EMOTE: 'game:send_emote',
  EMOTE_RECEIVED: 'game:emote_received',

  // System
  ERROR: 'system:error',
} as const;

export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
