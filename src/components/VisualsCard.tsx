import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import html2canvas from 'html2canvas';
import { useCorpus } from '../context/CorpusContext';
import { useWindowLayout } from '../utils/windowLayout';
import './VisualsCard.css';

export const VisualsCard: React.FC = () => {
  const {
    isVisualsOpen,
    setIsVisualsOpen,
    activeWindow,
    setActiveWindow,
    mapVisualMode,
    setMapVisualMode,
    downlightColorMode,
    setDownlightColorMode,
    downlightPercentile,
    setDownlightPercentile,
    lowFreqGreenStrength,
    setLowFreqGreenStrength,
    markerSizeScale,
    setMarkerSizeScale,
    heatmapStrength,
    setHeatmapStrength,
    compareSegmentsEnabled,
    setCompareSegmentsEnabled,
    segmentABookIds,
    segmentBBookIds
  } = useCorpus();
  const [isExporting, setIsExporting] = useState(false);

  const wait = (ms: number) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

  const downloadViewport = async (targetMode: 'map' | 'heatmap' | 'heatmap-all') => {
    if (isExporting) return;
    setIsExporting(true);
    const previousMode = mapVisualMode;
    try {
      if (mapVisualMode !== targetMode) {
        setMapVisualMode(targetMode);
        await wait(450);
      } else {
        await wait(150);
      }

      const mapElement = document.querySelector('.map-container') as HTMLElement | null;
      if (!mapElement) {
        alert('Fant ikke kart-viewport for nedlasting.');
        return;
      }

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: Math.min(window.devicePixelRatio || 1, 2),
        logging: false
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `imagination_${targetMode}_viewport.png`;
      link.click();
    } catch (error) {
      console.error(error);
      alert('Kunne ikke lage nedlasting av kartutsnittet.');
    } finally {
      if (previousMode !== targetMode) {
        setMapVisualMode(previousMode);
      }
      setIsExporting(false);
    }
  };

  const sliderTrackColor = downlightColorMode === 'red'
      ? '#dc2626'
      : '#2563eb';
  const sliderHandleColor = downlightColorMode === 'red'
      ? '#ef4444'
      : '#3b82f6';
  const { layout, onDragStop, onResizeStop } = useWindowLayout({
    key: 'visuals',
    defaultLayout: { x: 20, y: 20, width: 320, height: 640 },
    minWidth: 280,
    minHeight: 380
  });

  if (!isVisualsOpen) return null;

  return (
    <Rnd
      size={{ width: layout.width, height: layout.height }}
      position={{ x: layout.x, y: layout.y }}
      minWidth={280}
      minHeight={320}
      cancel=".no-drag"
      dragHandleClassName="drag-handle"
      className="visuals-card"
      style={{ zIndex: activeWindow === 'visuals' ? 2600 : 1750 }}
      onDragStart={() => setActiveWindow('visuals')}
      onResizeStart={() => setActiveWindow('visuals')}
      onDragStop={onDragStop}
      onResizeStop={onResizeStop}
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
            <button
              className={`visuals-toggle ${mapVisualMode === 'heatmap-all' ? 'active' : ''}`}
              onClick={() => setMapVisualMode('heatmap-all')}
            >
              Heatmap (alle)
            </button>
          </div>
        </div>

        <div className="visuals-section">
          <label>Fargeprofil for demping</label>
          <div className="visuals-toggle-row">
            <button
              className={`visuals-toggle ${downlightColorMode === 'red' ? 'active' : ''}`}
              onClick={() => setDownlightColorMode('red')}
            >
              Rød fokus
            </button>
            <button
              className={`visuals-toggle ${downlightColorMode === 'blue' ? 'active' : ''}`}
              onClick={() => setDownlightColorMode('blue')}
            >
              Blå dis
            </button>
          </div>
        </div>

        <div className="visuals-section">
          <label>Grønn-gradient for lavfrekvente ({lowFreqGreenStrength}%)</label>
          <div style={{ padding: '0 8px' }}>
            <Slider
              min={0}
              max={100}
              value={lowFreqGreenStrength}
              onChange={(val) => setLowFreqGreenStrength(val as number)}
              trackStyle={[{ backgroundColor: '#16a34a' }]}
              handleStyle={[{ borderColor: '#22c55e', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }]}
            />
          </div>
        </div>

        <div className="visuals-section">
          <label>Størrelse på stedsmarkører ({markerSizeScale}%)</label>
          <div style={{ padding: '0 8px' }}>
            <Slider
              min={20}
              max={200}
              step={5}
              value={markerSizeScale}
              onChange={(val) => setMarkerSizeScale(val as number)}
              trackStyle={[{ backgroundColor: '#4B6CB7' }]}
              handleStyle={[{ borderColor: '#4B6CB7', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }]}
            />
          </div>
          <small className="visuals-help">
            Skalerer radius på markører i kartvisning.
          </small>
        </div>

        <div className="visuals-section">
          <label>Demp lavfrekvente steder ({downlightPercentile}%)</label>
          <div style={{ padding: '0 8px' }}>
            <Slider
              min={0}
              max={99}
              value={downlightPercentile}
              onChange={(val) => setDownlightPercentile(val as number)}
              trackStyle={[{ backgroundColor: sliderTrackColor }]}
              handleStyle={[{ borderColor: sliderHandleColor, backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }]}
            />
          </div>
        </div>

        <div className="visuals-section">
          <label>Heatmap-styrke ({heatmapStrength}%)</label>
          <div style={{ padding: '0 8px' }}>
            <Slider
              min={50}
              max={300}
              step={10}
              value={heatmapStrength}
              onChange={(val) => setHeatmapStrength(val as number)}
              trackStyle={[{ backgroundColor: '#7c3aed' }]}
              handleStyle={[{ borderColor: '#7c3aed', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }]}
            />
          </div>
          <small className="visuals-help">
            Øker synlighet når det er få punkt i heatmap.
          </small>
        </div>

        <div className="visuals-section">
          <label>Segmentvisning (A/B)</label>
          <div className="visuals-toggle-row">
            <button
              className={`visuals-toggle ${compareSegmentsEnabled ? 'active' : ''}`}
              onClick={() => setCompareSegmentsEnabled(!compareSegmentsEnabled)}
              disabled={segmentABookIds.length === 0 || segmentBBookIds.length === 0}
              title={compareSegmentsEnabled ? 'Slå av sammenligning' : 'Sammenlign segment A og B'}
            >
              {compareSegmentsEnabled ? 'Slå av sammenligning' : 'Sammenlign A/B'}
            </button>
          </div>
          <small className="visuals-help">
            Velg A/B per bok i bøkerlista. Nå: A={segmentABookIds.length}, B={segmentBBookIds.length}. Kartfarger: blå = kun A, rød = kun B, lilla = begge.
          </small>
        </div>

        <div className="visuals-section">
          <label>Nedlasting av viewport</label>
          <div className="visuals-export-row">
            <button
              className="visuals-toggle"
              onClick={() => downloadViewport('map')}
              disabled={isExporting}
            >
              <i className="fas fa-download"></i> Kart
            </button>
            <button
              className="visuals-toggle"
              onClick={() => downloadViewport('heatmap')}
              disabled={isExporting}
            >
              <i className="fas fa-download"></i> Heatmap
            </button>
            <button
              className="visuals-toggle"
              onClick={() => downloadViewport('heatmap-all')}
              disabled={isExporting}
            >
              <i className="fas fa-download"></i> Heatmap (alle)
            </button>
          </div>
        </div>
      </div>
    </Rnd>
  );
};
