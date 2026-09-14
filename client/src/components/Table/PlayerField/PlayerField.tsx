import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../Card/Card';
import { type CardModel } from '../../../types/cards';
import { type MockPropertySet } from '../../../mocks/mockGameData';
import styles from './PlayerField.module.css';

export interface PlayerFieldProps {
  bankCards: CardModel[];
  propertySets: MockPropertySet[];
  validDropTarget: 'bank' | 'property' | 'action' | null;
  onPlayToBank: () => void;
  onPlayToProperty: () => void;
}

export const PlayerField: React.FC<PlayerFieldProps> = ({
  bankCards,
  propertySets,
  validDropTarget,
  onPlayToBank,
  onPlayToProperty,
}) => {
  const { t } = useTranslation();
  const isBankTarget = validDropTarget === 'bank';
  const isPropertyTarget = validDropTarget === 'property';

  const totalBank = bankCards.reduce((sum, c) => sum + (c.value || 0), 0);

  return (
    <div className={styles.fieldContainer}>
      {/* 1. Bank Zone */}
      <div
        className={`${styles.bankSection} ${isBankTarget ? styles.bankSectionHighlight : ''}`}
        onClick={() => {
          if (isBankTarget) onPlayToBank();
        }}
      >
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            💰 {t('board.bank')}
          </span>
          <span className={styles.bankSum}>${totalBank}</span>
        </div>

        {isBankTarget && (
          <div className={styles.dropPrompt}>
            ⚡ {t('board.dropToBank')}
          </div>
        )}

        <div className={styles.bankCardsFan}>
          {bankCards.map((card, idx) => (
            <div key={`${card.id}_${idx}`} className={styles.bankCardItem}>
              <Card card={card} />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Property Sets Zone */}
      <div
        className={`${styles.propertySection} ${isPropertyTarget ? styles.propertySectionHighlight : ''}`}
        onClick={() => {
          if (isPropertyTarget) onPlayToProperty();
        }}
      >
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            🏰 {t('board.properties')} ({propertySets.length})
          </span>
          {isPropertyTarget && (
            <span className={styles.dropPrompt}>
              ⚡ {t('board.dropToProperty')}
            </span>
          )}
        </div>

        <div className={styles.propertyColumnsGrid}>
          {propertySets.map((set, setIdx) => (
            <div
              key={setIdx}
              className={`${styles.propertySetColumn} ${set.isComplete ? styles.propertySetComplete : ''}`}
            >
              <div className={styles.setColHeader}>
                <span>{set.cards.length} {t('board.cards')}</span>
                {set.isComplete && (
                  <span className={styles.completeBadge}>{t('board.completeSet')}</span>
                )}
                {set.hasHouse && <span>🏠</span>}
                {set.hasHotel && <span>🏨</span>}
              </div>

              <div className={styles.setCardsStack}>
                {set.cards.map((card, cIdx) => (
                  <div key={`${card.id}_${cIdx}`} className={styles.setCardWrapper}>
                    <Card card={card} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
