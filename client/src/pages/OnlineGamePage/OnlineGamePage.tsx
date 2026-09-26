import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../store/gameStore';
import { getSavedPlayerName } from '../../services/session';
import { LanguageSwitcher } from '../../components/LanguageSwitcher/LanguageSwitcher';
import { OnlineGameBoard } from '../../components/Table/OnlineGameBoard/OnlineGameBoard';
import styles from './OnlineGamePage.module.css';

export const OnlineGamePage: React.FC = () => {
  const { t } = useTranslation();
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const {
    roomState,
    leaveRoom,
    errorMessage,
    clearError,
  } = useGameStore();

  const lastAttemptedGameIdRef = useRef<string | null>(null);

  // If page was refreshed or accessed directly, attempt reconnect using stored session
  useEffect(() => {
    if (!gameId) return;

    if (lastAttemptedGameIdRef.current === gameId) return;
    lastAttemptedGameIdRef.current = gameId;

    const currentRoomState = useGameStore.getState().roomState;
    if (!currentRoomState || currentRoomState.gameId !== gameId) {
      const savedName = getSavedPlayerName() || 'Player';
      useGameStore.getState().joinRoom(gameId, savedName);
    }
  }, [gameId]);

  // If the room is still in pre-game LOBBY state, redirect back to the room lobby
  useEffect(() => {
    if (roomState && roomState.status === 'LOBBY' && roomState.roomId) {
      navigate(`/room/${roomState.roomId}`, { replace: true });
    }
  }, [roomState, navigate]);

  // Synchronize route when gameId changes (e.g. after host restarts the game)
  useEffect(() => {
    if (roomState && roomState.gameId && roomState.gameId !== gameId && roomState.status !== 'LOBBY') {
      navigate(`/game/${roomState.gameId}`, { replace: true });
    }
  }, [roomState, gameId, navigate]);

  // Active game in progress: render the full online game board
  if (roomState && roomState.gameId === gameId && roomState.status !== 'LOBBY') {
    return <OnlineGameBoard />;
  }

  const handleBackToMainMenu = () => {
    leaveRoom();
    clearError();
    navigate('/', { replace: true });
  };

  return (
    <div className={styles.gamePageContainer}>
      {/* Top Navigation */}
      <header className={styles.topNav}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>💎</span>
          <span>Monopoly Deal</span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* Loading / Reconnecting / Error Card */}
      <main className={styles.statusCard}>
        {errorMessage ? (
          <>
            <div className={styles.titleWrapper}>
              <h1 className={styles.title}>{t('onlineGame.gameNotFound')}</h1>
              <p className={styles.subtitle}>
                {t('onlineGame.gameNotFoundDesc')}
              </p>
            </div>

            <div className={styles.errorBox}>
              <span>⚠️ {errorMessage}</span>
            </div>

            <button
              type="button"
              className={styles.backBtn}
              onClick={handleBackToMainMenu}
            >
              {t('onlineGame.backToLobby')}
            </button>
          </>
        ) : (
          <>
            <div className={styles.spinnerWrapper}>
              <div className={styles.spinnerRing} />
              <span className={styles.spinnerIcon}>🎲</span>
            </div>

            <div className={styles.titleWrapper}>
              <h1 className={styles.title}>
                {t('onlineGame.reconnectingGame')}
              </h1>
              <p className={styles.subtitle}>
                {t('onlineGame.reconnectingGameSubtitle')}
              </p>
            </div>

            {gameId && (
              <div className={styles.gamePill}>
                <span>🎮</span>
                <span>{gameId}</span>
              </div>
            )}

            <button
              type="button"
              className={styles.backBtn}
              onClick={handleBackToMainMenu}
            >
              {t('onlineGame.backToLobby')}
            </button>
          </>
        )}
      </main>
    </div>
  );
};
