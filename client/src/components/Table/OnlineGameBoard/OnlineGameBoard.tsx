import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../../store/gameStore';
import { getCardModel } from '../../../data/allCards';
import { CardType, ActionCardType, CardColor, type CardModel } from '../../../types/cards';
import { type MockPlayer, type MockPropertySet } from '../../../mocks/mockGameData';
import {
  computeValidPropertyTargets,
  computeBestRentForCard,
  computeFlipTargetForTableCard,
  type PropertyTarget,
  type TableMovingCard,
  type IncomingAction,
  type IncomingDebt,
} from '../../../mocks/useMockGame';
import { OpponentsArea } from '../OpponentsArea/OpponentsArea';
import { CenterTable } from '../CenterTable/CenterTable';
import { PlayerBank } from '../PlayerBank/PlayerBank';
import { PlayerProperties } from '../PlayerProperties/PlayerProperties';
import { PlayerHand } from '../PlayerHand/PlayerHand';
import { TurnHUD } from '../TurnHUD/TurnHUD';
import { DiscardCardsModal } from '../DiscardCardsModal/DiscardCardsModal';
import { DefenseActionModal } from '../DefenseActionModal/DefenseActionModal';
import { DefenseDebtModal } from '../DefenseDebtModal/DefenseDebtModal';
import { SlyDealModal } from '../SlyDealModal/SlyDealModal';
import { ForcedDealModal } from '../ForcedDealModal/ForcedDealModal';
import { DealBreakerModal } from '../DealBreakerModal/DealBreakerModal';
import { DoubleRentModal } from '../DoubleRentModal/DoubleRentModal';
import { LanguageSwitcher } from '../../LanguageSwitcher/LanguageSwitcher';
import styles from './OnlineGameBoard.module.css';

export const OnlineGameBoard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    roomId,
    myPlayerId,
    roomState,
    playCard,
    endTurn,
    discardCards,
    reactJustSayNo,
    passReaction,
    payDebt,
    moveProperty,
    leaveRoom,
  } = useGameStore();

  const handleLeaveGame = () => {
    leaveRoom();
    navigate('/');
  };

  // Selection state
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [validDropTarget, setValidDropTarget] = useState<'bank' | 'property' | 'action' | null>(null);
  const [validPropertyTargets, setValidPropertyTargets] = useState<PropertyTarget[]>([]);

  // Complex action state
  const [slyDealOpponentId, setSlyDealOpponentId] = useState<string | null>(null);
  const [forcedDealMyCard, setForcedDealMyCard] = useState<CardModel | null>(null);
  const [forcedDealOpponentId, setForcedDealOpponentId] = useState<string | null>(null);
  const [dealBreakerOpponentId, setDealBreakerOpponentId] = useState<string | null>(null);
  const [tableMovingCard, setTableMovingCard] = useState<TableMovingCard | null>(null);
  const [pendingStolenCardPlacement, setPendingStolenCardPlacement] = useState<{
    card: CardModel;
    fromOpponentName: string;
    actionType: ActionCardType.SLY_DEAL | ActionCardType.FORCED_DEAL | 'DEBT_PAYMENT';
    cardToPlayId?: string;
    targetId?: string;
    propertyColor?: CardColor;
    myCardId?: string;
    myPropertyColor?: CardColor;
  } | null>(null);
  const prevPropertyCardIdsRef = React.useRef<Set<string>>(new Set());
  const [pendingDoubleRentModal, setPendingDoubleRentModal] = useState<{
    rentCard: CardModel;
    baseAmount: number;
    colorName: string;
    chosenColor: CardColor;
    doubleRentCard: CardModel;
    targetId?: string;
  } | null>(null);

  const myPlayer = (roomState && myPlayerId) ? roomState.players[myPlayerId] : null;
  const isMyTurn = (roomState && myPlayerId) ? roomState.activePlayerId === myPlayerId : false;
  const actionsRemaining = myPlayer?.actionsRemaining ?? 0;
  const activePlayer = roomState?.activePlayerId ? roomState.players[roomState.activePlayerId] : null;
  const activePlayerName = isMyTurn ? t('board.you') : activePlayer?.name || 'Opponent';

  // Map Current Player Cards
  const handCards: CardModel[] = useMemo(() => {
    return myPlayer?.hand.map(getCardModel) || [];
  }, [myPlayer?.hand]);

  const bankCards: CardModel[] = useMemo(() => {
    return myPlayer?.bank.map(getCardModel) || [];
  }, [myPlayer?.bank]);

  const propertySets: MockPropertySet[] = useMemo(() => {
    return myPlayer?.table.map((set) => ({
      color: set.color as CardColor,
      cards: set.cards.map(getCardModel),
      isComplete: set.isComplete,
    })) || [];
  }, [myPlayer?.table]);

  // Map Opponents
  const opponents: MockPlayer[] = useMemo(() => {
    if (!roomState || !myPlayerId) return [];
    return roomState.playerOrder
      .filter((id) => id !== myPlayerId)
      .map((id) => {
        const p = roomState.players[id];
        return {
          id: p.id,
          name: p.name,
          avatar: '👤',
          handCount: p.hand.length,
          bankCards: p.bank.map(getCardModel),
          propertySets: p.table.map((set) => ({
            color: set.color as CardColor,
            cards: set.cards.map(getCardModel),
            isComplete: set.isComplete,
          })),
        };
      });
  }, [roomState, myPlayerId]);

  // Center Table data
  const deckCount = roomState?.deckCount ?? 0;
  const reversedDiscard = useMemo(() => {
    return [...(roomState?.discardPile ?? [])].reverse().map(getCardModel);
  }, [roomState?.discardPile]);

  // Active action card currently in play or reaction
  const activeActionCard = useMemo(() => {
    const cardId = roomState?.currentAction?.cardId;
    if (cardId) {
      return getCardModel(cardId);
    }
    return null;
  }, [roomState?.currentAction?.cardId]);

  // Selected card in hand
  const selectedCard = handCards.find((c) => c.id === selectedCardId) || null;

  // Just Say No card check in hand
  const justSayNoCard = useMemo(() => {
    return handCards.find(
      (c) => c.actionType === ActionCardType.JUST_SAY_NO || c.id.startsWith('action_just_say_no')
    );
  }, [handCards]);
  const hasJustSayNo = Boolean(justSayNoCard);

  // Double rent card in hand
  const doubleRentCardInHand = useMemo(() => {
    return handCards.find(
      (c) => c.actionType === ActionCardType.DOUBLE_RENT || c.id.startsWith('rent_double')
    );
  }, [handCards]);

  // Incoming Reaction & Debt Defense hooks (must be unconditional)
  const incomingAction: IncomingAction | null = useMemo(() => {
    if (!roomState || !myPlayerId || !myPlayer) return null;
    if (roomState.status !== 'REACTION_PHASE' || !roomState.currentAction) return null;
    const action = roomState.currentAction;
    if (action.targetId !== myPlayerId) return null;

    const attacker = roomState.players[action.initiatorId];
    const actionCard = getCardModel(action.cardId);

    if (action.actionType === 'SLY_DEAL') {
      return {
        type: 'sly_deal',
        attackerId: action.initiatorId,
        attackerName: attacker?.name || 'Opponent',
        actionCard,
        stolenCard: action.payload?.targetCardId ? getCardModel(action.payload.targetCardId) : undefined,
      };
    }

    if (action.actionType === 'FORCED_DEAL') {
      return {
        type: 'forced_deal',
        attackerId: action.initiatorId,
        attackerName: attacker?.name || 'Opponent',
        actionCard,
        myTargetCard: action.payload?.targetCardId ? getCardModel(action.payload.targetCardId) : undefined,
        theirCard: action.payload?.myCardId ? getCardModel(action.payload.myCardId) : undefined,
      };
    }

    if (action.actionType === 'DEAL_BREAKER') {
      const color = action.payload?.propertyColor;
      const targetSet = myPlayer.table.find((s) => s.color === color);
      return {
        type: 'deal_breaker',
        attackerId: action.initiatorId,
        attackerName: attacker?.name || 'Opponent',
        actionCard,
        stolenSet: targetSet
          ? {
              color: targetSet.color as CardColor,
              cards: targetSet.cards.map(getCardModel),
              isComplete: true,
            }
          : undefined,
      };
    }

    return null;
  }, [roomState, myPlayerId, myPlayer]);

  const incomingDebt: IncomingDebt | null = useMemo(() => {
    if (!roomState || !myPlayerId) return null;
    if (roomState.status !== 'DEBT_PAYMENT_PHASE' || !roomState.currentDebt) return null;
    const debt = roomState.currentDebt;
    if (debt.debtorId !== myPlayerId) return null;

    const creditor = roomState.players[debt.creditorId];
    return {
      attackerId: debt.creditorId,
      attackerName: creditor?.name || 'Opponent',
      actionCard: getCardModel('action_debt_collector_1'),
      amount: Math.max(0, debt.amount - debt.paidAmount),
      reason: t('board.defenseDebtTitle'),
    };
  }, [roomState, myPlayerId, t]);

  // Detect received wildcards from debt payments to let creditor place them freely (Hook must be called before any early return)
  React.useEffect(() => {
    if (!myPlayer || !isMyTurn) {
      if (myPlayer?.table) {
        prevPropertyCardIdsRef.current = new Set(myPlayer.table.flatMap((s) => s.cards));
      }
      return;
    }

    const currentCardIds = new Set(myPlayer.table.flatMap((s) => s.cards));
    if (prevPropertyCardIdsRef.current.size > 0 && !pendingStolenCardPlacement) {
      const newlyAddedIds = Array.from(currentCardIds).filter((id) => !prevPropertyCardIdsRef.current.has(id));
      for (const newId of newlyAddedIds) {
        const cardModel = getCardModel(newId);
        const isWild =
          cardModel.type === CardType.PROPERTY_WILDCARD ||
          Boolean(cardModel.colors && cardModel.colors.length > 1) ||
          cardModel.colors?.includes(CardColor.ALL_COLOR);

        const isFree = (myPlayer as any).freeMoveCardIds?.includes(newId);
        if (isWild && isFree) {
          const targets = computeValidPropertyTargets(cardModel, propertySets);
          setPendingStolenCardPlacement({
            card: cardModel,
            fromOpponentName: 'Opponent',
            actionType: 'DEBT_PAYMENT',
          });
          setValidPropertyTargets(targets);
          break;
        }
      }
    }
    prevPropertyCardIdsRef.current = currentCardIds;
  }, [myPlayer, isMyTurn, pendingStolenCardPlacement, propertySets]);

  if (!roomState || !myPlayerId || !myPlayer) {
    return null;
  }

  // Reset all selections
  const resetSelection = () => {
    setSelectedCardId(null);
    setValidDropTarget(null);
    setValidPropertyTargets([]);
    setSlyDealOpponentId(null);
    setForcedDealMyCard(null);
    setForcedDealOpponentId(null);
    setDealBreakerOpponentId(null);
    setPendingDoubleRentModal(null);
    setTableMovingCard(null);
    setPendingStolenCardPlacement(null);
  };

  // Card Selection handler
  const handleSelectCard = (cardId: string) => {
    if (!isMyTurn || actionsRemaining <= 0) return;

    if (selectedCardId === cardId) {
      resetSelection();
    } else {
      resetSelection();
      setSelectedCardId(cardId);

      const card = handCards.find((c) => c.id === cardId);
      if (!card) return;

      if (card.type === CardType.MONEY) {
        setValidDropTarget('bank');
      } else if (card.type === CardType.PROPERTY || card.type === CardType.PROPERTY_WILDCARD) {
        setValidDropTarget('property');
        const propTargets = computeValidPropertyTargets(card, propertySets);
        setValidPropertyTargets(propTargets);
      } else if (card.type === CardType.ACTION) {
        setValidDropTarget('action');
      }
    }
  };

  // 1. Play to Bank
  const handlePlayToBank = () => {
    if (!selectedCard || !isMyTurn || actionsRemaining <= 0) return;
    playCard(selectedCard.id);
    resetSelection();
  };

  // 2. Play to Property
  const handlePlayToPropertyTarget = (target: PropertyTarget) => {
    if (pendingStolenCardPlacement) {
      if (
        pendingStolenCardPlacement.actionType === ActionCardType.SLY_DEAL &&
        pendingStolenCardPlacement.cardToPlayId &&
        pendingStolenCardPlacement.targetId
      ) {
        playCard(pendingStolenCardPlacement.cardToPlayId, {
          targetId: pendingStolenCardPlacement.targetId,
          payload: {
            targetCardId: pendingStolenCardPlacement.card.id,
            propertyColor: pendingStolenCardPlacement.propertyColor,
            destinationColor: target.color,
          },
        });
      } else if (
        pendingStolenCardPlacement.actionType === ActionCardType.FORCED_DEAL &&
        pendingStolenCardPlacement.cardToPlayId &&
        pendingStolenCardPlacement.targetId
      ) {
        playCard(pendingStolenCardPlacement.cardToPlayId, {
          targetId: pendingStolenCardPlacement.targetId,
          payload: {
            targetCardId: pendingStolenCardPlacement.card.id,
            propertyColor: pendingStolenCardPlacement.propertyColor,
            destinationColor: target.color,
            myCardId: pendingStolenCardPlacement.myCardId,
            myPropertyColor: pendingStolenCardPlacement.myPropertyColor,
          },
        });
      } else if (pendingStolenCardPlacement.actionType === 'DEBT_PAYMENT') {
        moveProperty(pendingStolenCardPlacement.card.id, target.color);
      }
      setPendingStolenCardPlacement(null);
      setValidPropertyTargets([]);
      return;
    }

    if (!selectedCard || !isMyTurn || actionsRemaining <= 0) return;
    playCard(selectedCard.id, { propertyColor: target.color });
    resetSelection();
  };

  const handlePlayToProperty = () => {
    const target = validPropertyTargets[0];
    if (target) {
      handlePlayToPropertyTarget(target);
      return;
    }
    if (!selectedCard || !isMyTurn || actionsRemaining <= 0) return;
    const color = selectedCard.colors?.[0];
    playCard(selectedCard.id, color ? { propertyColor: color } : undefined);
    resetSelection();
  };

  // 3. Play Action Cards
  const handlePlayActionDirect = () => {
    if (!selectedCard || !isMyTurn || actionsRemaining <= 0) return;

    // A. Rent card
    if (selectedCard.actionType === ActionCardType.RENT) {
      const best = computeBestRentForCard(selectedCard, propertySets);
      if (!best || best.amount <= 0) {
        return;
      }

      const targetId = opponents.length === 1 ? opponents[0].id : undefined;

      if (doubleRentCardInHand && actionsRemaining >= 2) {
        setPendingDoubleRentModal({
          rentCard: selectedCard,
          baseAmount: best.amount,
          colorName: best.color.replace('_', ' '),
          chosenColor: best.color,
          doubleRentCard: doubleRentCardInHand,
          targetId,
        });
        return;
      }

      if (targetId) {
        playCard(selectedCard.id, { propertyColor: best.color, targetId });
        resetSelection();
      }
      return;
    }

    // B. Sly Deal
    if (selectedCard.actionType === ActionCardType.SLY_DEAL) {
      const eligible = opponents.filter((o) =>
        o.propertySets.some((s) => !s.isComplete && s.cards.length > 0)
      );
      if (eligible.length === 1) {
        setSlyDealOpponentId(eligible[0].id);
      }
      return;
    }

    // C. Forced Deal
    if (selectedCard.actionType === ActionCardType.FORCED_DEAL) {
      // User must choose trade give card from own table first
      return;
    }

    // D. Deal Breaker
    if (selectedCard.actionType === ActionCardType.DEAL_BREAKER) {
      const eligible = opponents.filter((o) =>
        o.propertySets.some((s) => s.isComplete && s.cards.length > 0)
      );
      if (eligible.length === 1) {
        setDealBreakerOpponentId(eligible[0].id);
      }
      return;
    }

    // E. Debt Collector
    if (selectedCard.actionType === ActionCardType.DEBT_COLLECTOR) {
      if (opponents.length === 1) {
        playCard(selectedCard.id, { targetId: opponents[0].id });
        resetSelection();
      }
      return;
    }

    // F. Direct actions (Pass Go, Birthday)
    playCard(selectedCard.id);
    resetSelection();
  };

  // Opponent Selection Handlers in OpponentsArea
  const handleSelectTargetOpponent = (oppId: string) => {
    if (!selectedCard || !isMyTurn || actionsRemaining <= 0) return;
    if (selectedCard.actionType === ActionCardType.DEBT_COLLECTOR) {
      playCard(selectedCard.id, { targetId: oppId });
      resetSelection();
    } else if (selectedCard.actionType === ActionCardType.RENT) {
      const best = computeBestRentForCard(selectedCard, propertySets);
      if (!best || best.amount <= 0) return;

      if (doubleRentCardInHand && actionsRemaining >= 2) {
        setPendingDoubleRentModal({
          rentCard: selectedCard,
          baseAmount: best.amount,
          colorName: best.color.replace('_', ' '),
          chosenColor: best.color,
          doubleRentCard: doubleRentCardInHand,
          targetId: oppId,
        });
        return;
      }

      playCard(selectedCard.id, { propertyColor: best.color, targetId: oppId });
      resetSelection();
    }
  };

  const handleSelectSlyDealOpponent = (oppId: string) => {
    setSlyDealOpponentId(oppId);
  };

  const handleSelectForcedDealOpponent = (oppId: string) => {
    setForcedDealOpponentId(oppId);
  };

  const handleSelectDealBreakerOpponent = (oppId: string) => {
    setDealBreakerOpponentId(oppId);
  };

  // Confirm Sly Deal from SlyDealModal
  const handleConfirmSlyDeal = (stolenCard: CardModel) => {
    const opp = opponents.find((o) => o.id === slyDealOpponentId);
    const set = opp?.propertySets.find((s) => s.cards.some((c) => c.id === stolenCard.id));
    const cardToPlay = selectedCard || handCards.find((c) => c.actionType === ActionCardType.SLY_DEAL);
    if (!opp || !set || !cardToPlay) return;

    const isWild =
      stolenCard.type === CardType.PROPERTY_WILDCARD ||
      Boolean(stolenCard.colors && stolenCard.colors.length > 1) ||
      stolenCard.colors?.includes(CardColor.ALL_COLOR);

    if (isWild) {
      setSlyDealOpponentId(null);
      setSelectedCardId(null);
      setValidDropTarget('property');
      const targets = computeValidPropertyTargets(stolenCard, propertySets);
      setPendingStolenCardPlacement({
        card: stolenCard,
        fromOpponentName: opp.name,
        actionType: ActionCardType.SLY_DEAL,
        cardToPlayId: cardToPlay.id,
        targetId: opp.id,
        propertyColor: set.color,
      });
      setValidPropertyTargets(targets);
    } else {
      playCard(cardToPlay.id, {
        targetId: opp.id,
        payload: {
          targetCardId: stolenCard.id,
          propertyColor: set.color,
          destinationColor: stolenCard.colors?.[0] || set.color,
        },
      });
      resetSelection();
      setSlyDealOpponentId(null);
    }
  };

  // Confirm Forced Deal from ForcedDealModal
  const handleConfirmForcedDeal = (theirCard: CardModel) => {
    const opp = opponents.find((o) => o.id === forcedDealOpponentId);
    const theirSet = opp?.propertySets.find((s) => s.cards.some((c) => c.id === theirCard.id));
    const mySet = propertySets.find((s) => s.cards.some((c) => c.id === forcedDealMyCard?.id));
    const cardToPlay = selectedCard || handCards.find((c) => c.actionType === ActionCardType.FORCED_DEAL);
    if (!opp || !theirSet || !mySet || !forcedDealMyCard || !cardToPlay) return;

    const isWild =
      theirCard.type === CardType.PROPERTY_WILDCARD ||
      Boolean(theirCard.colors && theirCard.colors.length > 1) ||
      theirCard.colors?.includes(CardColor.ALL_COLOR);

    if (isWild) {
      setForcedDealOpponentId(null);
      setSelectedCardId(null);
      setValidDropTarget('property');
      const targets = computeValidPropertyTargets(theirCard, propertySets);
      setPendingStolenCardPlacement({
        card: theirCard,
        fromOpponentName: opp.name,
        actionType: ActionCardType.FORCED_DEAL,
        cardToPlayId: cardToPlay.id,
        targetId: opp.id,
        propertyColor: theirSet.color,
        myCardId: forcedDealMyCard.id,
        myPropertyColor: mySet.color,
      });
      setValidPropertyTargets(targets);
    } else {
      playCard(cardToPlay.id, {
        targetId: opp.id,
        payload: {
          targetCardId: theirCard.id,
          propertyColor: theirSet.color,
          destinationColor: theirCard.colors?.[0] || theirSet.color,
          myCardId: forcedDealMyCard.id,
          myPropertyColor: mySet.color,
        },
      });
      resetSelection();
      setForcedDealOpponentId(null);
    }
  };

  // Table card move / flip handlers
  const handleStartTableCardMove = (sourceSetIndex: number, card: CardModel) => {
    if (!isMyTurn || actionsRemaining <= 0) return;

    if (tableMovingCard && tableMovingCard.cardId === card.id) {
      setTableMovingCard(null);
      setValidPropertyTargets([]);
      return;
    }

    const sourceSet = propertySets[sourceSetIndex];
    if (!sourceSet || sourceSet.isComplete) return;

    const isAllColor = card.colors?.includes(CardColor.ALL_COLOR);

    resetSelection();

    if (isAllColor) {
      const targets: PropertyTarget[] = [];
      propertySets.forEach((s, idx) => {
        if (idx !== sourceSetIndex && !s.isComplete) {
          targets.push({ type: 'existing', setIndex: idx, color: s.color });
        }
      });
      const allColors: CardColor[] = [
        CardColor.PINK,
        CardColor.ORANGE,
        CardColor.BROWN,
        CardColor.LIGHT_GREEN,
        CardColor.PURPLE,
        CardColor.DARK_BLUE,
        CardColor.LIGHT_BLUE,
        CardColor.GREEN,
        CardColor.RED,
        CardColor.MAROON,
        CardColor.DARK_GREEN,
        CardColor.DARK_MAROON,
      ];
      const existingIncompleteColors = new Set(targets.map((t) => t.color));
      allColors.forEach((c) => {
        if (!existingIncompleteColors.has(c)) {
          targets.push({ type: 'new_set', color: c });
        }
      });

      if (targets.length === 0) return;

      setTableMovingCard({
        sourceSetIndex,
        cardId: card.id,
        targetColor: targets[0].color,
        target: targets[0],
      });
      setValidPropertyTargets(targets);
    } else {
      const flipInfo = computeFlipTargetForTableCard(
        sourceSetIndex,
        card,
        propertySets
      );
      if (!flipInfo) return;

      setTableMovingCard({
        sourceSetIndex,
        cardId: card.id,
        targetColor: flipInfo.targetColor,
        target: flipInfo.target,
      });
      setValidPropertyTargets([flipInfo.target]);
    }
  };

  const handleCancelTableCardMove = () => {
    setTableMovingCard(null);
    setValidPropertyTargets([]);
  };

  const handleExecuteTableCardMove = (chosenTarget?: PropertyTarget) => {
    if (!tableMovingCard || !isMyTurn || actionsRemaining <= 0) return;

    const targetColor = chosenTarget?.color || tableMovingCard.targetColor;
    moveProperty(tableMovingCard.cardId, targetColor);
    setTableMovingCard(null);
    setValidPropertyTargets([]);
  };

  // Confirm Deal Breaker from DealBreakerModal
  const handleConfirmDealBreaker = (setIndex: number) => {
    const opp = opponents.find((o) => o.id === dealBreakerOpponentId);
    const chosenSet = opp?.propertySets[setIndex];
    const cardToPlay = selectedCard || handCards.find((c) => c.actionType === ActionCardType.DEAL_BREAKER);
    if (opp && chosenSet && cardToPlay) {
      playCard(cardToPlay.id, {
        targetId: opp.id,
        payload: {
          propertyColor: chosenSet.color,
          targetSetCardId: chosenSet.cards[0]?.id,
        },
      });
    }
    resetSelection();
  };

  // Double Rent Modal Handlers
  const handleConfirmDoubleRent = () => {
    if (!pendingDoubleRentModal) return;
    const targetId = pendingDoubleRentModal.targetId || (opponents.length === 1 ? opponents[0].id : undefined);
    playCard(pendingDoubleRentModal.rentCard.id, {
      propertyColor: pendingDoubleRentModal.chosenColor,
      modifierCardId: pendingDoubleRentModal.doubleRentCard.id,
      targetId,
    });
    resetSelection();
  };

  const handleDeclineDoubleRent = () => {
    if (!pendingDoubleRentModal) return;
    const targetId = pendingDoubleRentModal.targetId || (opponents.length === 1 ? opponents[0].id : undefined);
    playCard(pendingDoubleRentModal.rentCard.id, {
      propertyColor: pendingDoubleRentModal.chosenColor,
      targetId,
    });
    resetSelection();
  };

  // Defense handlers
  const handleAcceptDefenseAction = () => {
    passReaction();
  };

  const handleJustSayNoAction = () => {
    if (justSayNoCard) {
      reactJustSayNo(justSayNoCard.id);
    }
  };

  const handlePayDebt = (selectedCards: CardModel[]) => {
    payDebt(selectedCards.map((c) => c.id));
  };

  // Discard Phase
  const isDiscardPhase = roomState.status === 'DISCARD_PHASE' && isMyTurn;
  const excessCardsCount = Math.max(0, handCards.length - 7);

  const handleConfirmDiscard = (cardIds: string[]) => {
    discardCards(cardIds);
  };

  // Game Over
  const isGameOver = roomState.status === 'GAME_OVER';
  const winnerPlayer = roomState.winnerId ? roomState.players[roomState.winnerId] : null;

  // Modals active opponent references
  const slyDealOpponent = opponents.find((o) => o.id === slyDealOpponentId) || null;
  const forcedDealOpponent = opponents.find((o) => o.id === forcedDealOpponentId) || null;
  const dealBreakerOpponent = opponents.find((o) => o.id === dealBreakerOpponentId) || null;

  return (
    <div className={styles.pageContainer}>
      {/* 1. Header Bar */}
      <header className={styles.navHeader}>
        <div className={styles.leftNav}>
          <span className={styles.roomBadge}>
            💎 {t('board.room')}: {roomId}
          </span>
          <span className={styles.brandTitle}>Monopoly Deal</span>
        </div>

        <div className={styles.rightNav}>
          <LanguageSwitcher />
          <button
            type="button"
            className={styles.leaveGameBtn}
            onClick={handleLeaveGame}
          >
            {t('onlineGame.leaveGameBtn')}
          </button>
        </div>
      </header>

      {/* 2. Main Luxury Table Felt */}
      <main className={styles.tableFelt}>
        {/* Top-Right Deck Counter Widget */}
        <div className={styles.deckCounterWidget}>
          <span className={styles.deckIcon}>🎴</span>
          <span className={styles.deckLabel}>{t('board.deck')}:</span>
          <span className={styles.deckCountValue}>{deckCount}</span>
        </div>

        {/* Top: Opponents Area */}
        <section className={styles.opponentsWrapper}>
          <OpponentsArea
            opponents={opponents}
            activePlayerId={roomState.activePlayerId || ''}
            isSelectingTarget={
              selectedCard?.actionType === ActionCardType.DEBT_COLLECTOR ||
              (selectedCard?.actionType === ActionCardType.RENT && opponents.length > 1)
            }
            targetDemandAmount={
              selectedCard?.actionType === ActionCardType.DEBT_COLLECTOR
                ? 5
                : selectedCard?.actionType === ActionCardType.RENT
                ? computeBestRentForCard(selectedCard, propertySets)?.amount
                : undefined
            }
            isSelectingSlyDealTarget={selectedCard?.actionType === ActionCardType.SLY_DEAL && !slyDealOpponentId}
            isSelectingForcedDealTarget={selectedCard?.actionType === ActionCardType.FORCED_DEAL && Boolean(forcedDealMyCard) && !forcedDealOpponentId}
            isSelectingDealBreakerTarget={selectedCard?.actionType === ActionCardType.DEAL_BREAKER && !dealBreakerOpponentId}
            onSelectTargetOpponent={handleSelectTargetOpponent}
            onSelectSlyDealOpponent={handleSelectSlyDealOpponent}
            onSelectForcedDealOpponent={handleSelectForcedDealOpponent}
            onSelectDealBreakerOpponent={handleSelectDealBreakerOpponent}
          />
        </section>

        {/* Main Arena: Two-column layout (Bank + Hand on left, CenterTable + Properties on right) */}
        <div className={styles.arenaGrid}>
          {/* Left Column: Bank on top, Hand on bottom */}
          <section className={styles.leftColumn}>
            {/* 🟡 Gold Zone: Bank */}
            <div className={styles.bankWrapper}>
              <PlayerBank
                bankCards={bankCards}
                validDropTarget={validDropTarget}
                onPlayToBank={handlePlayToBank}
              />
            </div>

            {/* Hand Cards */}
            <div className={styles.handWrapper}>
              <PlayerHand
                cards={handCards}
                selectedCardId={selectedCardId}
                onSelectCard={handleSelectCard}
              />
            </div>
          </section>

          {/* Right Column: Center Action Arena & Discard Pile (Top) + Player Properties (Bottom) */}
          <section className={styles.rightColumn}>
            {/* Center Table: Action Arena & Discard Pile */}
            <div className={styles.centerWrapper}>
              <CenterTable
                discardPile={reversedDiscard}
                activeActionCard={activeActionCard}
                validDropTarget={validDropTarget}
                onPlayAction={handlePlayActionDirect}
              />
            </div>

            {/* 🟢 Green Zone: Player Properties (Extends below Action Arena) */}
            <div className={styles.propertiesWrapper}>
              {pendingStolenCardPlacement && (
                <div className={styles.placementNoticeBanner}>
                  <div className={styles.placementNoticeText}>
                    <span className={styles.placementNoticeIcon}>
                      {pendingStolenCardPlacement.actionType === ActionCardType.SLY_DEAL
                        ? '🥷'
                        : pendingStolenCardPlacement.actionType === ActionCardType.FORCED_DEAL
                        ? '🔄'
                        : '💰'}
                    </span>
                    <span>
                      {pendingStolenCardPlacement.actionType === ActionCardType.SLY_DEAL
                        ? t('board.slyDealPlaceWildPrompt', { card: pendingStolenCardPlacement.card.name })
                        : pendingStolenCardPlacement.actionType === ActionCardType.FORCED_DEAL
                        ? t('board.forcedDealPlaceWildPrompt', { card: pendingStolenCardPlacement.card.name })
                        : `Картку «${pendingStolenCardPlacement.card.name}» отримано! Оберіть набір або новий слот на своєму столі для її розміщення.`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.cancelPlacementBtn}
                    onClick={() => {
                      setPendingStolenCardPlacement(null);
                      setValidPropertyTargets([]);
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <PlayerProperties
                propertySets={propertySets}
                validDropTarget={pendingStolenCardPlacement ? 'property' : validDropTarget}
                validPropertyTargets={validPropertyTargets}
                onPlayToTarget={handlePlayToPropertyTarget}
                onPlayToProperty={handlePlayToProperty}
                selectedCard={selectedCard || pendingStolenCardPlacement?.card || null}
                tableMovingCard={tableMovingCard}
                onStartTableCardMove={handleStartTableCardMove}
                onCancelTableCardMove={handleCancelTableCardMove}
                onExecuteTableCardMove={handleExecuteTableCardMove}
                isMyTurn={isMyTurn}
                actionsRemaining={actionsRemaining}
                isTradeGiveMode={selectedCard?.actionType === ActionCardType.FORCED_DEAL && !forcedDealMyCard}
                selectedTradeGiveCardId={forcedDealMyCard?.id}
                onSelectTradeGiveCard={(card) => setForcedDealMyCard(card)}
              />
            </div>
          </section>
        </div>
      </main>

      {/* 3. Bottom HUD / Controls */}
      <TurnHUD
        isMyTurn={isMyTurn}
        activePlayerName={activePlayerName}
        actionsRemaining={actionsRemaining}
        maxActions={3}
        onEndTurn={endTurn}
      />

      {/* ----------------------------------------------------------- */}
      {/* 4. MODALS: Discard, Defense, Attack, Double Rent, Game Over */}
      {/* ----------------------------------------------------------- */}

      {/* A. Discard Cards Modal */}
      <DiscardCardsModal
        isOpen={isDiscardPhase && excessCardsCount > 0}
        handCards={handCards}
        excessCount={excessCardsCount}
        onConfirmDiscard={handleConfirmDiscard}
        onClose={() => {}}
      />

      {/* B. Defense Action Modal (Sly Deal / Forced Deal / Deal Breaker attack against you) */}
      <DefenseActionModal
        isOpen={Boolean(incomingAction)}
        incomingAction={incomingAction}
        hasJustSayNo={hasJustSayNo}
        onAccept={handleAcceptDefenseAction}
        onJustSayNo={handleJustSayNoAction}
      />

      {/* C. Defense Debt Modal (Rent / Debt Collector payment demand against you) */}
      <DefenseDebtModal
        isOpen={Boolean(incomingDebt)}
        incomingDebt={incomingDebt}
        bankCards={bankCards}
        propertySets={propertySets}
        hasJustSayNo={hasJustSayNo}
        onPay={handlePayDebt}
        onJustSayNo={handleJustSayNoAction}
      />

      {/* D. Sly Deal Modal (Stealing single property from chosen opponent) */}
      {slyDealOpponent && (
        <SlyDealModal
          isOpen={Boolean(slyDealOpponentId)}
          opponent={slyDealOpponent}
          onStealCard={handleConfirmSlyDeal}
          onClose={() => setSlyDealOpponentId(null)}
        />
      )}

      {/* E. Forced Deal Modal (Swapping properties with chosen opponent) */}
      {forcedDealOpponent && forcedDealMyCard && (
        <ForcedDealModal
          isOpen={Boolean(forcedDealOpponentId)}
          opponent={forcedDealOpponent}
          myCard={forcedDealMyCard}
          onSwapCard={handleConfirmForcedDeal}
          onClose={() => setForcedDealOpponentId(null)}
        />
      )}

      {/* F. Deal Breaker Modal (Stealing complete monopoly from chosen opponent) */}
      {dealBreakerOpponent && (
        <DealBreakerModal
          isOpen={Boolean(dealBreakerOpponentId)}
          opponent={dealBreakerOpponent}
          onStealSet={handleConfirmDealBreaker}
          onClose={() => setDealBreakerOpponentId(null)}
        />
      )}

      {/* G. Double Rent Modal (Offering to play rent x2 modifier) */}
      {pendingDoubleRentModal && (
        <DoubleRentModal
          isOpen={Boolean(pendingDoubleRentModal)}
          baseAmount={pendingDoubleRentModal.baseAmount}
          colorName={pendingDoubleRentModal.colorName}
          doubleRentCard={pendingDoubleRentModal.doubleRentCard}
          actionsRemaining={actionsRemaining}
          onConfirm={handleConfirmDoubleRent}
          onDecline={handleDeclineDoubleRent}
        />
      )}

      {/* H. Game Over Modal */}
      {isGameOver && winnerPlayer && (
        <div className={styles.gameOverOverlay}>
          <div className={styles.gameOverCard}>
            <span className={styles.trophyIcon}>🏆</span>
            <h2 className={styles.gameOverTitle}>{t('onlineGame.gameOverTitle')}</h2>
            <p className={styles.gameOverSubtitle}>
              {t('onlineGame.gameOverSubtitle', { name: winnerPlayer.name })}
            </p>
            <div className={styles.winnerPill}>
              {t('onlineGame.winnerBadge', { name: winnerPlayer.name })}
            </div>
            <button
              type="button"
              className={styles.returnLobbyBtn}
              onClick={handleLeaveGame}
            >
              {t('onlineGame.leaveGameBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
