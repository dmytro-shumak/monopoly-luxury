import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Modal';
import { Card } from '../../Card/Card';
import { type CardModel } from '../../../types/cards';
import styles from './DoubleRentModal.module.css';

export interface DoubleRentModalProps {
  isOpen: boolean;
  baseAmount: number;
  colorName?: string;
  doubleRentCard: CardModel;
  actionsRemaining: number;
  onConfirm: () => void;
  onDecline: () => void;
}

export const DoubleRentModal: React.FC<DoubleRentModalProps> = ({
  isOpen,
  baseAmount,
  colorName,
  doubleRentCard,
  actionsRemaining,
  onConfirm,
  onDecline,
}) => {
  const { t } = useTranslation();

  const doubledAmount = baseAmount * 2;
  const remainingAfter = Math.max(0, actionsRemaining - 1);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDecline}
      maxWidth="480px"
      icon={<div className={styles.headerIconBadge}>⚡</div>}
      title={t('board.doubleRentTitle')}
      subtitle={t('board.doubleRentDescription')}
      footer={
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
          >
            {t('board.doubleRentConfirm', { amount: doubledAmount })}
          </button>

          <button
            type="button"
            className={styles.declineBtn}
            onClick={onDecline}
          >
            {t('board.doubleRentDecline', { amount: baseAmount })}
          </button>
        </div>
      }
    >
      <div className={styles.modalBody}>
        <div className={styles.cardPreviewWrapper}>
          <Card card={doubleRentCard} />
        </div>

        <div className={styles.calcDetails}>
          <div className={styles.calcRow}>
            <span className={styles.calcRowLabel}>{t('board.baseRent')}:</span>
            <span className={styles.calcRowVal}>
              ${baseAmount} {colorName ? `(${colorName.replace('_', ' ')})` : ''}
            </span>
          </div>

          <div className={styles.calcRow}>
            <span className={styles.calcRowLabel}>{t('board.multiplier')}:</span>
            <span className={styles.calcRowVal}>× 2</span>
          </div>

          <div className={`${styles.calcRow} ${styles.calcRowHighlight}`}>
            <span className={styles.calcRowLabel}>{t('board.doubledRent')}:</span>
            <span className={styles.finalRentAmount}>${doubledAmount}</span>
          </div>

          <div className={styles.actionCostHint}>
            {t('board.doubleRentCostHint', { remaining: remainingAfter })}
          </div>
        </div>
      </div>
    </Modal>
  );
};
