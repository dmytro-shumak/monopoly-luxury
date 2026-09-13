import { create } from 'zustand';
import { socket } from '../services/socket';

// Types (we should ideally share these with the backend, but we'll mock the core ones here for now)
export interface PlayerState {
  id: string;
  name: string;
  handCount: number;
  bank: string[];
  table: any[];
}

export interface GameState {
  roomId: string;
  status: string;
  activePlayerId: string | null;
  players: Record<string, PlayerState>;
  myHand: string[]; // Cards in current player's hand
}

interface GameStore {
  gameState: GameState | null;
  playerId: string | null;
  isConnected: boolean;
  
  // Actions
  connect: (playerName: string, roomId?: string) => void;
  disconnect: () => void;
  playCard: (cardId: string, actionType: string, targetId?: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  // Socket listeners setup
  socket.on('connect', () => {
    set({ isConnected: true, playerId: socket.id });
  });

  socket.on('disconnect', () => {
    set({ isConnected: false });
  });

  socket.on('gameStateUpdate', (newState: GameState) => {
    set({ gameState: newState });
  });

  return {
    gameState: null,
    playerId: null,
    isConnected: false,

    connect: (playerName: string, roomId?: string) => {
      socket.auth = { playerName, roomId };
      socket.connect();
    },

    disconnect: () => {
      socket.disconnect();
    },

    playCard: (cardId: string, actionType: string, targetId?: string) => {
      socket.emit('playAction', { cardId, actionType, targetId });
    }
  };
});
