import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../Card/Card';
import { type CardModel } from '../../../types/cards';
import styles from './PlayerHand.module.css';

export interface PlayerHandProps {
  cards: CardModel[];
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  selectedCardId,
  onSelectCard,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.handContainer}>
      {/* Hand Header */}
      <div className={styles.handHeader}>
        <div className={styles.titleWrapper}>
          <span className={styles.handIcon}>🃏</span>
          <span className={styles.handTitle}>
            {t('board.hand')} ({cards.length})
          </span>
        </div>
        <div className={styles.limitPill}>
          <span>{cards.length} / 7</span>
        </div>
      </div>

      {/* Cards Row (fits max 9 cards within fixed width, overflow-x: auto when > 9) */}
      <div className={styles.handCardsRow}>
        {cards.map((card) => {
          const isSelected = selectedCardId === card.id;

          return (
            <div
              key={card.id}
              className={`${styles.cardSlot} ${isSelected ? styles.cardSelected : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCard(card.id);
              }}
            >
              {isSelected && (
                <div className={styles.selectionIndicator}>
                  ★ SELECTED
                </div>
              )}
              <Card card={card} isHighlighted={isSelected} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
