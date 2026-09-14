import React from 'react';
import styles from './CardBack.module.css';

export interface CardBackProps {
  isCompact?: boolean;
  className?: string;
  onClick?: () => void;
}

export const CardBack: React.FC<CardBackProps> = ({ isCompact, className = '', onClick }) => {
  return (
    <div
      className={`${styles.cardBack} ${isCompact ? styles.compact : ''} ${className}`}
      onClick={onClick}
    >
      <div className={styles.innerPattern}>
        <div className={styles.crestWrapper}>
          <span className={styles.monogram}>MD</span>
          <span className={styles.stars}>✦ ✦ ✦</span>
        </div>
      </div>
    </div>
  );
};
