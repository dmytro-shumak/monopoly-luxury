import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/LanguageSwitcher/LanguageSwitcher';
import { ALL_CARDS } from '../../data/allCards';
import styles from './GameBoardPage.module.css';

export function GameBoardPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <header className={styles.topBar}>
        <LanguageSwitcher />
      </header>

      <h1 className={styles.title}>{t('gameBoard.title')}</h1>
      <p className={styles.description}>
        {t('gameBoard.description')}
      </p>

      <div className={styles.actions}>
        <Link to="/cards" className={styles.primaryButton}>
          {t('gameBoard.viewDeckButton', { count: ALL_CARDS.length })}
        </Link>
      </div>
    </div>
  );
}

