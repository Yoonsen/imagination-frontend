import React, { useRef, useState } from 'react';
import './VisualsLauncherChip.css';

interface VisualsLauncherChipProps {
  onVisualsDefaultClick: () => void;
  onVisualsMapClick: () => void;
  onVisualsHeatmapClick: () => void;
  onVisualsHeatmapAllClick: () => void;
}

export const VisualsLauncherChip: React.FC<VisualsLauncherChipProps> = ({
  onVisualsDefaultClick,
  onVisualsMapClick,
  onVisualsHeatmapClick,
  onVisualsHeatmapAllClick
}) => {
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
      className="visuals-launcher"
      onMouseEnter={() => {
        cancelClose();
        setIsOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        className="chip chip-button visuals-launcher-chip"
        onClick={() => {
          cancelClose();
          setIsOpen((open) => !open);
        }}
        title="Åpne visuals-meny"
      >
        <i className="fas fa-layer-group"></i>
      </button>

      {isOpen && (
        <div className="chip-menu" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <button onClick={() => { onVisualsDefaultClick(); setIsOpen(false); }}>Visuals panel</button>
          <button onClick={() => { onVisualsMapClick(); setIsOpen(false); }}>Kartmodus</button>
          <button onClick={() => { onVisualsHeatmapClick(); setIsOpen(false); }}>Heatmap-modus</button>
          <button onClick={() => { onVisualsHeatmapAllClick(); setIsOpen(false); }}>Heatmap (alle steder)</button>
        </div>
      )}
    </div>
  );
};
