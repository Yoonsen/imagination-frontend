import React from 'react';
import { Rnd } from 'react-rnd';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { useCorpus } from '../context/CorpusContext';
import './VisualsCard.css';

export const VisualsCard: React.FC = () => {
  const {
    isVisualsOpen,
    setIsVisualsOpen,
    activeWindow,
    setActiveWindow,
    mapVisualMode,
    setMapVisualMode,
    downlightPercentile,
    setDownlightPercentile
  } = useCorpus();

  if (!isVisualsOpen) return null;

  return (
    <Rnd
      default={{ x: 20, y: 20, width: 320, height: 'auto' }}
      minWidth={280}
      cancel=".no-drag"
      className="visuals-card"
      style={{ zIndex: activeWindow === 'visuals' ? 2600 : 1750 }}
      onDragStart={() => setActiveWindow('visuals')}
      onResizeStart={() => setActiveWindow('visuals')}
    >
      <div className="visuals-header drag-handle" onMouseDown={() => setActiveWindow('visuals')}>
        <div className="visuals-title">
          <i className="fas fa-layer-group"></i> Visuals
        </div>
        <div className="visuals-controls no-drag">
          <button onClick={() => setIsVisualsOpen(false)} title="Minimer til chip">
            <i className="fas fa-window-minimize"></i>
          </button>
        </div>
      </div>

      <div className="visuals-body no-drag">
        <div className="visuals-section">
          <label>Kartmodus</label>
          <div className="visuals-toggle-row">
            <button
              className={`visuals-toggle ${mapVisualMode === 'map' ? 'active' : ''}`}
              onClick={() => setMapVisualMode('map')}
            >
              Kart
            </button>
            <button
              className={`visuals-toggle ${mapVisualMode === 'heatmap' ? 'active' : ''}`}
              onClick={() => setMapVisualMode('heatmap')}
            >
              Heatmap
            </button>
          </div>
        </div>

        <div className="visuals-section">
          <label>Demp lavfrekvente steder ({downlightPercentile}%)</label>
          <div style={{ padding: '0 8px' }}>
            <Slider
              min={0}
              max={99}
              value={downlightPercentile}
              onChange={(val) => setDownlightPercentile(val as number)}
              trackStyle={[{ backgroundColor: '#dc2626' }]}
              handleStyle={[{ borderColor: '#ef4444', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }]}
            />
          </div>
        </div>
      </div>
    </Rnd>
  );
};
