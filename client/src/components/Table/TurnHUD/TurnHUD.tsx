import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TurnHUD.module.css';

export interface TurnHUDProps {
  isMyTurn: boolean;
  activePlayerName: string;
  actionsRemaining: number;
  maxActions: number;
  onDrawCards: () => void;
  onEndTurn: () => void;
  onResetMock: () => void;
}

export const TurnHUD: React.FC<TurnHUDProps> = ({
  isMyTurn,
  activePlayerName,
  actionsRemaining,
  maxActions,
  onDrawCards,
  onEndTurn,
  onResetMock,
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
      </div>

      {/* Right controls: Actions */}
      <div className={styles.rightControls}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onResetMock}
          title={t('board.resetMock')}
        >
          🔄 {t('board.resetMock')}
        </button>

        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onDrawCards}
        >
          📥 {t('board.drawCards')}
        </button>

        <button
          type="button"
          className={styles.endTurnBtn}
          onClick={onEndTurn}
        >
          <span>{t('board.endTurn')}</span>
          <span>➔</span>
        </button>
      </div>
    </footer>
  );
};
