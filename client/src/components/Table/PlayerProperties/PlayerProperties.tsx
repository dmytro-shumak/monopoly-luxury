import React, { useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../Card/Card';
import { CardColor } from '../../../types/cards';
import { PROPERTY_CONFIG } from '../../../data/allCards';
import { type MockPropertySet } from '../../../mocks/mockGameData';
import { type PropertyTarget } from '../../../mocks/useMockGame';
import styles from './PlayerProperties.module.css';

export interface PlayerPropertiesProps {
  propertySets: MockPropertySet[];
  validDropTarget?: 'bank' | 'property' | 'action' | null;
  validPropertyTargets?: PropertyTarget[];
  onPlayToTarget?: (target: PropertyTarget) => void;
  onPlayToProperty?: () => void;
  variant?: 'board' | 'tooltip';
  title?: string;
}

const getColorVar = (color: CardColor): string => {
  return `var(--color-prop-${color.toLowerCase().replace('_', '-')})`;
};

export const PlayerProperties: React.FC<PlayerPropertiesProps> = ({
  propertySets,
  validDropTarget: _validDropTarget,
  validPropertyTargets,
  onPlayToTarget,
  onPlayToProperty,
  variant = 'board',
  title,
}) => {
  const { t } = useTranslation();
  const isTooltip = variant === 'tooltip';
  const totalCardsCount = propertySets.reduce((sum, set) => sum + set.cards.length, 0);
  const displayTitle = title || `${t('board.properties')} (${propertySets.length})`;

  // Map of setIndex -> PropertyTarget for existing sets
  const existingTargetMap = useMemo(() => {
    const map = new Map<number, PropertyTarget>();
    if (!isTooltip && validPropertyTargets) {
      for (const target of validPropertyTargets) {
        if (target.type === 'existing') {
          map.set(target.setIndex, target);
        }
      }
    }
    return map;
  }, [isTooltip, validPropertyTargets]);

  // List of new set targets
  const newSetTargets = useMemo(() => {
    if (isTooltip || !validPropertyTargets) return [];
    return validPropertyTargets.filter(
      (t): t is Extract<PropertyTarget, { type: 'new_set' }> => t.type === 'new_set'
    );
  }, [isTooltip, validPropertyTargets]);

  const setsGridRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to beginning when new set targets appear so they are immediately visible
  useEffect(() => {
    if (newSetTargets.length > 0 && setsGridRef.current) {
      setsGridRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [newSetTargets.length]);

  return (
    <div
      className={`${styles.propertiesContainer} ${isTooltip ? styles.tooltipVariant : ''}`}
    >
      {/* Header bar */}
      <div className={styles.propertiesHeader}>
        <div className={styles.titleWrapper}>
          <span className={styles.propertiesIcon}>🏰</span>
          <span className={styles.propertiesTitle}>{displayTitle}</span>
        </div>

        <div className={styles.propertiesCountBadge}>
          {totalCardsCount} {t('board.cards')}
        </div>
      </div>

      {/* Property Sets Row */}
      <div ref={setsGridRef} className={styles.setsGrid}>
        {propertySets.length === 0 && newSetTargets.length === 0 ? (
          <div className={styles.emptyProperties}>{t('board.emptyDiscard')}</div>
        ) : (
          <>
            {/* "+ New Set" Slots for unrepresented or completed colors - rendered at the start for immediate visibility */}
            {newSetTargets.map((newTarget) => (
              <div
                key={`new_set_${newTarget.color}`}
                className={styles.newSetSlot}
                onClick={() => {
                  if (onPlayToTarget) {
                    onPlayToTarget(newTarget);
                  } else if (onPlayToProperty) {
                    onPlayToProperty();
                  }
                }}
              >
                <div className={styles.newSetSlotInner}>
                  <span
                    className={styles.colorDot}
                    style={{ background: getColorVar(newTarget.color) }}
                  />
                  <span className={styles.newSetPlus}>➕</span>
                  <span className={styles.newSetLabel}>
                    {t('board.newSet')}
                  </span>
                  <span className={styles.newSetColorName}>
                    {newTarget.color.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}

            {propertySets.map((set, setIdx) => {
              const target = existingTargetMap.get(setIdx);
              const isSetTarget = Boolean(target);
              const targetSetSize =
                set.cards.find((c) => c.fullSetSize)?.fullSetSize ||
                (set.color && PROPERTY_CONFIG[set.color]?.setSize) ||
                3;

              return (
                <div
                  key={setIdx}
                  className={`${styles.propertySetColumn} ${set.isComplete ? styles.setComplete : ''} ${isSetTarget ? styles.targetSetHighlight : ''}`}
                  onClick={() => {
                    if (isSetTarget && target) {
                      if (onPlayToTarget) {
                        onPlayToTarget(target);
                      } else if (onPlayToProperty) {
                        onPlayToProperty();
                      }
                    }
                  }}
                >
                  {/* Set Status Header */}
                  <div className={styles.setColHeader}>
                    {/* Left: Color dot + Progress (e.g. 1/3, 3/3) */}
                    <div className={styles.setInfoGroup}>
                      <span
                        className={styles.headerColorDot}
                        style={{ background: getColorVar(set.color) }}
                        title={set.color.replace('_', ' ')}
                      />
                      <span
                        className={`${styles.setProgressCount} ${set.isComplete ? styles.completeCount : ''}`}
                      >
                        {set.cards.length}/{targetSetSize}
                      </span>
                    </div>

                    {/* Right: Badges (Target Add, Complete Star, House/Hotel) */}
                    <div className={styles.setBadgesGroup}>
                      {isSetTarget && (
                        <span className={styles.targetSetBadge}>
                          ⚡ {t('board.addToSet')}
                        </span>
                      )}
                      {set.isComplete && !isSetTarget && (
                        <span className={styles.completeBadge}>
                          {t('board.completeSet')}
                        </span>
                      )}
                      {set.hasHouse && <span className={styles.buildingIcon}>🏠</span>}
                      {set.hasHotel && <span className={styles.buildingIcon}>🏨</span>}
                    </div>
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
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
