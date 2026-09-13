import { Link } from 'react-router-dom';
import styles from './GameBoardPage.module.css';

export function GameBoardPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Monopoly Deal</h1>
      <p className={styles.description}>
        Ігровий стіл готовий до реалізації наступного етапу (розкладка столу, рука гравця, зони суперників, колода та банк).
      </p>

      <div className={styles.actions}>
        <Link to="/cards" className={styles.primaryButton}>
          🃏 Переглянути повну колоду карт (107 шт.)
        </Link>
      </div>
    </div>
  );
}
