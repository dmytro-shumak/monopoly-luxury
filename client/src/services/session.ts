const KEY_SESSION_ID = 'monopoly_session_id';
const KEY_PLAYER_NAME = 'monopoly_player_name';

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
