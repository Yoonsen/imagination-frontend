import React, { useEffect, useRef, useState } from 'react';
import './SettingsLauncherChip.css';

interface SettingsLauncherChipProps {
  onSettingsPanelClick: () => void;
  onSuggestChangeClick: () => void;
}

export const SettingsLauncherChip: React.FC<SettingsLauncherChipProps> = ({ onSettingsPanelClick, onSuggestChangeClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const launcherRef = useRef<HTMLDivElement | null>(null);
  const supportsHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setIsOpen(false), 250);
  };

  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!launcherRef.current) return;
      if (!launcherRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, []);

  return (
    <div
      ref={launcherRef}
      className="settings-launcher"
      onMouseEnter={() => {
        if (!supportsHover) return;
        cancelClose();
        setIsOpen(true);
      }}
      onMouseLeave={() => {
        if (!supportsHover) return;
        scheduleClose();
      }}
    >
      <button
        className="chip chip-button settings-launcher-chip"
        onClick={() => {
          cancelClose();
          setIsOpen((open) => !open);
        }}
        onTouchStart={cancelClose}
        title="Åpne innstillinger-meny"
      >
        <i className="fas fa-cog"></i>
      </button>

      {isOpen && (
        <div
          className="chip-menu"
          onMouseEnter={cancelClose}
          onMouseLeave={() => {
            if (!supportsHover) return;
            scheduleClose();
          }}
        >
          <button onClick={() => { onSettingsPanelClick(); setIsOpen(false); }}>Generelle parametre</button>
          <button onClick={() => { onSuggestChangeClick(); setIsOpen(false); }}>Foreslå endring</button>
        </div>
      )}
    </div>
  );
};
