import { create } from 'zustand';
import { CardType, CardColor, type CardModel } from '../types/cards';
import { PROPERTY_CONFIG, ALL_CARDS } from '../data/allCards';
import { createInitialMockState, type MockTableState, type MockPropertySet } from './mockGameData';

export type PropertyTarget =
  | { type: 'existing'; setIndex: number; color: CardColor }
  | { type: 'new_set'; color: CardColor };

export const computeValidPropertyTargets = (
  card: CardModel,
  propertySets: MockPropertySet[]
): PropertyTarget[] => {
  if (card.type !== CardType.PROPERTY && card.type !== CardType.PROPERTY_WILDCARD) {
    return [];
  }

  const colors = card.colors || [];
  const targets: PropertyTarget[] = [];

  // Case 3: Universal All-Color Wildcard (e.g. wild_all or CardColor.ALL_COLOR)
  if (colors.includes(CardColor.ALL_COLOR) || colors.length === 0) {
    // Only existing INCOMPLETE sets can be targeted; cannot start a new set!
    propertySets.forEach((set, idx) => {
      if (!set.isComplete) {
        targets.push({ type: 'existing', setIndex: idx, color: set.color });
      }
    });
    return targets;
  }

  // Case 1: Single Color Property Card (colors.length === 1)
  if (colors.length === 1) {
    const targetColor = colors[0];
    const incompleteSetIndex = propertySets.findIndex(
      (s) => s.color === targetColor && !s.isComplete
    );

    if (incompleteSetIndex !== -1) {
      // There is an incomplete set of this color: can only add to this incomplete set!
      targets.push({ type: 'existing', setIndex: incompleteSetIndex, color: targetColor });
    } else {
      // Either no set of this color exists, OR all existing sets of this color are complete!
      // Must start a new set!
      targets.push({ type: 'new_set', color: targetColor });
    }
    return targets;
  }

  // Case 2: Dual-Color Property Wildcard (colors.length === 2)
  if (colors.length === 2) {
    const [colorA, colorB] = colors;
    const incompleteAIndex = propertySets.findIndex(
      (s) => s.color === colorA && !s.isComplete
    );
    const incompleteBIndex = propertySets.findIndex(
      (s) => s.color === colorB && !s.isComplete
    );

    const hasIncompleteA = incompleteAIndex !== -1;
    const hasIncompleteB = incompleteBIndex !== -1;

    // Subcase 2A: Both colors have incomplete sets!
    // Rule: Can ONLY put on one of these existing incomplete sets. CANNOT create a new set.
    if (hasIncompleteA && hasIncompleteB) {
      targets.push({ type: 'existing', setIndex: incompleteAIndex, color: colorA });
      targets.push({ type: 'existing', setIndex: incompleteBIndex, color: colorB });
      return targets;
    }

    // Subcase 2B: Exactly one color has an incomplete set, the other is empty or complete!
    if (hasIncompleteA && !hasIncompleteB) {
      targets.push({ type: 'existing', setIndex: incompleteAIndex, color: colorA });
      targets.push({ type: 'new_set', color: colorB });
      return targets;
    }

    if (!hasIncompleteA && hasIncompleteB) {
      targets.push({ type: 'existing', setIndex: incompleteBIndex, color: colorB });
      targets.push({ type: 'new_set', color: colorA });
      return targets;
    }

    // Subcase 2C: Neither color has an incomplete set (both are either non-existent or complete monopolies)!
    // Rule: Can start a new set as either color A or color B!
    if (!hasIncompleteA && !hasIncompleteB) {
      targets.push({ type: 'new_set', color: colorA });
      targets.push({ type: 'new_set', color: colorB });
      return targets;
    }
  }

  return targets;
};

interface MockGameStore {
  tableState: MockTableState;
  selectedCardId: string | null;
  validDropTarget: 'bank' | 'property' | 'action' | null;
  validPropertyTargets: PropertyTarget[];

  // Actions
  selectCard: (cardId: string | null) => void;
  playSelectedToBank: () => void;
  playSelectedToProperty: (target?: PropertyTarget) => void;
  playSelectedAction: () => void;
  drawTwoCards: () => void;
  endTurn: () => void;
  resetMockState: () => void;
}

export const useMockGameStore = create<MockGameStore>((set, get) => ({
  tableState: createInitialMockState(),
  selectedCardId: null,
  validDropTarget: null,
  validPropertyTargets: [],

  selectCard: (cardId: string | null) => {
    const { selectedCardId, tableState } = get();
    if (selectedCardId === cardId || !cardId) {
      set({ selectedCardId: null, validDropTarget: null, validPropertyTargets: [] });
      return;
    }

    const card = tableState.currentPlayer.handCards?.find((c) => c.id === cardId);
    if (!card) {
      set({ selectedCardId: null, validDropTarget: null, validPropertyTargets: [] });
      return;
    }

    // Determine valid drop target based on card type
    let target: 'bank' | 'property' | 'action' | null = null;
    let propTargets: PropertyTarget[] = [];

    if (card.type === CardType.MONEY) {
      target = 'bank';
    } else if (card.type === CardType.PROPERTY || card.type === CardType.PROPERTY_WILDCARD) {
      target = 'property';
      propTargets = computeValidPropertyTargets(card, tableState.currentPlayer.propertySets);
    } else if (card.type === CardType.ACTION) {
      target = 'action';
    }

    set({ selectedCardId: cardId, validDropTarget: target, validPropertyTargets: propTargets });
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
      validPropertyTargets: [],
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

  playSelectedToProperty: (chosenTarget?: PropertyTarget) => {
    const { selectedCardId, validPropertyTargets, tableState } = get();
    if (!selectedCardId) return;

    const hand = tableState.currentPlayer.handCards || [];
    const card = hand.find((c) => c.id === selectedCardId);
    if (!card) return;

    // Use chosen target or first valid target
    const target = chosenTarget || validPropertyTargets[0];
    if (!target) return;

    const newHand = hand.filter((c) => c.id !== selectedCardId);
    const existingSets = [...tableState.currentPlayer.propertySets];

    if (target.type === 'existing') {
      const targetSet = existingSets[target.setIndex];
      if (targetSet) {
        const updatedCards = [...targetSet.cards, card];
        const fullSetSize = card.fullSetSize || PROPERTY_CONFIG[target.color]?.setSize || 3;
        const isComplete = updatedCards.length >= fullSetSize;
        existingSets[target.setIndex] = {
          ...targetSet,
          cards: updatedCards,
          isComplete,
        };
      }
    } else if (target.type === 'new_set') {
      const fullSetSize = card.fullSetSize || PROPERTY_CONFIG[target.color]?.setSize || 3;
      existingSets.push({
        color: target.color,
        cards: [card],
        isComplete: 1 >= fullSetSize,
      });
    }

    const newActions = Math.max(0, tableState.turn.actionsRemaining - 1);

    set({
      selectedCardId: null,
      validDropTarget: null,
      validPropertyTargets: [],
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
