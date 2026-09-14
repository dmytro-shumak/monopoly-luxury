import { create } from 'zustand';
import { CardType } from '../types/cards';
import { ALL_CARDS } from '../data/allCards';
import { createInitialMockState, type MockTableState } from './mockGameData';

interface MockGameStore {
  tableState: MockTableState;
  selectedCardId: string | null;
  validDropTarget: 'bank' | 'property' | 'action' | null;

  // Actions
  selectCard: (cardId: string | null) => void;
  playSelectedToBank: () => void;
  playSelectedToProperty: () => void;
  playSelectedAction: () => void;
  drawTwoCards: () => void;
  endTurn: () => void;
  resetMockState: () => void;
}

export const useMockGameStore = create<MockGameStore>((set, get) => ({
  tableState: createInitialMockState(),
  selectedCardId: null,
  validDropTarget: null,

  selectCard: (cardId: string | null) => {
    const { selectedCardId, tableState } = get();
    if (selectedCardId === cardId || !cardId) {
      set({ selectedCardId: null, validDropTarget: null });
      return;
    }

    const card = tableState.currentPlayer.handCards?.find((c) => c.id === cardId);
    if (!card) {
      set({ selectedCardId: null, validDropTarget: null });
      return;
    }

    // Determine valid drop target based on card type
    let target: 'bank' | 'property' | 'action' | null = null;
    if (card.type === CardType.MONEY) {
      target = 'bank';
    } else if (card.type === CardType.PROPERTY || card.type === CardType.PROPERTY_WILDCARD) {
      target = 'property';
    } else if (card.type === CardType.ACTION) {
      target = 'action';
    }

    set({ selectedCardId: cardId, validDropTarget: target });
  },

  playSelectedToBank: () => {
    const { selectedCardId, tableState } = get();
    if (!selectedCardId) return;

    const hand = tableState.currentPlayer.handCards || [];
    const card = hand.find((c) => c.id === selectedCardId);
    if (!card) return;

    const newHand = hand.filter((c) => c.id !== selectedCardId);
    const newBank = [card, ...tableState.currentPlayer.bankCards];
    const newActions = Math.max(0, tableState.turn.actionsRemaining - 1);

    set({
      selectedCardId: null,
      validDropTarget: null,
      tableState: {
        ...tableState,
        currentPlayer: {
          ...tableState.currentPlayer,
          handCards: newHand,
          handCount: newHand.length,
          bankCards: newBank,
        },
        turn: {
          ...tableState.turn,
          actionsRemaining: newActions,
        },
      },
    });
  },

  playSelectedToProperty: () => {
    const { selectedCardId, tableState } = get();
    if (!selectedCardId) return;

    const hand = tableState.currentPlayer.handCards || [];
    const card = hand.find((c) => c.id === selectedCardId);
    if (!card || !card.colors || card.colors.length === 0) return;

    const primaryColor = card.colors[0];
    const newHand = hand.filter((c) => c.id !== selectedCardId);

    // Find existing set with this color or create a new set
    const existingSets = [...tableState.currentPlayer.propertySets];
    const setIndex = existingSets.findIndex((s) => s.color === primaryColor);

    if (setIndex !== -1) {
      const targetSet = existingSets[setIndex];
      const updatedCards = [...targetSet.cards, card];
      const isComplete = card.fullSetSize ? updatedCards.length >= card.fullSetSize : false;
      existingSets[setIndex] = {
        ...targetSet,
        cards: updatedCards,
        isComplete,
      };
    } else {
      existingSets.push({
        color: primaryColor,
        cards: [card],
        isComplete: false,
      });
    }

    const newActions = Math.max(0, tableState.turn.actionsRemaining - 1);

    set({
      selectedCardId: null,
      validDropTarget: null,
      tableState: {
        ...tableState,
        currentPlayer: {
          ...tableState.currentPlayer,
          handCards: newHand,
          handCount: newHand.length,
          propertySets: existingSets,
        },
        turn: {
          ...tableState.turn,
          actionsRemaining: newActions,
        },
      },
    });
  },

  playSelectedAction: () => {
    const { selectedCardId, tableState } = get();
    if (!selectedCardId) return;

    const hand = tableState.currentPlayer.handCards || [];
    const card = hand.find((c) => c.id === selectedCardId);
    if (!card) return;

    const newHand = hand.filter((c) => c.id !== selectedCardId);
    const newActions = Math.max(0, tableState.turn.actionsRemaining - 1);

    set({
      selectedCardId: null,
      validDropTarget: null,
      tableState: {
        ...tableState,
        activeActionCard: card,
        activeActionMessage: `${card.name} played!`,
        discardPile: [card, ...tableState.discardPile],
        currentPlayer: {
          ...tableState.currentPlayer,
          handCards: newHand,
          handCount: newHand.length,
        },
        turn: {
          ...tableState.turn,
          actionsRemaining: newActions,
        },
      },
    });
  },

  drawTwoCards: () => {
    const { tableState } = get();
    // Pick 2 random cards from full deck
    const available = ALL_CARDS.slice(10, 20);
    const card1 = available[Math.floor(Math.random() * available.length)];
    const card2 = available[(Math.floor(Math.random() * available.length) + 1) % available.length];

    const currentHand = tableState.currentPlayer.handCards || [];
    const newHand = [...currentHand, card1, card2];
    const newDeckCount = Math.max(0, tableState.deckCount - 2);

    set({
      tableState: {
        ...tableState,
        deckCount: newDeckCount,
        currentPlayer: {
          ...tableState.currentPlayer,
          handCards: newHand,
          handCount: newHand.length,
        },
      },
    });
  },

  endTurn: () => {
    const { tableState } = get();
    const isNowOpponent = tableState.turn.activePlayerId === 'player_you';
    const nextPlayerId = isNowOpponent ? 'player_elena' : 'player_you';

    set({
      selectedCardId: null,
      validDropTarget: null,
      tableState: {
        ...tableState,
        activeActionCard: null,
        activeActionMessage: null,
        turn: {
          activePlayerId: nextPlayerId,
          actionsRemaining: 3,
          maxActions: 3,
        },
      },
    });
  },

  resetMockState: () => {
    set({
      tableState: createInitialMockState(),
      selectedCardId: null,
      validDropTarget: null,
    });
  },
}));
