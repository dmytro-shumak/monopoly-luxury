import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Modal';
import { PlayerBank } from '../PlayerBank/PlayerBank';
import { PlayerProperties } from '../PlayerProperties/PlayerProperties';
import { type CardModel } from '../../../types/cards';
import { type MockPropertySet } from '../../../mocks/mockGameData';
import { type IncomingDebt } from '../../../mocks/useMockGame';
import styles from './DefenseDebtModal.module.css';

const DEBT_TIMEOUT_MS = 60000;

export type PaymentStage = 'bank' | 'free_props' | 'monopoly';

export interface DefenseDebtModalProps {
  isOpen: boolean;
  incomingDebt: IncomingDebt | null;
  bankCards: CardModel[];
  propertySets?: MockPropertySet[];
  hasJustSayNo: boolean;
  onPay: (selectedCards: CardModel[]) => void;
  onJustSayNo: () => void;
}

export const DefenseDebtModal: React.FC<DefenseDebtModalProps> = ({
  isOpen,
  incomingDebt,
  bankCards,
  propertySets = [],
  hasJustSayNo,
  onPay,
  onJustSayNo,
}) => {
  const { t } = useTranslation();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [timeLeftMs, setTimeLeftMs] = useState(DEBT_TIMEOUT_MS);

  // 1. Bank Cards & Value
  const availableBankCards = bankCards;
  const totalBankValue = useMemo(() => {
    return availableBankCards.reduce((sum, c) => sum + (c.value || 0), 0);
  }, [availableBankCards]);

  // 2. Free Properties (Incomplete sets, excluding buildings)
  const freePropertySets = useMemo(() => {
    return propertySets
      .filter((s) => !s.isComplete)
      .map((s) => ({
        ...s,
        cards: s.cards.filter((c) => !c.isBuilding),
      }))
      .filter((s) => s.cards.length > 0);
  }, [propertySets]);

  const freePropertyCards = useMemo(() => {
    return freePropertySets.flatMap((s) => s.cards);
  }, [freePropertySets]);

  // 3. Monopoly Properties (Complete sets, excluding buildings)
  const monopolyPropertySets = useMemo(() => {
    return propertySets
      .filter((s) => s.isComplete)
      .map((s) => ({
        ...s,
        cards: s.cards.filter((c) => !c.isBuilding),
      }))
      .filter((s) => s.cards.length > 0);
  }, [propertySets]);

  const monopolyPropertyCards = useMemo(() => {
    return monopolyPropertySets.flatMap((s) => s.cards);
  }, [monopolyPropertySets]);

  // Determine initial stage: dynamically starts at first non-empty asset category
  const initialStage = useMemo<PaymentStage>(() => {
    if (availableBankCards.length > 0) return 'bank';
    if (freePropertyCards.length > 0) return 'free_props';
    if (monopolyPropertyCards.length > 0) return 'monopoly';
    return 'bank';
  }, [availableBankCards.length, freePropertyCards.length, monopolyPropertyCards.length]);

  const [currentStage, setCurrentStage] = useState<PaymentStage>(initialStage);
  const [prevDebtId, setPrevDebtId] = useState<string | null>(null);

  // Reset stage & selection when modal opens or incoming debt changes
  const currentDebtKey = isOpen && incomingDebt ? `${incomingDebt.attackerId}_${incomingDebt.amount}_${incomingDebt.reason}` : null;
  if (currentDebtKey !== prevDebtId) {
    setPrevDebtId(currentDebtKey);
    setCurrentStage(initialStage);
    setSelectedCardIds([]);
  }

  // All available cards across all categories
  const allAvailableCards = useMemo(() => {
    return [...availableBankCards, ...freePropertyCards, ...monopolyPropertyCards];
  }, [availableBankCards, freePropertyCards, monopolyPropertyCards]);

  const selectedCards = useMemo(() => {
    const set = new Set(selectedCardIds);
    return allAvailableCards.filter((c) => set.has(c.id));
  }, [allAvailableCards, selectedCardIds]);

  const selectedTotal = useMemo(() => {
    return selectedCards.reduce((sum, c) => sum + (c.value || 0), 0);
  }, [selectedCards]);

  const requiredAmount = incomingDebt?.amount || 0;
  const isDebtFullyCovered = selectedTotal >= requiredAmount && requiredAmount > 0;

  // Subsequent stages pre-calculation
  const hasFreePropsAfterBank = freePropertyCards.length > 0;
  const hasMonopoliesAfterBank = monopolyPropertyCards.length > 0;

  const isAllBankSelected =
    availableBankCards.length === 0 ||
    availableBankCards.every((c) => selectedCardIds.includes(c.id));

  const isAllFreePropsSelected =
    freePropertyCards.length === 0 ||
    freePropertyCards.every((c) => selectedCardIds.includes(c.id));

  const isAllMonopoliesSelected =
    monopolyPropertyCards.length === 0 ||
    monopolyPropertyCards.every((c) => selectedCardIds.includes(c.id));

  // Determine Dynamic Action Button state
  type ActionState =
    | { type: 'PAY'; label: string }
    | { type: 'CONTINUE'; label: string; nextStage: PaymentStage }
    | { type: 'DISABLED'; label: string };

  const actionState: ActionState = useMemo(() => {
    if (isDebtFullyCovered) {
      return {
        type: 'PAY',
        label: t('board.defensePayBtn', {
          selected: selectedTotal,
          required: requiredAmount,
        }),
      };
    }

    if (currentStage === 'bank') {
      if (isAllBankSelected) {
        if (hasFreePropsAfterBank) {
          return {
            type: 'CONTINUE',
            label: t('board.defenseContinueBtn'),
            nextStage: 'free_props',
          };
        }
        if (hasMonopoliesAfterBank) {
          return {
            type: 'CONTINUE',
            label: t('board.defenseContinueMonopoliesBtn'),
            nextStage: 'monopoly',
          };
        }
        // No properties exist anywhere! Debt forgiveness with all bank funds
        return {
          type: 'PAY',
          label: t('board.defensePayAllBtn', { amount: selectedTotal }),
        };
      }
      return {
        type: 'DISABLED',
        label:
          totalBankValue < requiredAmount
            ? t('board.defenseSelectAllBankFirst')
            : t('board.defensePayBtn', {
                selected: selectedTotal,
                required: requiredAmount,
              }),
      };
    }

    if (currentStage === 'free_props') {
      if (isAllFreePropsSelected) {
        if (hasMonopoliesAfterBank) {
          return {
            type: 'CONTINUE',
            label: t('board.defenseContinueMonopoliesBtn'),
            nextStage: 'monopoly',
          };
        }
        // No monopolies exist anywhere! Debt forgiveness with all assets
        return {
          type: 'PAY',
          label: t('board.defensePayAllBtn', { amount: selectedTotal }),
        };
      }
      return {
        type: 'DISABLED',
        label: t('board.defensePayBtn', {
          selected: selectedTotal,
          required: requiredAmount,
        }),
      };
    }

    if (currentStage === 'monopoly') {
      if (isAllMonopoliesSelected) {
        // Complete bankruptcy: everything selected
        return {
          type: 'PAY',
          label: t('board.defensePayAllBtn', { amount: selectedTotal }),
        };
      }
      return {
        type: 'DISABLED',
        label: t('board.defensePayBtn', {
          selected: selectedTotal,
          required: requiredAmount,
        }),
      };
    }

    return {
      type: 'DISABLED',
      label: t('board.defensePayBtn', {
        selected: selectedTotal,
        required: requiredAmount,
      }),
    };
  }, [
    isDebtFullyCovered,
    selectedTotal,
    requiredAmount,
    currentStage,
    isAllBankSelected,
    hasFreePropsAfterBank,
    hasMonopoliesAfterBank,
    isAllFreePropsSelected,
    isAllMonopoliesSelected,
    totalBankValue,
    t,
  ]);

  const onPayRef = useRef(onPay);
  useEffect(() => {
    onPayRef.current = onPay;
  }, [onPay]);

  const selectedCardsRef = useRef(selectedCards);
  useEffect(() => {
    selectedCardsRef.current = selectedCards;
  }, [selectedCards]);

  // 60s Timer countdown when modal is open
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
        // Auto-pay with currently selected cards
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

  const handleActionClick = () => {
    if (actionState.type === 'CONTINUE') {
      setCurrentStage(actionState.nextStage);
    } else if (actionState.type === 'PAY') {
      onPay(selectedCards);
    }
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

          {/* Action Button: Dynamic Orange Continue or Green Pay */}
          {actionState.type === 'CONTINUE' ? (
            <button
              type="button"
              className={styles.continueBtn}
              onClick={handleActionClick}
            >
              {actionState.label}
            </button>
          ) : (
            <button
              type="button"
              className={styles.payBtn}
              disabled={actionState.type === 'DISABLED'}
              onClick={handleActionClick}
            >
              {actionState.label}
            </button>
          )}
        </div>
      }
    >
      <div className={styles.contentContainer}>
        {/* 60s Countdown Timer */}
        <div className={styles.timerBarWrapper}>
          <div className={styles.timerHeader}>
            <span className={styles.timerLabel}>⏱️ {t('board.timer') || 'Час на оплату'}:</span>
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
            <span className={styles.summaryLabel}>{t('board.demand') || 'Вимога'}:</span>
            <span className={styles.summaryValue}>${requiredAmount}</span>
          </div>

          <div
            className={`${styles.summaryBadgeSelected} ${isDebtFullyCovered ? styles.summaryBadgeValid : ''}`}
          >
            <span className={styles.summaryLabel}>{t('board.selected') || 'Виділено'}:</span>
            <span className={styles.summaryValue}>${selectedTotal}</span>
          </div>
        </div>

        {/* Stage Content: Dynamically renders only the active category */}
        {currentStage === 'bank' && (
          <div className={styles.bankSelectableWrapper}>
            <div className={styles.bankInstruction}>
              {t('board.defenseSelectBankInstruction')}
            </div>
            <PlayerBank
              bankCards={availableBankCards}
              isSelectableMode={true}
              selectedCardIds={selectedCardIds}
              onToggleSelectCard={handleToggleSelectCard}
              title={t('board.bank')}
            />
          </div>
        )}

        {currentStage === 'free_props' && (
          <div className={styles.propertiesSelectableWrapper}>
            <div className={styles.propertiesInstruction}>
              {t('board.defenseSelectPropsInstruction')}
            </div>
            <PlayerProperties
              propertySets={freePropertySets}
              variant="modal"
              isMultiSelectMode={true}
              selectedCardIds={selectedCardIds}
              onToggleSelectCard={handleToggleSelectCard}
              title={t('board.defenseFreePropsTitle')}
            />
          </div>
        )}

        {currentStage === 'monopoly' && (
          <div className={styles.propertiesSelectableWrapper}>
            <div className={styles.monopolyWarningBanner}>
              <span>⚠️</span>
              <span>{t('board.defenseMonopolyWarning')}</span>
            </div>
            <div className={styles.propertiesInstruction}>
              {t('board.defenseSelectMonopoliesInstruction')}
            </div>
            <PlayerProperties
              propertySets={monopolyPropertySets}
              variant="modal"
              isMultiSelectMode={true}
              selectedCardIds={selectedCardIds}
              onToggleSelectCard={handleToggleSelectCard}
              title={t('board.defenseMonopoliesTitle')}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
