import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './LanguageSwitcher.module.css';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const currentLang = (i18n.language || 'uk').startsWith('uk') ? 'uk' : 'en';

  const handleLanguageChange = (lang: 'uk' | 'en') => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className={styles.switcherContainer} role="group" aria-label={t('common.language')}>
      <button
        type="button"
        className={`${styles.langButton} ${currentLang === 'uk' ? styles.langButtonActive : ''}`}
        onClick={() => handleLanguageChange('uk')}
      >
        {t('common.uk')}
      </button>
      <button
        type="button"
        className={`${styles.langButton} ${currentLang === 'en' ? styles.langButtonActive : ''}`}
        onClick={() => handleLanguageChange('en')}
      >
        {t('common.en')}
      </button>
    </div>
  );
};
