import React from 'react';
import { useTranslation } from 'react-i18next';
import { CardColor } from '../../../types/cards';
import { type MockPlayer } from '../../../mocks/mockGameData';
import { Tooltip } from '../../Tooltip/Tooltip';
import { PlayerBank } from '../PlayerBank/PlayerBank';
import { PlayerProperties } from '../PlayerProperties/PlayerProperties';
import styles from './OpponentsArea.module.css';

export interface OpponentsAreaProps {
  opponents: MockPlayer[];
  activePlayerId: string;
}

const getColorVar = (color: CardColor): string => {
  return `var(--color-prop-${color.toLowerCase().replace('_', '-')})`;
};

export const OpponentsArea: React.FC<OpponentsAreaProps> = ({ opponents, activePlayerId }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.opponentsContainer}>
      {opponents.map((opponent) => {
        const isActive = activePlayerId === opponent.id;
        const totalBank = opponent.bankCards.reduce((acc, card) => acc + (card.value || 0), 0);
        const totalProperties = opponent.propertySets.reduce((acc, set) => acc + set.cards.length, 0);

        return (
          <div
            key={opponent.id}
            className={`${styles.opponentCard} ${isActive ? styles.opponentActive : ''}`}
          >
            {/* Header: Name, Avatar, Turn Badge, Properties & Bank Badges */}
            <div className={styles.headerRow}>
              <div className={styles.playerInfo}>
                <span className={styles.avatar}>{opponent.avatar}</span>
                <span className={styles.playerName}>{opponent.name}</span>
                {isActive && (
                  <span className={styles.activeBadge}>{t('board.turn')}</span>
                )}
              </div>

              <div className={styles.badgesWrapper}>
                {/* Properties Tooltip */}
                <Tooltip
                  content={
                    <PlayerProperties
                      propertySets={opponent.propertySets}
                      variant="tooltip"
                      title={t('board.opponentPropertiesTitle', { name: opponent.name })}
                    />
                  }
                  placement="bottom"
                  offset={8}
                >
                  <div className={styles.propertiesPill}>
                    <span>🏠 {totalProperties}</span>
                  </div>
                </Tooltip>

                {/* Bank Tooltip */}
                <Tooltip
                  content={
                    <PlayerBank
                      bankCards={opponent.bankCards}
                      variant="tooltip"
                      title={t('board.opponentBankTitle', { name: opponent.name })}
                    />
                  }
                  placement="bottom"
                  offset={8}
                >
                  <div className={styles.bankPill}>
                    <span>💰 ${totalBank}</span>
                  </div>
                </Tooltip>
              </div>
            </div>

            {/* Body: Hand Cards Count & Property Sets */}
            <div className={styles.bodyRow}>
              {/* Hand cards representation */}
              <div className={styles.handZone}>
                <div className={styles.handStack}>
                  {Array.from({ length: Math.min(3, opponent.handCount) }).map((_, i) => (
                    <div
                      key={i}
                      className={styles.miniCardBack}
                      style={{ transform: `translate(${i * 6}px, ${i * 2}px)` }}
                    />
                  ))}
                </div>
                <span className={styles.handCountText}>
                  {opponent.handCount} {t('board.cards')}
                </span>
              </div>

              {/* Property columns */}
              <div className={styles.propertiesZone}>
                {opponent.propertySets.map((set, idx) => (
                  <div
                    key={idx}
                    className={`${styles.propertyPill} ${set.isComplete ? styles.propertyPillComplete : ''}`}
                  >
                    <span
                      className={styles.colorDot}
                      style={{ background: getColorVar(set.color) }}
                    />
                    <span>{set.cards.length}</span>
                    {set.isComplete && <span className={styles.completeStar}>★</span>}
                    {set.hasHouse && <span className={styles.buildingIcon}>🏠</span>}
                    {set.hasHotel && <span className={styles.buildingIcon}>🏨</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
