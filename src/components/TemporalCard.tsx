import React, { useEffect, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { useCorpus } from '../context/CorpusContext';
import { useWindowLayout } from '../utils/windowLayout';
import './TemporalCard.css';

interface TemporalCardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemporalCard: React.FC<TemporalCardProps> = ({ isOpen, onClose }) => {
  const {
    activeBooksMetadata,
    temporalEnabled,
    setTemporalEnabled,
    temporalCutoffYear,
    setTemporalCutoffYear,
    temporalMode,
    setTemporalMode,
    activeWindow,
    setActiveWindow
  } = useCorpus();

  const years = useMemo(() => activeBooksMetadata.map((b) => b.year).filter((y): y is number => y !== null), [activeBooksMetadata]);
  const minYear = years.length > 0 ? Math.min(...years) : 1800;
  const maxYear = years.length > 0 ? Math.max(...years) : 2025;
  const effectiveYear = temporalCutoffYear ?? maxYear;
  const { layout, onDragStop, onResizeStop } = useWindowLayout({
    key: 'temporal',
    defaultLayout: { x: 360, y: 20, width: 360, height: 260 },
    minWidth: 300,
    minHeight: 220
  });

  useEffect(() => {
    if (temporalCutoffYear === null && years.length > 0) {
      setTemporalCutoffYear(maxYear);
    }
  }, [temporalCutoffYear, years.length, maxYear, setTemporalCutoffYear]);

  useEffect(() => {
    if (isOpen && !temporalEnabled) {
      setTemporalEnabled(true);
    }
  }, [isOpen, temporalEnabled, setTemporalEnabled]);

  if (!isOpen) return null;

  return (
    <Rnd
      size={{ width: layout.width, height: layout.height }}
      position={{ x: layout.x, y: layout.y }}
      minWidth={300}
      minHeight={220}
      cancel=".no-drag"
      dragHandleClassName="drag-handle"
      className="temporal-card"
      style={{ zIndex: activeWindow === 'temporal' ? 2600 : 1750 }}
      onDragStart={() => setActiveWindow('temporal')}
      onResizeStart={() => setActiveWindow('temporal')}
      onDragStop={onDragStop}
      onResizeStop={onResizeStop}
    >
      <div className="temporal-header drag-handle" onMouseDown={() => setActiveWindow('temporal')}>
        <div className="temporal-title">
          <i className="fas fa-calendar-alt"></i> Tidsvisning
        </div>
        <div className="temporal-controls no-drag">
          <button onClick={onClose} title="Minimer til chip">
            <i className="fas fa-window-minimize"></i>
          </button>
        </div>
      </div>

      <div className="temporal-body no-drag">
        <div className="temporal-section">
          <label>Skilleår ({effectiveYear})</label>
          <div style={{ padding: '0 8px' }}>
            <Slider
              min={minYear}
              max={maxYear}
              value={effectiveYear}
              onChange={(val) => {
                setTemporalCutoffYear(val as number);
                if (!temporalEnabled) setTemporalEnabled(true);
              }}
            />
          </div>
          <div className="temporal-range">
            <span>{minYear}</span>
            <span>{maxYear}</span>
          </div>
        </div>

        <div className="temporal-section temporal-mode-row">
          <button type="button" className={temporalMode === 'color' ? 'active' : ''} onClick={() => setTemporalMode('color')}>
            Farge
          </button>
          <button type="button" className={temporalMode === 'toggle' ? 'active' : ''} onClick={() => setTemporalMode('toggle')}>
            Av/på
          </button>
        </div>
      </div>
    </Rnd>
  );
};
