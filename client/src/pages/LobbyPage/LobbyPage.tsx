import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../store/gameStore';
import { getSavedPlayerName, getLastRoomId, getLastGameId } from '../../services/session';
import { LanguageSwitcher } from '../../components/LanguageSwitcher/LanguageSwitcher';
import styles from './LobbyPage.module.css';

export const LobbyPage: React.FC = () => {
  const { t } = useTranslation();
  const { roomId: routeRoomId } = useParams<{ roomId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    roomId,
    myPlayerId,
    roomState,
    errorMessage,
    isConnecting,
    createRoom,
    joinRoom,
    startGame,
    leaveRoom,
    clearError,
  } = useGameStore();

  const [playerName, setPlayerName] = useState(() => getSavedPlayerName());
  const queryRoom = searchParams.get('room')?.trim() || '';
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // If entered via query param e.g. /?room=room_xxx, redirect to /room/room_xxx
  useEffect(() => {
    if (queryRoom) {
      navigate(`/room/${queryRoom}`, { replace: true });
    }
  }, [queryRoom, navigate]);

  // When game starts, navigate immediately to dedicated game route /game/:gameId
  useEffect(() => {
    if (roomState && roomState.status !== 'LOBBY' && roomState.gameId) {
      navigate(`/game/${roomState.gameId}`, { replace: true });
    }
  }, [roomState, navigate]);

  // Synchronize route with active roomId while in lobby
  useEffect(() => {
    if (roomId && routeRoomId !== roomId && (!roomState || roomState.status === 'LOBBY')) {
      navigate(`/room/${roomId}`, { replace: true });
    }
  }, [roomId, routeRoomId, roomState, navigate]);

  const activeTargetRoomId = routeRoomId || '';
  const lastSavedRoomId = getLastRoomId();
  const lastSavedGameId = getLastGameId();

  // Determine room state
  const isInRoom = Boolean(roomId && roomState && (!activeTargetRoomId || roomId === activeTargetRoomId));

  const isHost = Boolean(roomState && myPlayerId && roomState.hostId === myPlayerId);
  const playersList = roomState ? roomState.playerOrder.map((id) => roomState.players[id]).filter(Boolean) : [];
  const playersCount = playersList.length;
  const canStart = isHost && playersCount >= 2 && playersCount <= 4;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    createRoom(playerName);
  };

  const handleJoinManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !inputRoomCode.trim()) return;
    joinRoom(inputRoomCode, playerName);
  };

  const handleJoinInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !activeTargetRoomId) return;
    joinRoom(activeTargetRoomId, playerName);
  };

  const handleBackToMainMenu = () => {
    clearError();
    navigate('/');
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    navigate('/');
  };

  const handleCopyLink = async () => {
    if (!roomId) return;
    const inviteUrl = `${window.location.origin}/room/${roomId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = inviteUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <div className={styles.lobbyContainer}>
      {/* Top Bar */}
      <header className={styles.topNav}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>💎</span>
          <span>Monopoly Deal</span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* Main Card Area */}
      <main className={styles.mainCard}>
        {/* Error Banner */}
        {errorMessage && (
          <div className={styles.errorBanner}>
            <span>⚠️ {errorMessage}</span>
            <button
              type="button"
              className={styles.errorCloseBtn}
              onClick={clearError}
            >
              ✕
            </button>
          </div>
        )}

        {!isInRoom || !roomState ? (
          activeTargetRoomId ? (
            /* ======================================================= */
            /* 1B. INVITE MODE: Direct room URL                        */
            /* ======================================================= */
            <form onSubmit={handleJoinInvite}>
              <div className={styles.titleWrapper}>
                <h1 className={styles.lobbyTitle}>{t('lobby.inviteTitle')}</h1>
                <p className={styles.lobbySubtitle}>{t('lobby.inviteSubtitle')}</p>
              </div>

              {/* Locked Room Code */}
              <div className={styles.inviteRoomCard} style={{ margin: '20px 0' }}>
                <span className={styles.inviteRoomLabel}>{t('lobby.inviteRoomLabel')}</span>
                <div className={styles.roomCodePill}>
                  <span>🔑</span>
                  <span className={styles.roomCodeText}>{activeTargetRoomId}</span>
                </div>
              </div>

              {/* Player Name Input */}
              <div className={styles.formGroup}>
                <label htmlFor="playerNameInput" className={styles.inputLabel}>
                  {t('lobby.yourNameLabel')}
                </label>
                <input
                  id="playerNameInput"
                  type="text"
                  className={styles.textInput}
                  placeholder={t('lobby.yourNamePlaceholder')}
                  value={playerName}
                  maxLength={20}
                  autoFocus
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>

              {/* Join & Back to Main Menu Actions */}
              <div className={styles.inviteActions}>
                <button
                  type="submit"
                  className={styles.joinInviteBtn}
                  disabled={!playerName.trim() || isConnecting}
                >
                  {isConnecting ? t('lobby.connecting') : t('lobby.joinRoomBtn')}
                </button>
                <button
                  type="button"
                  className={styles.backToMenuBtn}
                  onClick={handleBackToMainMenu}
                >
                  {t('lobby.backToMainMenuBtn')}
                </button>
              </div>
            </form>
          ) : (
            /* ======================================================= */
            /* 1C. STANDARD WELCOME SCREEN: Create or Join Room        */
            /* ======================================================= */
            <>
              <div className={styles.titleWrapper}>
                <h1 className={styles.lobbyTitle}>{t('lobby.title')}</h1>
                <p className={styles.lobbySubtitle}>{t('lobby.subtitle')}</p>
              </div>

              {/* Resume Last Game or Room Shortcut if available */}
              {(lastSavedGameId || lastSavedRoomId) && (
                <div className={styles.resumeLastRoomCard}>
                  <div className={styles.resumeLastRoomText}>
                    <span className={styles.resumeLastRoomLabel}>{t('lobby.resumeGameLabel')}</span>
                    <span className={styles.resumeLastRoomCode}>{lastSavedGameId || lastSavedRoomId}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.resumeLastRoomBtn}
                    onClick={() => {
                      if (lastSavedGameId) {
                        navigate(`/game/${lastSavedGameId}`);
                      } else {
                        navigate(`/room/${lastSavedRoomId}`);
                      }
                    }}
                  >
                    {t('lobby.resumeGameBtn')}
                  </button>
                </div>
              )}

              {/* Player Name Input */}
              <div className={styles.formGroup}>
                <label htmlFor="playerNameInput" className={styles.inputLabel}>
                  {t('lobby.yourNameLabel')}
                </label>
                <input
                  id="playerNameInput"
                  type="text"
                  className={styles.textInput}
                  placeholder={t('lobby.yourNamePlaceholder')}
                  value={playerName}
                  maxLength={20}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>

              {/* Create Room Button */}
              <button
                type="button"
                className={styles.createBtn}
                disabled={!playerName.trim() || isConnecting}
                onClick={handleCreate}
              >
                {isConnecting ? t('lobby.connecting') : t('lobby.createRoomBtn')}
              </button>

              <div className={styles.divider}>
                <span>{t('lobby.joinSectionTitle')}</span>
              </div>

              {/* Join Room Form */}
              <form onSubmit={handleJoinManual} className={styles.joinSection}>
                <div className={styles.joinInputRow}>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder={t('lobby.roomCodePlaceholder')}
                    value={inputRoomCode}
                    onChange={(e) => setInputRoomCode(e.target.value)}
                  />
                  <button
                    type="submit"
                    className={styles.joinBtn}
                    disabled={!playerName.trim() || !inputRoomCode.trim() || isConnecting}
                  >
                    {isConnecting ? t('lobby.connecting') : t('lobby.joinRoomBtn')}
                  </button>
                </div>
              </form>
            </>
          )
        ) : (
          /* ======================================================= */
          /* 2. WAITING ROOM LOBBY: Room Code, Players, Host Start   */
          /* ======================================================= */
          <>
            <div className={styles.roomHeaderBlock}>
              <h2 className={styles.lobbyTitle}>{t('lobby.roomHeader')}</h2>
              <div className={styles.roomBadgeRow}>
                <div className={styles.roomCodePill}>
                  <span>🔑</span>
                  <span className={styles.roomCodeText}>{roomState.roomId}</span>
                </div>
                <button
                  type="button"
                  className={`${styles.copyBtn} ${isCopied ? styles.copyBtnSuccess : ''}`}
                  onClick={handleCopyLink}
                >
                  {isCopied ? t('lobby.linkCopied') : t('lobby.copyLinkBtn')}
                </button>
              </div>
            </div>

            {/* Players List */}
            <div className={styles.playersSection}>
              <div className={styles.playersSectionTitle}>
                <span>{t('lobby.playersTitle')}</span>
                <span>{playersCount} / 4</span>
              </div>

              <div className={styles.playerSlotsList}>
                {/* Connected Players */}
                {playersList.map((player) => {
                  const isThisPlayerHost = player.id === roomState.hostId;
                  const isThisYou = player.id === myPlayerId;

                  return (
                    <div
                      key={player.id}
                      className={`${styles.playerSlot} ${styles.playerSlotConnected}`}
                    >
                      <div className={styles.playerInfoLeft}>
                        <div
                          className={player.isConnected ? styles.onlineDot : styles.offlineDot}
                          title={player.isConnected ? t('lobby.onlineStatus') : 'Disconnected'}
                        />
                        <span className={styles.playerName}>{player.name}</span>
                      </div>

                      <div className={styles.playerBadges}>
                        {isThisPlayerHost && (
                          <span className={styles.badgeHost}>{t('lobby.hostBadge')}</span>
                        )}
                        {isThisYou && (
                          <span className={styles.badgeYou}>{t('lobby.youBadge')}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Empty Slots up to 4 */}
                {Array.from({ length: Math.max(0, 4 - playersCount) }).map((_, idx) => (
                  <div key={`empty_${idx}`} className={styles.playerSlotEmpty}>
                    <span className={styles.emptySlotIcon}>⏳</span>
                    <span>{t('lobby.waitingSlot')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions: Start Game (Host) / Waiting (Guest) & Leave */}
            <div className={styles.lobbyActions}>
              {isHost ? (
                <>
                  <button
                    type="button"
                    className={styles.startGameBtn}
                    disabled={!canStart}
                    onClick={startGame}
                  >
                    {t('lobby.startGameBtn')}
                  </button>
                  {!canStart && (
                    <span className={styles.minPlayersHint}>
                      {t('lobby.minPlayersHint', { count: playersCount })}
                    </span>
                  )}
                </>
              ) : (
                <div className={styles.waitingForHostCard}>
                  {t('lobby.waitingForHost')}
                </div>
              )}

              <button
                type="button"
                className={styles.leaveBtn}
                onClick={handleLeaveRoom}
              >
                {t('lobby.leaveRoomBtn')}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
