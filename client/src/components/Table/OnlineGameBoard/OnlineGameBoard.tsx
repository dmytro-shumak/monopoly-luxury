import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../../store/gameStore';
import { getCardModel } from '../../../data/allCards';
import { CardType, ActionCardType, CardColor, type CardModel } from '../../../types/cards';
import { type MockPlayer, type MockPropertySet } from '../../../mocks/mockGameData';
import { computeValidPropertyTargets, type PropertyTarget } from '../../../mocks/useMockGame';
import { OpponentsArea } from '../OpponentsArea/OpponentsArea';
import { CenterTable } from '../CenterTable/CenterTable';
import { PlayerBank } from '../PlayerBank/PlayerBank';
import { PlayerProperties } from '../PlayerProperties/PlayerProperties';
import { PlayerHand } from '../PlayerHand/PlayerHand';
import { TurnHUD } from '../TurnHUD/TurnHUD';
import { DiscardCardsModal } from '../DiscardCardsModal/DiscardCardsModal';
import { LanguageSwitcher } from '../../LanguageSwitcher/LanguageSwitcher';
import styles from './OnlineGameBoard.module.css';

export const OnlineGameBoard: React.FC = () => {
  const { t } = useTranslation();

  const {
    roomId,
    myPlayerId,
    roomState,
    playCard,
    endTurn,
    discardCards,
    leaveRoom,
  } = useGameStore();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [validDropTarget, setValidDropTarget] = useState<'bank' | 'property' | 'action' | null>(null);
  const [validPropertyTargets, setValidPropertyTargets] = useState<PropertyTarget[]>([]);
  const [targetingActionCard, setTargetingActionCard] = useState<CardModel | null>(null);

  if (!roomState || !myPlayerId) {
    return null;
  }

  const myPlayer = roomState.players[myPlayerId];
  if (!myPlayer) {
    return null;
  }

  const isMyTurn = roomState.activePlayerId === myPlayerId;
  const actionsRemaining = myPlayer.actionsRemaining ?? 0;
  const activePlayer = roomState.activePlayerId ? roomState.players[roomState.activePlayerId] : null;
  const activePlayerName = isMyTurn ? t('board.you') : activePlayer?.name || 'Opponent';

  // Map Current Player Cards
  const handCards: CardModel[] = myPlayer.hand.map(getCardModel);
  const bankCards: CardModel[] = myPlayer.bank.map(getCardModel);
  const propertySets: MockPropertySet[] = myPlayer.table.map((set) => ({
    color: set.color as CardColor,
    cards: set.cards.map(getCardModel),
    isComplete: set.isComplete,
  }));

  // Map Opponents
  const opponents: MockPlayer[] = roomState.playerOrder
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

  // Center Table data
  const deckCount = roomState.deckCount ?? 0;
  const discardPile = roomState.discardPile ?? [];
  const reversedDiscard = [...discardPile].reverse().map(getCardModel);

  // Selected card
  const selectedCard = handCards.find((c) => c.id === selectedCardId) || null;

  // Card Selection & Playing handlers
  const handleSelectCard = (cardId: string) => {
    if (!isMyTurn || actionsRemaining <= 0) return;

    if (selectedCardId === cardId) {
      setSelectedCardId(null);
      setValidDropTarget(null);
      setValidPropertyTargets([]);
      setTargetingActionCard(null);
    } else {
      setSelectedCardId(cardId);
      setTargetingActionCard(null);

      const card = handCards.find((c) => c.id === cardId);
      if (!card) return;

      if (card.type === CardType.MONEY) {
        setValidDropTarget('bank');
        setValidPropertyTargets([]);
      } else if (card.type === CardType.PROPERTY || card.type === CardType.PROPERTY_WILDCARD) {
        setValidDropTarget('property');
        const propTargets = computeValidPropertyTargets(card, propertySets);
        setValidPropertyTargets(propTargets);
      } else if (card.type === CardType.ACTION) {
        setValidDropTarget('action');
        setValidPropertyTargets([]);
      }
    }
  };

  const resetSelection = () => {
    setSelectedCardId(null);
    setValidDropTarget(null);
    setValidPropertyTargets([]);
    setTargetingActionCard(null);
  };

  const handlePlayToBank = () => {
    if (!selectedCard || !isMyTurn || actionsRemaining <= 0) return;
    playCard(selectedCard.id);
    resetSelection();
  };

  const handlePlayToPropertyTarget = (target: PropertyTarget) => {
    if (!selectedCard || !isMyTurn || actionsRemaining <= 0) return;
    playCard(selectedCard.id, { propertyColor: target.color });
    resetSelection();
  };

  const handlePlayToProperty = () => {
    if (!selectedCard || !isMyTurn || actionsRemaining <= 0) return;
    const target = validPropertyTargets[0];
    const color = target?.color || selectedCard.colors?.[0];
    playCard(selectedCard.id, color ? { propertyColor: color } : undefined);
    resetSelection();
  };

  const handlePlayActionDirect = () => {
    if (!selectedCard || !isMyTurn || actionsRemaining <= 0) return;
    if (selectedCard.actionType === ActionCardType.DEBT_COLLECTOR) {
      if (opponents.length === 1) {
        playCard(selectedCard.id, { targetId: opponents[0].id });
      } else {
        setTargetingActionCard(selectedCard);
        return;
      }
    } else {
      playCard(selectedCard.id);
    }
    resetSelection();
  };

  const handleSelectTargetOpponent = (targetId: string) => {
    if (!targetingActionCard || !isMyTurn || actionsRemaining <= 0) return;
    playCard(targetingActionCard.id, { targetId });
    resetSelection();
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
            onClick={leaveRoom}
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
            isSelectingTarget={Boolean(targetingActionCard)}
            onSelectTargetOpponent={handleSelectTargetOpponent}
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
                activeActionCard={null}
                validDropTarget={validDropTarget}
                onPlayAction={handlePlayActionDirect}
              />
            </div>

            {/* 🟢 Green Zone: Player Properties (Extends below Action Arena) */}
            <div className={styles.propertiesWrapper}>
              <PlayerProperties
                propertySets={propertySets}
                validDropTarget={validDropTarget}
                validPropertyTargets={validPropertyTargets}
                onPlayToTarget={handlePlayToPropertyTarget}
                onPlayToProperty={handlePlayToProperty}
                selectedCard={selectedCard}
                isMyTurn={isMyTurn}
                actionsRemaining={actionsRemaining}
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

      {/* 4. Discard Cards Modal */}
      <DiscardCardsModal
        isOpen={isDiscardPhase && excessCardsCount > 0}
        handCards={handCards}
        excessCount={excessCardsCount}
        onConfirmDiscard={handleConfirmDiscard}
        onClose={() => {}}
      />

      {/* 5. Game Over Modal */}
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
              onClick={leaveRoom}
            >
              {t('onlineGame.leaveGameBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
