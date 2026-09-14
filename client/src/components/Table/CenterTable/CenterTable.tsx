import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../Card/Card';
import { CardBack } from '../../Card/CardBack';
import { type CardModel } from '../../../types/cards';
import styles from './CenterTable.module.css';

export interface CenterTableProps {
  deckCount: number;
  discardPile: CardModel[];
  activeActionCard: CardModel | null;
  validDropTarget: 'bank' | 'property' | 'action' | null;
  onDrawCards: () => void;
  onPlayAction: () => void;
}

export const CenterTable: React.FC<CenterTableProps> = ({
  deckCount,
  discardPile,
  activeActionCard,
  validDropTarget,
  onDrawCards,
  onPlayAction,
}) => {
  const { t } = useTranslation();
  const isActionTarget = validDropTarget === 'action';
  const topDiscard = discardPile[0];

  return (
    <div className={styles.centerContainer}>
      {/* 1. Draw Deck */}
      <div className={styles.pileWrapper}>
        <div className={styles.deckStack} onClick={onDrawCards} title={t('board.drawCards')}>
          <div className={styles.deckLayer2} />
          <div className={styles.deckLayer1} />
          <div className={styles.deckTop}>
            <CardBack />
          </div>
        </div>
        <span className={styles.countPill}>
          {t('board.deck')}: {deckCount}
        </span>
      </div>

      {/* 2. Central Action Arena / Play Plinth */}
      <div
        className={`${styles.actionArena} ${isActionTarget ? styles.actionArenaHighlight : ''}`}
        onClick={() => {
          if (isActionTarget) {
            onPlayAction();
          }
        }}
      >
        {activeActionCard ? (
          <div className={styles.activeCardWrapper}>
            <Card card={activeActionCard} />
          </div>
        ) : isActionTarget ? (
          <div className={styles.actionPromptText}>
            ⚡ {t('board.dropToAction')}
          </div>
        ) : (
          <div className={styles.actionArenaText}>
            {t('board.actionArena')}
          </div>
        )}
      </div>

      {/* 3. Discard Pile */}
      <div className={styles.pileWrapper}>
        <div className={styles.discardStack}>
          {topDiscard ? (
            <div className={styles.discardTop}>
              <Card card={topDiscard} />
            </div>
          ) : (
            <div className={styles.emptyDiscard}>
              {t('board.emptyDiscard')}
            </div>
          )}
        </div>
        <span className={styles.countPill}>
          {t('board.discard')}: {discardPile.length}
        </span>
      </div>
    </div>
  );
};
