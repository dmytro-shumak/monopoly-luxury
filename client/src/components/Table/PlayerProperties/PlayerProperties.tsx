import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../Card/Card';
import { type MockPropertySet } from '../../../mocks/mockGameData';
import styles from './PlayerProperties.module.css';

export interface PlayerPropertiesProps {
  propertySets: MockPropertySet[];
  validDropTarget: 'bank' | 'property' | 'action' | null;
  onPlayToProperty: () => void;
}

export const PlayerProperties: React.FC<PlayerPropertiesProps> = ({
  propertySets,
  validDropTarget,
  onPlayToProperty,
}) => {
  const { t } = useTranslation();
  const isPropertyTarget = validDropTarget === 'property';

  return (
    <div
      className={`${styles.propertiesContainer} ${isPropertyTarget ? styles.propertiesContainerHighlight : ''}`}
      onClick={() => {
        if (isPropertyTarget) {
          onPlayToProperty();
        }
      }}
    >
      {/* Header bar */}
      <div className={styles.propertiesHeader}>
        <div className={styles.titleWrapper}>
          <span className={styles.propertiesIcon}>🏰</span>
          <span className={styles.propertiesTitle}>
            {t('board.properties')} ({propertySets.length})
          </span>
        </div>

        {isPropertyTarget && (
          <span className={styles.dropPrompt}>
            ⚡ {t('board.dropToProperty')}
          </span>
        )}
      </div>

      {/* Property Sets Row */}
      <div className={styles.setsGrid}>
        {propertySets.length === 0 ? (
          <div className={styles.emptyProperties}>{t('board.emptyDiscard')}</div>
        ) : (
          propertySets.map((set, setIdx) => (
            <div
              key={setIdx}
              className={`${styles.propertySetColumn} ${set.isComplete ? styles.setComplete : ''}`}
            >
              {/* Set Status Header */}
              <div className={styles.setColHeader}>
                <span className={styles.setCardCount}>
                  {set.cards.length} {t('board.cards')}
                </span>
                {set.isComplete && (
                  <span className={styles.completeBadge}>
                    {t('board.completeSet')}
                  </span>
                )}
                {set.hasHouse && <span className={styles.buildingIcon}>🏠</span>}
                {set.hasHotel && <span className={styles.buildingIcon}>🏨</span>}
              </div>

              {/* Stack of Cards for this Property Color */}
              <div className={styles.cardsStack}>
                {set.cards.map((card, cardIdx) => (
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
