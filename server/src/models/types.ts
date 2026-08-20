export type CardType = "PROPERTY" | "MONEY" | "ACTION" | "PROPERTY_WILDCARD";

export type CardColor = 
  | "PINK" | "ORANGE" | "BROWN" | "LIGHT_GREEN" | "PURPLE" 
  | "DARK_BLUE" | "LIGHT_BLUE" | "GREEN" | "RED" | "MAROON" 
  | "DARK_GREEN" | "DARK_MAROON" | "ALL_COLOR";

export interface CardDefinition {
  id: string; // e.g., "prop_pink_1", "action_sly_deal"
  type: CardType;
  value: number; // Value when placed in the bank (or printed value for debt payment)
  colors?: CardColor[]; // For properties and wildcards
  isBuilding?: "HOUSE" | "HOTEL";
  rentValues?: number[]; // [1 property rent, 2 properties rent, ...]
}

export type GamePhase = 
  | "LOBBY"
  | "TURN_START"
  | "ACTION_PHASE"
  | "REACTION_PHASE"
  | "DEBT_PAYMENT_PHASE"
  | "DISCARD_PHASE"
  | "GAME_OVER";

export interface PropertySet {
  color: CardColor;
  cards: string[]; // Array of card IDs
  buildings: ("HOUSE" | "HOTEL")[];
  isComplete: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  isConnected: boolean;
  hand: string[]; // Hand is private, but included in state. We'll filter this when sending to others.
  bank: string[]; // Array of card IDs in the personal bank
  table: PropertySet[]; // Active properties on the table
  actionsRemaining: number;
}

export interface TimerState {
  expiresAt: number; // Unix timestamp
  type: "REACTION" | "DEBT";
  targetPlayerId?: string; 
  durationMs: number;
}

export interface GameState {
  roomId: string;
  status: GamePhase;
  activePlayerId: string | null;
  players: Record<string, PlayerState>;
  playerOrder: string[];
  deckCount: number; // Hide the actual deck, just send count
  discardPile: string[]; // Top cards in discard pile
  activeTimer: TimerState | null;
}
