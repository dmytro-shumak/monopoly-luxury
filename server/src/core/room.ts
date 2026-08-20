import type { GameState } from "../models/types.js";
import { CardType } from "../models/types.js";
import { DeckManager } from "./deck.js";
import { CARDS_DICTIONARY } from "./cards.js";

const DISCONNECT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const REACTION_TIMEOUT_MS = 15 * 1000; // 15 seconds
const DEBT_TIMEOUT_MS = 60 * 1000; // 60 seconds

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
      activePlayerId: null,
      players: {},
      playerOrder: [],
      deckCount: this.deckManager.getDrawPileCount(),
      discardPile: [],
      activeTimer: null,
      pendingAction: null,
      activeDebt: null,
    };
  }

  private notify() {
    this.onStateChange();
  }

  // --- LOBBY & CONNECTION LOGIC ---

  public join(sessionId: string, name: string): { success: boolean; playerId?: string; error?: string } {
    const existingPlayer = Object.values(this.state.players).find(p => p.sessionId === sessionId);
    if (existingPlayer) {
      return { success: true, playerId: existingPlayer.id };
    }
    if (this.state.status !== "LOBBY") return { success: false, error: "Game already in progress" };
    if (Object.keys(this.state.players).length >= 5) return { success: false, error: "Room is full" };

    const playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
    this.state.players[playerId] = {
      id: playerId,
      sessionId,
      name,
      isConnected: true,
      hand: [],
      bank: [],
      table: [],
      actionsRemaining: 0,
    };
    this.state.playerOrder.push(playerId);
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
      this.state.status = "GAME_OVER"; // Basic abandon handling for now
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
      this.notify(); // Extra notify for when callback finishes
    }, durationMs);
  }

  private clearActiveTimer() {
    if (this.gameTimers["main"]) {
      clearTimeout(this.gameTimers["main"]);
      delete this.gameTimers["main"];
    }
    this.state.activeTimer = null;
    this.notify();
  }

  // --- CORE GAME LOOP ---

  public startGame(): { success: boolean; error?: string } {
    if (this.state.status !== "LOBBY") return { success: false, error: "Already started" };
    if (this.state.playerOrder.length < 2) return { success: false, error: "Not enough players" };

    this.deckManager.initDeck();
    for (const playerId of this.state.playerOrder) {
      this.state.players[playerId]!.hand = this.deckManager.drawCards(5);
    }

    this.state.activePlayerId = this.state.playerOrder[0] ?? null;
    this.startTurn(); // This will call notify()
    return { success: true };
  }

  public startTurn() {
    if (!this.state.activePlayerId) return;
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

    this.passTurnToNextPlayer(); // This will call notify()
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
    this.passTurnToNextPlayer(); // Calls notify()
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

  // --- PLAY CARD & REACTIONS ---

  public playCard(playerId: string, cardId: string, options?: { targetId?: string; propertyColor?: string }): { success: boolean; error?: string } {
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
      const color = cardDef.colors?.[0]; 
      if (color) {
        let set = player.table.find(s => s.color === color && !s.isComplete);
        if (!set) {
          set = { color, cards: [], buildings: [], isComplete: false };
          player.table.push(set);
        }
        set.cards.push(cardId);
      }
    } else if (cardDef.type === CardType.ACTION) {
      this.discardCard(cardId);

      // If action targets someone, enter reaction phase
      if (options?.targetId && cardDef.id.includes("action_debt_collector")) {
        this.state.status = "REACTION_PHASE";
        this.state.pendingAction = { initiatorId: playerId, targetId: options.targetId, cardId, cancelChain: [] };
        
        this.startTimer(REACTION_TIMEOUT_MS, "REACTION", options.targetId, () => {
          this.executePendingAction();
        });
        return { success: true, error: "Waiting for reaction" }; // Technically not an error, just info
      } else {
        // Immediate execution (e.g. Pass Go)
        if (cardDef.id.includes("pass_go")) {
          player.hand.push(...this.deckManager.drawCards(2));
          this.updateDeckCount();
        }
      }
    }

    this.notify();
    return { success: true };
  }

  public reactJustSayNo(playerId: string, cardId: string): { success: boolean; error?: string } {
    if (this.state.status !== "REACTION_PHASE" || !this.state.pendingAction) {
      return { success: false, error: "Not in reaction phase" };
    }

    const player = this.state.players[playerId];
    if (!player) return { success: false, error: "Player not found" };

    const action = this.state.pendingAction;
    
    // Determine who is allowed to play Just Say No right now
    const currentDefender = action.cancelChain.length % 2 === 0 ? action.targetId : action.initiatorId;
    if (playerId !== currentDefender) {
      return { success: false, error: "It's not your turn to react" };
    }

    const handIndex = player.hand.indexOf(cardId);
    if (handIndex === -1) return { success: false, error: "Card not in hand" };
    const cardDef = CARDS_DICTIONARY[cardId];
    if (!cardDef || !cardDef.id.includes("just_say_no")) return { success: false, error: "Not a Just Say No card" };

    // Play the card
    player.hand.splice(handIndex, 1);
    this.discardCard(cardId);
    action.cancelChain.push(playerId);

    // Swap the target and reset the 15s timer for the other person to respond
    const newDefender = action.cancelChain.length % 2 === 0 ? action.targetId! : action.initiatorId;
    this.startTimer(REACTION_TIMEOUT_MS, "REACTION", newDefender, () => {
      this.executePendingAction();
    });

    this.notify();
    return { success: true };
  }

  private executePendingAction() {
    const action = this.state.pendingAction;
    this.state.pendingAction = null;
    this.clearActiveTimer();

    // If cancelChain length is odd, the action was canceled (Just Say No wins)
    if (action && action.cancelChain.length % 2 === 0) {
      // Execute the action (e.g. Debt Collector triggers Debt Phase)
      const cardDef = CARDS_DICTIONARY[action.cardId];
      if (cardDef && cardDef.id.includes("action_debt_collector") && action.targetId) {
        this.triggerDebt(action.initiatorId, action.targetId, 5); // Debt Collector is always 5
        return;
      }
    }

    // If canceled or done, go back to action phase
    this.state.status = "ACTION_PHASE";
    this.notify();
  }

  // --- DEBT LOGIC ---

  private triggerDebt(creditorId: string, debtorId: string, amount: number) {
    this.state.status = "DEBT_PAYMENT_PHASE";
    this.state.activeDebt = { creditorId, debtorId, amount, paidAmount: 0 };
    
    this.notify();
    this.startTimer(DEBT_TIMEOUT_MS, "DEBT", debtorId, () => {
      // 60s AFK timeout -> Auto Loss
      this.state.status = "GAME_OVER"; // We'll refine eliminating a single player later
      this.notify();
    });
  }

  public payDebt(playerId: string, _assetIds: string[]): { success: boolean; error?: string } {
    if (this.state.status !== "DEBT_PAYMENT_PHASE" || !this.state.activeDebt) return { success: false, error: "Not in debt phase" };
    if (this.state.activeDebt.debtorId !== playerId) return { success: false, error: "Not your debt" };

    // In a real implementation, we will validate the strict hierarchy (Bank -> Free Props -> Monopolies)
    // and sum up the value of the assets.
    // For now, this is a stub that accepts payment and ends the debt phase.
    
    this.clearActiveTimer(); // This notifies
    this.state.activeDebt = null;
    this.state.status = "ACTION_PHASE"; // return to action phase of the initiator
    
    this.notify();
    return { success: true };
  }
}
