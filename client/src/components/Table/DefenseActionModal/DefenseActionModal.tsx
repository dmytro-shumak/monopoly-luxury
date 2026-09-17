import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Modal';
import { Card } from '../../Card/Card';
import { type IncomingAction } from '../../../mocks/useMockGame';
import styles from './DefenseActionModal.module.css';

const REACTION_TIMEOUT_MS = 15000;

export interface DefenseActionModalProps {
  isOpen: boolean;
  incomingAction: IncomingAction | null;
  hasJustSayNo: boolean;
  onAccept: () => void;
  onJustSayNo: () => void;
}

export const DefenseActionModal: React.FC<DefenseActionModalProps> = ({
  isOpen,
  incomingAction,
  hasJustSayNo,
  onAccept,
  onJustSayNo,
}) => {
  const { t } = useTranslation();
  const [timeLeftMs, setTimeLeftMs] = useState(REACTION_TIMEOUT_MS);
  const onAcceptRef = useRef(onAccept);
  useEffect(() => {
    onAcceptRef.current = onAccept;
  }, [onAccept]);

  // Reset timer when modal opens with a new incoming action
  useEffect(() => {
    if (!isOpen || !incomingAction) return;

    const intervalMs = 100;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, REACTION_TIMEOUT_MS - elapsed);
      setTimeLeftMs(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onAcceptRef.current();
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
      setTimeLeftMs(REACTION_TIMEOUT_MS);
    };
  }, [isOpen, incomingAction]);

  if (!isOpen || !incomingAction) return null;

  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progressPercent = (timeLeftMs / REACTION_TIMEOUT_MS) * 100;

  // Determine modal subtitle based on attack type
  let subtitle = t('board.defenseActionSlySubtitle', { name: incomingAction.attackerName });
  if (incomingAction.type === 'deal_breaker') {
    subtitle = t('board.defenseActionDealBreakerSubtitle', { name: incomingAction.attackerName });
  } else if (incomingAction.type === 'forced_deal') {
    subtitle = t('board.defenseActionForcedSubtitle', { name: incomingAction.attackerName });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onAccept}
      width="fit-content"
      minWidth="min(580px, 95vw)"
      maxWidth="85vw"
      showCloseButton={false}
      closeOnOverlayClick={false}
      closeOnEscape={false}
      icon={<div className={styles.headerIconBadge}>🛡️</div>}
      title={t('board.defenseActionTitle')}
      subtitle={subtitle}
      footer={
        <div className={styles.modalActions}>
          {/* Accept Button */}
          <button
            type="button"
            className={styles.acceptBtn}
            onClick={onAccept}
          >
            ✓ {t('board.defenseAcceptActionBtn')}
          </button>

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
        </div>
      }
    >
      <div className={styles.contentContainer}>
        {/* Timer Bar */}
        <div className={styles.timerBarWrapper}>
          <div className={styles.timerHeader}>
            <span className={styles.timerLabel}>⏱️ Час на реакцію:</span>
            <span className={`${styles.timerCountdown} ${secondsLeft <= 5 ? styles.timerUrgent : ''}`}>
              {t('board.defenseTimerSeconds', { seconds: secondsLeft })}
            </span>
          </div>
          <div className={styles.progressBarTrack}>
            <div
              className={`${styles.progressBarFill} ${secondsLeft <= 5 ? styles.progressUrgent : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Attack Showcase: Sly Deal */}
        {incomingAction.type === 'sly_deal' && incomingAction.stolenCard && (
          <div className={styles.attackShowcase}>
            <div className={styles.targetCardBadge}>
              ⚡ {incomingAction.attackerName} викрадає карту нерухомості:
            </div>
            <div className={styles.singleCardPreview}>
              <Card card={incomingAction.stolenCard} />
            </div>
          </div>
        )}

        {/* Attack Showcase: Deal Breaker */}
        {incomingAction.type === 'deal_breaker' && incomingAction.stolenSet && (
          <div className={styles.attackShowcase}>
            <div className={styles.targetCardBadge}>
              ⚡ {incomingAction.attackerName} захоплює повний комплект:
            </div>
            <div className={styles.setCardsRow}>
              {incomingAction.stolenSet.cards.map((card, idx) => (
                <div key={`${card.id}_${idx}`} className={styles.setCardItem}>
                  <Card card={card} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attack Showcase: Forced Deal */}
        {incomingAction.type === 'forced_deal' && incomingAction.myTargetCard && incomingAction.theirCard && (
          <div className={styles.forcedDealShowcase}>
            <div className={styles.tradeCardCol}>
              <div className={styles.tradeCardLabelNegative}>
                Втрачаєте (ваша карта):
              </div>
              <div className={styles.singleCardPreview}>
                <Card card={incomingAction.myTargetCard} />
              </div>
            </div>

            <div className={styles.tradeExchangeIcon}>
              ⇄
            </div>

            <div className={styles.tradeCardCol}>
              <div className={styles.tradeCardLabelPositive}>
                Отримуєте (карта {incomingAction.attackerName}):
              </div>
              <div className={styles.singleCardPreview}>
                <Card card={incomingAction.theirCard} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
