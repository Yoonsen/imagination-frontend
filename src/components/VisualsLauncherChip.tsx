import React, { useEffect, useRef, useState } from 'react';
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
      className="visuals-launcher"
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
        className="chip chip-button visuals-launcher-chip"
        onClick={() => {
          cancelClose();
          setIsOpen((open) => !open);
        }}
        onTouchStart={cancelClose}
        title="Åpne visuals-meny"
      >
        <i className="fas fa-layer-group"></i>
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
          <button onClick={() => { onVisualsDefaultClick(); setIsOpen(false); }}>Visuals panel</button>
          <button onClick={() => { onVisualsMapClick(); setIsOpen(false); }}>Kartmodus</button>
          <button onClick={() => { onVisualsHeatmapClick(); setIsOpen(false); }}>Heatmap-modus</button>
          <button onClick={() => { onVisualsHeatmapAllClick(); setIsOpen(false); }}>Heatmap (alle steder)</button>
        </div>
      )}
    </div>
  );
};
