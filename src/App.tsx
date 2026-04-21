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
import { TemporalCard } from './components/TemporalCard'
import { GeoConcordanceCard } from './components/GeoConcordanceCard'
import { BookSequenceCard } from './components/BookSequenceCard'
import { useCorpus } from './context/CorpusContext'
import type { GeoSequenceRow } from './utils/geoApi'
import './index.css'

interface SelectedPlace {
  token: string;
  placeId?: string;
}

interface OmniboxSearchPlace {
  id: string;
  token: string;
  lat: number;
  lon: number;
  frequency: number;
  doc_count: number;
}

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
    setIsGeoConcordanceOpen,
    isGeoConcordanceOpen,
    setMapVisualMode,
    mapVisualMode,
    activeWindow,
    setActiveWindow
  } = useCorpus();
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [isAuthorsInspectorOpen, setIsAuthorsInspectorOpen] = useState(false);
  const [authorsInspectorTab, setAuthorsInspectorTab] = useState<'list' | 'images'>('list');
  const [isPlacesInspectorOpen, setIsPlacesInspectorOpen] = useState(false);
  const [placesInspectorTab, setPlacesInspectorTab] = useState<'list' | 'images'>('list');
  const [isTemporalOpen, setIsTemporalOpen] = useState(false);
  const [isBookSequenceOpen, setIsBookSequenceOpen] = useState(false);
  const [sequenceBookId, setSequenceBookId] = useState<number | null>(null);
  const [sequenceRows, setSequenceRows] = useState<GeoSequenceRow[]>([]);
  const [sequenceDimOthers, setSequenceDimOthers] = useState(true);
  const [sequenceShowLine, setSequenceShowLine] = useState(false);
  const [sequenceShortStepsMode, setSequenceShortStepsMode] = useState(true);
  const [sequenceMaxStepKm, setSequenceMaxStepKm] = useState(350);
  const [sequenceProgressPct, setSequenceProgressPct] = useState(0);
  const [geoFocusPlaceIds, setGeoFocusPlaceIds] = useState<string[]>([]);
  const [geoFocusDimOthers, setGeoFocusDimOthers] = useState(true);
  const [geoFocusStyle, setGeoFocusStyle] = useState<'fill' | 'ring'>('ring');
  const [omniboxSearchLayer, setOmniboxSearchLayer] = useState<OmniboxSearchPlace[]>([]);

  const openBookSequenceForBook = (bookId: number) => {
    setSequenceBookId(bookId);
    setIsBookSequenceOpen(true);
    setActiveWindow('bookSequence');
  };

  const exitBookSequenceMode = () => {
    setIsBookSequenceOpen(false);
    setSequenceRows([]);
    setSequenceBookId(null);
    setSequenceProgressPct(0);
    if (activeWindow === 'bookSequence') setActiveWindow(null);
  };

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
            onSelectPlace={(place) => {
              setSelectedPlace(place);
              setActiveWindow('summary');
            }}
            bookSequence={{
              rows: sequenceRows,
              dimOthers: sequenceDimOthers,
              showLine: sequenceShowLine,
              shortStepsMode: sequenceShortStepsMode,
              maxStepKm: sequenceMaxStepKm,
              progressPct: sequenceProgressPct
            }}
            geoFocus={{
              placeIds: geoFocusPlaceIds,
              dimOthers: geoFocusDimOthers,
              style: geoFocusStyle
            }}
            omniboxSearchPlaces={omniboxSearchLayer}
          />
        )}
      </MapContainer>

      {/* Floating UI Elements */}
      <Omnibox
        onSelectPlace={(place) => {
          setMapVisualMode('map');
          setSelectedPlace(place);
          setActiveWindow('summary');
        }}
        onSetSearchMapLayer={(places) => {
          setMapVisualMode('map');
          setOmniboxSearchLayer(places);
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
        onSuggestChangeClick={() => {
          const title = encodeURIComponent('Forslag: ');
          const body = encodeURIComponent([
            '## Forslag',
            'Beskriv ønsket endring her.',
            '',
            '## Hvor i appen',
            'f.eks. Tidsvisning / Geo-konkordans / Steder',
            '',
            '## Hvorfor',
            'Hva blir bedre for brukeren?'
          ].join('\n'));
          window.open(`https://github.com/Yoonsen/imagination-frontend/issues/new?title=${title}&body=${body}`, '_blank', 'noopener,noreferrer');
        }}
      />
      <StatsHUD
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
        onPlacesGeoConcordanceClick={() => {
          if (isGeoConcordanceOpen && activeWindow === 'geoConcordance') {
            setIsGeoConcordanceOpen(false);
            setActiveWindow(null);
          } else {
            setIsGeoConcordanceOpen(true);
            setActiveWindow('geoConcordance');
          }
        }}
        onPlacesBookSequenceClick={() => {
          if (isBookSequenceOpen && activeWindow === 'bookSequence') {
            exitBookSequenceMode();
          } else {
            setIsBookSequenceOpen(true);
            setActiveWindow('bookSequence');
          }
        }}
        onYearClick={() => {
          if (isTemporalOpen && activeWindow === 'temporal') {
            setIsTemporalOpen(false);
            setActiveWindow(null);
          } else {
            setIsTemporalOpen(true);
            setActiveWindow('temporal');
          }
        }}
      />
      <div className="workspace-zone">
        <CorpusBuilderCard />
        <VisualsCard />
        <SettingsCard />
        <GeoConcordanceCard
          isOpen={isGeoConcordanceOpen}
          onClose={() => {
            setIsGeoConcordanceOpen(false);
            if (activeWindow === 'geoConcordance') setActiveWindow(null);
          }}
          onApplyMapFocus={({ placeIds, dimOthers, style }) => {
            setGeoFocusPlaceIds(placeIds);
            setGeoFocusDimOthers(dimOthers);
            setGeoFocusStyle(style);
            setMapVisualMode('map');
          }}
          onClearMapFocus={() => setGeoFocusPlaceIds([])}
          mapFocusAppliedCount={geoFocusPlaceIds.length}
        />
        <BookSequenceCard
          isOpen={isBookSequenceOpen}
          onClose={exitBookSequenceMode}
          onExitMode={exitBookSequenceMode}
          selectedBookId={sequenceBookId}
          onSelectBookId={setSequenceBookId}
          sequenceRows={sequenceRows}
          onSetSequenceRows={(rows) => {
            setSequenceRows(rows);
            setSequenceProgressPct(0);
          }}
          dimOthers={sequenceDimOthers}
          onSetDimOthers={setSequenceDimOthers}
          showLine={sequenceShowLine}
          onSetShowLine={setSequenceShowLine}
          shortStepsMode={sequenceShortStepsMode}
          onSetShortStepsMode={setSequenceShortStepsMode}
          maxStepKm={sequenceMaxStepKm}
          onSetMaxStepKm={setSequenceMaxStepKm}
          progressPct={sequenceProgressPct}
          onSetProgressPct={setSequenceProgressPct}
        />
        <TemporalCard
          isOpen={isTemporalOpen}
          onClose={() => {
            setIsTemporalOpen(false);
            if (activeWindow === 'temporal') setActiveWindow(null);
          }}
        />
        <CorpusBrowseTable onShowBookSequence={openBookSequenceForBook} />
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
            onSelectPlace={(place) => {
              setSelectedPlace(place);
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
            onSelectPlace={(place) => {
              setSelectedPlace(place);
              setActiveWindow('summary');
            }}
          />
        )}
        <PlaceSummaryCard
          token={selectedPlace?.token || null}
          placeId={selectedPlace?.placeId}
          onClose={() => setSelectedPlace(null)}
          onShowBookSequence={openBookSequenceForBook}
        />
      </div>

    </div>
  )
}

export default App
