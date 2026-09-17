import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Modal';
import { Card } from '../../Card/Card';
import { type CardModel } from '../../../types/cards';
import styles from './DiscardCardsModal.module.css';

export interface DiscardCardsModalProps {
  isOpen: boolean;
  handCards: CardModel[];
  excessCount: number;
  onConfirmDiscard: (cardIds: string[]) => void;
  onClose: () => void;
}

export const DiscardCardsModal: React.FC<DiscardCardsModalProps> = ({
  isOpen,
  handCards,
  excessCount,
  onConfirmDiscard,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  if (!isOpen || excessCount <= 0) return null;

  const isReadyToDiscard = selectedCardIds.length === excessCount;

  const handleToggleCard = (cardId: string) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length < excessCount) {
        return [...prev, cardId];
      }
      return prev;
    });
  };

  const handleConfirm = () => {
    if (!isReadyToDiscard) return;
    onConfirmDiscard(selectedCardIds);
    setSelectedCardIds([]);
  };

  const handleClose = () => {
    setSelectedCardIds([]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      width="fit-content"
      minWidth="min(640px, 95vw)"
      maxWidth="85vw"
      showCloseButton={false}
      closeOnOverlayClick={false}
      closeOnEscape={true}
      icon={<div className={styles.headerIconBadge}>🗑️</div>}
      title={t('board.discardTitle')}
      subtitle={t('board.discardSubtitle', { count: excessCount })}
      footer={
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={handleClose}
          >
            ← {t('board.discardBackBtn')}
          </button>

          <button
            type="button"
            className={styles.confirmDiscardBtn}
            disabled={!isReadyToDiscard}
            onClick={handleConfirm}
          >
            🗑️ {t('board.discardBtn', { count: excessCount })}
          </button>
        </div>
      }
    >
      <div className={styles.contentContainer}>
        {/* Summary Status Bar */}
        <div className={styles.summaryRow}>
          <div className={styles.limitBadge}>
            ⚠️ {t('board.discardLimitBadge', { current: handCards.length })}
          </div>

          <div
            className={`${styles.selectedBadge} ${isReadyToDiscard ? styles.selectedBadgeReady : ''}`}
          >
            {t('board.discardSelectedProgress', {
              selected: selectedCardIds.length,
              required: excessCount,
            })}
          </div>
        </div>

        {/* Hand Cards Grid */}
        <div className={styles.cardsGridWrapper}>
          <div className={styles.instructionText}>
            {t('board.discardSubtitle', { count: excessCount })}
          </div>

          <div className={styles.cardsRow}>
            {handCards.map((card) => {
              const isSelected = selectedCardIds.includes(card.id);

              return (
                <div
                  key={card.id}
                  className={`${styles.cardItem} ${isSelected ? styles.cardItemSelected : ''}`}
                  onClick={() => handleToggleCard(card.id)}
                >
                  <Card card={card} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};
