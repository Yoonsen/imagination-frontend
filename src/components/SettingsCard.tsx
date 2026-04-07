import React from 'react';
import { Rnd } from 'react-rnd';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { useCorpus } from '../context/CorpusContext';
import './SettingsCard.css';

export const SettingsCard: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    activeWindow,
    setActiveWindow,
    maxPlacesInView,
    setMaxPlacesInView
  } = useCorpus();

  if (!isSettingsOpen) return null;

  return (
    <Rnd
      default={{ x: 20, y: 260, width: 320, height: 'auto' }}
      minWidth={280}
      cancel=".no-drag"
      className="settings-card"
      style={{ zIndex: activeWindow === 'settings' ? 2600 : 1750 }}
      onDragStart={() => setActiveWindow('settings')}
      onResizeStart={() => setActiveWindow('settings')}
    >
      <div className="settings-header drag-handle" onMouseDown={() => setActiveWindow('settings')}>
        <div className="settings-title">
          <i className="fas fa-cog"></i> Generelle parametre
        </div>
        <div className="settings-controls no-drag">
          <button onClick={() => setIsSettingsOpen(false)} title="Minimer til chip">
            <i className="fas fa-window-minimize"></i>
          </button>
        </div>
      </div>

      <div className="settings-body no-drag">
        <div className="settings-section">
          <label>Maks antall steder i visning ({maxPlacesInView.toLocaleString()})</label>
          <div style={{ padding: '0 8px' }}>
            <Slider
              min={500}
              max={20000}
              step={500}
              value={maxPlacesInView}
              onChange={(val) => setMaxPlacesInView(val as number)}
              trackStyle={[{ backgroundColor: '#4B6CB7' }]}
              handleStyle={[{ borderColor: '#4B6CB7', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }]}
            />
          </div>
          <small className="settings-help">
            Styrer hvor mange steder som hentes inn i standard visning.
          </small>
        </div>
      </div>
    </Rnd>
  );
};
