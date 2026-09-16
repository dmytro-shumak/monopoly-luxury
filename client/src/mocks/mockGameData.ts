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
  // Current player: "Alex (You)" — Maximally populated Bank & Properties
  const currentPlayer: MockPlayer = {
    id: 'player_you',
    name: 'Alex',
    avatar: '👑',
    isCurrentPlayer: true,
    handCount: 12,
    handCards: [
      getCard('rent_darkblue_purple_1'), // Dual-color rent (Dark Blue / Purple) -> picks Dark Blue ($3)
      getCard('rent_wild_1'), // Wild rent -> picks Brown ($6, has house)
      getCard('action_debt_collector_1'), // Debt Collector -> $5 from 1 player
      getCard('action_birthday_1'), // Birthday -> $2 from ALL players (no selection)
      getCard('action_house_1'), // House card (adds +$3 rent to complete set)
      getCard('action_hotel_1'), // Hotel card (adds +$4 rent to set with house)
      getCard('prop_orange_3'), // Single property: existing incomplete set (Orange)
      getCard('prop_dark_blue_1'), // Single property: existing complete set (Dark Blue) -> starts new set
      getCard('wild_purple_lightblue_1'), // Dual-color wild: BOTH sets incomplete (Purple & Light Blue) -> highlights both
      getCard('wild_darkblue_brown_1'), // Dual-color wild: BOTH sets complete (Dark Blue & Brown) -> new set for either
      getCard('action_pass_go_1'),
      getCard('money_3_3'),
    ],
    // Maximally populated Bank: ALL 22 official Money cards in the deck
    bankCards: [
      // $1 (7 cards)
      getCard('money_1_1'),
      getCard('money_1_2'),
      getCard('money_1_3'),
      getCard('money_1_4'),
      getCard('money_1_5'),
      getCard('money_1_6'),
      getCard('money_1_7'),
      // $2 (5 cards)
      getCard('money_2_1'),
      getCard('money_2_2'),
      getCard('money_2_3'),
      getCard('money_2_4'),
      getCard('money_2_5'),
      // $3 (4 cards)
      getCard('money_3_1'),
      getCard('money_3_2'),
      getCard('money_3_3'),
      getCard('money_3_4'),
      // $4 (3 cards)
      getCard('money_4_1'),
      getCard('money_4_2'),
      getCard('money_4_3'),
      // $5 (2 cards)
      getCard('money_5_1'),
      getCard('money_5_2'),
      // $10 (1 card)
      getCard('money_10_1'),
    ],
    // Maximally populated Properties: 2 full monopolies + 6 partial sets
    propertySets: [
      {
        color: CardColor.DARK_BLUE,
        cards: [
          getCard('prop_dark_blue_1'),
          getCard('prop_dark_blue_2'),
          getCard('prop_dark_blue_3'),
        ],
        isComplete: true,
        // No house yet - ready for House action card!
      },
      {
        color: CardColor.BROWN,
        cards: [
          getCard('prop_brown_1'),
          getCard('prop_brown_2'),
          getCard('prop_brown_3'),
        ],
        isComplete: true,
        hasHouse: true,
        // Has house, but no hotel yet - ready for Hotel action card!
      },
      {
        color: CardColor.PINK,
        cards: [
          getCard('prop_pink_1'),
          getCard('prop_pink_2'),
          getCard('prop_pink_3'),
        ],
        isComplete: false,
      },
      {
        color: CardColor.ORANGE,
        cards: [
          getCard('prop_orange_1'),
          getCard('wild_pink_orange_1'),
        ],
        isComplete: false,
      },
      {
        color: CardColor.LIGHT_BLUE,
        cards: [
          getCard('prop_light_blue_1'),
          getCard('prop_light_blue_2'),
        ],
        isComplete: false,
      },
      {
        color: CardColor.PURPLE,
        cards: [
          getCard('prop_purple_1'),
          getCard('prop_purple_2'),
        ],
        isComplete: false,
      },
      {
        color: CardColor.GREEN,
        cards: [
          getCard('prop_green_1'),
        ],
        isComplete: false,
      },
      {
        color: CardColor.RED,
        cards: [
          getCard('prop_red_1'),
        ],
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
      getCard('money_5_1'),
      getCard('money_2_1'),
      getCard('money_1_1'),
      getCard('money_1_2'),
    ],
    propertySets: [
      {
        color: CardColor.LIGHT_GREEN,
        cards: [
          getCard('prop_light_green_1'),
          getCard('prop_light_green_2'),
          getCard('prop_light_green_3'),
        ],
        isComplete: true,
        hasHouse: true,
      },
      {
        color: CardColor.MAROON,
        cards: [getCard('prop_maroon_1')],
        isComplete: false,
      },
      {
        color: CardColor.PINK,
        cards: [
          getCard('prop_pink_1'),
          getCard('prop_pink_2'),
          getCard('prop_pink_3'),
        ],
        isComplete: false,
      },
      {
        color: CardColor.BROWN,
        cards: [
          getCard('prop_brown_1'),
          getCard('prop_brown_2'),
        ],
        isComplete: false,
      },
      {
        color: CardColor.ORANGE,
        cards: [
          getCard('prop_orange_1'),
          getCard('prop_orange_2'),
          getCard('prop_orange_3'),
        ],
        isComplete: true,
      },
      {
        color: CardColor.RED,
        cards: [
          getCard('prop_red_1'),
        ],
        isComplete: false,
      }
    ],
  };

  // Opponent 2: "Marcus"
  const opponentMarcus: MockPlayer = {
    id: 'player_marcus',
    name: 'Marcus',
    avatar: '🎩',
    handCount: 6,
    bankCards: [
      getCard('money_10_1'),
      getCard('money_4_1'),
      getCard('money_3_1'),
      getCard('money_2_2'),
      getCard('money_1_3'),
      getCard('money_1_6'),
      getCard('money_1_7'),
    ],
    propertySets: [
      {
        color: CardColor.RED,
        cards: [
          getCard('prop_red_2'),
          getCard('wild_red_pink_1'),
        ],
        isComplete: true,
      },
      {
        color: CardColor.MAROON,
        cards: [getCard('prop_maroon_2')],
        isComplete: false,
      },
    ],
  };

  return {
    roomId: 'LUX-777',
    deckCount: 52,
    discardPile: [
      getCard('action_debt_collector_2'),
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
