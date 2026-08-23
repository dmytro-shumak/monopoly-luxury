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
      this.state.players[playerId]!.hand = this.drawCardsFromDeck(5);
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
      player.hand.push(...this.drawCardsFromDeck(2));
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
    
    const uniqueIds = new Set(cardIds);
    if (uniqueIds.size !== cardIds.length) return { success: false, error: "Duplicate card IDs provided" };
    
    for (const id of cardIds) {
      if (!player.hand.includes(id)) return { success: false, error: `Card not in hand` };
    }
    
    if (player.hand.length - cardIds.length !== 7) return { success: false, error: "Must discard exactly down to 7 cards" };

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
    this.state.discardPile.push(cardId);
  }

  private drawCardsFromDeck(count: number): string[] {
    const drawn: string[] = [];
    for (let i = 0; i < count; i++) {
      if (this.deckManager.getDrawPileCount() === 0) {
        if (this.state.discardPile.length > 0) {
          // Pass room discard pile to deckManager to reshuffle
          this.deckManager.discard([...this.state.discardPile]);
          this.state.discardPile = [];
        }
      }
      const c = this.deckManager.drawCards(1);
      if (c.length > 0) drawn.push(c[0]!);
    }
    return drawn;
  }

  private updateDeckCount() {
    // Legacy, not strictly needed anymore since drawCardsFromDeck handles it, but keeps state clean
  } // --- WIN CONDITION ---

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

    let actionsToDeduct = 1;
    let multiplier = 1;
    let modIndex = -1;

    if (options?.modifierCardId) {
      if (cardId === options.modifierCardId) return { success: false, error: "Cannot use the same card as both main and modifier" };
      modIndex = player.hand.indexOf(options.modifierCardId);
      if (modIndex === -1) return { success: false, error: "Modifier card not in hand" };
      
      const modDef = CARDS_DICTIONARY[options.modifierCardId];
      if (modDef?.id.includes("rent_double")) {
        if (!cardDef.id.includes("rent")) return { success: false, error: "Double Rent must be played with a Rent card" };
        if (player.actionsRemaining < 2) return { success: false, error: "Double Rent requires 2 actions" };
        actionsToDeduct = 2;
        multiplier = 2;
      }
    }

    if (player.actionsRemaining < actionsToDeduct) return { success: false, error: "Not enough actions left" };

    let effect: () => void = () => {};

    if (cardDef.type === CardType.MONEY) {
      effect = () => player.bank.push(cardId);
    } else if (cardDef.type === CardType.PROPERTY || cardDef.type === CardType.PROPERTY_WILDCARD) {
      if (cardDef.colors?.[0] === CardColor.ALL_COLOR && (!options?.propertyColor || options.propertyColor === CardColor.ALL_COLOR)) {
         return { success: false, error: "Must specify a color when playing an All-Color wildcard" };
      }
      const color = options?.propertyColor ? (options.propertyColor as CardColor) : cardDef.colors?.[0]; 
      if (!color) return { success: false, error: "No color available" };

      if (!cardDef.colors?.includes(color) && cardDef.colors?.[0] !== CardColor.ALL_COLOR) {
         return { success: false, error: "Property card cannot be played as this color" };
      }

      effect = () => {
        let set = player.table.find(s => s.color === color && !s.isComplete);
        if (!set) {
          set = { color, cards: [], isComplete: false };
          player.table.push(set);
        }
        set.cards.push(cardId);
        this.updateSetCompletion(set);
      };
    } else if (cardDef.type === CardType.ACTION) {
      if (cardDef.id.includes("pass_go")) {
        effect = () => {
          this.discardCard(cardId);
          player.hand.push(...this.drawCardsFromDeck(2));
          this.updateDeckCount();
        };
      } else if (cardDef.id.includes("birthday")) {
        effect = () => {
          this.discardCard(cardId);
          for (const otherId of this.state.playerOrder) {
            if (otherId !== playerId) {
              this.state.actionQueue.push({ initiatorId: playerId, targetId: otherId, cardId, actionType: "BIRTHDAY", cancelChain: [] });
            }
          }
          this.processNextAction();
        };
      } else if (cardDef.id.includes("debt_collector") && options?.targetId) {
        effect = () => {
          this.discardCard(cardId);
          this.state.actionQueue.push({ initiatorId: playerId, targetId: options.targetId!, cardId, actionType: "DEBT_COLLECTOR", cancelChain: [] });
          this.processNextAction();
        };
      } else if (cardDef.id.includes("sly_deal") && options?.targetId) {
        const target = this.state.players[options.targetId];
        if (!target) return { success: false, error: "Invalid target player" };
        const payload = options.payload;
        if (!payload || !payload.targetCardId) return { success: false, error: "Missing payload" };
        if (CARDS_DICTIONARY[payload.targetCardId]?.isBuilding) return { success: false, error: "Cannot steal buildings" };
        const setIndex = target.table.findIndex(s => s.cards.includes(payload.targetCardId));
        if (setIndex === -1) return { success: false, error: "Target does not have this property" };
        if (target.table[setIndex]!.isComplete) return { success: false, error: "Cannot steal from a complete monopoly" };

        effect = () => {
          this.discardCard(cardId);
          this.state.actionQueue.push({ initiatorId: playerId, targetId: options.targetId!, cardId, actionType: "SLY_DEAL", cancelChain: [], payload: options.payload });
          this.processNextAction();
        };
      } else if (cardDef.id.includes("deal_breaker") && options?.targetId) {
        const target = this.state.players[options.targetId];
        if (!target) return { success: false, error: "Invalid target player" };
        const payload = options.payload;
        if (!payload || !payload.propertyColor) return { success: false, error: "Missing payload" };
        const setIndex = payload.targetSetCardId
           ? target.table.findIndex(s => s.cards.includes(payload.targetSetCardId) && s.isComplete)
           : target.table.findIndex(s => s.color === payload.propertyColor && s.isComplete);
        if (setIndex === -1) return { success: false, error: "Target does not have a complete monopoly of this color" };

        effect = () => {
          this.discardCard(cardId);
          this.state.actionQueue.push({ initiatorId: playerId, targetId: options.targetId!, cardId, actionType: "DEAL_BREAKER", cancelChain: [], payload: options.payload });
          this.processNextAction();
        };
      } else if (cardDef.id.includes("forced_deal") && options?.targetId) {
        const target = this.state.players[options.targetId];
        if (!target) return { success: false, error: "Invalid target player" };
        const payload = options.payload;
        if (!payload || !payload.targetCardId || !payload.myCardId) return { success: false, error: "Missing payload" };
        if (CARDS_DICTIONARY[payload.targetCardId]?.isBuilding || CARDS_DICTIONARY[payload.myCardId]?.isBuilding) return { success: false, error: "Cannot swap buildings" };
        
        const targetSetIndex = target.table.findIndex(s => s.cards.includes(payload.targetCardId));
        if (targetSetIndex === -1 || target.table[targetSetIndex]!.isComplete) return { success: false, error: "Invalid target property" };
        
        const mySetIndex = player.table.findIndex(s => s.cards.includes(payload.myCardId));
        if (mySetIndex === -1 || player.table[mySetIndex]!.isComplete) return { success: false, error: "Invalid offered property" };

        effect = () => {
          this.discardCard(cardId);
          this.state.actionQueue.push({ initiatorId: playerId, targetId: options.targetId!, cardId, actionType: "FORCED_DEAL", cancelChain: [], payload: options.payload });
          this.processNextAction();
        };
      } else if (cardDef.id.includes("rent_double")) {
        return { success: false, error: "Double Rent must be played alongside a Rent card" };
      } else if (cardDef.id.includes("rent") && options?.targetId && options?.propertyColor) {
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
        
        const amount = (propertyCardCount + buildingBonus) * multiplier;
        
        effect = () => {
          this.discardCard(cardId);
          this.state.actionQueue.push({ initiatorId: playerId, targetId: options.targetId!, cardId, actionType: "RENT", cancelChain: [], payload: { amount } });
          this.processNextAction();
        };
      } else if (cardDef.id.includes("house") || cardDef.id.includes("hotel")) {
        if (!options?.propertyColor && !options?.targetSetCardId) return { success: false, error: "Must specify color or target set to build on" };
        const set = options?.targetSetCardId
           ? player.table.find(s => s.cards.includes(options.targetSetCardId!) && s.isComplete)
           : player.table.find(s => s.color === options.propertyColor && s.isComplete);
        if (!set) return { success: false, error: "Must build on a complete monopoly" };
        
        const hasHouse = set.cards.some(c => CARDS_DICTIONARY[c]?.isBuilding === BuildingType.HOUSE);
        const hasHotel = set.cards.some(c => CARDS_DICTIONARY[c]?.isBuilding === BuildingType.HOTEL);
        
        if (cardDef.id.includes("house") && hasHouse) return { success: false, error: "Already has a house" };
        if (cardDef.id.includes("hotel") && (!hasHouse || hasHotel)) return { success: false, error: "Must have house first, and no hotel" };
        
        effect = () => { set.cards.push(cardId); };
      } else {
         return { success: false, error: "Missing required options for this action" };
      }
    }

    player.actionsRemaining -= actionsToDeduct;
    if (modIndex !== -1 && options?.modifierCardId) {
      player.hand.splice(modIndex, 1);
      this.discardCard(options.modifierCardId);
    }
    const finalHandIndex = player.hand.indexOf(cardId);
    if (finalHandIndex !== -1) player.hand.splice(finalHandIndex, 1);
    
    effect();

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
    let standardCount = 0;
    for (const c of set.cards) {
      const d = CARDS_DICTIONARY[c];
      if (d?.type === CardType.PROPERTY || d?.type === CardType.PROPERTY_WILDCARD) {
        propCount++;
      }
      if (d?.type === CardType.PROPERTY || (d?.type === CardType.PROPERTY_WILDCARD && d?.colors?.[0] !== CardColor.ALL_COLOR)) {
        standardCount++;
      }
    }
    
    set.isComplete = propCount >= required && standardCount > 0;
  }

  public moveProperty(playerId: string, cardId: string, toColor: string): { success: boolean, error?: string } {
    if (this.state.activePlayerId !== playerId) return { success: false, error: "Not your turn" };
    if (this.state.status !== "ACTION_PHASE") return { success: false, error: "Wrong phase" };

    const player = this.state.players[playerId];
    if (!player) return { success: false, error: "Player not found" };

    // Find current set
    let currentSet: PropertySet | null = null;
    let cardIndex = -1;
    for (const s of player.table) {
      cardIndex = s.cards.indexOf(cardId);
      if (cardIndex !== -1) {
        currentSet = s;
        break;
      }
    }

    if (!currentSet || cardIndex === -1) return { success: false, error: "Card not on table" };
    if (currentSet.isComplete) return { success: false, error: "Cannot move cards from a complete monopoly (Color Lock)" };
    
    // Validate wildcard
    const cardDef = CARDS_DICTIONARY[cardId];
    if (!cardDef || cardDef.type !== CardType.PROPERTY_WILDCARD) return { success: false, error: "Only wildcards can be moved/changed" };
    if (!cardDef.colors?.includes(toColor as CardColor) && cardDef.colors?.[0] !== CardColor.ALL_COLOR) {
       return { success: false, error: "Wildcard cannot be this color" };
    }
    if (cardDef.colors?.[0] === CardColor.ALL_COLOR && currentSet.color !== toColor) {
       if (currentSet.color !== CardColor.ALL_COLOR) {
           return { success: false, error: "All-Color wildcard cannot change color once assigned" };
       }
    }

    // Changing color of 2-color wildcard costs 1 action
    const isTwoColor = cardDef.colors && cardDef.colors.length === 2;
    if (isTwoColor && currentSet.color !== toColor) {
       if (player.actionsRemaining <= 0) return { success: false, error: "No actions left to change color" };
       player.actionsRemaining -= 1;
    }

    currentSet.cards.splice(cardIndex, 1);
    this.updateSetCompletion(currentSet);

    let targetSet = player.table.find(s => s.color === toColor && !s.isComplete);
    if (!targetSet) {
      targetSet = { color: toColor as CardColor, cards: [], isComplete: false };
      player.table.push(targetSet);
    }
    targetSet.cards.push(cardId);
    this.updateSetCompletion(targetSet);
    
    this.checkWinCondition();
    this.notify();
    return { success: true };
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
        // payload should have { targetCardId: string, destinationColor?: CardColor }
        const target = this.state.players[action.targetId];
        const initiator = this.state.players[action.initiatorId];
        const payload = action.payload;
        if (target && initiator && payload && payload.targetCardId) {
           if (CARDS_DICTIONARY[payload.targetCardId]?.isBuilding) return;
           const setIndex = target.table.findIndex(s => s.cards.includes(payload.targetCardId));
           if (setIndex !== -1 && !target.table[setIndex]!.isComplete) {
              const cIdx = target.table[setIndex]!.cards.indexOf(payload.targetCardId);
              if (cIdx !== -1) {
                 // Steal card
                 target.table[setIndex]!.cards.splice(cIdx, 1);
                 
                 // Add to initiator
                 const stolenCardDef = CARDS_DICTIONARY[payload.targetCardId];
                 let colorToAssign = payload.destinationColor;
                 if (!colorToAssign) {
                     colorToAssign = stolenCardDef?.colors?.[0] === CardColor.ALL_COLOR ? CardColor.ALL_COLOR : target.table[setIndex]!.color;
                 }
                 let initSet = initiator.table.find(s => s.color === colorToAssign && !s.isComplete);
                 if (!initSet) {
                   initSet = { color: colorToAssign, cards: [], isComplete: false };
                   initiator.table.push(initSet);
                 }
                 initSet.cards.push(payload.targetCardId);
                 this.updateSetCompletion(initSet);
              }
           }
        }
      } else if (action.actionType === "FORCED_DEAL") {
        // payload: { targetCardId: string, myCardId: string, destinationColor?: CardColor, targetDestinationColor?: CardColor }
        const target = this.state.players[action.targetId];
        const initiator = this.state.players[action.initiatorId];
        const payload = action.payload;
        if (target && initiator && payload && payload.targetCardId && payload.myCardId) {
           if (CARDS_DICTIONARY[payload.targetCardId]?.isBuilding || CARDS_DICTIONARY[payload.myCardId]?.isBuilding) return;
           const targetSetIndex = target.table.findIndex(s => s.cards.includes(payload.targetCardId));
           const initSetIndex = initiator.table.findIndex(s => s.cards.includes(payload.myCardId));
           if (targetSetIndex !== -1 && initSetIndex !== -1 && !target.table[targetSetIndex]!.isComplete && !initiator.table[initSetIndex]!.isComplete) {
              const targetCardIdx = target.table[targetSetIndex]!.cards.indexOf(payload.targetCardId);
              const initCardIdx = initiator.table[initSetIndex]!.cards.indexOf(payload.myCardId);
              if (targetCardIdx !== -1 && initCardIdx !== -1) {
                 // Remove from both
                 const targetOldColor = target.table[targetSetIndex]!.color;
                 const initOldColor = initiator.table[initSetIndex]!.color;
                 target.table[targetSetIndex]!.cards.splice(targetCardIdx, 1);
                 initiator.table[initSetIndex]!.cards.splice(initCardIdx, 1);
                 
                 // Add target card to initiator
                 const targetCardDef = CARDS_DICTIONARY[payload.targetCardId];
                 let initColorToAssign = payload.destinationColor;
                 if (!initColorToAssign) {
                     initColorToAssign = targetCardDef?.colors?.[0] === CardColor.ALL_COLOR ? CardColor.ALL_COLOR : targetOldColor;
                 }
                 let newInitSet = initiator.table.find(s => s.color === initColorToAssign && !s.isComplete);
                 if (!newInitSet) {
                   newInitSet = { color: initColorToAssign, cards: [], isComplete: false };
                   initiator.table.push(newInitSet);
                 }
                 newInitSet.cards.push(payload.targetCardId);
                 this.updateSetCompletion(newInitSet);
                 
                 // Add init card to target
                 const myCardDef = CARDS_DICTIONARY[payload.myCardId];
                 let targetColorToAssign = payload.targetDestinationColor;
                 if (!targetColorToAssign) {
                     targetColorToAssign = myCardDef?.colors?.[0] === CardColor.ALL_COLOR ? CardColor.ALL_COLOR : initOldColor;
                 }
                 let newTargetSet = target.table.find(s => s.color === targetColorToAssign && !s.isComplete);
                 if (!newTargetSet) {
                   newTargetSet = { color: targetColorToAssign, cards: [], isComplete: false };
                   target.table.push(newTargetSet);
                 }
                 newTargetSet.cards.push(payload.myCardId);
                 this.updateSetCompletion(newTargetSet);
              }
           }
        }
      } else if (action.actionType === "DEAL_BREAKER") {
        // payload: { propertyColor: CardColor, targetSetCardId?: string }
        const target = this.state.players[action.targetId];
        const initiator = this.state.players[action.initiatorId];
        const payload = action.payload;
        if (target && initiator && payload) {
           const targetSetIndex = payload.targetSetCardId
             ? target.table.findIndex(s => s.cards.includes(payload.targetSetCardId) && s.isComplete)
             : target.table.findIndex(s => s.color === payload.propertyColor && s.isComplete);
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

  public payDebt(playerId: string, assetIds: string[], options?: { wildcardAssignments?: Record<string, string> }): { success: boolean; error?: string } {
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
      if (cardDef.isBuilding) return { success: false, error: "Cannot use buildings to pay debts" };
      
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
    
    // Strict Payment Hierarchy Check
    // 1. Bank Money MUST be exhausted before Free Properties
    // 2. Free Properties MUST be exhausted before Monopolies
    if (usingFreeProp && bankRemainingValue > 0) {
        return { success: false, error: "Must use bank money first" };
    }
    if (usingMonopoly && (freePropsRemaining.length > 0 || bankRemainingValue > 0)) {
        return { success: false, error: "Must use bank and free properties before breaking monopolies" };
    }

    // Debt forgiveness check: if value < amount, ensure they have NOTHING else
    if (totalValue < this.state.currentDebt.amount) {
      const remainingBank = debtor.bank.filter(id => !assetIds.includes(id));
      const remainingTable = debtor.table.flatMap(s => s.cards).filter(id => !assetIds.includes(id) && !CARDS_DICTIONARY[id]?.isBuilding);
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
           }
        }

        set.cards = set.cards.filter(id => id !== asset.id);
        this.updateSetCompletion(set);
        
        // Add to creditor's table (lazy: match color if available)
        const assetCardDef = CARDS_DICTIONARY[asset.id];
        let color = set.color;
        if (assetCardDef?.colors?.[0] === CardColor.ALL_COLOR) {
           color = (options?.wildcardAssignments?.[asset.id] as CardColor) || CardColor.ALL_COLOR;
        }
        let creditorSet = creditor.table.find(s => s.color === color && !s.isComplete);
        if (!creditorSet) {
          creditorSet = { color, cards: [], isComplete: false };
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
