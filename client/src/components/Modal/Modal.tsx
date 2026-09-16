import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string | number;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  portal?: boolean;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  ariaLabel?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = '500px',
  showCloseButton = false,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  portal = true,
  className = '',
  bodyClassName = '',
  headerClassName = '',
  footerClassName = '',
  ariaLabel,
}) => {
  // Handle Escape key listener
  useEffect(() => {
    if (!isOpen || !closeOnEscape || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnOverlayClick && onClose) {
      onClose();
    }
  };

  const hasHeader = Boolean(icon || title || subtitle);

  const modalContent = (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={`${styles.modalWindow} ${className}`}
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === 'string' ? title : undefined)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Optional Close Button */}
        {showCloseButton && onClose && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        )}

        {/* Modal Header */}
        {hasHeader && (
          <header className={`${styles.modalHeader} ${headerClassName}`}>
            {icon && <div className={styles.headerIconWrapper}>{icon}</div>}
            {title && <h2 className={styles.modalTitle}>{title}</h2>}
            {subtitle && <p className={styles.modalSubtitle}>{subtitle}</p>}
          </header>
        )}

        {/* Modal Body / Children */}
        <div className={`${styles.modalBody} ${bodyClassName}`}>
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <footer className={`${styles.modalFooter} ${footerClassName}`}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );

  if (portal && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
