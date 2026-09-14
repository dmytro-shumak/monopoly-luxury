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
import { LanguageSwitcher } from '../../components/LanguageSwitcher/LanguageSwitcher';
import styles from './GameBoardPage.module.css';

export const GameBoardPage: React.FC = () => {
  const { t } = useTranslation();

  const {
    tableState,
    selectedCardId,
    validDropTarget,
    selectCard,
    playSelectedToBank,
    playSelectedToProperty,
    playSelectedAction,
    drawTwoCards,
    endTurn,
    resetMockState,
  } = useMockGameStore();

  const isMyTurn = tableState.turn.activePlayerId === 'player_you';
  const activePlayer = tableState.opponents.find((o) => o.id === tableState.turn.activePlayerId);
  const activePlayerName = isMyTurn ? t('board.you') : activePlayer?.name || 'Opponent';

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
        {/* Top: Opponents Area */}
        <section className={styles.opponentsWrapper}>
          <OpponentsArea
            opponents={tableState.opponents}
            activePlayerId={tableState.turn.activePlayerId}
          />
        </section>

        {/* Main Arena: Left Column (Bank + Hand) & Right Column (CenterTable + Properties) */}
        <div className={styles.arenaGrid}>
          {/* Left Column: Bank (Top) & Hand (Bottom) */}
          <section className={styles.leftColumn}>
            {/* 🟡 Yellow Zone: Player Bank */}
            <div className={styles.bankWrapper}>
              <PlayerBank
                bankCards={tableState.currentPlayer.bankCards}
                validDropTarget={validDropTarget}
                onPlayToBank={playSelectedToBank}
              />
            </div>

            {/* 🔴 Red Zone: Player Hand (Fixed width holding 9 cards max, overflow-x scroll) */}
            <div className={styles.handWrapper}>
              <PlayerHand
                cards={tableState.currentPlayer.handCards || []}
                selectedCardId={selectedCardId}
                onSelectCard={selectCard}
              />
            </div>
          </section>

          {/* Right Column: Center Table (Top) & Properties (Bottom) */}
          <section className={styles.rightColumn}>
            {/* Center Table: Deck, Action Arena, Discard Pile */}
            <div className={styles.centerWrapper}>
              <CenterTable
                deckCount={tableState.deckCount}
                discardPile={tableState.discardPile}
                activeActionCard={tableState.activeActionCard}
                validDropTarget={validDropTarget}
                onDrawCards={drawTwoCards}
                onPlayAction={playSelectedAction}
              />
            </div>

            {/* 🟢 Green Zone: Player Properties (Extends below Action Arena) */}
            <div className={styles.propertiesWrapper}>
              <PlayerProperties
                propertySets={tableState.currentPlayer.propertySets}
                validDropTarget={validDropTarget}
                onPlayToProperty={playSelectedToProperty}
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
    </div>
  );
};
