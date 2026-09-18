const KEY_SESSION_ID = 'monopoly_session_id';
const KEY_PLAYER_NAME = 'monopoly_player_name';
const KEY_LAST_ROOM_ID = 'monopoly_last_room_id';

export function getSessionId(): string {
  try {
    let sessionId = localStorage.getItem(KEY_SESSION_ID);
    if (!sessionId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        sessionId = crypto.randomUUID();
      } else {
        sessionId = `sess_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      }
      localStorage.setItem(KEY_SESSION_ID, sessionId);
    }
    return sessionId;
  } catch {
    return `sess_${Math.random().toString(36).substring(2, 10)}`;
  }
}

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem(KEY_PLAYER_NAME) || '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(KEY_PLAYER_NAME, name.trim());
  } catch {
    // LocalStorage not available, ignore
  }
}

export function getLastRoomId(): string {
  try {
    return localStorage.getItem(KEY_LAST_ROOM_ID) || '';
  } catch {
    return '';
  }
}

export function saveLastRoomId(roomId: string): void {
  try {
    if (roomId) {
      localStorage.setItem(KEY_LAST_ROOM_ID, roomId.trim());
    }
  } catch {
    // LocalStorage not available, ignore
  }
}

export function clearLastRoomId(): void {
  try {
    localStorage.removeItem(KEY_LAST_ROOM_ID);
  } catch {
    // LocalStorage not available, ignore
  }
}

