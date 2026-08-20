export enum CardType {
  PROPERTY = "PROPERTY",
  MONEY = "MONEY",
  ACTION = "ACTION",
  PROPERTY_WILDCARD = "PROPERTY_WILDCARD"
}

export enum CardColor {
  PINK = "PINK",
  ORANGE = "ORANGE",
  BROWN = "BROWN",
  LIGHT_GREEN = "LIGHT_GREEN",
  PURPLE = "PURPLE",
  DARK_BLUE = "DARK_BLUE",
  LIGHT_BLUE = "LIGHT_BLUE",
  GREEN = "GREEN",
  RED = "RED",
  MAROON = "MAROON",
  DARK_GREEN = "DARK_GREEN",
  DARK_MAROON = "DARK_MAROON",
  ALL_COLOR = "ALL_COLOR"
}

export enum BuildingType {
  HOUSE = "HOUSE",
  HOTEL = "HOTEL"
}

export interface CardDefinition {
  id: string; // e.g., "prop_pink_1", "action_sly_deal"
  type: CardType;
  value?: number; // Optional because only money and property cards have value
  colors?: CardColor[]; // For properties and wildcards
  isBuilding?: BuildingType;
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
  buildings: BuildingType[];
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
