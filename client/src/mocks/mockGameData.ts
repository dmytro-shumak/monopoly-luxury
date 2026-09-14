import type { CardModel } from '../types/cards';
import { CardColor } from '../types/cards';
import { ALL_CARDS } from '../data/allCards';

export { ALL_CARDS };

export const CARDS_MAP: Record<string, CardModel> = Object.fromEntries(
  ALL_CARDS.map((card) => [card.id, card])
);

export const getCard = (id: string): CardModel => {
  const card = CARDS_MAP[id];
  if (!card) {
    throw new Error(`Card not found with id: ${id}`);
  }
  return card;
};

export interface MockPropertySet {
  color: CardColor;
  cards: CardModel[];
  isComplete: boolean;
  hasHouse?: boolean;
  hasHotel?: boolean;
}

export interface MockPlayer {
  id: string;
  name: string;
  avatar: string;
  isCurrentPlayer?: boolean;
  handCount: number;
  handCards?: CardModel[];
  bankCards: CardModel[];
  propertySets: MockPropertySet[];
}

export interface MockTableState {
  roomId: string;
  deckCount: number;
  discardPile: CardModel[];
  activeActionCard: CardModel | null;
  activeActionMessage: string | null;
  currentPlayer: MockPlayer;
  opponents: MockPlayer[];
  turn: {
    activePlayerId: string;
    actionsRemaining: number;
    maxActions: number;
  };
}

export const createInitialMockState = (): MockTableState => {
  // Current player: "Alex (You)"
  const currentPlayer: MockPlayer = {
    id: 'player_you',
    name: 'Alex',
    avatar: '👑',
    isCurrentPlayer: true,
    handCount: 5,
    handCards: [
      getCard('money_3_1'),
      getCard('action_pass_go_1'),
      getCard('prop_dark_blue_1'),
      getCard('action_sly_deal_1'),
      getCard('prop_pink_1'),
    ],
    bankCards: [
      getCard('money_5_1'),
      getCard('money_2_1'),
      getCard('money_1_1'),
    ],
    propertySets: [
      {
        color: CardColor.DARK_BLUE,
        cards: [getCard('prop_dark_blue_2'), getCard('prop_dark_blue_3')],
        isComplete: false,
        hasHouse: false,
      },
      {
        color: CardColor.PINK,
        cards: [getCard('prop_pink_2'), getCard('prop_pink_3'), getCard('prop_pink_4')],
        isComplete: false,
      },
    ],
  };

  // Opponent 1: "Elena"
  const opponentElena: MockPlayer = {
    id: 'player_elena',
    name: 'Elena',
    avatar: '💎',
    handCount: 4,
    bankCards: [
      getCard('money_3_2'),
      getCard('money_2_2'),
    ],
    propertySets: [
      {
        color: CardColor.GREEN,
        cards: [getCard('prop_green_1'), getCard('prop_green_2')],
        isComplete: true,
        hasHouse: true,
      },
      {
        color: CardColor.RED,
        cards: [getCard('prop_red_1')],
        isComplete: false,
      },
    ],
  };

  // Opponent 2: "Marcus"
  const opponentMarcus: MockPlayer = {
    id: 'player_marcus',
    name: 'Marcus',
    avatar: '🎩',
    handCount: 6,
    bankCards: [
      getCard('money_5_2'),
      getCard('money_4_1'),
      getCard('money_3_3'),
    ],
    propertySets: [
      {
        color: CardColor.ORANGE,
        cards: [getCard('prop_orange_1'), getCard('prop_orange_2'), getCard('prop_orange_3')],
        isComplete: true,
        hasHouse: true,
        hasHotel: true,
      },
      {
        color: CardColor.LIGHT_BLUE,
        cards: [getCard('prop_light_blue_1'), getCard('prop_light_blue_2')],
        isComplete: false,
      },
    ],
  };

  return {
    roomId: 'LUX-777',
    deckCount: 54,
    discardPile: [
      getCard('action_debt_collector_1'),
      getCard('action_pass_go_2'),
    ],
    activeActionCard: null,
    activeActionMessage: null,
    currentPlayer,
    opponents: [opponentElena, opponentMarcus],
    turn: {
      activePlayerId: 'player_you',
      actionsRemaining: 3,
      maxActions: 3,
    },
  };
};
