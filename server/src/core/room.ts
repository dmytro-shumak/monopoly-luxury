import type { GameState, PropertySet } from "../models/types.js";
import { CardType, CardColor, BuildingType } from "../models/types.js";
import { DeckManager } from "./deck.js";
import { CARDS_DICTIONARY } from "./cards.js";

const DISCONNECT_TIMEOUT_MS = 5 * 60 * 1000;
const REACTION_TIMEOUT_MS = 15 * 1000;
const DEBT_TIMEOUT_MS = 60 * 1000;

export class GameRoom {
  public state: GameState;
  private deckManager: DeckManager;
  private disconnectTimers: Record<string, NodeJS.Timeout> = {};
  private gameTimers: Record<string, NodeJS.Timeout> = {};
  private onStateChange: () => void;

  constructor(roomId: string, onStateChange: () => void = () => {}) {
    this.deckManager = new DeckManager();
    this.onStateChange = onStateChange;
    this.state = {
      roomId,
      status: "LOBBY",
      hostId: null,
      activePlayerId: null,
      players: {},
      playerOrder: [],
      deckCount: this.deckManager.getDrawPileCount(),
      discardPile: [],
      activeTimer: null,
      
      actionQueue: [],
      currentAction: null,
      
      debtQueue: [],
      currentDebt: null,
      
      winnerId: null,
    };
  }

  private notify() {
    this.onStateChange();
  }

  // --- LOBBY & CONNECTION LOGIC ---

  public join(sessionId: string, name: string): { success: boolean; playerId?: string; error?: string } {
    const existingPlayer = Object.values(this.state.players).find(p => p.sessionId === sessionId);
    if (existingPlayer) return { success: true, playerId: existingPlayer.id };
    if (this.state.status !== "LOBBY") return { success: false, error: "Game in progress" };
    if (Object.keys(this.state.players).length >= 4) return { success: false, error: "Room full (max 4 players)" };

    const playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
    this.state.players[playerId] = {
      id: playerId, sessionId, name, isConnected: true,
      hand: [], bank: [], table: [], actionsRemaining: 0,
    };
    this.state.playerOrder.push(playerId);
    
    // First player to join becomes host
    if (this.state.hostId === null) {
      this.state.hostId = playerId;
    }
    
    this.notify();
    return { success: true, playerId };
  }

  public connectPlayer(playerId: string) {
    const player = this.state.players[playerId];
    if (player) {
      player.isConnected = true;
      if (this.disconnectTimers[playerId]) {
        clearTimeout(this.disconnectTimers[playerId]);
        delete this.disconnectTimers[playerId];
      }
      this.notify();
    }
  }

  public disconnectPlayer(playerId: string) {
    const player = this.state.players[playerId];
    if (player) {
      player.isConnected = false;
      this.disconnectTimers[playerId] = setTimeout(() => this.handlePlayerAbandon(playerId), DISCONNECT_TIMEOUT_MS);
      this.notify();
    }
  }

  private handlePlayerAbandon(playerId: string) {
    if (this.state.status === "LOBBY") {
      delete this.state.players[playerId];
      this.state.playerOrder = this.state.playerOrder.filter(id => id !== playerId);
    } else {
      // Just mark as game over for now
      this.state.status = "GAME_OVER";
    }
    this.notify();
  }

  // --- TIMERS ---

  private startTimer(durationMs: number, type: "REACTION" | "DEBT", targetId: string, callback: () => void) {
    this.clearActiveTimer();
    this.state.activeTimer = { type, targetPlayerId: targetId, durationMs, expiresAt: Date.now() + durationMs };
    this.notify();
    this.gameTimers["main"] = setTimeout(() => {
      this.state.activeTimer = null;
      callback();
      this.notify();
    }, durationMs);
  }

  private clearActiveTimer() {
    if (this.gameTimers["main"]) {
      clearTimeout(this.gameTimers["main"]);
      delete this.gameTimers["main"];
    }
    this.state.activeTimer = null;
  }

  // --- CORE GAME LOOP ---

  public startGame(playerId: string): { success: boolean; error?: string } {
    if (this.state.status !== "LOBBY") return { success: false, error: "Already started" };
    if (this.state.hostId !== playerId) return { success: false, error: "Only the host can start the game" };
    if (this.state.playerOrder.length < 2) return { success: false, error: "Not enough players" };

    this.deckManager.initDeck();
    for (const playerId of this.state.playerOrder) {
      this.state.players[playerId]!.hand = this.deckManager.drawCards(5);
    }

    this.state.activePlayerId = this.state.playerOrder[0] ?? null;
    this.startTurn(); // calls notify
    return { success: true };
  }

  public startTurn() {
    if (!this.state.activePlayerId || this.state.status === "GAME_OVER") return;
    this.state.status = "TURN_START";
    const player = this.state.players[this.state.activePlayerId];
    if (player) {
      player.hand.push(...this.deckManager.drawCards(2));
      this.state.status = "ACTION_PHASE";
      player.actionsRemaining = 3;
    }
    this.updateDeckCount();
    this.notify();
  }

  public endTurn(playerId: string): { success: boolean; error?: string } {
    if (this.state.activePlayerId !== playerId) return { success: false, error: "Not your turn" };
    if (this.state.status !== "ACTION_PHASE") return { success: false, error: "Wrong phase" };

    const player = this.state.players[playerId];
    if (player && player.hand.length > 7) {
      this.state.status = "DISCARD_PHASE";
      this.notify();
      return { success: true };
    }

    this.passTurnToNextPlayer();
    return { success: true };
  }

  public discardExcess(playerId: string, cardIds: string[]): { success: boolean; error?: string } {
    if (this.state.status !== "DISCARD_PHASE" || this.state.activePlayerId !== playerId) return { success: false, error: "Not allowed" };
    const player = this.state.players[playerId];
    if (!player) return { success: false, error: "No player" };
    
    if (player.hand.length - cardIds.length > 7) return { success: false, error: "Must discard more cards" };

    for (const cardId of cardIds) {
      const idx = player.hand.indexOf(cardId);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        this.discardCard(cardId);
      }
    }
    this.passTurnToNextPlayer();
    return { success: true };
  }

  private passTurnToNextPlayer() {
    const currentIndex = this.state.playerOrder.indexOf(this.state.activePlayerId!);
    const nextIndex = (currentIndex + 1) % this.state.playerOrder.length;
    this.state.activePlayerId = this.state.playerOrder[nextIndex] ?? null;
    this.startTurn();
  }

  private discardCard(cardId: string) {
    this.state.discardPile.unshift(cardId);
    this.deckManager.discard([cardId]);
  }

  private updateDeckCount() {
    this.state.deckCount = this.deckManager.getDrawPileCount();
  }

  // --- WIN CONDITION ---

  private checkWinCondition() {
    if (this.state.status === "GAME_OVER") return;

    for (const [playerId, player] of Object.entries(this.state.players)) {
      let completeSets = 0;
      const seenColors = new Set<CardColor>();

      for (const set of player.table) {
        if (set.isComplete && !seenColors.has(set.color)) {
          completeSets++;
          seenColors.add(set.color);
        }
      }

      if (completeSets >= 3) {
        this.state.status = "GAME_OVER";
        this.state.winnerId = playerId;
        this.clearActiveTimer();
        this.notify();
        return;
      }
    }
  }

  // --- PLAY CARD & ACTIONS ---

  public playCard(playerId: string, cardId: string, options?: { targetId?: string; propertyColor?: string; payload?: any }): { success: boolean; error?: string } {
    if (this.state.activePlayerId !== playerId) return { success: false, error: "Not your turn" };
    if (this.state.status !== "ACTION_PHASE") return { success: false, error: "Wrong phase" };

    const player = this.state.players[playerId];
    if (!player) return { success: false, error: "Player not found" };
    if (player.actionsRemaining <= 0) return { success: false, error: "No actions left" };

    const handIndex = player.hand.indexOf(cardId);
    if (handIndex === -1) return { success: false, error: "Card not in hand" };

    const cardDef = CARDS_DICTIONARY[cardId];
    if (!cardDef) return { success: false, error: "Unknown card" };

    player.actionsRemaining -= 1;
    player.hand.splice(handIndex, 1);

    if (cardDef.type === CardType.MONEY) {
      player.bank.push(cardId);
    } else if (cardDef.type === CardType.PROPERTY || cardDef.type === CardType.PROPERTY_WILDCARD) {
      const color = options?.propertyColor ? (options.propertyColor as CardColor) : cardDef.colors?.[0]; 
      if (color) {
        let set = player.table.find(s => s.color === color && !s.isComplete);
        if (!set) {
          set = { color, cards: [], buildings: [], isComplete: false };
          player.table.push(set);
        }
        set.cards.push(cardId);
        this.updateSetCompletion(set);
      }
    } else if (cardDef.type === CardType.ACTION) {
      this.discardCard(cardId);

      // Handle Immediate Actions
      if (cardDef.id.includes("pass_go")) {
        player.hand.push(...this.deckManager.drawCards(2));
        this.updateDeckCount();
      } else if (cardDef.id.includes("birthday")) {
        // Queue actions for all other players
        for (const otherId of this.state.playerOrder) {
          if (otherId !== playerId) {
            this.state.actionQueue.push({
              initiatorId: playerId, targetId: otherId, cardId, actionType: "BIRTHDAY", cancelChain: []
            });
          }
        }
        this.processNextAction();
        return { success: true }; // processNextAction notifies
      } else if (cardDef.id.includes("debt_collector") && options?.targetId) {
        this.state.actionQueue.push({
          initiatorId: playerId, targetId: options.targetId, cardId, actionType: "DEBT_COLLECTOR", cancelChain: []
        });
        this.processNextAction();
        return { success: true };
      } else if (cardDef.id.includes("sly_deal") && options?.targetId) {
        this.state.actionQueue.push({
          initiatorId: playerId, targetId: options.targetId, cardId, actionType: "SLY_DEAL", cancelChain: [], payload: options.payload
        });
        this.processNextAction();
        return { success: true };
      } else if (cardDef.id.includes("deal_breaker") && options?.targetId) {
        this.state.actionQueue.push({
          initiatorId: playerId, targetId: options.targetId, cardId, actionType: "DEAL_BREAKER", cancelChain: [], payload: options.payload
        });
        this.processNextAction();
        return { success: true };
      } else if (cardDef.id.includes("forced_deal") && options?.targetId) {
        this.state.actionQueue.push({
          initiatorId: playerId, targetId: options.targetId, cardId, actionType: "FORCED_DEAL", cancelChain: [], payload: options.payload
        });
        this.processNextAction();
        return { success: true };
      } else if (cardDef.id.includes("rent") && options?.targetId && options?.propertyColor) {
        let amount = 0;
        const set = player.table.find(s => s.color === options.propertyColor);
        if (set) {
          // Base rent = number of property cards
          amount = set.cards.filter(c => CARDS_DICTIONARY[c]?.type === CardType.PROPERTY || CARDS_DICTIONARY[c]?.type === CardType.PROPERTY_WILDCARD).length;
          
          if (set.isComplete) {
            const hasHouse = set.cards.some(c => CARDS_DICTIONARY[c]?.isBuilding === BuildingType.HOUSE);
            const hasHotel = set.cards.some(c => CARDS_DICTIONARY[c]?.isBuilding === BuildingType.HOTEL);
            if (hasHouse) amount += 3;
            if (hasHotel) amount += 4;
          }
        }
        
        this.state.actionQueue.push({
          initiatorId: playerId, targetId: options.targetId, cardId, actionType: "RENT", cancelChain: [], payload: { amount }
        });
        this.processNextAction();
        return { success: true };
      }
    }

    this.checkWinCondition();
    this.notify();
    return { success: true };
  }

  private updateSetCompletion(set: PropertySet) {
    const rules: Record<string, number> = {
      [CardColor.PINK]: 4,
      [CardColor.ORANGE]: 3, [CardColor.BROWN]: 3, [CardColor.LIGHT_GREEN]: 3,
      [CardColor.PURPLE]: 3, [CardColor.DARK_BLUE]: 3, [CardColor.LIGHT_BLUE]: 3,
      [CardColor.GREEN]: 2, [CardColor.RED]: 2, [CardColor.MAROON]: 2,
      [CardColor.DARK_GREEN]: 2, [CardColor.DARK_MAROON]: 2,
    };
    const required = rules[set.color] || 99;
    
    let propCount = 0;
    for (const c of set.cards) {
      if (CARDS_DICTIONARY[c]?.type === CardType.PROPERTY || CARDS_DICTIONARY[c]?.type === CardType.PROPERTY_WILDCARD) {
        propCount++;
      }
    }
    
    set.isComplete = propCount >= required;
  }

  // --- QUEUE PROCESSING ---

  private processNextAction() {
    if (this.state.currentAction !== null || this.state.status === "GAME_OVER") return;

    const nextAction = this.state.actionQueue.shift();
    if (nextAction) {
      this.state.currentAction = nextAction;
      this.state.status = "REACTION_PHASE";
      this.startTimer(REACTION_TIMEOUT_MS, "REACTION", nextAction.targetId, () => {
        this.executePendingAction();
      });
    } else {
      // No more actions, return to action phase or check debts
      this.processNextDebt();
    }
    this.notify();
  }

  private processNextDebt() {
    if (this.state.currentDebt !== null || this.state.status === "GAME_OVER") return;

    const nextDebt = this.state.debtQueue.shift();
    if (nextDebt) {
      this.state.currentDebt = nextDebt;
      this.state.status = "DEBT_PAYMENT_PHASE";
      this.startTimer(DEBT_TIMEOUT_MS, "DEBT", nextDebt.debtorId, () => {
        this.state.status = "GAME_OVER"; // Auto lose
        this.notify();
      });
    } else {
      this.state.status = "ACTION_PHASE";
    }
    this.notify();
  }

  public reactJustSayNo(playerId: string, cardId: string): { success: boolean; error?: string } {
    if (this.state.status !== "REACTION_PHASE" || !this.state.currentAction) return { success: false, error: "Not in reaction phase" };

    const action = this.state.currentAction;
    
    // RULE: "Just Say No cannot be canceled"
    if (action.cancelChain.length > 0) {
      return { success: false, error: "Cannot cancel a Just Say No" };
    }

    if (playerId !== action.targetId) return { success: false, error: "Not your turn to react" };

    const player = this.state.players[playerId];
    if (!player) return { success: false, error: "Player not found" };

    const handIndex = player.hand.indexOf(cardId);
    if (handIndex === -1) return { success: false, error: "Card not in hand" };
    
    const cardDef = CARDS_DICTIONARY[cardId];
    if (!cardDef || !cardDef.id.includes("just_say_no")) return { success: false, error: "Not a Just Say No card" };

    player.hand.splice(handIndex, 1);
    this.discardCard(cardId);
    action.cancelChain.push(playerId);

    // It was canceled successfully. Execute immediately (which will do nothing because it's canceled)
    this.clearActiveTimer();
    this.executePendingAction(); // This handles moving to the next action
    
    return { success: true };
  }

  private executePendingAction() {
    const action = this.state.currentAction;
    this.state.currentAction = null;
    this.clearActiveTimer();

    if (action && action.cancelChain.length === 0) {
      // Execute the effect
      if (action.actionType === "BIRTHDAY") {
        this.state.debtQueue.push({ creditorId: action.initiatorId, debtorId: action.targetId, amount: 2, paidAmount: 0 });
      } else if (action.actionType === "DEBT_COLLECTOR") {
        this.state.debtQueue.push({ creditorId: action.initiatorId, debtorId: action.targetId, amount: 5, paidAmount: 0 });
      } else if (action.actionType === "SLY_DEAL") {
        // payload should have { targetCardId: string, propertyColor: CardColor }
        const target = this.state.players[action.targetId];
        const initiator = this.state.players[action.initiatorId];
        const payload = action.payload;
        if (target && initiator && payload && payload.targetCardId && payload.propertyColor) {
           const setIndex = target.table.findIndex(s => s.color === payload.propertyColor);
           if (setIndex !== -1 && !target.table[setIndex]!.isComplete) {
              const cIdx = target.table[setIndex]!.cards.indexOf(payload.targetCardId);
              if (cIdx !== -1) {
                 // Steal card
                 target.table[setIndex]!.cards.splice(cIdx, 1);
                 
                 // Add to initiator
                 let initSet = initiator.table.find(s => s.color === payload.propertyColor && !s.isComplete);
                 if (!initSet) {
                   initSet = { color: payload.propertyColor, cards: [], buildings: [], isComplete: false };
                   initiator.table.push(initSet);
                 }
                 initSet.cards.push(payload.targetCardId);
                 this.updateSetCompletion(initSet);
              }
           }
        }
      } else if (action.actionType === "FORCED_DEAL") {
        // payload: { targetCardId: string, myCardId: string, propertyColor: CardColor, myPropertyColor: CardColor }
        const target = this.state.players[action.targetId];
        const initiator = this.state.players[action.initiatorId];
        const payload = action.payload;
        if (target && initiator && payload) {
           const targetSetIndex = target.table.findIndex(s => s.color === payload.propertyColor);
           const initSetIndex = initiator.table.findIndex(s => s.color === payload.myPropertyColor);
           if (targetSetIndex !== -1 && initSetIndex !== -1 && !target.table[targetSetIndex]!.isComplete && !initiator.table[initSetIndex]!.isComplete) {
              const targetCardIdx = target.table[targetSetIndex]!.cards.indexOf(payload.targetCardId);
              const initCardIdx = initiator.table[initSetIndex]!.cards.indexOf(payload.myCardId);
              if (targetCardIdx !== -1 && initCardIdx !== -1) {
                 // Remove from both
                 target.table[targetSetIndex]!.cards.splice(targetCardIdx, 1);
                 initiator.table[initSetIndex]!.cards.splice(initCardIdx, 1);
                 // Add target card to initiator
                 let newInitSet = initiator.table.find(s => s.color === payload.propertyColor && !s.isComplete);
                 if (!newInitSet) {
                   newInitSet = { color: payload.propertyColor, cards: [], buildings: [], isComplete: false };
                   initiator.table.push(newInitSet);
                 }
                 newInitSet.cards.push(payload.targetCardId);
                 this.updateSetCompletion(newInitSet);
                 // Add init card to target
                 let newTargetSet = target.table.find(s => s.color === payload.myPropertyColor && !s.isComplete);
                 if (!newTargetSet) {
                   newTargetSet = { color: payload.myPropertyColor, cards: [], buildings: [], isComplete: false };
                   target.table.push(newTargetSet);
                 }
                 newTargetSet.cards.push(payload.myCardId);
                 this.updateSetCompletion(newTargetSet);
              }
           }
        }
      } else if (action.actionType === "DEAL_BREAKER") {
        // payload: { propertyColor: CardColor }
        const target = this.state.players[action.targetId];
        const initiator = this.state.players[action.initiatorId];
        const payload = action.payload;
        if (target && initiator && payload) {
           const targetSetIndex = target.table.findIndex(s => s.color === payload.propertyColor && s.isComplete);
           if (targetSetIndex !== -1) {
              // Steal entire set
              const stolenSet = target.table.splice(targetSetIndex, 1)[0]!;
              initiator.table.push(stolenSet);
           }
        }
      } else if (action.actionType === "RENT" || action.actionType === "DOUBLE_RENT") {
        // payload: { amount: number }
        const amount = action.payload?.amount || 1;
        this.state.debtQueue.push({ creditorId: action.initiatorId, debtorId: action.targetId, amount, paidAmount: 0 });
      }
    }

    this.checkWinCondition();
    this.processNextAction(); // Moves to next action or next debt
  }

  // --- DEBT PAYMENTS ---

  public payDebt(playerId: string, assetIds: string[]): { success: boolean; error?: string } {
    if (this.state.status !== "DEBT_PAYMENT_PHASE" || !this.state.currentDebt) return { success: false, error: "Not in debt phase" };
    if (this.state.currentDebt.debtorId !== playerId) return { success: false, error: "Not your debt" };

    const debtor = this.state.players[playerId];
    const creditor = this.state.players[this.state.currentDebt.creditorId];
    if (!debtor || !creditor) return { success: false, error: "Invalid players" };

    let totalValue = 0;
    const assetsToRemove: { source: "BANK" | "TABLE", id: string, setIndex?: number }[] = [];

    // Calculate value and verify ownership
    for (const assetId of assetIds) {
      const cardDef = CARDS_DICTIONARY[assetId];
      if (!cardDef || cardDef.value === undefined) return { success: false, error: `Invalid asset ${assetId}` };
      
      const inBank = debtor.bank.includes(assetId);
      if (inBank) {
        totalValue += cardDef.value;
        assetsToRemove.push({ source: "BANK", id: assetId });
        continue;
      }

      let foundOnTable = false;
      for (let i = 0; i < debtor.table.length; i++) {
        if (debtor.table[i]!.cards.includes(assetId)) {
          totalValue += cardDef.value;
          assetsToRemove.push({ source: "TABLE", id: assetId, setIndex: i });
          foundOnTable = true;
          break;
        }
      }

      if (!foundOnTable) return { success: false, error: `You don't own ${assetId}` };
    }

    // Strict Payment Hierarchy Check
    // 1. Bank Money MUST be exhausted before Free Properties
    // 2. Free Properties MUST be exhausted before Monopolies
    const usingMonopoly = assetsToRemove.some(a => a.source === "TABLE" && debtor.table[a.setIndex!]!.isComplete);
    const usingFreeProp = assetsToRemove.some(a => a.source === "TABLE" && !debtor.table[a.setIndex!]!.isComplete);
    const bankRemainingValue = debtor.bank.filter(id => !assetIds.includes(id)).reduce((acc, id) => acc + (CARDS_DICTIONARY[id]?.value || 0), 0);
    const freePropsRemaining = debtor.table.filter(s => !s.isComplete).flatMap(s => s.cards).filter(id => !assetIds.includes(id));
    
    if (totalValue < this.state.currentDebt.amount) {
       // debt forgiveness is possible if nothing remains, checked later
    } else {
       if (usingFreeProp && bankRemainingValue > 0) {
           // We are paying with free prop, but we still have bank money!
           // This is only allowed if the bank money is not enough to cover the debt alone.
           // Actually, the rule is "Bank -> Free Props". If Bank can cover it, use Bank.
           // If we selected free props, check if we could have satisfied it with Bank.
           // This is complex to calculate optimally. Let's enforce: you can't use Table if Bank alone can pay it.
           const selectedBankValue = assetsToRemove.filter(a => a.source === "BANK").reduce((acc, a) => acc + (CARDS_DICTIONARY[a.id]?.value || 0), 0);
           if (selectedBankValue + bankRemainingValue >= this.state.currentDebt.amount && usingFreeProp) {
               return { success: false, error: "Must use bank money first" };
           }
       }
       if (usingMonopoly && freePropsRemaining.length > 0) {
           // Can't break monopoly if we have free props
           return { success: false, error: "Must use free properties before breaking monopolies" };
       }
    }

    // Debt forgiveness check: if value < amount, ensure they have NOTHING else
    if (totalValue < this.state.currentDebt.amount) {
      const remainingBank = debtor.bank.filter(id => !assetIds.includes(id));
      const remainingTable = debtor.table.flatMap(s => s.cards).filter(id => !assetIds.includes(id));
      if (remainingBank.length > 0 || remainingTable.length > 0) {
        return { success: false, error: "Must pay full amount if you have assets" };
      }
    }

    // Execute transfer & Building destruction
    for (const asset of assetsToRemove) {
      if (asset.source === "BANK") {
        debtor.bank = debtor.bank.filter(id => id !== asset.id);
        creditor.bank.push(asset.id);
      } else if (asset.source === "TABLE" && asset.setIndex !== undefined) {
        const set = debtor.table[asset.setIndex]!;
        
        // Building destruction rule
        if (set.isComplete) {
           // If monopoly broken, discard buildings
           const hasBuildings = set.cards.some(id => CARDS_DICTIONARY[id]?.isBuilding);
           if (hasBuildings) {
               // We don't track building card IDs in `buildings` array currently, we should fix this if needed.
               // Actually, buildings are just cards in `set.cards` with `isBuilding`.
                   const buildingCards = set.cards.filter(id => CARDS_DICTIONARY[id]?.isBuilding);
                   for (const bc of buildingCards) {
                      this.discardCard(bc);
                      set.cards = set.cards.filter(id => id !== bc);
                   }
               set.buildings = [];
           }
        }

        set.cards = set.cards.filter(id => id !== asset.id);
        this.updateSetCompletion(set);
        
        // Add to creditor's table (lazy: match color if available)
        const color = set.color; // Keep the same color
        let creditorSet = creditor.table.find(s => s.color === color && !s.isComplete);
        if (!creditorSet) {
          creditorSet = { color, cards: [], buildings: [], isComplete: false };
          creditor.table.push(creditorSet);
        }
        creditorSet.cards.push(asset.id);
        this.updateSetCompletion(creditorSet);
      }
    }

    this.clearActiveTimer();
    this.state.currentDebt = null;
    
    this.checkWinCondition();
    this.processNextDebt();
    
    return { success: true };
  }
}
