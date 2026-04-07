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
import { SettingsLauncherChip } from './components/SettingsLauncherChip'
import { SettingsCard } from './components/SettingsCard'
import { useCorpus } from './context/CorpusContext'
import './index.css'

function App() {
  const {
    setIsBrowseTableOpen,
    isBrowseTableOpen,
    setIsCorpusBuilderOpen,
    isCorpusBuilderOpen,
    setIsVisualsOpen,
    isVisualsOpen,
    setIsSettingsOpen,
    isSettingsOpen,
    setMapVisualMode,
    mapVisualMode,
    activeWindow,
    setActiveWindow
  } = useCorpus();
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [isAuthorsInspectorOpen, setIsAuthorsInspectorOpen] = useState(false);
  const [authorsInspectorTab, setAuthorsInspectorTab] = useState<'list' | 'images'>('list');
  const [isPlacesInspectorOpen, setIsPlacesInspectorOpen] = useState(false);
  const [placesInspectorTab, setPlacesInspectorTab] = useState<'list' | 'images'>('list');

  return (
    <div className="app-shell">
      {/* Map layer */}
      <MapContainer center={[60.472, 8.468]} zoom={6} className="map-container" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapVisualMode === 'heatmap' || mapVisualMode === 'heatmap-all' ? (
          <HeatmapLayer useFullDataset={mapVisualMode === 'heatmap-all'} />
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
          if (isVisualsOpen && activeWindow === 'visuals') {
            setIsVisualsOpen(false);
            setActiveWindow(null);
          } else {
            setIsVisualsOpen(true);
            setActiveWindow('visuals');
          }
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
        onVisualsHeatmapAllClick={() => {
          setMapVisualMode('heatmap-all');
          setIsVisualsOpen(true);
          setActiveWindow('visuals');
        }}
      />
      <SettingsLauncherChip
        onSettingsPanelClick={() => {
          if (isSettingsOpen && activeWindow === 'settings') {
            setIsSettingsOpen(false);
            setActiveWindow(null);
          } else {
            setIsSettingsOpen(true);
            setActiveWindow('settings');
          }
        }}
      />
      <StatsHUD
        onBooksDefaultClick={() => {
          if (isBrowseTableOpen && activeWindow === 'browse') {
            setIsBrowseTableOpen(false);
            setActiveWindow(null);
          } else {
            setIsBrowseTableOpen(true);
            setActiveWindow('browse');
          }
        }}
        onBooksCorpusBuilderClick={() => {
          if (isCorpusBuilderOpen && activeWindow === 'builder') {
            setIsCorpusBuilderOpen(false);
            setActiveWindow(null);
          } else {
            setIsCorpusBuilderOpen(true);
            setActiveWindow('builder');
          }
        }}
        onBooksTableClick={() => {
          if (isBrowseTableOpen && activeWindow === 'browse') {
            setIsBrowseTableOpen(false);
            setActiveWindow(null);
          } else {
            setIsBrowseTableOpen(true);
            setActiveWindow('browse');
          }
        }}
        onAuthorsDefaultClick={() => {
          if (isAuthorsInspectorOpen && activeWindow === 'entityAuthors' && authorsInspectorTab === 'list') {
            setIsAuthorsInspectorOpen(false);
            setActiveWindow(null);
          } else {
            setIsAuthorsInspectorOpen(true);
            setAuthorsInspectorTab('list');
            setActiveWindow('entityAuthors');
          }
        }}
        onAuthorsListClick={() => {
          if (isAuthorsInspectorOpen && activeWindow === 'entityAuthors' && authorsInspectorTab === 'list') {
            setIsAuthorsInspectorOpen(false);
            setActiveWindow(null);
          } else {
            setIsAuthorsInspectorOpen(true);
            setAuthorsInspectorTab('list');
            setActiveWindow('entityAuthors');
          }
        }}
        onAuthorsImagesClick={() => {
          if (isAuthorsInspectorOpen && activeWindow === 'entityAuthors' && authorsInspectorTab === 'images') {
            setIsAuthorsInspectorOpen(false);
            setActiveWindow(null);
          } else {
            setIsAuthorsInspectorOpen(true);
            setAuthorsInspectorTab('images');
            setActiveWindow('entityAuthors');
          }
        }}
        onPlacesDefaultClick={() => {
          if (isPlacesInspectorOpen && activeWindow === 'entityPlaces' && placesInspectorTab === 'list') {
            setIsPlacesInspectorOpen(false);
            setActiveWindow(null);
          } else {
            setIsPlacesInspectorOpen(true);
            setPlacesInspectorTab('list');
            setActiveWindow('entityPlaces');
          }
        }}
        onPlacesListClick={() => {
          if (isPlacesInspectorOpen && activeWindow === 'entityPlaces' && placesInspectorTab === 'list') {
            setIsPlacesInspectorOpen(false);
            setActiveWindow(null);
          } else {
            setIsPlacesInspectorOpen(true);
            setPlacesInspectorTab('list');
            setActiveWindow('entityPlaces');
          }
        }}
        onPlacesImagesClick={() => {
          if (isPlacesInspectorOpen && activeWindow === 'entityPlaces' && placesInspectorTab === 'images') {
            setIsPlacesInspectorOpen(false);
            setActiveWindow(null);
          } else {
            setIsPlacesInspectorOpen(true);
            setPlacesInspectorTab('images');
            setActiveWindow('entityPlaces');
          }
        }}
      />
      <div className="workspace-zone">
        <CorpusBuilderCard />
        <VisualsCard />
        <SettingsCard />
        <CorpusBrowseTable />
        {isAuthorsInspectorOpen && (
          <EntityInspectorPanel
            mode="authors"
            windowKey="entityAuthors"
            defaultPosition={{ x: 80, y: 24 }}
            initialTab={authorsInspectorTab}
            onClose={() => {
              setIsAuthorsInspectorOpen(false);
              if (activeWindow === 'entityAuthors') setActiveWindow(null);
            }}
            onSelectPlace={(token) => {
              setSelectedPlace(token);
              setActiveWindow('summary');
            }}
          />
        )}
        {isPlacesInspectorOpen && (
          <EntityInspectorPanel
            mode="places"
            windowKey="entityPlaces"
            defaultPosition={{ x: 180, y: 90 }}
            initialTab={placesInspectorTab}
            onClose={() => {
              setIsPlacesInspectorOpen(false);
              if (activeWindow === 'entityPlaces') setActiveWindow(null);
            }}
            onSelectPlace={(token) => {
              setSelectedPlace(token);
              setActiveWindow('summary');
            }}
          />
        )}
        <PlaceSummaryCard token={selectedPlace} onClose={() => setSelectedPlace(null)} />
      </div>

    </div>
  )
}

export default App
