import { useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { StatsHUD } from './components/StatsHUD'
import { CorpusBuilderCard } from './components/CorpusBuilderCard'
import { MapMarkers } from './components/MapMarkers'
import { PlaceSummaryCard } from './components/PlaceSummaryCard'
import { CorpusBrowseTable } from './components/CorpusBrowseTable'
import { EntityInspectorPanel } from './components/EntityInspectorPanel'
import { Omnibox } from './components/Omnibox'
import { useCorpus } from './context/CorpusContext'
import './index.css'

function App() {
  const { setIsBrowseTableOpen, setIsCorpusBuilderOpen } = useCorpus();
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<'authors' | 'places' | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'list' | 'images'>('list');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Map layer */}
      <MapContainer center={[60.472, 8.468]} zoom={6} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapMarkers onSelectPlace={setSelectedPlace} />
      </MapContainer>

      {/* Floating UI Elements */}
      <Omnibox onSelectPlace={setSelectedPlace} />
      <StatsHUD
        onBooksDefaultClick={() => {
          setIsBrowseTableOpen(true);
          setIsCorpusBuilderOpen(false);
          setInspectorMode(null);
        }}
        onBooksCorpusBuilderClick={() => {
          setIsBrowseTableOpen(false);
          setIsCorpusBuilderOpen(true);
          setInspectorMode(null);
        }}
        onBooksTableClick={() => {
          setIsBrowseTableOpen(true);
          setIsCorpusBuilderOpen(false);
          setInspectorMode(null);
        }}
        onAuthorsClick={() => {
          setInspectorMode('authors');
          setInspectorTab('images');
        }}
        onPlacesDefaultClick={() => {
          setInspectorMode('places');
          setInspectorTab('list');
        }}
        onPlacesListClick={() => {
          setInspectorMode('places');
          setInspectorTab('list');
        }}
        onPlacesImagesClick={() => {
          setInspectorMode('places');
          setInspectorTab('images');
        }}
      />
      <CorpusBuilderCard />
      <CorpusBrowseTable />
      <EntityInspectorPanel
        mode={inspectorMode}
        initialTab={inspectorTab}
        onClose={() => setInspectorMode(null)}
        onSelectPlace={(token) => setSelectedPlace(token)}
      />
      <PlaceSummaryCard token={selectedPlace} onClose={() => setSelectedPlace(null)} />

    </div>
  )
}

export default App
