import React, { useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../Card/Card';
import { CardType, CardColor, BuildingType, ActionCardType, type CardModel } from '../../../types/cards';
import { PROPERTY_CONFIG } from '../../../data/allCards';
import { type MockPropertySet } from '../../../mocks/mockGameData';
import { type PropertyTarget, type TableMovingCard } from '../../../mocks/useMockGame';
import cardStyles from '../../Card/Card.module.css';
import styles from './PlayerProperties.module.css';

export interface PlayerPropertiesProps {
  propertySets: MockPropertySet[];
  validDropTarget?: 'bank' | 'property' | 'action' | null;
  validPropertyTargets?: PropertyTarget[];
  onPlayToTarget?: (target: PropertyTarget) => void;
  onPlayToProperty?: () => void;
  variant?: 'board' | 'tooltip' | 'modal';
  title?: string;
  selectedCard?: CardModel | null;
  tableMovingCard?: TableMovingCard | null;
  onStartTableCardMove?: (sourceSetIndex: number, card: CardModel) => void;
  onCancelTableCardMove?: () => void;
  onExecuteTableCardMove?: (target: PropertyTarget) => void;
  isMyTurn?: boolean;
  actionsRemaining?: number;
  isStealMode?: boolean;
  selectedStealCardId?: string | null;
  onSelectStealCard?: (card: CardModel) => void;
  onDoubleClickStealCard?: (card: CardModel) => void;
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
  selectedCard,
  tableMovingCard,
  onStartTableCardMove,
  onCancelTableCardMove,
  onExecuteTableCardMove,
  isMyTurn = false,
  actionsRemaining = 0,
  isStealMode = false,
  selectedStealCardId = null,
  onSelectStealCard,
  onDoubleClickStealCard,
}) => {
  const { t } = useTranslation();
  const isTooltip = variant === 'tooltip';
  const isModal = variant === 'modal';
  const totalCardsCount = propertySets.reduce((sum, set) => sum + set.cards.length, 0);
  const displayTitle = title || `${t('board.properties')} (${propertySets.length})`;
  const isTableMoveActive = Boolean(tableMovingCard);

  // Map of setIndex -> PropertyTarget for existing sets
  const existingTargetMap = useMemo(() => {
    const map = new Map<number, PropertyTarget>();
    if (isTooltip || isModal || isStealMode) return map;

    if (tableMovingCard && tableMovingCard.target.type === 'existing') {
      map.set(tableMovingCard.target.setIndex, tableMovingCard.target);
      return map;
    }

    if (validPropertyTargets) {
      for (const target of validPropertyTargets) {
        if (target.type === 'existing') {
          map.set(target.setIndex, target);
        }
      }
    }
    return map;
  }, [isTooltip, isModal, isStealMode, validPropertyTargets, tableMovingCard]);

  // List of new set targets
  const newSetTargets = useMemo(() => {
    if (isTooltip || isModal || isStealMode) return [];

    if (tableMovingCard && tableMovingCard.target.type === 'new_set') {
      return [tableMovingCard.target];
    }

    if (!validPropertyTargets) return [];
    return validPropertyTargets.filter(
      (t): t is Extract<PropertyTarget, { type: 'new_set' }> => t.type === 'new_set'
    );
  }, [isTooltip, isModal, isStealMode, validPropertyTargets, tableMovingCard]);

  const setsGridRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to beginning when new set targets appear so they are immediately visible
  useEffect(() => {
    if (newSetTargets.length > 0 && setsGridRef.current) {
      setsGridRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [newSetTargets.length]);

  return (
    <div
      className={`${styles.propertiesContainer} ${isTooltip ? styles.tooltipVariant : ''} ${isModal ? styles.modalVariant : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && isTableMoveActive) {
          onCancelTableCardMove?.();
        }
      }}
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
                  if (isTableMoveActive && onExecuteTableCardMove) {
                    onExecuteTableCardMove(newTarget);
                  } else if (onPlayToTarget) {
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
                  <span className={styles.newSetPlus}>
                    {isTableMoveActive ? '⚡' : '➕'}
                  </span>
                  <span className={styles.newSetLabel}>
                    {isTableMoveActive ? t('board.moveHere') : t('board.newSet')}
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

              const isSetDimmed = isStealMode && set.isComplete;

              return (
                <div
                  key={setIdx}
                  className={`${styles.propertySetColumn} ${set.isComplete ? styles.setComplete : ''} ${isSetTarget ? styles.targetSetHighlight : ''} ${isSetDimmed ? styles.monopolyDimmed : ''}`}
                  onClick={() => {
                    if (isSetTarget && target) {
                      if (isTableMoveActive && onExecuteTableCardMove) {
                        onExecuteTableCardMove(target);
                      } else if (onPlayToTarget) {
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
                          {selectedCard?.isBuilding === BuildingType.HOUSE || selectedCard?.actionType === ActionCardType.HOUSE
                            ? `🏠 ${t('board.addHouse')}`
                            : selectedCard?.isBuilding === BuildingType.HOTEL || selectedCard?.actionType === ActionCardType.HOTEL
                            ? `🏨 ${t('board.addHotel')}`
                            : `⚡ ${isTableMoveActive ? t('board.moveHere') : t('board.addToSet')}`}
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
                    {set.cards.map((card, cardIdx) => {
                      const isThisCardMoving = tableMovingCard?.cardId === card.id;
                      const isTwoColorWild =
                        !isTooltip &&
                        !isModal &&
                        !isStealMode &&
                        card.type === CardType.PROPERTY_WILDCARD &&
                        card.colors &&
                        card.colors.length === 2 &&
                        !card.colors.includes(CardColor.ALL_COLOR);

                      const canFlip =
                        isTwoColorWild &&
                        isMyTurn &&
                        actionsRemaining > 0 &&
                        !set.isComplete;

                      const altColor = isTwoColorWild
                        ? card.colors?.find((c) => c !== set.color)
                        : undefined;

                      const isStealable = isStealMode && !set.isComplete;
                      const isSelectedSteal = isStealMode && selectedStealCardId === card.id;

                      let cardClass: string | undefined = undefined;
                      if (isStealMode) {
                        if (isSelectedSteal) {
                          cardClass = cardStyles.selectedStealCard;
                        } else if (isStealable) {
                          cardClass = cardStyles.stealableCard;
                        }
                      } else if (isThisCardMoving) {
                        cardClass = cardStyles.flippableCardMoving;
                      } else if (canFlip) {
                        cardClass = cardStyles.flippableCard;
                      }

                      const itemClass = [
                        styles.cardItem,
                        canFlip ? styles.cardFlipEligible : '',
                        isThisCardMoving ? styles.cardMovingActive : '',
                        isStealable ? styles.stealableCardItem : '',
                        isSelectedSteal ? styles.selectedStealCardItem : '',
                      ].filter(Boolean).join(' ');

                      return (
                        <div
                          key={`${card.id}_${cardIdx}`}
                          className={itemClass}
                          title={
                            canFlip && altColor
                              ? t('board.swapColorHint', { color: altColor.replace('_', ' ') })
                              : undefined
                          }
                          onClick={(e) => {
                            if (isStealMode) {
                              e.stopPropagation();
                              if (isStealable && onSelectStealCard) {
                                onSelectStealCard(card);
                              }
                            } else if (canFlip) {
                              e.stopPropagation();
                              onStartTableCardMove?.(setIdx, card);
                            }
                          }}
                          onDoubleClick={(e) => {
                            if (isStealMode && isStealable && onDoubleClickStealCard) {
                              e.stopPropagation();
                              onDoubleClickStealCard(card);
                            }
                          }}
                        >
                          <Card card={card} className={cardClass} />
                        </div>
                      );
                    })}
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
