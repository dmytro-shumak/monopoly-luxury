import { create } from 'zustand';
import { CardType, CardColor, BuildingType, ActionCardType, type CardModel } from '../types/cards';
import { PROPERTY_CONFIG, ALL_CARDS } from '../data/allCards';
import { createInitialMockState, type MockTableState, type MockPropertySet } from './mockGameData';

export type PropertyTarget =
  | { type: 'existing'; setIndex: number; color: CardColor }
  | { type: 'new_set'; color: CardColor };

export const computeValidPropertyTargets = (
  card: CardModel,
  propertySets: MockPropertySet[]
): PropertyTarget[] => {
  const isHouse = card.isBuilding === BuildingType.HOUSE || card.actionType === ActionCardType.HOUSE;
  const isHotel = card.isBuilding === BuildingType.HOTEL || card.actionType === ActionCardType.HOTEL;

  if (isHouse) {
    const targets: PropertyTarget[] = [];
    propertySets.forEach((set, idx) => {
      if (set.isComplete && !set.hasHouse) {
        targets.push({ type: 'existing', setIndex: idx, color: set.color });
      }
    });
    return targets;
  }

  if (isHotel) {
    const targets: PropertyTarget[] = [];
    propertySets.forEach((set, idx) => {
      if (set.isComplete && set.hasHouse && !set.hasHotel) {
        targets.push({ type: 'existing', setIndex: idx, color: set.color });
      }
    });
    return targets;
  }

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

export interface TableMovingCard {
  sourceSetIndex: number;
  cardId: string;
  targetColor: CardColor;
  target: PropertyTarget;
}

export const computeFlipTargetForTableCard = (
  sourceSetIndex: number,
  card: CardModel,
  propertySets: MockPropertySet[]
): { targetColor: CardColor; target: PropertyTarget } | null => {
  if (card.type !== CardType.PROPERTY_WILDCARD || !card.colors || card.colors.length !== 2) {
    return null;
  }
  if (card.colors.includes(CardColor.ALL_COLOR)) {
    return null;
  }
  const sourceSet = propertySets[sourceSetIndex];
  if (!sourceSet || sourceSet.isComplete) {
    return null; // Color lock in complete monopoly
  }

  const currentColor = sourceSet.color;
  const targetColor = card.colors.find((c) => c !== currentColor);
  if (!targetColor) return null;

  const incompleteTargetIndex = propertySets.findIndex(
    (s, idx) => idx !== sourceSetIndex && s.color === targetColor && !s.isComplete
  );

  let target: PropertyTarget;
  if (incompleteTargetIndex !== -1) {
    target = { type: 'existing', setIndex: incompleteTargetIndex, color: targetColor };
  } else {
    target = { type: 'new_set', color: targetColor };
  }

  return { targetColor, target };
};

export const drawCardsFromDeck = (
  tableState: MockTableState,
  count: number = 2
): { drawnCards: CardModel[]; newDeckCount: number } => {
  const usedCardIds = new Set<string>([
    ...(tableState.currentPlayer.handCards || []).map((c) => c.id),
    ...tableState.currentPlayer.bankCards.map((c) => c.id),
    ...tableState.currentPlayer.propertySets.flatMap((s) => s.cards.map((c) => c.id)),
    ...tableState.discardPile.map((c) => c.id),
  ]);

  let availableCards = ALL_CARDS.filter((c) => !usedCardIds.has(c.id));

  if (availableCards.length < count) {
    availableCards = ALL_CARDS;
  }

  const shuffled = [...availableCards].sort(() => Math.random() - 0.5);
  const drawnCards: CardModel[] = [];

  for (let i = 0; i < count && i < shuffled.length; i++) {
    const original = shuffled[i];
    const isIdUsed = usedCardIds.has(original.id) || drawnCards.some((c) => c.id === original.id);
    if (isIdUsed) {
      drawnCards.push({
        ...original,
        id: `${original.id}_drawn_${Date.now()}_${i}`,
      });
    } else {
      drawnCards.push(original);
      usedCardIds.add(original.id);
    }
  }

  const newDeckCount = Math.max(0, tableState.deckCount - drawnCards.length);
  return { drawnCards, newDeckCount };
};

interface MockGameStore {
  tableState: MockTableState;
  selectedCardId: string | null;
  validDropTarget: 'bank' | 'property' | 'action' | null;
  validPropertyTargets: PropertyTarget[];
  tableMovingCard: TableMovingCard | null;

  // Actions
  selectCard: (cardId: string | null) => void;
  playSelectedToBank: () => void;
  playSelectedToProperty: (target?: PropertyTarget) => void;
  playSelectedAction: () => void;
  startTableCardMove: (sourceSetIndex: number, card: CardModel) => void;
  cancelTableCardMove: () => void;
  executeTableCardMove: (target?: PropertyTarget) => void;
  drawTwoCards: () => void;
  endTurn: () => void;
  resetMockState: () => void;
}

export const useMockGameStore = create<MockGameStore>((set, get) => ({
  tableState: createInitialMockState(),
  selectedCardId: null,
  validDropTarget: null,
  validPropertyTargets: [],
  tableMovingCard: null,

  selectCard: (cardId: string | null) => {
    const { selectedCardId, tableState } = get();
    if (selectedCardId === cardId || !cardId) {
      set({ selectedCardId: null, validDropTarget: null, validPropertyTargets: [], tableMovingCard: null });
      return;
    }

    const card = tableState.currentPlayer.handCards?.find((c) => c.id === cardId);
    if (!card) {
      set({ selectedCardId: null, validDropTarget: null, validPropertyTargets: [], tableMovingCard: null });
      return;
    }

    // Determine valid drop target based on card type
    let target: 'bank' | 'property' | 'action' | null = null;
    let propTargets: PropertyTarget[] = [];

    const isHouse = card.isBuilding === BuildingType.HOUSE || card.actionType === ActionCardType.HOUSE;
    const isHotel = card.isBuilding === BuildingType.HOTEL || card.actionType === ActionCardType.HOTEL;

    if (isHouse || isHotel) {
      propTargets = computeValidPropertyTargets(card, tableState.currentPlayer.propertySets);
      target = propTargets.length > 0 ? 'property' : null;
    } else if (card.type === CardType.MONEY) {
      target = 'bank';
    } else if (card.type === CardType.PROPERTY || card.type === CardType.PROPERTY_WILDCARD) {
      target = 'property';
      propTargets = computeValidPropertyTargets(card, tableState.currentPlayer.propertySets);
    } else if (card.type === CardType.ACTION) {
      target = 'action';
    }

    set({ selectedCardId: cardId, validDropTarget: target, validPropertyTargets: propTargets, tableMovingCard: null });
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

    const isHouse = card.isBuilding === BuildingType.HOUSE || card.actionType === ActionCardType.HOUSE;
    const isHotel = card.isBuilding === BuildingType.HOTEL || card.actionType === ActionCardType.HOTEL;

    if (isHouse) {
      if (target.type === 'existing' && existingSets[target.setIndex]) {
        existingSets[target.setIndex] = {
          ...existingSets[target.setIndex],
          hasHouse: true,
        };
      }
    } else if (isHotel) {
      if (target.type === 'existing' && existingSets[target.setIndex]) {
        existingSets[target.setIndex] = {
          ...existingSets[target.setIndex],
          hasHotel: true,
        };
      }
    } else if (target.type === 'existing') {
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
    const newDiscard = [card, ...tableState.discardPile];

    let finalHand = newHand;
    let finalDeckCount = tableState.deckCount;
    let actionMessage = `${card.name} played!`;

    // Special logic for PASS_GO: draw 2 cards from deck to hand
    if (card.actionType === ActionCardType.PASS_GO) {
      const { drawnCards, newDeckCount } = drawCardsFromDeck(
        {
          ...tableState,
          currentPlayer: {
            ...tableState.currentPlayer,
            handCards: newHand,
          },
          discardPile: newDiscard,
        },
        2
      );
      finalHand = [...newHand, ...drawnCards];
      finalDeckCount = newDeckCount;
      actionMessage = `${card.name}: +2 карт у руці!`;
    }

    set({
      selectedCardId: null,
      validDropTarget: null,
      tableState: {
        ...tableState,
        deckCount: finalDeckCount,
        activeActionCard: card,
        activeActionMessage: actionMessage,
        discardPile: newDiscard,
        currentPlayer: {
          ...tableState.currentPlayer,
          handCards: finalHand,
          handCount: finalHand.length,
        },
        turn: {
          ...tableState.turn,
          actionsRemaining: newActions,
        },
      },
    });
  },

  startTableCardMove: (sourceSetIndex: number, card: CardModel) => {
    const { tableState, tableMovingCard } = get();
    if (tableState.turn.actionsRemaining <= 0) return;

    // Toggle off if already moving this card
    if (tableMovingCard && tableMovingCard.cardId === card.id) {
      set({ tableMovingCard: null });
      return;
    }

    const flipInfo = computeFlipTargetForTableCard(
      sourceSetIndex,
      card,
      tableState.currentPlayer.propertySets
    );
    if (!flipInfo) return;

    // Deselect any hand card
    set({
      selectedCardId: null,
      validDropTarget: null,
      validPropertyTargets: [],
      tableMovingCard: {
        sourceSetIndex,
        cardId: card.id,
        targetColor: flipInfo.targetColor,
        target: flipInfo.target,
      },
    });
  },

  cancelTableCardMove: () => {
    set({ tableMovingCard: null });
  },

  executeTableCardMove: (chosenTarget?: PropertyTarget) => {
    const { tableMovingCard, tableState } = get();
    if (!tableMovingCard) return;
    if (tableState.turn.actionsRemaining <= 0) return;

    const { sourceSetIndex, cardId, targetColor } = tableMovingCard;
    const existingSets = [...tableState.currentPlayer.propertySets];
    const sourceSet = existingSets[sourceSetIndex];
    if (!sourceSet) return;

    const card = sourceSet.cards.find((c) => c.id === cardId);
    if (!card) return;

    // 1. Remove card from sourceSet
    const remainingCardsInSource = sourceSet.cards.filter((c) => c.id !== cardId);
    const sourceFullSetSize = PROPERTY_CONFIG[sourceSet.color]?.setSize || 3;

    if (remainingCardsInSource.length === 0) {
      existingSets.splice(sourceSetIndex, 1);
    } else {
      existingSets[sourceSetIndex] = {
        ...sourceSet,
        cards: remainingCardsInSource,
        isComplete: remainingCardsInSource.length >= sourceFullSetSize,
      };
    }

    // 2. Add card to target set
    const target = chosenTarget || tableMovingCard.target;
    const targetFullSetSize = card.fullSetSize || PROPERTY_CONFIG[targetColor]?.setSize || 3;

    if (target.type === 'existing') {
      const targetSetIndex = existingSets.findIndex(
        (s) => s.color === target.color && !s.isComplete
      );
      if (targetSetIndex !== -1) {
        const destSet = existingSets[targetSetIndex];
        const newCards = [...destSet.cards, card];
        existingSets[targetSetIndex] = {
          ...destSet,
          cards: newCards,
          isComplete: newCards.length >= targetFullSetSize,
        };
      } else {
        existingSets.push({
          color: targetColor,
          cards: [card],
          isComplete: 1 >= targetFullSetSize,
        });
      }
    } else if (target.type === 'new_set') {
      existingSets.push({
        color: targetColor,
        cards: [card],
        isComplete: 1 >= targetFullSetSize,
      });
    }

    const newActions = Math.max(0, tableState.turn.actionsRemaining - 1);

    set({
      tableMovingCard: null,
      tableState: {
        ...tableState,
        currentPlayer: {
          ...tableState.currentPlayer,
          propertySets: existingSets,
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
    const { drawnCards, newDeckCount } = drawCardsFromDeck(tableState, 2);
    const currentHand = tableState.currentPlayer.handCards || [];
    const newHand = [...currentHand, ...drawnCards];

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
      tableMovingCard: null,
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
      tableMovingCard: null,
    });
  },
}));
