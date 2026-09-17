import { create } from 'zustand';
import { CardType, CardColor, BuildingType, ActionCardType, type CardModel } from '../types/cards';
import { PROPERTY_CONFIG, ALL_CARDS } from '../data/allCards';
import { createInitialMockState, getCard, type MockTableState, type MockPropertySet, type MockPlayer } from './mockGameData';

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

export interface BestRentChoice {
  color: CardColor;
  amount: number;
}

export interface ActiveMoneyDemand {
  card: CardModel;
  amount: number;
  color?: CardColor;
  targetType: 'single_player' | 'all_players';
}

export interface PendingDoubleRentPrompt {
  rentCard: CardModel;
  doubleRentCard: CardModel;
  baseAmount: number;
  color?: CardColor;
}

export interface ActiveSlyDeal {
  card: CardModel;
}

export interface ActiveForcedDeal {
  card: CardModel;
}

export interface ActiveDealBreaker {
  card: CardModel;
}

export interface PendingStolenCardPlacement {
  card: CardModel;
  fromOpponentName: string;
}

export interface IncomingAction {
  type: 'sly_deal' | 'forced_deal' | 'deal_breaker';
  attackerId: string;
  attackerName: string;
  actionCard: CardModel;
  stolenCard?: CardModel;
  stolenCardSetIndex?: number;
  theirCard?: CardModel;
  myTargetCard?: CardModel;
  myTargetCardSetIndex?: number;
  stolenSetIndex?: number;
  stolenSet?: MockPropertySet;
}

export interface IncomingDebt {
  attackerId: string;
  attackerName: string;
  actionCard: CardModel;
  amount: number;
  reason: string;
}

export const computeRentForColor = (
  color: CardColor,
  propertySets: MockPropertySet[]
): number => {
  const setsOfColor = propertySets.filter((s) => s.color === color);
  if (setsOfColor.length === 0) return 0;

  let maxRent = 0;
  setsOfColor.forEach((set) => {
    let rent = set.cards.length;
    if (set.hasHouse) rent += 3;
    if (set.hasHotel) rent += 4;
    if (rent > maxRent) {
      maxRent = rent;
    }
  });
  return maxRent;
};

export const computeBestRentForCard = (
  card: CardModel,
  propertySets: MockPropertySet[]
): BestRentChoice | null => {
  if (card.actionType !== ActionCardType.RENT) return null;

  const colors = card.colors || [];

  // Wild Rent (ALL_COLOR) -> evaluate all colors the player currently owns
  if (colors.includes(CardColor.ALL_COLOR)) {
    let best: BestRentChoice | null = null;
    propertySets.forEach((set) => {
      const rent = computeRentForColor(set.color, propertySets);
      if (!best || rent > best.amount) {
        best = { color: set.color, amount: rent };
      }
    });
    return best;
  }

  // Dual-color Rent -> evaluate both colors and pick the highest rent
  let best: BestRentChoice | null = null;
  colors.forEach((color) => {
    const rent = computeRentForColor(color, propertySets);
    if (!best || rent > best.amount) {
      best = { color, amount: rent };
    }
  });

  return best;
};

export const settlePaymentFromPlayer = (
  payer: MockPlayer,
  amount: number
): { paidCards: CardModel[]; updatedPayer: MockPlayer; totalPaid: number } => {
  let remainingDue = amount;
  const paidCards: CardModel[] = [];
  const remainingBank: CardModel[] = [];

  // Sort bank cards ascending so smaller bills are used first
  const bankCards = [...payer.bankCards].sort((a, b) => (a.value || 0) - (b.value || 0));

  for (const card of bankCards) {
    if (remainingDue > 0) {
      paidCards.push(card);
      remainingDue -= card.value || 0;
    } else {
      remainingBank.push(card);
    }
  }

  const totalPaid = paidCards.reduce((acc, c) => acc + (c.value || 0), 0);

  const updatedPayer: MockPlayer = {
    ...payer,
    bankCards: remainingBank,
  };

  return { paidCards, updatedPayer, totalPaid };
};

interface MockGameStore {
  tableState: MockTableState;
  selectedCardId: string | null;
  validDropTarget: 'bank' | 'property' | 'action' | null;
  validPropertyTargets: PropertyTarget[];
  tableMovingCard: TableMovingCard | null;
  activeMoneyDemand: ActiveMoneyDemand | null;
  pendingDoubleRent: PendingDoubleRentPrompt | null;
  activeSlyDeal: ActiveSlyDeal | null;
  slyDealTargetOpponentId: string | null;
  pendingStolenCardPlacement: PendingStolenCardPlacement | null;
  activeForcedDeal: ActiveForcedDeal | null;
  forcedDealMyCard: CardModel | null;
  forcedDealTargetOpponentId: string | null;
  activeDealBreaker: ActiveDealBreaker | null;
  dealBreakerTargetOpponentId: string | null;
  incomingAction: IncomingAction | null;
  incomingDebt: IncomingDebt | null;

  // Actions
  selectCard: (cardId: string | null) => void;
  playSelectedToBank: () => void;
  playSelectedToProperty: (target?: PropertyTarget) => void;
  playSelectedAction: () => void;
  confirmDoubleRent: () => void;
  declineDoubleRent: () => void;
  executeOpponentPayment: (targetOpponentId: string) => void;
  selectSlyDealOpponent: (opponentId: string) => void;
  executeSlyDeal: (targetOpponentId: string, stolenCard: CardModel) => void;
  placeStolenWildcardToProperty: (target: PropertyTarget) => void;
  cancelSlyDeal: () => void;
  selectForcedDealMyCard: (card: CardModel) => void;
  selectForcedDealOpponent: (opponentId: string) => void;
  cancelForcedDealOpponent: () => void;
  cancelForcedDeal: () => void;
  executeForcedDeal: (targetOpponentId: string, opponentCard: CardModel) => void;
  selectDealBreakerOpponent: (opponentId: string) => void;
  cancelDealBreakerOpponent: () => void;
  cancelDealBreaker: () => void;
  executeDealBreaker: (targetOpponentId: string, setIndex: number) => void;
  startTableCardMove: (sourceSetIndex: number, card: CardModel) => void;
  cancelTableCardMove: () => void;
  executeTableCardMove: (target?: PropertyTarget) => void;
  drawTwoCards: () => void;
  endTurn: () => void;
  resetMockState: () => void;
  simulateIncomingAction: (type?: 'sly_deal' | 'forced_deal' | 'deal_breaker') => void;
  simulateIncomingDebt: (amount?: number, reason?: string) => void;
  cancelWithJustSayNo: () => void;
  acceptIncomingAction: () => void;
  payIncomingDebt: (selectedCards: CardModel[]) => void;
  dismissDefenseModal: () => void;
}

export const useMockGameStore = create<MockGameStore>((set, get) => ({
  tableState: createInitialMockState(),
  selectedCardId: null,
  validDropTarget: null,
  validPropertyTargets: [],
  tableMovingCard: null,
  activeMoneyDemand: null,
  pendingDoubleRent: null,
  activeSlyDeal: null,
  slyDealTargetOpponentId: null,
  pendingStolenCardPlacement: null,
  activeForcedDeal: null,
  forcedDealMyCard: null,
  forcedDealTargetOpponentId: null,
  activeDealBreaker: null,
  dealBreakerTargetOpponentId: null,
  incomingAction: null,
  incomingDebt: null,

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
      if (card.actionType === ActionCardType.RENT) {
        const best = computeBestRentForCard(card, tableState.currentPlayer.propertySets);
        target = best && best.amount > 0 ? 'action' : null;
      } else {
        target = 'action';
      }
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
    const { pendingStolenCardPlacement, placeStolenWildcardToProperty } = get();
    if (pendingStolenCardPlacement) {
      const { validPropertyTargets } = get();
      const target = chosenTarget || validPropertyTargets[0];
      if (target) {
        placeStolenWildcardToProperty(target);
      }
      return;
    }

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
    let newMoneyDemand: ActiveMoneyDemand | null = null;
    let updatedOpponents = tableState.opponents;
    let newBank = tableState.currentPlayer.bankCards;

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
    } else if (card.actionType === ActionCardType.RENT) {
      const bestRent = computeBestRentForCard(card, tableState.currentPlayer.propertySets);
      const rentAmount = bestRent ? bestRent.amount : 0;

      if (rentAmount > 0 && bestRent) {
        // Check if player has Double Rent in hand AND has at least 1 action remaining to pay for it
        const doubleRentCard = newHand.find((c) => c.actionType === ActionCardType.DOUBLE_RENT);

        if (doubleRentCard && newActions >= 1) {
          set({
            selectedCardId: null,
            validDropTarget: null,
            pendingDoubleRent: {
              rentCard: card,
              doubleRentCard,
              baseAmount: rentAmount,
              color: bestRent.color,
            },
            activeMoneyDemand: null,
            tableState: {
              ...tableState,
              deckCount: finalDeckCount,
              activeActionCard: card,
              activeActionMessage: `${card.name}: чи бажаєте подвоїти ренту?`,
              discardPile: newDiscard,
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
          return;
        }

        newMoneyDemand = {
          card,
          amount: rentAmount,
          color: bestRent.color,
          targetType: 'single_player',
        };
        actionMessage = `${card.name}: вимагаємо $${rentAmount} (колір: ${bestRent.color.replace('_', ' ')}). Оберіть гравця!`;
      } else {
        actionMessage = `${card.name}: немає нерухомості цього кольору ($0).`;
      }
    } else if (card.actionType === ActionCardType.DEBT_COLLECTOR) {
      newMoneyDemand = {
        card,
        amount: 5,
        targetType: 'single_player',
      };
      actionMessage = `${card.name}: вимагаємо $5! Оберіть гравця!`;
    } else if (card.actionType === ActionCardType.BIRTHDAY) {
      // Birthday: all other players pay $2 immediately without player selection
      let totalCollectedCards: CardModel[] = [];
      updatedOpponents = tableState.opponents.map((opp) => {
        const { paidCards, updatedPayer } = settlePaymentFromPlayer(opp, 2);
        totalCollectedCards = [...totalCollectedCards, ...paidCards];
        return updatedPayer;
      });

      const totalCollectedAmount = totalCollectedCards.reduce((acc, c) => acc + (c.value || 0), 0);
      newBank = [...totalCollectedCards, ...newBank];
      actionMessage = `День народження: усі гравці сплатили по $2 (всього +$${totalCollectedAmount})!`;
    } else if (card.actionType === ActionCardType.SLY_DEAL) {
      actionMessage = `${card.name}: оберіть суперника, у якого хочете викрасти нерухомість!`;
      set({
        selectedCardId: null,
        validDropTarget: null,
        activeSlyDeal: { card },
        slyDealTargetOpponentId: null,
        pendingStolenCardPlacement: null,
        tableState: {
          ...tableState,
          activeActionCard: card,
          activeActionMessage: actionMessage,
          discardPile: newDiscard,
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
      return;
    } else if (card.actionType === ActionCardType.FORCED_DEAL) {
      const hasTradableProperty = tableState.currentPlayer.propertySets.some(
        (s) => !s.isComplete && s.cards.length > 0
      );
      if (!hasTradableProperty) {
        set({
          tableState: {
            ...tableState,
            activeActionMessage:
              'У вас немає доступних карток нерухомості для обміну (повні монополії захищені)!',
          },
        });
        return;
      }

      actionMessage = `${card.name}: оберіть вашу картку нерухомості, яку хочете віддати!`;
      set({
        selectedCardId: null,
        validDropTarget: null,
        activeForcedDeal: { card },
        forcedDealMyCard: null,
        forcedDealTargetOpponentId: null,
        pendingStolenCardPlacement: null,
        tableState: {
          ...tableState,
          activeActionCard: card,
          activeActionMessage: actionMessage,
          discardPile: newDiscard,
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
      return;
    } else if (card.actionType === ActionCardType.DEAL_BREAKER) {
      const hasStealableMonopoly = tableState.opponents.some((opp) =>
        opp.propertySets.some((s) => s.isComplete && s.cards.length > 0)
      );
      if (!hasStealableMonopoly) {
        set({
          tableState: {
            ...tableState,
            activeActionMessage:
              'У суперників немає жодного повного комплекту нерухомості для захоплення!',
          },
        });
        return;
      }

      actionMessage = `${card.name}: оберіть суперника, у якого хочете захопити повний комплект!`;
      set({
        selectedCardId: null,
        validDropTarget: null,
        activeDealBreaker: { card },
        dealBreakerTargetOpponentId: null,
        pendingStolenCardPlacement: null,
        tableState: {
          ...tableState,
          activeActionCard: card,
          activeActionMessage: actionMessage,
          discardPile: newDiscard,
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
      return;
    }

    set({
      selectedCardId: null,
      validDropTarget: null,
      activeMoneyDemand: newMoneyDemand,
      tableState: {
        ...tableState,
        deckCount: finalDeckCount,
        activeActionCard: card,
        activeActionMessage: actionMessage,
        discardPile: newDiscard,
        opponents: updatedOpponents,
        currentPlayer: {
          ...tableState.currentPlayer,
          handCards: finalHand,
          handCount: finalHand.length,
          bankCards: newBank,
        },
        turn: {
          ...tableState.turn,
          actionsRemaining: newActions,
        },
      },
    });
  },

  confirmDoubleRent: () => {
    const { pendingDoubleRent, tableState } = get();
    if (!pendingDoubleRent) return;

    const { rentCard, doubleRentCard, baseAmount, color } = pendingDoubleRent;
    const doubledAmount = baseAmount * 2;
    const hand = tableState.currentPlayer.handCards || [];
    const newHand = hand.filter((c) => c.id !== doubleRentCard.id);
    const newActions = Math.max(0, tableState.turn.actionsRemaining - 1);
    const newDiscard = [doubleRentCard, ...tableState.discardPile];

    set({
      pendingDoubleRent: null,
      activeMoneyDemand: {
        card: rentCard,
        amount: doubledAmount,
        color,
        targetType: 'single_player',
      },
      tableState: {
        ...tableState,
        activeActionCard: doubleRentCard,
        activeActionMessage: `⚡ ${doubleRentCard.name}: рента подвоєна до $${doubledAmount}! Оберіть гравця!`,
        discardPile: newDiscard,
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

  declineDoubleRent: () => {
    const { pendingDoubleRent, tableState } = get();
    if (!pendingDoubleRent) return;

    const { rentCard, baseAmount, color } = pendingDoubleRent;

    set({
      pendingDoubleRent: null,
      activeMoneyDemand: {
        card: rentCard,
        amount: baseAmount,
        color,
        targetType: 'single_player',
      },
      tableState: {
        ...tableState,
        activeActionMessage: `${rentCard.name}: вимагаємо $${baseAmount}! Оберіть гравця!`,
      },
    });
  },

  selectSlyDealOpponent: (opponentId: string) => {
    set({ slyDealTargetOpponentId: opponentId });
  },

  cancelSlyDeal: () => {
    set({ slyDealTargetOpponentId: null });
  },

  executeSlyDeal: (targetOpponentId: string, stolenCard: CardModel) => {
    const { tableState } = get();
    const targetOpponent = tableState.opponents.find((o) => o.id === targetOpponentId);
    if (!targetOpponent) return;

    // 1. Remove stolen card from the opponent's property sets
    const updatedOpponents = tableState.opponents.map((opp) => {
      if (opp.id !== targetOpponentId) return opp;
      const newSets = opp.propertySets
        .map((set) => ({
          ...set,
          cards: set.cards.filter((c) => c.id !== stolenCard.id),
        }))
        .filter((set) => set.cards.length > 0);
      return {
        ...opp,
        propertySets: newSets,
      };
    });

    const isWildcard =
      stolenCard.type === CardType.PROPERTY_WILDCARD ||
      (stolenCard.colors && stolenCard.colors.length > 1);

    if (isWildcard) {
      // Wildcard: Player must choose color and set on their table
      const targets = computeValidPropertyTargets(stolenCard, tableState.currentPlayer.propertySets);
      set({
        slyDealTargetOpponentId: null, // close modal
        pendingStolenCardPlacement: { card: stolenCard, fromOpponentName: targetOpponent.name },
        validPropertyTargets: targets,
        tableState: {
          ...tableState,
          opponents: updatedOpponents,
          activeActionMessage: `🥷 «${stolenCard.name}» викрадено у ${targetOpponent.name}! Оберіть набір або новий слот на своєму столі для її розміщення.`,
        },
      });
    } else {
      // Single-color card: automatically place onto player's table
      const targets = computeValidPropertyTargets(stolenCard, tableState.currentPlayer.propertySets);
      const existingSets = [...tableState.currentPlayer.propertySets];
      const existingTarget = targets.find((t) => t.type === 'existing');

      if (existingTarget && existingTarget.type === 'existing') {
        const targetSet = existingSets[existingTarget.setIndex];
        const updatedCards = [...targetSet.cards, stolenCard];
        const fullSetSize = stolenCard.fullSetSize || PROPERTY_CONFIG[targetSet.color]?.setSize || 3;
        existingSets[existingTarget.setIndex] = {
          ...targetSet,
          cards: updatedCards,
          isComplete: updatedCards.length >= fullSetSize,
        };
      } else {
        const targetColor = stolenCard.colors?.[0] || CardColor.ORANGE;
        const fullSetSize = stolenCard.fullSetSize || PROPERTY_CONFIG[targetColor]?.setSize || 3;
        existingSets.push({
          color: targetColor,
          cards: [stolenCard],
          isComplete: 1 >= fullSetSize,
        });
      }

      set({
        activeSlyDeal: null,
        slyDealTargetOpponentId: null,
        pendingStolenCardPlacement: null,
        tableState: {
          ...tableState,
          opponents: updatedOpponents,
          currentPlayer: {
            ...tableState.currentPlayer,
            propertySets: existingSets,
          },
          activeActionMessage: `🥷 Спритна угода: ви успішно викрали «${stolenCard.name}» у ${targetOpponent.name}!`,
        },
      });
    }
  },

  placeStolenWildcardToProperty: (chosenTarget: PropertyTarget) => {
    const { pendingStolenCardPlacement, tableState } = get();
    if (!pendingStolenCardPlacement) return;

    const { card } = pendingStolenCardPlacement;
    const existingSets = [...tableState.currentPlayer.propertySets];

    if (chosenTarget.type === 'existing') {
      const targetSet = existingSets[chosenTarget.setIndex];
      if (targetSet) {
        const updatedCards = [...targetSet.cards, card];
        const fullSetSize = card.fullSetSize || PROPERTY_CONFIG[chosenTarget.color]?.setSize || 3;
        existingSets[chosenTarget.setIndex] = {
          ...targetSet,
          cards: updatedCards,
          isComplete: updatedCards.length >= fullSetSize,
        };
      }
    } else if (chosenTarget.type === 'new_set') {
      const fullSetSize = card.fullSetSize || PROPERTY_CONFIG[chosenTarget.color]?.setSize || 3;
      existingSets.push({
        color: chosenTarget.color,
        cards: [card],
        isComplete: 1 >= fullSetSize,
      });
    }

    set({
      activeSlyDeal: null,
      slyDealTargetOpponentId: null,
      activeForcedDeal: null,
      forcedDealMyCard: null,
      forcedDealTargetOpponentId: null,
      pendingStolenCardPlacement: null,
      validPropertyTargets: [],
      tableState: {
        ...tableState,
        currentPlayer: {
          ...tableState.currentPlayer,
          propertySets: existingSets,
        },
        activeActionMessage: `«${card.name}» успішно додано у ваш набір (${chosenTarget.color.replace('_', ' ')})!`,
      },
    });
  },

  selectForcedDealMyCard: (card: CardModel) => {
    const { tableState, activeForcedDeal } = get();
    if (!activeForcedDeal) return;
    set({
      forcedDealMyCard: card,
      tableState: {
        ...tableState,
        activeActionMessage: `🔄 Ви віддаєте «${card.name}». Тепер оберіть суперника для обміну!`,
      },
    });
  },

  selectForcedDealOpponent: (opponentId: string) => {
    set({ forcedDealTargetOpponentId: opponentId });
  },

  cancelForcedDealOpponent: () => {
    set({ forcedDealTargetOpponentId: null });
  },

  cancelForcedDeal: () => {
    set({
      activeForcedDeal: null,
      forcedDealMyCard: null,
      forcedDealTargetOpponentId: null,
    });
  },

  executeForcedDeal: (targetOpponentId: string, opponentCard: CardModel) => {
    const { tableState, forcedDealMyCard } = get();
    if (!forcedDealMyCard) return;

    const targetOpponent = tableState.opponents.find((o) => o.id === targetOpponentId);
    if (!targetOpponent) return;

    // 1. Remove forcedDealMyCard from player's propertySets
    let playerSets = tableState.currentPlayer.propertySets
      .map((set) => {
        const remainingCards = set.cards.filter((c) => c.id !== forcedDealMyCard.id);
        const fullSize = remainingCards.find((c) => c.fullSetSize)?.fullSetSize || PROPERTY_CONFIG[set.color]?.setSize || 3;
        return {
          ...set,
          cards: remainingCards,
          isComplete: remainingCards.length >= fullSize,
        };
      })
      .filter((set) => set.cards.length > 0);

    // 2. Remove opponentCard from targetOpponent AND add forcedDealMyCard to targetOpponent
    const updatedOpponents = tableState.opponents.map((opp) => {
      if (opp.id !== targetOpponentId) return opp;

      let oppSets = opp.propertySets
        .map((set) => {
          const remainingCards = set.cards.filter((c) => c.id !== opponentCard.id);
          const fullSize = remainingCards.find((c) => c.fullSetSize)?.fullSetSize || PROPERTY_CONFIG[set.color]?.setSize || 3;
          return {
            ...set,
            cards: remainingCards,
            isComplete: remainingCards.length >= fullSize,
          };
        })
        .filter((set) => set.cards.length > 0);

      const myCardColor = forcedDealMyCard.colors?.[0] || CardColor.ORANGE;
      const existingMatchingSetIndex = oppSets.findIndex((s) => s.color === myCardColor && !s.isComplete);
      if (existingMatchingSetIndex !== -1) {
        const targetSet = oppSets[existingMatchingSetIndex];
        const updatedCards = [...targetSet.cards, forcedDealMyCard];
        const fullSetSize = forcedDealMyCard.fullSetSize || PROPERTY_CONFIG[targetSet.color]?.setSize || 3;
        oppSets[existingMatchingSetIndex] = {
          ...targetSet,
          cards: updatedCards,
          isComplete: updatedCards.length >= fullSetSize,
        };
      } else {
        const fullSetSize = forcedDealMyCard.fullSetSize || PROPERTY_CONFIG[myCardColor]?.setSize || 3;
        oppSets.push({
          color: myCardColor,
          cards: [forcedDealMyCard],
          isComplete: 1 >= fullSetSize,
        });
      }

      return {
        ...opp,
        propertySets: oppSets,
      };
    });

    // 3. Add opponentCard to player
    const isWildcard =
      opponentCard.type === CardType.PROPERTY_WILDCARD ||
      (opponentCard.colors && opponentCard.colors.length > 1);

    if (isWildcard) {
      const targets = computeValidPropertyTargets(opponentCard, playerSets);
      set({
        activeForcedDeal: null,
        forcedDealMyCard: null,
        forcedDealTargetOpponentId: null,
        pendingStolenCardPlacement: { card: opponentCard, fromOpponentName: targetOpponent.name },
        validPropertyTargets: targets,
        tableState: {
          ...tableState,
          opponents: updatedOpponents,
          currentPlayer: {
            ...tableState.currentPlayer,
            propertySets: playerSets,
          },
          activeActionMessage: `🔄 «${forcedDealMyCard.name}» віддано! Картку «${opponentCard.name}» отримано. Оберіть набір або новий слот на своєму столі для її розміщення.`,
        },
      });
    } else {
      const targets = computeValidPropertyTargets(opponentCard, playerSets);
      const existingTarget = targets.find((t) => t.type === 'existing');

      if (existingTarget && existingTarget.type === 'existing') {
        const targetSet = playerSets[existingTarget.setIndex];
        const updatedCards = [...targetSet.cards, opponentCard];
        const fullSetSize = opponentCard.fullSetSize || PROPERTY_CONFIG[targetSet.color]?.setSize || 3;
        playerSets[existingTarget.setIndex] = {
          ...targetSet,
          cards: updatedCards,
          isComplete: updatedCards.length >= fullSetSize,
        };
      } else {
        const targetColor = opponentCard.colors?.[0] || CardColor.ORANGE;
        const fullSetSize = opponentCard.fullSetSize || PROPERTY_CONFIG[targetColor]?.setSize || 3;
        playerSets.push({
          color: targetColor,
          cards: [opponentCard],
          isComplete: 1 >= fullSetSize,
        });
      }

      set({
        activeForcedDeal: null,
        forcedDealMyCard: null,
        forcedDealTargetOpponentId: null,
        pendingStolenCardPlacement: null,
        tableState: {
          ...tableState,
          opponents: updatedOpponents,
          currentPlayer: {
            ...tableState.currentPlayer,
            propertySets: playerSets,
          },
          activeActionMessage: `🔄 Примусовий обмін завершено: ви віддали «${forcedDealMyCard.name}» та отримали «${opponentCard.name}» від ${targetOpponent.name}!`,
        },
      });
    }
  },

  selectDealBreakerOpponent: (opponentId: string) => {
    set({ dealBreakerTargetOpponentId: opponentId });
  },

  cancelDealBreakerOpponent: () => {
    set({ dealBreakerTargetOpponentId: null });
  },

  cancelDealBreaker: () => {
    set({
      activeDealBreaker: null,
      dealBreakerTargetOpponentId: null,
    });
  },

  executeDealBreaker: (targetOpponentId: string, setIndex: number) => {
    const { tableState } = get();
    const opponent = tableState.opponents.find((o) => o.id === targetOpponentId);
    if (!opponent || !opponent.propertySets[setIndex]) return;

    const stolenSet = opponent.propertySets[setIndex];
    if (!stolenSet.isComplete) return;

    // Remove the entire completed set from the opponent
    const updatedOpponents = tableState.opponents.map((opp) => {
      if (opp.id !== targetOpponentId) return opp;
      const updatedSets = opp.propertySets.filter((_, idx) => idx !== setIndex);
      return {
        ...opp,
        propertySets: updatedSets,
      };
    });

    // Add the entire completed set to current player
    const updatedMySets = [...tableState.currentPlayer.propertySets, stolenSet];

    set({
      activeDealBreaker: null,
      dealBreakerTargetOpponentId: null,
      tableState: {
        ...tableState,
        opponents: updatedOpponents,
        currentPlayer: {
          ...tableState.currentPlayer,
          propertySets: updatedMySets,
        },
        activeActionMessage: `⚡ «Зривник угод»: ви захопили повний комплект (${stolenSet.color.replace('_', ' ')}) у ${opponent.name}!`,
      },
    });
  },

  executeOpponentPayment: (targetOpponentId: string) => {
    const { activeMoneyDemand, tableState } = get();
    if (!activeMoneyDemand) return;

    const targetOpponent = tableState.opponents.find((o) => o.id === targetOpponentId);
    if (!targetOpponent) return;

    const { paidCards, updatedPayer, totalPaid } = settlePaymentFromPlayer(
      targetOpponent,
      activeMoneyDemand.amount
    );

    const updatedOpponents = tableState.opponents.map((o) =>
      o.id === targetOpponentId ? updatedPayer : o
    );

    const colorInfo = activeMoneyDemand.color
      ? ` (${activeMoneyDemand.color.replace('_', ' ')})`
      : '';

    set({
      activeMoneyDemand: null,
      tableState: {
        ...tableState,
        activeActionMessage: `${targetOpponent.name} заплатив(ла) $${totalPaid}${colorInfo} за карткою ${activeMoneyDemand.card.name}!`,
        opponents: updatedOpponents,
        currentPlayer: {
          ...tableState.currentPlayer,
          bankCards: [...paidCards, ...tableState.currentPlayer.bankCards],
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
      activeMoneyDemand: null,
      pendingDoubleRent: null,
      activeSlyDeal: null,
      slyDealTargetOpponentId: null,
      activeForcedDeal: null,
      forcedDealMyCard: null,
      forcedDealTargetOpponentId: null,
      activeDealBreaker: null,
      dealBreakerTargetOpponentId: null,
      pendingStolenCardPlacement: null,
      incomingAction: null,
      incomingDebt: null,
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
      validPropertyTargets: [],
      tableMovingCard: null,
      activeMoneyDemand: null,
      pendingDoubleRent: null,
      activeSlyDeal: null,
      slyDealTargetOpponentId: null,
      activeForcedDeal: null,
      forcedDealMyCard: null,
      forcedDealTargetOpponentId: null,
      activeDealBreaker: null,
      dealBreakerTargetOpponentId: null,
      pendingStolenCardPlacement: null,
      incomingAction: null,
      incomingDebt: null,
    });
  },

  simulateIncomingAction: (type = 'sly_deal') => {
    const { tableState } = get();
    const elena = tableState.opponents.find((o) => o.id === 'player_elena') || tableState.opponents[0];
    const attackerName = elena ? elena.name : 'Elena';
    const attackerId = elena ? elena.id : 'player_elena';

    if (type === 'deal_breaker') {
      const completeSetIndex = tableState.currentPlayer.propertySets.findIndex((s) => s.isComplete);
      const setIndex = completeSetIndex !== -1 ? completeSetIndex : 0;
      const targetSet = tableState.currentPlayer.propertySets[setIndex];

      set({
        incomingDebt: null,
        incomingAction: {
          type: 'deal_breaker',
          attackerId,
          attackerName,
          actionCard: getCard('action_deal_breaker_1'),
          stolenSetIndex: setIndex,
          stolenSet: targetSet,
        },
        tableState: {
          ...tableState,
          activeActionCard: getCard('action_deal_breaker_1'),
          activeActionMessage: `${attackerName} грає «Зривник угод» проти вас!`,
        },
      });
    } else if (type === 'forced_deal') {
      const incompleteSetIndex = tableState.currentPlayer.propertySets.findIndex((s) => !s.isComplete && s.cards.length > 0);
      const setIndex = incompleteSetIndex !== -1 ? incompleteSetIndex : 0;
      const myCard = tableState.currentPlayer.propertySets[setIndex]?.cards[0] || getCard('prop_pink_1');
      const opponentCard = elena?.propertySets[0]?.cards[0] || getCard('prop_maroon_1');

      set({
        incomingDebt: null,
        incomingAction: {
          type: 'forced_deal',
          attackerId,
          attackerName,
          actionCard: getCard('action_forced_deal_1'),
          myTargetCard: myCard,
          myTargetCardSetIndex: setIndex,
          theirCard: opponentCard,
        },
        tableState: {
          ...tableState,
          activeActionCard: getCard('action_forced_deal_1'),
          activeActionMessage: `${attackerName} грає «Примусовий обмін» проти вас!`,
        },
      });
    } else {
      // Default: Sly Deal
      const incompleteSetIndex = tableState.currentPlayer.propertySets.findIndex((s) => !s.isComplete && s.cards.length > 0);
      const setIndex = incompleteSetIndex !== -1 ? incompleteSetIndex : 0;
      const targetSet = tableState.currentPlayer.propertySets[setIndex];
      const targetCard = targetSet?.cards[0] || getCard('prop_pink_1');

      set({
        incomingDebt: null,
        incomingAction: {
          type: 'sly_deal',
          attackerId,
          attackerName,
          actionCard: getCard('action_sly_deal_1'),
          stolenCard: targetCard,
          stolenCardSetIndex: setIndex,
        },
        tableState: {
          ...tableState,
          activeActionCard: getCard('action_sly_deal_1'),
          activeActionMessage: `${attackerName} грає «Спритна оборудка» проти вас!`,
        },
      });
    }
  },

  simulateIncomingDebt: (amount = 5, reason = 'Оренда (Темно-синій)') => {
    const { tableState } = get();
    const elena = tableState.opponents.find((o) => o.id === 'player_elena') || tableState.opponents[0];
    const attackerName = elena ? elena.name : 'Elena';
    const attackerId = elena ? elena.id : 'player_elena';

    set({
      incomingAction: null,
      incomingDebt: {
        attackerId,
        attackerName,
        actionCard: getCard('rent_darkblue_purple_1'),
        amount,
        reason,
      },
      tableState: {
        ...tableState,
        activeActionCard: getCard('rent_darkblue_purple_1'),
        activeActionMessage: `${attackerName} вимагає сплатити $${amount} (${reason})!`,
      },
    });
  },

  cancelWithJustSayNo: () => {
    const { tableState, incomingAction, incomingDebt } = get();
    const hand = tableState.currentPlayer.handCards || [];
    const justSayNoIndex = hand.findIndex(
      (c) => c.actionType === ActionCardType.JUST_SAY_NO || c.id.startsWith('action_just_say_no')
    );

    if (justSayNoIndex === -1) return;

    const justSayNoCard = hand[justSayNoIndex];
    const updatedHand = hand.filter((_, idx) => idx !== justSayNoIndex);

    const opponentName = incomingAction?.attackerName || incomingDebt?.attackerName || 'Суперника';
    const msg = `🚫 Ви зіграли «Ні!» та заблокували дію ${opponentName}!`;

    set({
      incomingAction: null,
      incomingDebt: null,
      tableState: {
        ...tableState,
        currentPlayer: {
          ...tableState.currentPlayer,
          handCards: updatedHand,
          handCount: updatedHand.length,
        },
        activeActionCard: justSayNoCard,
        activeActionMessage: msg,
      },
    });
  },

  acceptIncomingAction: () => {
    const { tableState, incomingAction } = get();
    if (!incomingAction) return;

    const { type, attackerId, attackerName } = incomingAction;
    let newCurrentPlayer = { ...tableState.currentPlayer };
    let newOpponents = [...tableState.opponents];
    let msg = `Вимогу суперника ${attackerName} прийнято.`;

    if (type === 'sly_deal' && incomingAction.stolenCard && incomingAction.stolenCardSetIndex !== undefined) {
      const cardToSteal = incomingAction.stolenCard;
      const setIdx = incomingAction.stolenCardSetIndex;

      const updatedSets = newCurrentPlayer.propertySets.map((s, idx) => {
        if (idx !== setIdx) return s;
        const filteredCards = s.cards.filter((c) => c.id !== cardToSteal.id);
        return {
          ...s,
          cards: filteredCards,
          isComplete: false,
        };
      }).filter((s) => s.cards.length > 0);

      newCurrentPlayer = {
        ...newCurrentPlayer,
        propertySets: updatedSets,
      };

      newOpponents = newOpponents.map((opp) => {
        if (opp.id !== attackerId) return opp;
        const cardColor = cardToSteal.colors?.[0] || CardColor.PINK;
        const matchingSet = opp.propertySets.find((s) => s.color === cardColor && !s.isComplete);
        let updatedOppSets = [...opp.propertySets];
        if (matchingSet) {
          updatedOppSets = opp.propertySets.map((s) =>
            s === matchingSet ? { ...s, cards: [...s.cards, cardToSteal] } : s
          );
        } else {
          updatedOppSets.push({
            color: cardColor,
            cards: [cardToSteal],
            isComplete: false,
          });
        }
        return {
          ...opp,
          propertySets: updatedOppSets,
        };
      });

      msg = `${attackerName} викрав «${cardToSteal.name}»!`;
    } else if (type === 'deal_breaker' && incomingAction.stolenSetIndex !== undefined) {
      const setIdx = incomingAction.stolenSetIndex;
      const setObj = newCurrentPlayer.propertySets[setIdx] || incomingAction.stolenSet;

      if (setObj) {
        const updatedSets = newCurrentPlayer.propertySets.filter((_, idx) => idx !== setIdx);
        newCurrentPlayer = {
          ...newCurrentPlayer,
          propertySets: updatedSets,
        };

        newOpponents = newOpponents.map((opp) => {
          if (opp.id !== attackerId) return opp;
          return {
            ...opp,
            propertySets: [...opp.propertySets, setObj],
          };
        });

        msg = `${attackerName} захопив вашу монополію «${setObj.color}»!`;
      }
    } else if (type === 'forced_deal' && incomingAction.myTargetCard && incomingAction.theirCard) {
      const myCard = incomingAction.myTargetCard;
      const theirCard = incomingAction.theirCard;
      const mySetIdx = incomingAction.myTargetCardSetIndex ?? 0;

      const updatedMySets = newCurrentPlayer.propertySets.map((s, idx) => {
        if (idx !== mySetIdx) return s;
        const filtered = s.cards.filter((c) => c.id !== myCard.id);
        return { ...s, cards: filtered, isComplete: false };
      }).filter((s) => s.cards.length > 0);

      const theirColor = theirCard.colors?.[0] || CardColor.PINK;
      const matchingMySet = updatedMySets.find((s) => s.color === theirColor && !s.isComplete);
      if (matchingMySet) {
        matchingMySet.cards.push(theirCard);
      } else {
        updatedMySets.push({ color: theirColor, cards: [theirCard], isComplete: false });
      }

      newCurrentPlayer = { ...newCurrentPlayer, propertySets: updatedMySets };

      newOpponents = newOpponents.map((opp) => {
        if (opp.id !== attackerId) return opp;
        const updatedOppSets = opp.propertySets.map((s) => {
          const filtered = s.cards.filter((c) => c.id !== theirCard.id);
          return { ...s, cards: filtered, isComplete: false };
        }).filter((s) => s.cards.length > 0);

        const myColor = myCard.colors?.[0] || CardColor.PINK;
        const matchingOppSet = updatedOppSets.find((s) => s.color === myColor && !s.isComplete);
        if (matchingOppSet) {
          matchingOppSet.cards.push(myCard);
        } else {
          updatedOppSets.push({ color: myColor, cards: [myCard], isComplete: false });
        }
        return { ...opp, propertySets: updatedOppSets };
      });

      msg = `Обмін з ${attackerName} завершено: ви віддали «${myCard.name}», отримали «${theirCard.name}».`;
    }

    set({
      incomingAction: null,
      tableState: {
        ...tableState,
        currentPlayer: newCurrentPlayer,
        opponents: newOpponents,
        activeActionMessage: msg,
      },
    });
  },

  payIncomingDebt: (selectedCards: CardModel[]) => {
    const { tableState, incomingDebt } = get();
    if (!incomingDebt) return;

    const selectedCardIds = new Set(selectedCards.map((c) => c.id));
    const remainingBank = tableState.currentPlayer.bankCards.filter((c) => !selectedCardIds.has(c.id));
    const totalPaid = selectedCards.reduce((acc, c) => acc + (c.value || 0), 0);

    const updatedOpponents = tableState.opponents.map((opp) => {
      if (opp.id !== incomingDebt.attackerId) return opp;
      return {
        ...opp,
        bankCards: [...opp.bankCards, ...selectedCards],
      };
    });

    set({
      incomingDebt: null,
      tableState: {
        ...tableState,
        currentPlayer: {
          ...tableState.currentPlayer,
          bankCards: remainingBank,
        },
        opponents: updatedOpponents,
        activeActionMessage: `Ви сплатили $${totalPaid} для ${incomingDebt.attackerName}.`,
      },
    });
  },

  dismissDefenseModal: () => {
    set({ incomingAction: null, incomingDebt: null });
  },
}));
