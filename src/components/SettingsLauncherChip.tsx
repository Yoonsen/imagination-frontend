import React, { useRef, useState } from 'react';
import './SettingsLauncherChip.css';

interface SettingsLauncherChipProps {
  onSettingsPanelClick: () => void;
  onSuggestChangeClick: () => void;
}

export const SettingsLauncherChip: React.FC<SettingsLauncherChipProps> = ({ onSettingsPanelClick, onSuggestChangeClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

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

  return (
    <div
      className="settings-launcher"
      onMouseEnter={() => {
        cancelClose();
        setIsOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        className="chip chip-button settings-launcher-chip"
        onClick={() => {
          cancelClose();
          setIsOpen((open) => !open);
        }}
        title="Åpne innstillinger-meny"
      >
        <i className="fas fa-cog"></i>
      </button>

      {isOpen && (
        <div className="chip-menu" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <button onClick={() => { onSettingsPanelClick(); setIsOpen(false); }}>Generelle parametre</button>
          <button onClick={() => { onSuggestChangeClick(); setIsOpen(false); }}>Foreslå endring</button>
        </div>
      )}
    </div>
  );
};
