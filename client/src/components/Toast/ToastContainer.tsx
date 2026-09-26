import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore, type GameNotification } from '../../store/gameStore';
import styles from './ToastContainer.module.css';

interface ToastItemProps {
  notification: GameNotification;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification, onDismiss }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const getToastContent = () => {
    switch (notification.type) {
      case 'JUST_SAY_NO':
        return {
          icon: '🛡️',
          title: t('toast.justSayNoTitle'),
          desc: t('toast.justSayNoDesc', {
            actor: notification.actorName,
            target: notification.targetName || t('board.opponent'),
          }),
        };
      case 'DEBT_PAID':
        return {
          icon: '💰',
          title: t('toast.debtPaidTitle'),
          desc: t('toast.debtPaidDesc', {
            actor: notification.actorName,
            target: notification.targetName || t('board.opponent'),
            amount: notification.details?.totalAmount ?? 0,
            bank: notification.details?.bankAmount ?? 0,
            props: notification.details?.propertiesCount ?? 0,
          }),
        };
      case 'DEBT_EMPTY':
        return {
          icon: '⚠️',
          title: t('toast.debtEmptyTitle'),
          desc: t('toast.debtEmptyDesc', {
            actor: notification.actorName,
          }),
        };
      case 'DEAL_COMPLETED':
        return {
          icon: '🤝',
          title: t('toast.dealCompletedTitle'),
          desc: t('toast.dealCompletedDesc', {
            actor: notification.actorName,
            target: notification.targetName || t('board.opponent'),
          }),
        };
      case 'TIMEOUT':
        return {
          icon: '⌛',
          title: t('toast.timeoutTitle'),
          desc: t('toast.timeoutDesc', {
            actor: notification.actorName,
          }),
        };
      default:
        return {
          icon: 'ℹ️',
          title: 'Notification',
          desc: `${notification.actorName} performed an action`,
        };
    }
  };

  const { icon, title, desc } = getToastContent();

  return (
    <div className={styles.toastItem}>
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <span className={styles.icon}>{icon}</span>
          <span className={styles.title}>{title}</span>
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => onDismiss(notification.id)}
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
      <div className={styles.description}>{desc}</div>
      <div className={styles.progressBarTrack}>
        <div className={styles.progressBar} />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const notifications = useGameStore((state) => state.notifications);
  const dismissNotification = useGameStore((state) => state.dismissNotification);

  if (notifications.length === 0) return null;

  return (
    <div className={styles.toastContainer} aria-live="polite">
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} onDismiss={dismissNotification} />
      ))}
    </div>
  );
};
