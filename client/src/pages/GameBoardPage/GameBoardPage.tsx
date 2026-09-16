import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMockGameStore } from '../../mocks/useMockGame';
import { OpponentsArea } from '../../components/Table/OpponentsArea/OpponentsArea';
import { CenterTable } from '../../components/Table/CenterTable/CenterTable';
import { PlayerBank } from '../../components/Table/PlayerBank/PlayerBank';
import { PlayerProperties } from '../../components/Table/PlayerProperties/PlayerProperties';
import { PlayerHand } from '../../components/Table/PlayerHand/PlayerHand';
import { TurnHUD } from '../../components/Table/TurnHUD/TurnHUD';
import { DoubleRentModal } from '../../components/Table/DoubleRentModal/DoubleRentModal';
import { SlyDealModal } from '../../components/Table/SlyDealModal/SlyDealModal';
import { ForcedDealModal } from '../../components/Table/ForcedDealModal/ForcedDealModal';
import { DealBreakerModal } from '../../components/Table/DealBreakerModal/DealBreakerModal';
import { LanguageSwitcher } from '../../components/LanguageSwitcher/LanguageSwitcher';
import styles from './GameBoardPage.module.css';

export const GameBoardPage: React.FC = () => {
  const { t } = useTranslation();

  const {
    tableState,
    selectedCardId,
    validDropTarget,
    validPropertyTargets,
    tableMovingCard,
    activeMoneyDemand,
    pendingDoubleRent,
    activeSlyDeal,
    slyDealTargetOpponentId,
    activeForcedDeal,
    forcedDealMyCard,
    forcedDealTargetOpponentId,
    activeDealBreaker,
    dealBreakerTargetOpponentId,
    pendingStolenCardPlacement,
    selectCard,
    playSelectedToBank,
    playSelectedToProperty,
    playSelectedAction,
    confirmDoubleRent,
    declineDoubleRent,
    executeOpponentPayment,
    selectSlyDealOpponent,
    executeSlyDeal,
    cancelSlyDeal,
    selectForcedDealMyCard,
    selectForcedDealOpponent,
    cancelForcedDealOpponent,
    executeForcedDeal,
    selectDealBreakerOpponent,
    cancelDealBreakerOpponent,
    executeDealBreaker,
    startTableCardMove,
    cancelTableCardMove,
    executeTableCardMove,
    drawTwoCards,
    endTurn,
    resetMockState,
  } = useMockGameStore();

  const isMyTurn = tableState.turn.activePlayerId === 'player_you';
  const activePlayer = tableState.opponents.find((o) => o.id === tableState.turn.activePlayerId);
  const activePlayerName = isMyTurn ? t('board.you') : activePlayer?.name || 'Opponent';
  const selectedCard = tableState.currentPlayer.handCards?.find((c) => c.id === selectedCardId);
  const slyDealTargetOpponent = tableState.opponents.find((o) => o.id === slyDealTargetOpponentId);
  const forcedDealTargetOpponent = tableState.opponents.find((o) => o.id === forcedDealTargetOpponentId);
  const dealBreakerTargetOpponent = tableState.opponents.find((o) => o.id === dealBreakerTargetOpponentId);

  return (
    <div className={styles.pageContainer}>
      {/* 1. Header Bar */}
      <header className={styles.navHeader}>
        <div className={styles.leftNav}>
          <span className={styles.roomBadge}>
            💎 {t('board.room')}
          </span>
          <span className={styles.brandTitle}>Monopoly Deal</span>
        </div>

        <div className={styles.rightNav}>
          <Link to="/cards" className={styles.deckLink}>
            <span>🃏</span>
            <span>{t('gameBoard.viewDeckButton', { count: 107 })}</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      {/* 2. Main Luxury Table Felt */}
      <main className={styles.tableFelt}>
        {/* Top-Right Deck Counter (Purely Static Information) */}
        <div className={styles.deckCounterWidget}>
          <span className={styles.deckIcon}>🎴</span>
          <span className={styles.deckLabel}>{t('board.deck')}:</span>
          <span className={styles.deckCountValue}>{tableState.deckCount}</span>
        </div>

        {/* Top: Opponents Area */}
        <section className={styles.opponentsWrapper}>
          <OpponentsArea
            opponents={tableState.opponents}
            activePlayerId={tableState.turn.activePlayerId}
            isSelectingTarget={Boolean(activeMoneyDemand && activeMoneyDemand.targetType === 'single_player')}
            targetDemandAmount={activeMoneyDemand?.amount}
            isSelectingSlyDealTarget={Boolean(activeSlyDeal && !slyDealTargetOpponentId && !pendingStolenCardPlacement)}
            isSelectingForcedDealTarget={Boolean(activeForcedDeal && forcedDealMyCard && !forcedDealTargetOpponentId && !pendingStolenCardPlacement)}
            isSelectingDealBreakerTarget={Boolean(activeDealBreaker && !dealBreakerTargetOpponentId)}
            onSelectTargetOpponent={executeOpponentPayment}
            onSelectSlyDealOpponent={selectSlyDealOpponent}
            onSelectForcedDealOpponent={selectForcedDealOpponent}
            onSelectDealBreakerOpponent={selectDealBreakerOpponent}
          />
        </section>

        {/* Main Arena: Left Column (Bank + Hand) & Right Column (CenterTable + Properties) */}
        <div className={styles.arenaGrid}>
          {/* Left Column: Bank + Player Hand */}
          <section className={styles.leftColumn}>
            {/* 🟡 Gold Zone: Bank */}
            <div className={styles.bankWrapper}>
              <PlayerBank
                bankCards={tableState.currentPlayer.bankCards}
                validDropTarget={validDropTarget}
                onPlayToBank={playSelectedToBank}
              />
            </div>

            {/* Hand Cards */}
            <div className={styles.handWrapper}>
              <PlayerHand
                cards={tableState.currentPlayer.handCards || []}
                selectedCardId={selectedCardId}
                onSelectCard={selectCard}
              />
            </div>
          </section>

          {/* Right Column: Center Action Arena & Discard Pile (Top) + Player Properties (Bottom) */}
          <section className={styles.rightColumn}>
            {/* Center Table: Action Arena & Discard Pile */}
            <div className={styles.centerWrapper}>
              <CenterTable
                discardPile={tableState.discardPile}
                activeActionCard={tableState.activeActionCard}
                validDropTarget={validDropTarget}
                onPlayAction={playSelectedAction}
              />
            </div>

            {/* 🟢 Green Zone: Player Properties (Extends below Action Arena) */}
            <div className={styles.propertiesWrapper}>
              <PlayerProperties
                propertySets={tableState.currentPlayer.propertySets}
                validDropTarget={validDropTarget}
                validPropertyTargets={validPropertyTargets}
                onPlayToTarget={playSelectedToProperty}
                selectedCard={selectedCard || pendingStolenCardPlacement?.card || null}
                tableMovingCard={tableMovingCard}
                onStartTableCardMove={startTableCardMove}
                onCancelTableCardMove={cancelTableCardMove}
                onExecuteTableCardMove={executeTableCardMove}
                isMyTurn={isMyTurn}
                actionsRemaining={tableState.turn.actionsRemaining}
                isTradeGiveMode={Boolean(activeForcedDeal && !forcedDealMyCard)}
                selectedTradeGiveCardId={forcedDealMyCard?.id}
                onSelectTradeGiveCard={selectForcedDealMyCard}
              />
            </div>
          </section>
        </div>
      </main>

      {/* 3. Bottom HUD / Controls */}
      <TurnHUD
        isMyTurn={isMyTurn}
        activePlayerName={activePlayerName}
        actionsRemaining={tableState.turn.actionsRemaining}
        maxActions={tableState.turn.maxActions}
        onDrawCards={drawTwoCards}
        onEndTurn={endTurn}
        onResetMock={resetMockState}
      />

      {/* 4. Double Rent Confirm Modal */}
      {pendingDoubleRent && (
        <DoubleRentModal
          isOpen={Boolean(pendingDoubleRent)}
          baseAmount={pendingDoubleRent.baseAmount}
          colorName={pendingDoubleRent.color}
          doubleRentCard={pendingDoubleRent.doubleRentCard}
          actionsRemaining={tableState.turn.actionsRemaining}
          onConfirm={confirmDoubleRent}
          onDecline={declineDoubleRent}
        />
      )}

      {/* 5. Sly Deal Modal */}
      {slyDealTargetOpponent && (
        <SlyDealModal
          isOpen={Boolean(slyDealTargetOpponentId && slyDealTargetOpponent)}
          opponent={slyDealTargetOpponent}
          onStealCard={(stolenCard) => executeSlyDeal(slyDealTargetOpponent.id, stolenCard)}
          onClose={cancelSlyDeal}
        />
      )}

      {/* 6. Forced Deal Modal */}
      {forcedDealTargetOpponent && forcedDealMyCard && (
        <ForcedDealModal
          isOpen={Boolean(forcedDealTargetOpponentId && forcedDealTargetOpponent && forcedDealMyCard)}
          opponent={forcedDealTargetOpponent}
          myCard={forcedDealMyCard}
          onSwapCard={(opponentCard) => executeForcedDeal(forcedDealTargetOpponent.id, opponentCard)}
          onClose={cancelForcedDealOpponent}
        />
      )}

      {/* 7. Deal Breaker Modal */}
      {dealBreakerTargetOpponent && (
        <DealBreakerModal
          isOpen={Boolean(dealBreakerTargetOpponentId && dealBreakerTargetOpponent)}
          opponent={dealBreakerTargetOpponent}
          onStealSet={(setIndex) => executeDealBreaker(dealBreakerTargetOpponent.id, setIndex)}
          onClose={cancelDealBreakerOpponent}
        />
      )}
    </div>
  );
};
