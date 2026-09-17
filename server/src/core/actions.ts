import { CARDS_DICTIONARY } from "./cards.js";
import { ActionCardType, CardColor, BuildingType, CardType } from "../models/types.js";
import type { PendingAction, IGameRoom } from "../models/types.js";

export function playActionCard(room: IGameRoom, playerId: string, cardId: string, options?: { targetId?: string; propertyColor?: string; payload?: any; modifierCardId?: string; targetSetCardId?: string }): { success: boolean; error?: string; effect?: () => void; actionsToDeduct?: number; modIndex?: number } {
  const cardDef = CARDS_DICTIONARY[cardId];
  if (!cardDef) return { success: false, error: "Invalid card" };

  const player = room.state.players[playerId];
  if (!player) return { success: false, error: "Player not found" };

  const actionType = cardDef.actionType;
  if (!actionType) return { success: false, error: "Not an action card" };

  if (options?.targetId && options.targetId === playerId) {
    return { success: false, error: "Cannot target yourself" };
  }

  let effect: () => void = () => {};

  switch (actionType) {
    case ActionCardType.PASS_GO:
      effect = () => {
        room.discardCard(cardId);
        player.hand.push(...room.drawCardsFromDeck(2));
        room.updateDeckCount();
      };
      break;

    case ActionCardType.BIRTHDAY:
      effect = () => {
        room.discardCard(cardId);
        for (const otherId of room.state.playerOrder) {
          if (otherId !== playerId) {
            room.state.debtQueue.push({ creditorId: playerId, debtorId: otherId, amount: 2, paidAmount: 0 });
          }
        }
        room.processNextAction();
      };
      break;

    case ActionCardType.DEBT_COLLECTOR:
      if (!options?.targetId) return { success: false, error: "Missing required options for this action" };
      effect = () => {
        room.discardCard(cardId);
        room.state.debtQueue.push({ creditorId: playerId, debtorId: options.targetId!, amount: 5, paidAmount: 0 });
        room.processNextAction();
      };
      break;

    case ActionCardType.SLY_DEAL:
      if (!options?.targetId) return { success: false, error: "Missing required options for this action" };
      const targetSly = room.state.players[options.targetId];
      if (!targetSly) return { success: false, error: "Invalid target player" };
      if (!options.payload || !options.payload.targetCardId) return { success: false, error: "Missing payload" };
      if (CARDS_DICTIONARY[options.payload.targetCardId]?.isBuilding) return { success: false, error: "Cannot steal buildings directly" };
      
      const setIndex = targetSly.table.findIndex(s => s.cards.includes(options.payload!.targetCardId));
      if (setIndex === -1 || targetSly.table[setIndex]!.isComplete) return { success: false, error: "Invalid target property or set is complete" };

      effect = () => {
        room.discardCard(cardId);
        room.state.actionQueue.push({ initiatorId: playerId, targetId: options.targetId!, cardId, actionType: "SLY_DEAL", cancelChain: [], payload: options.payload });
        room.processNextAction();
      };
      break;

    case ActionCardType.DEAL_BREAKER:
      if (!options?.targetId) return { success: false, error: "Missing required options for this action" };
      const targetDb = room.state.players[options.targetId];
      if (!targetDb) return { success: false, error: "Invalid target player" };
      if (!options.payload || !options.payload.propertyColor) return { success: false, error: "Missing payload" };
      
      const dbSet = options.payload.targetSetCardId 
          ? targetDb.table.find(s => s.cards.includes(options.payload!.targetSetCardId) && s.isComplete)
          : targetDb.table.find(s => s.color === options.payload!.propertyColor && s.isComplete);
      if (!dbSet) return { success: false, error: "Target does not have a complete monopoly of this color" };

      effect = () => {
        room.discardCard(cardId);
        room.state.actionQueue.push({ initiatorId: playerId, targetId: options.targetId!, cardId, actionType: "DEAL_BREAKER", cancelChain: [], payload: options.payload });
        room.processNextAction();
      };
      break;

    case ActionCardType.FORCED_DEAL:
      if (!options?.targetId) return { success: false, error: "Missing required options for this action" };
      const targetFd = room.state.players[options.targetId];
      if (!targetFd) return { success: false, error: "Invalid target player" };
      if (!options.payload || !options.payload.targetCardId || !options.payload.myCardId) return { success: false, error: "Missing payload" };
      if (CARDS_DICTIONARY[options.payload.targetCardId]?.isBuilding || CARDS_DICTIONARY[options.payload.myCardId]?.isBuilding) return { success: false, error: "Cannot swap buildings" };
      
      const targetSetIndexFd = targetFd.table.findIndex(s => s.cards.includes(options.payload!.targetCardId));
      if (targetSetIndexFd === -1 || targetFd.table[targetSetIndexFd]!.isComplete) return { success: false, error: "Invalid target property" };
      
      const mySetIndexFd = player.table.findIndex(s => s.cards.includes(options.payload!.myCardId));
      if (mySetIndexFd === -1 || player.table[mySetIndexFd]!.isComplete) return { success: false, error: "Invalid offered property" };

      effect = () => {
        room.discardCard(cardId);
        room.state.actionQueue.push({ initiatorId: playerId, targetId: options.targetId!, cardId, actionType: "FORCED_DEAL", cancelChain: [], payload: options.payload });
        room.processNextAction();
      };
      break;

    case ActionCardType.DOUBLE_RENT:
      return { success: false, error: "Double Rent must be played alongside a Rent card" };

    case ActionCardType.RENT:
      if (!options?.targetId || !options?.propertyColor) return { success: false, error: "Missing required options for this action" };
      if (options.propertyColor === CardColor.ALL_COLOR) {
          return { success: false, error: "Cannot target ALL_COLOR for rent" };
      }
      if (!cardDef.colors?.includes(CardColor.ALL_COLOR) && !cardDef.colors?.includes(options.propertyColor as CardColor)) {
          return { success: false, error: "Rent card cannot be used for this color" };
      }
      
      const sets = player.table.filter(s => s.color === options.propertyColor);
      if (sets.length === 0) return { success: false, error: "You do not own any properties of this color" };
      
      let propertyCardCount = 0;
      let buildingBonus = 0;
      for (const set of sets) {
          propertyCardCount += set.cards.filter(c => CARDS_DICTIONARY[c]?.type === CardType.PROPERTY || CARDS_DICTIONARY[c]?.type === CardType.PROPERTY_WILDCARD).length;
          if (set.isComplete) {
            if (set.cards.some(c => CARDS_DICTIONARY[c]?.isBuilding === BuildingType.HOUSE)) buildingBonus += 3;
            if (set.cards.some(c => CARDS_DICTIONARY[c]?.isBuilding === BuildingType.HOTEL)) buildingBonus += 4;
          }
      }
      
      let multiplier = 1;
      if (options?.modifierCardId) {
          const modDef = CARDS_DICTIONARY[options.modifierCardId];
          if (modDef?.actionType === ActionCardType.DOUBLE_RENT) {
              multiplier = 2;
          }
      }

      const amount = (propertyCardCount + buildingBonus) * multiplier;
      
      effect = () => {
        room.discardCard(cardId);
        room.state.debtQueue.push({ creditorId: playerId, debtorId: options.targetId!, amount, paidAmount: 0 });
        room.processNextAction();
      };
      break;

    case ActionCardType.HOUSE:
    case ActionCardType.HOTEL:
      if (!options?.propertyColor && !options?.targetSetCardId) return { success: false, error: "Must specify color or target set to build on" };
      const set = options?.targetSetCardId
          ? player.table.find(s => s.cards.includes(options.targetSetCardId!) && s.isComplete)
          : player.table.find(s => s.color === options.propertyColor && s.isComplete);
      if (!set) return { success: false, error: "Must build on a complete monopoly" };
      
      const hasHouse = set.cards.some(c => CARDS_DICTIONARY[c]?.isBuilding === BuildingType.HOUSE);
      const hasHotel = set.cards.some(c => CARDS_DICTIONARY[c]?.isBuilding === BuildingType.HOTEL);
      
      if (actionType === ActionCardType.HOUSE && hasHouse) return { success: false, error: "Already has a house" };
      if (actionType === ActionCardType.HOTEL && (!hasHouse || hasHotel)) return { success: false, error: "Must have house first, and no hotel" };
      
      effect = () => { set.cards.push(cardId); };
      break;

    default:
      return { success: false, error: "Missing required options for this action" };
  }

  return { success: true, effect };
}

export function executePendingAction(room: IGameRoom, action: PendingAction) {
  switch (action.actionType) {
    case "SLY_DEAL": {
      const target = room.state.players[action.targetId];
      const initiator = room.state.players[action.initiatorId];
      const payload = action.payload;
      if (target && initiator && payload && payload.targetCardId) {
          if (CARDS_DICTIONARY[payload.targetCardId]?.isBuilding) return;
          const setIndex = target.table.findIndex(s => s.cards.includes(payload.targetCardId));
          if (setIndex !== -1 && !target.table[setIndex]!.isComplete) {
            const cIdx = target.table[setIndex]!.cards.indexOf(payload.targetCardId);
            if (cIdx !== -1) {
                const targetOldColor = target.table[setIndex]!.color;
                target.table[setIndex]!.cards.splice(cIdx, 1);
                if (target.table[setIndex]!.cards.length === 0) {
                  target.table.splice(setIndex, 1);
                } else {
                  room.updateSetCompletion(target.table[setIndex]!);
                }
                
                const stolenCardDef = CARDS_DICTIONARY[payload.targetCardId];
                let colorToAssign = payload.destinationColor;
                if (!colorToAssign || colorToAssign === CardColor.ALL_COLOR) {
                    colorToAssign = targetOldColor;
                } else if (stolenCardDef?.colors?.[0] !== CardColor.ALL_COLOR && !stolenCardDef?.colors?.includes(colorToAssign as CardColor)) {
                    colorToAssign = targetOldColor;
                }
                let initSet = initiator.table.find(s => s.color === colorToAssign && !s.isComplete);
                if (!initSet) {
                  initSet = { color: colorToAssign, cards: [], isComplete: false };
                  initiator.table.push(initSet);
                }
                initSet.cards.push(payload.targetCardId);
                room.updateSetCompletion(initSet);
            }
          }
      }
      break;
    }
    case "FORCED_DEAL": {
      const target = room.state.players[action.targetId];
      const initiator = room.state.players[action.initiatorId];
      const payload = action.payload;
      if (target && initiator && payload && payload.targetCardId && payload.myCardId) {
          if (CARDS_DICTIONARY[payload.targetCardId]?.isBuilding || CARDS_DICTIONARY[payload.myCardId]?.isBuilding) return;
          const targetSetIndex = target.table.findIndex(s => s.cards.includes(payload.targetCardId));
          const initSetIndex = initiator.table.findIndex(s => s.cards.includes(payload.myCardId));
          if (targetSetIndex !== -1 && initSetIndex !== -1 && !target.table[targetSetIndex]!.isComplete && !initiator.table[initSetIndex]!.isComplete) {
            const targetCardIdx = target.table[targetSetIndex]!.cards.indexOf(payload.targetCardId);
            const initCardIdx = initiator.table[initSetIndex]!.cards.indexOf(payload.myCardId);
            if (targetCardIdx !== -1 && initCardIdx !== -1) {
                const targetOldColor = target.table[targetSetIndex]!.color;
                const initOldColor = initiator.table[initSetIndex]!.color;
                target.table[targetSetIndex]!.cards.splice(targetCardIdx, 1);
                if (target.table[targetSetIndex]!.cards.length === 0) {
                  target.table.splice(targetSetIndex, 1);
                } else {
                  room.updateSetCompletion(target.table[targetSetIndex]!);
                }
                
                initiator.table[initSetIndex]!.cards.splice(initCardIdx, 1);
                if (initiator.table[initSetIndex]!.cards.length === 0) {
                  initiator.table.splice(initSetIndex, 1);
                } else {
                  room.updateSetCompletion(initiator.table[initSetIndex]!);
                }
                
                const targetCardDef = CARDS_DICTIONARY[payload.targetCardId];
                let initColorToAssign = payload.destinationColor;
                if (!initColorToAssign || initColorToAssign === CardColor.ALL_COLOR) {
                    initColorToAssign = targetOldColor;
                } else if (targetCardDef?.colors?.[0] !== CardColor.ALL_COLOR && !targetCardDef?.colors?.includes(initColorToAssign as CardColor)) {
                    initColorToAssign = targetOldColor;
                }
                let newInitSet = initiator.table.find(s => s.color === initColorToAssign && !s.isComplete);
                if (!newInitSet) {
                  newInitSet = { color: initColorToAssign, cards: [], isComplete: false };
                  initiator.table.push(newInitSet);
                }
                newInitSet.cards.push(payload.targetCardId);
                room.updateSetCompletion(newInitSet);
                
                const myCardDef = CARDS_DICTIONARY[payload.myCardId];
                let targetColorToAssign = payload.targetDestinationColor;
                if (!targetColorToAssign || targetColorToAssign === CardColor.ALL_COLOR) {
                    targetColorToAssign = initOldColor;
                } else if (myCardDef?.colors?.[0] !== CardColor.ALL_COLOR && !myCardDef?.colors?.includes(targetColorToAssign as CardColor)) {
                    targetColorToAssign = initOldColor;
                }
                let newTargetSet = target.table.find(s => s.color === targetColorToAssign && !s.isComplete);
                if (!newTargetSet) {
                  newTargetSet = { color: targetColorToAssign, cards: [], isComplete: false };
                  target.table.push(newTargetSet);
                }
                newTargetSet.cards.push(payload.myCardId);
                room.updateSetCompletion(newTargetSet);
            }
          }
      }
      break;
    }
    case "DEAL_BREAKER": {
      const target = room.state.players[action.targetId];
      const initiator = room.state.players[action.initiatorId];
      const payload = action.payload;
      if (target && initiator && payload && payload.propertyColor) {
          const dbSetIndex = payload.targetSetCardId 
              ? target.table.findIndex(s => s.cards.includes(payload.targetSetCardId) && s.isComplete)
              : target.table.findIndex(s => s.color === payload.propertyColor && s.isComplete);
          if (dbSetIndex !== -1) {
            const stolenSet = target.table.splice(dbSetIndex, 1)[0];
            if (stolenSet) {
                initiator.table.push(stolenSet);
            }
          }
      }
      break;
    }
  }
}
