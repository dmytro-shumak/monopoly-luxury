import React from 'react';
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
  return (
    <div className={styles.handContainer}>
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
