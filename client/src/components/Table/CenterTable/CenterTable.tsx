import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../Card/Card';
import { type CardModel } from '../../../types/cards';
import styles from './CenterTable.module.css';

export interface CenterTableProps {
  discardPile: CardModel[];
  activeActionCard: CardModel | null;
  validDropTarget: 'bank' | 'property' | 'action' | null;
  onPlayAction: () => void;
}

export const CenterTable: React.FC<CenterTableProps> = ({
  discardPile,
  activeActionCard,
  validDropTarget,
  onPlayAction,
}) => {
  const { t } = useTranslation();
  const isActionTarget = validDropTarget === 'action';
  const topDiscard = discardPile[0];

  return (
    <div className={styles.centerContainer}>
      {/* 1. Central Action Arena / Play Plinth */}
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

      {/* 2. Discard Pile */}
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

