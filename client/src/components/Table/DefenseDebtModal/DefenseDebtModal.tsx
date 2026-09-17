import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Modal';
import { PlayerBank } from '../PlayerBank/PlayerBank';
import { type CardModel } from '../../../types/cards';
import { type IncomingDebt } from '../../../mocks/useMockGame';
import styles from './DefenseDebtModal.module.css';

const DEBT_TIMEOUT_MS = 60000;

export interface DefenseDebtModalProps {
  isOpen: boolean;
  incomingDebt: IncomingDebt | null;
  bankCards: CardModel[];
  hasJustSayNo: boolean;
  onPay: (selectedCards: CardModel[]) => void;
  onJustSayNo: () => void;
}

export const DefenseDebtModal: React.FC<DefenseDebtModalProps> = ({
  isOpen,
  incomingDebt,
  bankCards,
  hasJustSayNo,
  onPay,
  onJustSayNo,
}) => {
  const { t } = useTranslation();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [timeLeftMs, setTimeLeftMs] = useState(DEBT_TIMEOUT_MS);

  const totalBank = useMemo(() => {
    return bankCards.reduce((sum, c) => sum + (c.value || 0), 0);
  }, [bankCards]);

  const selectedCards = useMemo(() => {
    const set = new Set(selectedCardIds);
    return bankCards.filter((c) => set.has(c.id));
  }, [bankCards, selectedCardIds]);

  const selectedTotal = useMemo(() => {
    return selectedCards.reduce((sum, c) => sum + (c.value || 0), 0);
  }, [selectedCards]);

  const requiredAmount = incomingDebt?.amount || 0;
  const isBankruptOrUnderfunded = totalBank < requiredAmount;
  const isPayValid =
    (selectedTotal >= requiredAmount && requiredAmount > 0) ||
    (isBankruptOrUnderfunded && selectedTotal === totalBank);

  const onPayRef = useRef(onPay);
  useEffect(() => {
    onPayRef.current = onPay;
  }, [onPay]);

  const selectedCardsRef = useRef(selectedCards);
  useEffect(() => {
    selectedCardsRef.current = selectedCards;
  }, [selectedCards]);

  // Timer countdown when modal is open
  useEffect(() => {
    if (!isOpen || !incomingDebt) return;

    const intervalMs = 100;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, DEBT_TIMEOUT_MS - elapsed);
      setTimeLeftMs(remainingTime);

      if (remainingTime <= 0) {
        clearInterval(interval);
        // Auto-pay with currently selected or all cards
        onPayRef.current(selectedCardsRef.current);
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
      setTimeLeftMs(DEBT_TIMEOUT_MS);
    };
  }, [isOpen, incomingDebt]);

  if (!isOpen || !incomingDebt) return null;

  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progressPercent = (timeLeftMs / DEBT_TIMEOUT_MS) * 100;

  const handleToggleSelectCard = (card: CardModel) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(card.id)) {
        return prev.filter((id) => id !== card.id);
      }
      return [...prev, card.id];
    });
  };

  const handleConfirmPay = () => {
    if (!isPayValid) return;
    onPay(selectedCards);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      width="fit-content"
      minWidth="min(620px, 95vw)"
      maxWidth="85vw"
      showCloseButton={false}
      closeOnOverlayClick={false}
      closeOnEscape={false}
      icon={<div className={styles.headerIconBadge}>💰</div>}
      title={t('board.defenseDebtTitle')}
      subtitle={t('board.defenseDebtSubtitle', {
        name: incomingDebt.attackerName,
        amount: incomingDebt.amount,
        reason: incomingDebt.reason,
      })}
      footer={
        <div className={styles.modalActions}>
          {/* Just Say No Button */}
          <div className={styles.justSayNoWrapper}>
            <button
              type="button"
              className={styles.justSayNoBtn}
              disabled={!hasJustSayNo}
              onClick={onJustSayNo}
              title={!hasJustSayNo ? t('board.defenseNoJustSayNoTooltip') : undefined}
            >
              🚫 {t('board.defenseJustSayNoBtn')}
            </button>
            {!hasJustSayNo && (
              <span className={styles.noCardTooltip}>
                {t('board.defenseNoJustSayNoTooltip')}
              </span>
            )}
          </div>

          {/* Pay Button */}
          <button
            type="button"
            className={styles.payBtn}
            disabled={!isPayValid}
            onClick={handleConfirmPay}
          >
            {isBankruptOrUnderfunded
              ? t('board.defensePayAllBtn', { amount: totalBank })
              : t('board.defensePayBtn', {
                  selected: selectedTotal,
                  required: requiredAmount,
                })}
          </button>
        </div>
      }
    >
      <div className={styles.contentContainer}>
        {/* 60s Countdown Timer */}
        <div className={styles.timerBarWrapper}>
          <div className={styles.timerHeader}>
            <span className={styles.timerLabel}>⏱️ Час на оплату:</span>
            <span className={`${styles.timerCountdown} ${secondsLeft <= 10 ? styles.timerUrgent : ''}`}>
              {t('board.defenseTimerSeconds', { seconds: secondsLeft })}
            </span>
          </div>
          <div className={styles.progressBarTrack}>
            <div
              className={`${styles.progressBarFill} ${secondsLeft <= 10 ? styles.progressUrgent : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Debt Amount Summary Header */}
        <div className={styles.summaryRow}>
          <div className={styles.summaryBadgeRequired}>
            <span className={styles.summaryLabel}>Вимога:</span>
            <span className={styles.summaryValue}>${requiredAmount}</span>
          </div>

          <div
            className={`${styles.summaryBadgeSelected} ${isPayValid ? styles.summaryBadgeValid : ''}`}
          >
            <span className={styles.summaryLabel}>Виділено:</span>
            <span className={styles.summaryValue}>${selectedTotal}</span>
          </div>
        </div>

        {/* Selectable Bank Cards Grid */}
        <div className={styles.bankSelectableWrapper}>
          <div className={styles.bankInstruction}>
            Клікніть на купюри у вашому банку, щоб обрати їх для оплати:
          </div>
          <PlayerBank
            bankCards={bankCards}
            isSelectableMode={true}
            selectedCardIds={selectedCardIds}
            onToggleSelectCard={handleToggleSelectCard}
            title="Ваш банк (оберіть картки для передачі)"
          />
        </div>
      </div>
    </Modal>
  );
};
