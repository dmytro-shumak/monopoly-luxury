import React from 'react';
import styles from './Card.module.css';
import { type CardModel, CardType, ActionCardType, CardColor, BuildingType } from '../../types/cards';

export interface CardProps {
  card: CardModel;
  onClick?: () => void;
  isHighlighted?: boolean;
}

// Crisp inline SVGs matching the physical cards in the photo
const ActionIcons: Record<string, () => React.JSX.Element> = {
  PASS_GO: () => (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="15" stroke="var(--color-gold)" strokeWidth="1.5" strokeDasharray="3 2" />
      <path d="M12 24L24 12" stroke="var(--color-gold-light)" strokeWidth="3" />
      <path d="M15 12H24V21" stroke="var(--color-gold-light)" strokeWidth="3" />
    </svg>
  ),
  JUST_SAY_NO: () => (
    <svg viewBox="0 0 36 36" width="38" height="38" fill="none">
      <polygon points="18,3 32,8 32,22 18,33 4,22 4,8" fill="#8B0000" stroke="var(--color-gold)" strokeWidth="2" />
      <text x="18" y="22" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" fontFamily="sans-serif">НI!</text>
    </svg>
  ),
  SLY_DEAL: () => (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 18c0-2 2-4 5-4h4l5 4 6-2c2 0 4 2 4 4s-2 4-4 4h-5l-4-3-4 1H11c-3 0-5-2-5-4z" stroke="var(--color-gold)" fill="rgba(212,175,55,0.15)" />
      <path d="M22 8l4 6-3 2-4-6z" fill="var(--color-gold-light)" stroke="var(--color-gold)" />
    </svg>
  ),
  FORCED_DEAL: () => (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 13h18l-5-5" stroke="var(--color-gold-light)" />
      <path d="M29 23H11l5 5" stroke="var(--color-gold)" />
    </svg>
  ),
  DEAL_BREAKER: () => (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
      <path d="M5 24L10 12L18 19L26 12L31 24Z" fill="rgba(212,175,55,0.2)" stroke="var(--color-gold)" strokeWidth="2" />
      <line x1="18" y1="9" x2="18" y2="28" stroke="#ff4d4d" strokeWidth="3" strokeDasharray="3 2" />
      <circle cx="18" cy="7" r="2" fill="var(--color-gold-light)" />
      <circle cx="10" cy="10" r="2" fill="var(--color-gold-light)" />
      <circle cx="26" cy="10" r="2" fill="var(--color-gold-light)" />
    </svg>
  ),
  DEBT_COLLECTOR: () => (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
      <text x="18" y="24" textAnchor="middle" fill="var(--color-gold-light)" fontSize="16" fontWeight="900" fontFamily="serif" letterSpacing="1">$$$</text>
      <circle cx="18" cy="18" r="16" stroke="var(--color-gold)" strokeWidth="1.5" strokeDasharray="2 3" />
    </svg>
  ),
  BIRTHDAY: () => (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
      <rect x="7" y="16" width="22" height="15" rx="2" fill="rgba(212,175,55,0.2)" stroke="var(--color-gold)" strokeWidth="1.5" />
      <rect x="5" y="11" width="26" height="5" rx="1.5" fill="var(--color-gold)" />
      <line x1="18" y1="11" x2="18" y2="31" stroke="var(--color-gold-light)" strokeWidth="2.5" />
      <path d="M18 11 C14 5, 9 8, 14 11 Z" fill="var(--color-prop-pink)" stroke="var(--color-gold)" strokeWidth="1" />
      <path d="M18 11 C22 5, 27 8, 22 11 Z" fill="var(--color-prop-pink)" stroke="var(--color-gold)" strokeWidth="1" />
    </svg>
  ),
  HOUSE: () => (
    <svg viewBox="0 0 36 36" width="34" height="34" fill="none">
      <path d="M6 16L18 6L30 16V30H6V16Z" fill="#238b45" stroke="var(--color-gold)" strokeWidth="2" />
      <rect x="14" y="20" width="8" height="10" fill="var(--color-gold-light)" />
    </svg>
  ),
  HOTEL: () => (
    <svg viewBox="0 0 36 36" width="34" height="34" fill="none">
      <rect x="8" y="8" width="20" height="24" rx="2" fill="#d32f2f" stroke="var(--color-gold)" strokeWidth="2" />
      <rect x="12" y="12" width="4" height="4" fill="var(--color-gold-light)" />
      <rect x="20" y="12" width="4" height="4" fill="var(--color-gold-light)" />
      <rect x="12" y="18" width="4" height="4" fill="var(--color-gold-light)" />
      <rect x="20" y="18" width="4" height="4" fill="var(--color-gold-light)" />
      <rect x="15" y="25" width="6" height="7" fill="var(--color-gold)" />
    </svg>
  ),
  DOUBLE_RENT: () => (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
      <circle cx="18" cy="18" r="16" fill="rgba(212,175,55,0.15)" stroke="var(--color-gold)" strokeWidth="2" />
      <text x="18" y="24" textAnchor="middle" fill="var(--color-gold-light)" fontSize="18" fontWeight="bold" fontFamily="serif">x2</text>
    </svg>
  ),
  RENT: () => (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
      <circle cx="18" cy="18" r="15" stroke="var(--color-gold)" strokeWidth="1.5" />
      <path d="M12 18h12M18 12l6 6-6 6" stroke="var(--color-gold-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};

const getColorVar = (color?: CardColor): string => {
  if (!color) return 'transparent';
  if (color === CardColor.ALL_COLOR) return 'var(--color-prop-all-color)';
  return `var(--color-prop-${color.toLowerCase().replace('_', '-')})`;
};

export const Card: React.FC<CardProps> = ({ card, onClick, isHighlighted }) => {
  const { type, value, colors, name, description, actionType, isBuilding, rentValues, fullSetSize } = card;

  // Render corner value badge - ONLY for MONEY, PROPERTY, and PROPERTY_WILDCARD
  const renderValueBadge = () => {
    if (type !== CardType.MONEY && type !== CardType.PROPERTY && type !== CardType.PROPERTY_WILDCARD) {
      return null;
    }
    if (value === undefined) return null;
    return (
      <div className={styles.cornerValue}>
        <span>${value}</span>
      </div>
    );
  };

  return (
    <div
      className={`${styles.card} ${isHighlighted ? styles.highlighted : ''}`}
      onClick={onClick}
      data-card-type={type}
    >
      <div className={styles.outerBorder}>
        <div className={styles.innerCard}>
          
          {/* Top Corner Value (ONLY for MONEY, PROPERTY, PROPERTY_WILDCARD) */}
          {renderValueBadge()}

          {/* 1. MONEY CARD */}
          {type === CardType.MONEY && (
            <div className={styles.moneyContent}>
              <div className={styles.vintageFiligreeTop}>
                <span>✦ ✦ ✦</span>
              </div>
              <div className={styles.moneyCenter}>
                <div className={styles.moneyAmount}>${value}</div>
              </div>
              <div className={styles.vintageFiligreeBottom}>
                <span>✦ ✦ ✦</span>
              </div>
            </div>
          )}

          {/* 2. PROPERTY CARD */}
          {type === CardType.PROPERTY && colors && colors[0] && (
            <div className={styles.propertyContent}>
              {/* Top Colored Banner with Name */}
              <div className={styles.propBanner} style={{ background: getColorVar(colors[0]) }}>
                <span className={styles.propName}>{name}</span>
              </div>

              {/* Middle Rent Progression Table */}
              <div className={styles.rentTable}>
                <div className={styles.rentHeader}>РЕНТА</div>
                {rentValues && rentValues.map((val, idx) => (
                  <div key={idx} className={styles.rentRow}>
                    <span className={styles.rentHouses}>
                      {Array.from({ length: idx + 1 }).map((_, i) => (
                        <span key={i} className={styles.miniHouseIcon}>🏰</span>
                      ))}
                    </span>
                    <span className={styles.rentPrice}>${val}</span>
                  </div>
                ))}
                {fullSetSize && (
                  <div className={styles.setInfo}>
                    Комплект: {fullSetSize} шт.
                  </div>
                )}
              </div>

              {/* Bottom Colored Accent Bar */}
              <div className={styles.propBottomBar} style={{ background: getColorVar(colors[0]) }}></div>
            </div>
          )}

          {/* 3. PROPERTY WILDCARD (УНІВЕРСАЛЬНА КАРТА) */}
          {type === CardType.PROPERTY_WILDCARD && colors && (
            <div className={styles.wildcardContent}>
              {/* Dual Color or Rainbow Banner */}
              <div className={styles.wildBannerContainer}>
                {colors[0] === CardColor.ALL_COLOR ? (
                  <div className={styles.wildBannerAllColor} />
                ) : (
                  <div className={styles.wildBannerSplit}>
                    <div className={styles.wildHalf} style={{ background: getColorVar(colors[0]) }}></div>
                    <div className={styles.wildHalf} style={{ background: getColorVar(colors[1] || colors[0]) }}></div>
                  </div>
                )}
              </div>

              <div className={styles.wildcardName}>{name}</div>
              
              <div className={styles.wildcardBody}>
                <div className={styles.wildcardBadge}>УНІВЕРСАЛЬНА КАРТА</div>
                <div className={styles.wildcardDesc}>{description}</div>
              </div>

              {/* Bottom split bar */}
              <div className={styles.wildBannerContainerBottom}>
                {colors[0] === CardColor.ALL_COLOR ? (
                  <div className={styles.wildBannerAllColorBottom} />
                ) : (
                  <div className={styles.wildBannerSplit}>
                    <div className={styles.wildHalf} style={{ background: getColorVar(colors[0]) }}></div>
                    <div className={styles.wildHalf} style={{ background: getColorVar(colors[1] || colors[0]) }}></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. ACTION / RENT CARD - NO MONEY / NO BANK VALUES */}
          {type === CardType.ACTION && (
            <div className={styles.actionContent}>
              {/* Colored Rent Indicators if Rent Card */}
              {actionType === ActionCardType.RENT && colors && (
                <div className={styles.rentColorsBar}>
                  {colors[0] === CardColor.ALL_COLOR ? (
                    <div className={styles.rentAllColorBar}>БУДЬ-ЯКИЙ КОЛIР</div>
                  ) : (
                    <div className={styles.rentDualBar}>
                      <span className={styles.rentDot} style={{ background: getColorVar(colors[0]) }} />
                      <span className={styles.rentDot} style={{ background: getColorVar(colors[1] || colors[0]) }} />
                    </div>
                  )}
                </div>
              )}

              {/* Action Center Icon */}
              <div className={styles.actionIconWrapper}>
                {actionType === ActionCardType.RENT ? (
                  ActionIcons.RENT()
                ) : isBuilding === BuildingType.HOUSE ? (
                  ActionIcons.HOUSE()
                ) : isBuilding === BuildingType.HOTEL ? (
                  ActionIcons.HOTEL()
                ) : actionType && ActionIcons[actionType] ? (
                  ActionIcons[actionType]()
                ) : (
                  ActionIcons.PASS_GO()
                )}
              </div>

              {/* Title and Description */}
              <div className={styles.actionTitle}>{name}</div>
              <div className={styles.actionDesc}>{description}</div>
            </div>
          )}

          {/* Bottom-right value mirror - ONLY for MONEY, PROPERTY, and PROPERTY_WILDCARD */}
          {(type === CardType.MONEY || type === CardType.PROPERTY || type === CardType.PROPERTY_WILDCARD) && value !== undefined && (
            <div className={styles.cornerValueBottom}>
              <span>${value}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
