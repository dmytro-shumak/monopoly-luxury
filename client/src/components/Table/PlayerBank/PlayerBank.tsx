import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../Card/Card';
import { type CardModel } from '../../../types/cards';
import styles from './PlayerBank.module.css';

// Bank section component with exact 7-card height calculation

export interface PlayerBankProps {
  bankCards: CardModel[];
  validDropTarget?: 'bank' | 'property' | 'action' | null;
  onPlayToBank?: () => void;
  variant?: 'board' | 'tooltip';
  title?: string;
}

export const PlayerBank: React.FC<PlayerBankProps> = ({
  bankCards,
  validDropTarget,
  onPlayToBank,
  variant = 'board',
  title,
}) => {
  const { t } = useTranslation();
  const isTooltip = variant === 'tooltip';
  const isBankTarget = !isTooltip && validDropTarget === 'bank';
  const displayTitle = title || t('board.bank');

  // Group bank cards strictly by denomination/value
  const denominationGroups = useMemo(() => {
    const groups: Record<number, CardModel[]> = {};
    for (const card of bankCards) {
      const val = card.value || 0;
      if (!groups[val]) {
        groups[val] = [];
      }
      groups[val].push(card);
    }

    // Sort ascending by value ($1, $2, $3, $4, $5, $10)
    return Object.entries(groups)
      .map(([valStr, cards]) => ({
        value: Number(valStr),
        cards,
      }))
      .sort((a, b) => a.value - b.value);
  }, [bankCards]);

  const totalBank = useMemo(() => {
    return bankCards.reduce((sum, c) => sum + (c.value || 0), 0);
  }, [bankCards]);

  // Dynamic maximum cards of any single denomination (minimum 3 cards)
  const maxStackCount = useMemo(() => {
    if (denominationGroups.length === 0) return 3;
    const maxInGroups = Math.max(...denominationGroups.map((g) => g.cards.length));
    return Math.max(3, maxInGroups);
  }, [denominationGroups]);

  return (
    <div
      className={`${styles.bankContainer} ${isTooltip ? styles.tooltipVariant : ''} ${isBankTarget ? styles.bankContainerHighlight : ''}`}
      data-max-stack={maxStackCount}
      onClick={() => {
        if (isBankTarget && onPlayToBank) {
          onPlayToBank();
        }
      }}
    >
      {/* Header with Title and Total Bank Balance */}
      <div className={styles.bankHeader}>
        <div className={styles.titleWrapper}>
          <span className={styles.bankIcon}>💰</span>
          <span className={styles.bankTitle}>{displayTitle}</span>
        </div>
        <div className={styles.bankSumBadge}>${totalBank}</div>
      </div>

      {/* Target drop prompt when a money or action card can be banked */}
      {isBankTarget && (
        <div className={styles.dropPrompt}>
          ⚡ {t('board.dropToBank')}
        </div>
      )}

      {/* Denomination Columns (Grouped only for cards of same value) */}
      <div className={styles.denominationsRow}>
        {denominationGroups.length === 0 ? (
          <div className={styles.emptyBank}>{t('board.emptyDiscard')}</div>
        ) : (
          denominationGroups.map((group) => (
            <div key={group.value} className={styles.denominationColumn}>
              {/* Value & Count Badge */}
              <div className={styles.denominationBadge}>
                <span className={styles.badgeValue}>${group.value}</span>
                <span className={styles.badgeCount}>×{group.cards.length}</span>
              </div>

              {/* Vertical cascading card stack for cards of this denomination */}
              <div className={styles.cardsStack}>
                {group.cards.map((card, cardIdx) => (
                  <div
                    key={`${card.id}_${cardIdx}`}
                    className={styles.cardItem}
                  >
                    <Card card={card} />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
