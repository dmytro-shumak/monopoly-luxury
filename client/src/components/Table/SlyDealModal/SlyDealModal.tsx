import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Modal';
import { PlayerProperties } from '../PlayerProperties/PlayerProperties';
import { CardType, type CardModel } from '../../../types/cards';
import { type MockPlayer } from '../../../mocks/mockGameData';
import styles from './SlyDealModal.module.css';

export interface SlyDealModalProps {
  isOpen: boolean;
  opponent: MockPlayer;
  onStealCard: (stolenCard: CardModel) => void;
  onClose: () => void;
}

export const SlyDealModal: React.FC<SlyDealModalProps> = ({
  isOpen,
  opponent,
  onStealCard,
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

  const handleConfirmSteal = () => {
    if (!selectedCard) return;
    onStealCard(selectedCard);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="fit-content"
      minWidth="min(600px, 95vw)"
      maxWidth="80vw"
      showCloseButton={true}
      icon={<div className={styles.headerIconBadge}>🥷</div>}
      title={t('board.slyDealTitle')}
      subtitle={t('board.slyDealSubtitle', { name: opponent.name })}
      footer={
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.stealBtn}
            disabled={!selectedCard}
            onClick={handleConfirmSteal}
          >
            {selectedCard
              ? t('board.slyDealStealCardBtn', { card: selectedCard.name })
              : t('board.slyDealStealBtn')}
          </button>

          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
          >
            {t('board.slyDealCancelBtn')}
          </button>
        </div>
      }
    >
      <div className={styles.bodyContainer}>
        <PlayerProperties
          propertySets={opponent.propertySets}
          variant="modal"
          isStealMode={true}
          selectedStealCardId={selectedCardId}
          onSelectStealCard={(card) => setSelectedCardId(card.id)}
          onDoubleClickStealCard={(card) => onStealCard(card)}
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
