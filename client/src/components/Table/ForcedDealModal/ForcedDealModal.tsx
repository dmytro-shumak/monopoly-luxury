import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Modal';
import { PlayerProperties } from '../PlayerProperties/PlayerProperties';
import { CardType, type CardModel } from '../../../types/cards';
import { type MockPlayer } from '../../../mocks/mockGameData';
import styles from './ForcedDealModal.module.css';

export interface ForcedDealModalProps {
  isOpen: boolean;
  opponent: MockPlayer;
  myCard: CardModel;
  onSwapCard: (opponentCard: CardModel) => void;
  onClose: () => void;
}

export const ForcedDealModal: React.FC<ForcedDealModalProps> = ({
  isOpen,
  opponent,
  myCard,
  onSwapCard,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // All cards of the opponent
  const allOpponentCards = useMemo(() => {
    return opponent.propertySets.flatMap((s) => s.cards);
  }, [opponent.propertySets]);

  const selectedCard = useMemo(() => {
    return allOpponentCards.find((c) => c.id === selectedCardId);
  }, [allOpponentCards, selectedCardId]);

  const isWildcard =
    selectedCard?.type === CardType.PROPERTY_WILDCARD ||
    Boolean(selectedCard?.colors && selectedCard.colors.length > 1);

  const handleConfirmSwap = () => {
    if (!selectedCard) return;
    onSwapCard(selectedCard);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="fit-content"
      minWidth="min(600px, 95vw)"
      maxWidth="80vw"
      showCloseButton={true}
      icon={<div className={styles.headerIconBadge}>🔄</div>}
      title={t('board.forcedDealTitle')}
      subtitle={t('board.forcedDealSubtitle', { name: opponent.name, myCard: myCard.name })}
      footer={
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.swapBtn}
            disabled={!selectedCard}
            onClick={handleConfirmSwap}
          >
            {selectedCard
              ? t('board.forcedDealSwapCardsBtn', {
                  myCard: myCard.name,
                  theirCard: selectedCard.name,
                })
              : t('board.forcedDealSwapBtn')}
          </button>

          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
          >
            {t('board.forcedDealCancelBtn')}
          </button>
        </div>
      }
    >
      <div className={styles.bodyContainer}>
        {/* Banner highlighting what card the player is giving */}
        <div className={styles.givingCardBanner}>
          <div className={styles.givingCardLabel}>
            <span>📤</span>
            <span>{t('board.forcedDealSelectOpponent', { card: myCard.name })}</span>
          </div>
        </div>

        <PlayerProperties
          propertySets={opponent.propertySets}
          variant="modal"
          isStealMode={true}
          selectedStealCardId={selectedCardId}
          onSelectStealCard={(card) => setSelectedCardId(card.id)}
          onDoubleClickStealCard={(card) => onSwapCard(card)}
          title={t('board.opponentPropertiesTitle', { name: opponent.name })}
        />

        {isWildcard && (
          <div className={styles.wildcardHintBanner}>
            <span>💡</span>
            <span>{t('board.slyDealWildHint')}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
