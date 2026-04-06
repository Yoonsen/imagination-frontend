import { useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { StatsHUD } from './components/StatsHUD'
import { CorpusBuilderCard } from './components/CorpusBuilderCard'
import { MapMarkers } from './components/MapMarkers'
import { HeatmapLayer } from './components/HeatmapLayer'
import { PlaceSummaryCard } from './components/PlaceSummaryCard'
import { CorpusBrowseTable } from './components/CorpusBrowseTable'
import { EntityInspectorPanel } from './components/EntityInspectorPanel'
import { Omnibox } from './components/Omnibox'
import { VisualsCard } from './components/VisualsCard'
import { VisualsLauncherChip } from './components/VisualsLauncherChip'
import { useCorpus } from './context/CorpusContext'
import './index.css'

function App() {
  const {
    setIsBrowseTableOpen,
    setIsCorpusBuilderOpen,
    setIsVisualsOpen,
    setMapVisualMode,
    mapVisualMode,
    setActiveWindow
  } = useCorpus();
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<'authors' | 'places' | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'list' | 'images'>('list');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Map layer */}
      <MapContainer center={[60.472, 8.468]} zoom={6} className="map-container" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapVisualMode === 'heatmap' ? (
          <HeatmapLayer />
        ) : (
          <MapMarkers
            onSelectPlace={(token) => {
              setSelectedPlace(token);
              setActiveWindow('summary');
            }}
          />
        )}
      </MapContainer>

      {/* Floating UI Elements */}
      <Omnibox
        onSelectPlace={(token) => {
          setSelectedPlace(token);
          setActiveWindow('summary');
        }}
      />
      <VisualsLauncherChip
        onVisualsDefaultClick={() => {
          setIsVisualsOpen(true);
          setActiveWindow('visuals');
        }}
        onVisualsMapClick={() => {
          setMapVisualMode('map');
          setIsVisualsOpen(true);
          setActiveWindow('visuals');
        }}
        onVisualsHeatmapClick={() => {
          setMapVisualMode('heatmap');
          setIsVisualsOpen(true);
          setActiveWindow('visuals');
        }}
      />
      <StatsHUD
        onBooksDefaultClick={() => {
          setIsBrowseTableOpen(true);
          setIsCorpusBuilderOpen(false);
          setActiveWindow('browse');
          setInspectorMode(null);
        }}
        onBooksCorpusBuilderClick={() => {
          setIsBrowseTableOpen(false);
          setIsCorpusBuilderOpen(true);
          setActiveWindow('builder');
          setInspectorMode(null);
        }}
        onBooksTableClick={() => {
          setIsBrowseTableOpen(true);
          setIsCorpusBuilderOpen(false);
          setActiveWindow('browse');
          setInspectorMode(null);
        }}
        onAuthorsClick={() => {
          setInspectorMode('authors');
          setInspectorTab('images');
          setActiveWindow('entity');
        }}
        onPlacesDefaultClick={() => {
          setInspectorMode('places');
          setInspectorTab('list');
          setActiveWindow('entity');
        }}
        onPlacesListClick={() => {
          setInspectorMode('places');
          setInspectorTab('list');
          setActiveWindow('entity');
        }}
        onPlacesImagesClick={() => {
          setInspectorMode('places');
          setInspectorTab('images');
          setActiveWindow('entity');
        }}
      />
      <CorpusBuilderCard />
      <VisualsCard />
      <CorpusBrowseTable />
      <EntityInspectorPanel
        mode={inspectorMode}
        initialTab={inspectorTab}
        onClose={() => setInspectorMode(null)}
        onSelectPlace={(token) => {
          setSelectedPlace(token);
          setActiveWindow('summary');
        }}
      />
      <PlaceSummaryCard token={selectedPlace} onClose={() => setSelectedPlace(null)} />

    </div>
  )
}

export default App
