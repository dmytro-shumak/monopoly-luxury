import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Modal';
import { PlayerProperties } from '../PlayerProperties/PlayerProperties';
import { type MockPlayer } from '../../../mocks/mockGameData';
import styles from './DealBreakerModal.module.css';

export interface DealBreakerModalProps {
  isOpen: boolean;
  opponent: MockPlayer;
  onStealSet: (setIndex: number) => void;
  onClose: () => void;
}

export const DealBreakerModal: React.FC<DealBreakerModalProps> = ({
  isOpen,
  opponent,
  onStealSet,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);

  const selectedSet = useMemo(() => {
    if (selectedSetIndex === null) return null;
    return opponent.propertySets[selectedSetIndex] || null;
  }, [opponent.propertySets, selectedSetIndex]);

  const handleConfirmSteal = () => {
    if (selectedSetIndex === null || !selectedSet || !selectedSet.isComplete) return;
    onStealSet(selectedSetIndex);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="fit-content"
      minWidth="min(600px, 95vw)"
      maxWidth="80vw"
      showCloseButton={true}
      icon={<div className={styles.headerIconBadge}>⚡</div>}
      title={t('board.dealBreakerTitle')}
      subtitle={t('board.dealBreakerSubtitle', { name: opponent.name })}
      footer={
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.stealSetBtn}
            disabled={selectedSetIndex === null || !selectedSet?.isComplete}
            onClick={handleConfirmSteal}
          >
            {selectedSet && selectedSet.isComplete
              ? t('board.dealBreakerStealSetBtn', {
                  color: selectedSet.color.replace('_', ' '),
                  count: selectedSet.cards.length,
                })
              : t('board.dealBreakerStealBtn')}
          </button>

          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
          >
            {t('board.dealBreakerCancelBtn')}
          </button>
        </div>
      }
    >
      <div className={styles.bodyContainer}>
        <PlayerProperties
          propertySets={opponent.propertySets}
          variant="modal"
          isDealBreakerMode={true}
          selectedDealBreakerSetIndex={selectedSetIndex}
          onSelectDealBreakerSet={(idx) => setSelectedSetIndex(idx)}
          onDoubleClickDealBreakerSet={(idx) => onStealSet(idx)}
          title={t('board.opponentPropertiesTitle', { name: opponent.name })}
        />
      </div>
    </Modal>
  );
};
