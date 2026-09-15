import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  placement?: 'bottom' | 'top';
  offset?: number;
  openDelay?: number;
  closeDelay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  placement = 'bottom',
  offset = 8,
  openDelay = 100,
  closeDelay = 150,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipElem = tooltipRef.current;

    const tooltipWidth = tooltipElem ? tooltipElem.offsetWidth : 280;
    const tooltipHeight = tooltipElem ? tooltipElem.offsetHeight : 180;

    let top = 0;
    let left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;

    if (placement === 'bottom') {
      top = triggerRect.bottom + offset;
      // Flip to top if overflowing bottom
      if (top + tooltipHeight > window.innerHeight - 12) {
        top = Math.max(12, triggerRect.top - tooltipHeight - offset);
      }
    } else {
      top = triggerRect.top - tooltipHeight - offset;
      if (top < 12) {
        top = triggerRect.bottom + offset;
      }
    }

    // Horizontal clamping to keep inside viewport
    const minLeft = 12;
    const maxLeft = window.innerWidth - tooltipWidth - 12;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    setCoords({ top, left });
  }, [offset, placement]);

  const handleMouseEnter = () => {
    clearTimers();
    openTimerRef.current = window.setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, openDelay);
  };

  const handleMouseLeave = () => {
    clearTimers();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, closeDelay);
  };

  // Recompute position synchronously before paint using exact rendered dimensions
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  // Window scroll and resize listeners while open
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return (
    <>
      <div
        ref={triggerRef}
        className={styles.triggerWrapper}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`${styles.portalContainer} ${className || ''}`}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            role="tooltip"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};
