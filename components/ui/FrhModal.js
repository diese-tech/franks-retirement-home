'use client';

import { useEffect, useRef } from 'react';

/**
 * Overlay modal in the FRH retro broadcast style. Renders a centered window
 * with a title bar over a dimmed backdrop. Closes on Escape or backdrop click.
 *
 * Props:
 *   - title: string
 *   - accent: 'yellow' | 'blue' | 'red' | 'lime' | 'purple' | 'orange'
 *   - onClose: () => void
 *   - children
 */
export default function FrhModal({ title, accent = 'blue', onClose, children }) {
  const previousFocusRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    // Save previously focused element
    previousFocusRef.current = document.activeElement;

    // Move focus to first focusable element in modal
    const timer = setTimeout(() => {
      if (!modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      focusable[0]?.focus();
    }, 0);

    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      // Restore focus on close — defer to avoid backdrop-click race
      setTimeout(() => previousFocusRef.current?.focus(), 0);
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,20,20,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        zIndex: 1000,
        overflowY: 'auto',
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="frh-panel"
        style={{ width: '100%', maxWidth: 520, margin: 'auto 0' }}
      >
        <header className={`frh-panel__titlebar frh-panel__titlebar--${accent}`}>
          <div className="frh-panel__ttl">
            <span className="frh-panel__accent" />
            {title}
          </div>
          <div className="frh-panel__chips">
            <button
              type="button"
              onClick={onClose}
              className="frh-panel__chip"
              style={{ cursor: 'pointer', border: 'none', background: 'none', color: 'inherit', font: 'inherit' }}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </header>
        <div className="frh-panel__body" style={{ padding: 16 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
