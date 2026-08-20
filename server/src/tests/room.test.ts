import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from '../core/room.js';
import { CardColor } from '../models/types.js';

describe('GameRoom - Comprehensive Tests', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom("test_room");
  });

  const setupGame = () => {
    const p1 = room.join("session_1", "Player 1").playerId!;
    const p2 = room.join("session_2", "Player 2").playerId!;
    const p3 = room.join("session_3", "Player 3").playerId!;
    room.startGame(p1);
    
    // Clear hands for deterministic testing
    for (const p of Object.values(room.state.players)) {
      p.hand = [];
    }
    
    return { p1, p2, p3 };
  };

  it('should initialize and start the game properly', () => {
    const { p1 } = setupGame();
    expect(room.state.status).toBe("ACTION_PHASE");
    expect(room.state.activePlayerId).toBe(p1);
    expect(room.state.players[p1]!.actionsRemaining).toBe(3);
  });

  describe('Just Say No (No Chains)', () => {
    it('should allow target to cancel an action', () => {
      const { p1, p2 } = setupGame();
      
      room.state.players[p1]!.hand = ["action_debt_collector_1"];
      room.state.players[p2]!.hand = ["action_just_say_no_1"];
      
      room.playCard(p1, "action_debt_collector_1", { targetId: p2 });
      
      const cancelRes = room.reactJustSayNo(p2, "action_just_say_no_1");
      expect(cancelRes.success).toBe(true);
      
      expect(room.state.debtQueue.length).toBe(0);
      expect(room.state.status).toBe("ACTION_PHASE");
    });

    it('should NOT allow Just Say No chains (counter-cancel)', () => {
      const { p1, p2 } = setupGame();
      
      room.state.players[p1]!.hand = ["action_debt_collector_1", "action_just_say_no_2"];
      room.state.players[p2]!.hand = ["action_just_say_no_1"];
      
      room.playCard(p1, "action_debt_collector_1", { targetId: p2 });
      room.reactJustSayNo(p2, "action_just_say_no_1");
      
      const p1Cancel = room.reactJustSayNo(p1, "action_just_say_no_2");
      expect(p1Cancel.success).toBe(false);
      expect(p1Cancel.error).toBe("Not in reaction phase");
    });
  });

  describe('Action Cards', () => {
    it('Birthday: creates debts for all other players sequentially', () => {
      const { p1 } = setupGame();
      
      room.state.players[p1]!.hand = ["action_birthday_1"];
      room.playCard(p1, "action_birthday_1");
      
      // Birthday queues 2 actions. processNextAction pops the first one and enters REACTION_PHASE.
      // After REACTION_PHASE expires (or is executed), it pushes to debtQueue.
      // To simulate execution without waiting for timers, we can just call `executePendingAction`.
      room['executePendingAction'](); // Executing for P2
      room['executePendingAction'](); // Executing for P3
      
      // One debt is in currentDebt, the other in debtQueue
      expect(room.state.currentDebt?.amount).toBe(2);
      expect(room.state.debtQueue.length).toBe(1);
      expect(room.state.debtQueue[0]?.amount).toBe(2);
    });

    it('Sly Deal: steals 1 free property', () => {
      const { p1, p2 } = setupGame();
      
      room.state.players[p1]!.hand = ["action_sly_deal_1"];
      room.state.players[p2]!.table = [
        { color: CardColor.PINK, cards: ["prop_pink_1"], buildings: [], isComplete: false }
      ];
      
      room.playCard(p1, "action_sly_deal_1", { targetId: p2, payload: { targetCardId: "prop_pink_1", propertyColor: CardColor.PINK } });
      room['executePendingAction']();
      
      expect(room.state.players[p2]!.table[0]?.cards.length).toBe(0);
      expect(room.state.players[p1]!.table[0]?.color).toBe(CardColor.PINK);
      expect(room.state.players[p1]!.table[0]?.cards).toContain("prop_pink_1");
    });

    it('Forced Deal: swaps 1 property for another', () => {
      const { p1, p2 } = setupGame();
      
      room.state.players[p1]!.hand = ["action_forced_deal_1"];
      room.state.players[p1]!.table = [{ color: CardColor.BROWN, cards: ["prop_brown_1"], buildings: [], isComplete: false }];
      room.state.players[p2]!.table = [{ color: CardColor.PINK, cards: ["prop_pink_1"], buildings: [], isComplete: false }];
      
      room.playCard(p1, "action_forced_deal_1", { 
        targetId: p2, 
        payload: { targetCardId: "prop_pink_1", propertyColor: CardColor.PINK, myCardId: "prop_brown_1", myPropertyColor: CardColor.BROWN } 
      });
      room['executePendingAction']();
      
      expect(room.state.players[p1]!.table.some(s => s.color === CardColor.PINK && s.cards.includes("prop_pink_1"))).toBe(true);
      expect(room.state.players[p2]!.table.some(s => s.color === CardColor.BROWN && s.cards.includes("prop_brown_1"))).toBe(true);
    });

    it('Deal Breaker: steals a full monopoly', () => {
      const { p1, p2 } = setupGame();
      
      room.state.players[p1]!.hand = ["action_deal_breaker_1"];
      room.state.players[p2]!.table = [
        { color: CardColor.BROWN, cards: ["prop_brown_1", "prop_brown_2", "prop_brown_3"], buildings: [], isComplete: true }
      ];
      
      room.playCard(p1, "action_deal_breaker_1", { targetId: p2, payload: { propertyColor: CardColor.BROWN } });
      room['executePendingAction']();
      
      expect(room.state.players[p2]!.table.length).toBe(0);
      expect(room.state.players[p1]!.table.length).toBe(1);
      expect(room.state.players[p1]!.table[0]?.isComplete).toBe(true);
    });
  });

  describe('Rent & Buildings', () => {
    it('calculates rent correctly for properties with buildings', () => {
      const { p1, p2 } = setupGame();
      
      room.state.players[p1]!.hand = ["rent_wild_1"];
      room.state.players[p1]!.table = [
        { color: CardColor.BROWN, cards: ["prop_brown_1", "prop_brown_2", "prop_brown_3", "action_house_1"], buildings: [], isComplete: true }
      ];
      
      room.playCard(p1, "rent_wild_1", { targetId: p2, propertyColor: CardColor.BROWN });
      room['executePendingAction']();
      
      // Should queue debt of 6 (3 properties + 3 for house)
      expect(room.state.currentDebt?.amount).toBe(6);
    });
  });

  describe('Win Condition', () => {
    it('should detect win when player has 3 different monopolies', () => {
      const { p1 } = setupGame();
      
      const pinks = ["prop_pink_1", "prop_pink_2", "prop_pink_3", "prop_pink_4"];
      const darkBlues = ["prop_dark_blue_1", "prop_dark_blue_2", "prop_dark_blue_3"];
      const greens = ["prop_green_1", "prop_green_2"];
      
      room.state.players[p1]!.hand = [...pinks, ...darkBlues, ...greens];
      room.state.players[p1]!.actionsRemaining = 99;
      
      for (const card of [...pinks, ...darkBlues]) {
        room.playCard(p1, card);
      }
      expect(room.state.status).toBe("ACTION_PHASE"); 

      room.playCard(p1, greens[0]!);
      expect(room.state.status).toBe("ACTION_PHASE"); 
      
      room.playCard(p1, greens[1]!);
      
      expect(room.state.status).toBe("GAME_OVER");
      expect(room.state.winnerId).toBe(p1);
    });
  });

  describe('Strict Payment Hierarchy', () => {
    it('should enforce bank money is used before free properties', () => {
      const { p1, p2 } = setupGame();
      
      room.state.debtQueue.push({ creditorId: p2, debtorId: p1, amount: 1, paidAmount: 0 });
      room["processNextDebt"]();

      room.state.players[p1]!.bank = ["money_5_1"];
      room.state.players[p1]!.table = [
        { color: CardColor.BROWN, cards: ["prop_brown_1"], buildings: [], isComplete: false }
      ];
      
      const res = room.payDebt(p1, ["prop_brown_1"]);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Must use bank money first");
      
      const res2 = room.payDebt(p1, ["money_5_1"]);
      expect(res2.success).toBe(true);
      
      expect(room.state.players[p1]!.bank.length).toBe(0);
      expect(room.state.players[p2]!.bank).toContain("money_5_1");
    });

    it('should destroy buildings and move them to discard when monopoly is broken for debt', () => {
      const { p1, p2 } = setupGame();
      
      // Debt is $1 so paying with 1 property covers it fully
      room.state.debtQueue.push({ creditorId: p2, debtorId: p1, amount: 1, paidAmount: 0 });
      room["processNextDebt"]();

      room.state.players[p1]!.bank = []; // No money
      // Player has a complete monopoly with a house
      room.state.players[p1]!.table = [
        { color: CardColor.BROWN, cards: ["prop_brown_1", "prop_brown_2", "prop_brown_3", "action_house_1"], buildings: [], isComplete: true }
      ];
      
      // Pay using one property from the monopoly
      const res = room.payDebt(p1, ["prop_brown_1"]);
      expect(res.success).toBe(true);
      
      const updatedSet = room.state.players[p1]!.table[0]!;
      expect(updatedSet.isComplete).toBe(false);
      expect(updatedSet.cards.includes("action_house_1")).toBe(false);
      expect(room.state.discardPile).toContain("action_house_1"); // Building discarded
    });

    it('should forgive debt if player has absolutely nothing left', () => {
      const { p1, p2 } = setupGame();
      
      room.state.debtQueue.push({ creditorId: p2, debtorId: p1, amount: 5, paidAmount: 0 });
      room["processNextDebt"]();

      room.state.players[p1]!.bank = ["money_3_1"];
      room.state.players[p1]!.table = [];
      
      const res = room.payDebt(p1, ["money_3_1"]);
      expect(res.success).toBe(true); 
      expect(room.state.status).toBe("ACTION_PHASE");
    });
  });

  describe('Turn Cycle', () => {
    it('should force player to discard excess cards at end of turn', () => {
      const { p1 } = setupGame();
      
      room.state.players[p1]!.hand = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
      
      const res = room.endTurn(p1);
      expect(res.success).toBe(true);
      expect(room.state.status).toBe("DISCARD_PHASE");
      
      const discardRes = room.discardExcess(p1, ["c8"]);
      expect(discardRes.success).toBe(true);
      expect(room.state.players[p1]!.hand.length).toBe(7);
    });
  });
});
