import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TurnHUD.module.css';


export interface TurnHUDProps {
  isMyTurn: boolean;
  activePlayerName: string;
  actionsRemaining: number;
  maxActions: number;
  onEndTurn: () => void;
}

export const TurnHUD: React.FC<TurnHUDProps> = ({
  isMyTurn,
  activePlayerName,
  actionsRemaining,
  maxActions,
  onEndTurn,
}) => {
  const { t } = useTranslation();

  return (
    <footer className={styles.hudContainer}>
      {/* Left controls: Turn banner + Action pips */}
      <div className={styles.leftControls}>
        <div className={`${styles.turnIndicator} ${!isMyTurn ? styles.turnIndicatorInactive : ''}`}>
          <span>{isMyTurn ? '⚡' : '⏳'}</span>
          <span>
            {isMyTurn ? t('board.yourTurn') : t('board.opponentsTurn', { name: activePlayerName })}
          </span>
        </div>

        {isMyTurn && (
          <div className={styles.actionPipsWrapper}>
            <span>{t('board.actionsLeft', { count: actionsRemaining })}</span>
            <div className={styles.pipsContainer}>
              {Array.from({ length: maxActions }).map((_, i) => (
                <div
                  key={i}
                  className={`${styles.pip} ${i < actionsRemaining ? styles.pipActive : ''}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right controls: Actions */}

      {/* Right controls: Actions */}
      <div className={styles.rightControls}>
        <button
          type="button"
          className={styles.endTurnBtn}
          onClick={onEndTurn}
          disabled={!isMyTurn}
        >
          <span>{t('board.endTurn')}</span>
          <span>➔</span>
        </button>
      </div>
    </footer>
  );
};
