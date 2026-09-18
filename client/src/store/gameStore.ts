import { create } from 'zustand';
import { socket } from '../services/socket';
import { getSessionId, savePlayerName, saveLastRoomId, clearLastRoomId } from '../services/session';

export type GamePhase = 
  | 'LOBBY'
  | 'TURN_START'
  | 'ACTION_PHASE'
  | 'REACTION_PHASE'
  | 'DEBT_PAYMENT_PHASE'
  | 'DISCARD_PHASE'
  | 'GAME_OVER';

export interface PropertySet {
  color: string;
  cards: string[];
  isComplete: boolean;
}

export interface PlayerState {
  id: string;
  sessionId: string;
  name: string;
  isConnected: boolean;
  hand: string[];
  bank: string[];
  table: PropertySet[];
  actionsRemaining: number;
}

export interface TimerState {
  expiresAt: number;
  type: 'REACTION' | 'DEBT';
  targetPlayerId?: string;
  durationMs: number;
}

export interface PendingAction {
  initiatorId: string;
  targetId: string;
  cardId: string;
  actionType: 'SLY_DEAL' | 'FORCED_DEAL' | 'DEAL_BREAKER';
  payload?: any;
  cancelChain: string[];
}

export interface DebtState {
  creditorId: string;
  debtorId: string;
  amount: number;
  paidAmount: number;
}

export interface GameState {
  roomId: string;
  status: GamePhase;
  hostId: string | null;
  activePlayerId: string | null;
  players: Record<string, PlayerState>;
  playerOrder: string[];
  deckCount: number;
  discardPile: string[];
  activeTimer: TimerState | null;
  actionQueue: PendingAction[];
  currentAction: PendingAction | null;
  debtQueue: DebtState[];
  currentDebt: DebtState | null;
  winnerId: string | null;
}

interface GameStore {
  // Connection & Room state
  isConnected: boolean;
  roomId: string | null;
  myPlayerId: string | null;
  roomState: GameState | null;
  errorMessage: string | null;
  isConnecting: boolean;

  // Actions
  createRoom: (playerName: string) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  startGame: () => void;
  leaveRoom: () => void;
  clearError: () => void;
  // In-Game Socket Actions
  playCard: (cardId: string, options?: { targetId?: string; propertyColor?: string; payload?: any; modifierCardId?: string }) => void;
  endTurn: () => void;
  discardCards: (cardIds: string[]) => void;
  reactJustSayNo: (cardId: string) => void;
  passReaction: () => void;
  payDebt: (assetIds: string[]) => void;
  moveProperty: (cardId: string, toColor: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  // Set up socket listeners once
  socket.on('connect', () => {
    set({ isConnected: true });
  });

  socket.on('disconnect', () => {
    set({ isConnected: false });
  });

  socket.on('room_joined', (data: { roomId: string; playerId: string }) => {
    saveLastRoomId(data.roomId);
    set({
      roomId: data.roomId,
      myPlayerId: data.playerId,
      isConnecting: false,
      errorMessage: null,
    });
  });

  socket.on('room_state', (state: GameState) => {
    if (state.roomId) {
      saveLastRoomId(state.roomId);
    }
    set({
      roomState: state,
      roomId: state.roomId,
      isConnecting: false,
    });
  });

  socket.on('error', (err: { message?: string } | string) => {
    const msg = typeof err === 'string' ? err : err.message || 'Unknown server error';
    set({ errorMessage: msg, isConnecting: false });
  });

  return {
    isConnected: socket.connected,
    roomId: null,
    myPlayerId: null,
    roomState: null,
    errorMessage: null,
    isConnecting: false,

    createRoom: (playerName: string) => {
      const trimmed = playerName.trim();
      if (!trimmed) {
        set({ errorMessage: 'Please enter your name' });
        return;
      }
      savePlayerName(trimmed);
      const sessionId = getSessionId();

      set({ isConnecting: true, errorMessage: null });

      const emitCreate = () => {
        socket.emit('create_room', { sessionId, name: trimmed });
      };

      if (!socket.connected) {
        socket.connect();
        socket.once('connect', emitCreate);
      } else {
        emitCreate();
      }
    },

    joinRoom: (targetRoomId: string, playerName: string) => {
      const trimmedName = playerName.trim();
      let normalizedRoomId = targetRoomId.trim();
      if (!normalizedRoomId) {
        set({ errorMessage: 'Please enter room code' });
        return;
      }
      // If player entered short code like "a1b2", prefix with "room_"
      if (!normalizedRoomId.startsWith('room_')) {
        normalizedRoomId = `room_${normalizedRoomId}`;
      }
      if (!trimmedName) {
        set({ errorMessage: 'Please enter your name' });
        return;
      }

      savePlayerName(trimmedName);
      const sessionId = getSessionId();

      set({ isConnecting: true, errorMessage: null });

      const emitJoin = () => {
        socket.emit('join_room', { roomId: normalizedRoomId, sessionId, name: trimmedName });
      };

      if (!socket.connected) {
        socket.connect();
        socket.once('connect', emitJoin);
      } else {
        emitJoin();
      }
    },

    startGame: () => {
      const { roomState, myPlayerId } = get();
      if (!roomState || !myPlayerId) return;
      if (roomState.hostId !== myPlayerId) {
        set({ errorMessage: 'Only the host can start the game' });
        return;
      }
      if (roomState.playerOrder.length < 2) {
        set({ errorMessage: 'At least 2 players are required to start' });
        return;
      }

      socket.emit('start_game');
    },

    leaveRoom: () => {
      clearLastRoomId();
      socket.disconnect();
      set({
        roomId: null,
        myPlayerId: null,
        roomState: null,
        errorMessage: null,
        isConnecting: false,
      });
    },

    clearError: () => {
      set({ errorMessage: null });
    },

    playCard: (cardId: string, options?: { targetId?: string; propertyColor?: string; payload?: any; modifierCardId?: string }) => {
      socket.emit('play_card', { cardId, ...options });
    },

    endTurn: () => {
      socket.emit('end_turn');
    },

    discardCards: (cardIds: string[]) => {
      socket.emit('discard', { cardIds });
    },

    reactJustSayNo: (cardId: string) => {
      socket.emit('react_jsn', { cardId });
    },

    passReaction: () => {
      socket.emit('pass_reaction');
    },

    payDebt: (assetIds: string[]) => {
      socket.emit('pay_debt', { assetIds });
    },

    moveProperty: (cardId: string, toColor: string) => {
      socket.emit('move_property', { cardId, toColor });
    },
  };
});
