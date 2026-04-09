import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface BookMetadata {
  dhlabid: number;
  urn: string;
  author: string | null;
  year: number | null;
  category: string | null;
  title: string | null;
  unique_places?: number;
  total_mentions?: number;
}

export interface PlacePoint {
    id: string;
    token: string;
    name: string | null;
    lat: number;
    lon: number;
    frequency: number;
    doc_count: number;
}

interface CorpusContextType {
  allBooks: BookMetadata[];
  activeDhlabids: number[];
  setActiveDhlabids: (ids: number[]) => void;
  API_URL: string;
  LEGACY_API_URL: string;
  isLoading: boolean;
  error: string | null;
  // Computed values based on active set
  activeBooksMetadata: BookMetadata[];
  isBrowseTableOpen: boolean;
  setIsBrowseTableOpen: (val: boolean) => void;
  isCorpusBuilderOpen: boolean;
  setIsCorpusBuilderOpen: (val: boolean) => void;
  isVisualsOpen: boolean;
  setIsVisualsOpen: (val: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (val: boolean) => void;
  isGeoConcordanceOpen: boolean;
  setIsGeoConcordanceOpen: (val: boolean) => void;
  activeWindow: 'builder' | 'browse' | 'visuals' | 'settings' | 'temporal' | 'geoConcordance' | 'bookSequence' | 'entityAuthors' | 'entityPlaces' | 'summary' | null;
  setActiveWindow: (window: 'builder' | 'browse' | 'visuals' | 'settings' | 'temporal' | 'geoConcordance' | 'bookSequence' | 'entityAuthors' | 'entityPlaces' | 'summary' | null) => void;
  // Map properties
  places: PlacePoint[];
  totalPlaces: number;
  isPlacesLoading: boolean;
  mapVisualMode: 'map' | 'heatmap' | 'heatmap-all';
  setMapVisualMode: (mode: 'map' | 'heatmap' | 'heatmap-all') => void;
  downlightColorMode: 'red' | 'blue';
  setDownlightColorMode: (mode: 'red' | 'blue') => void;
  downlightPercentile: number;
  setDownlightPercentile: (val: number) => void;
  lowFreqGreenStrength: number;
  setLowFreqGreenStrength: (val: number) => void;
  markerSizeScale: number;
  setMarkerSizeScale: (val: number) => void;
  maxPlacesInView: number;
  setMaxPlacesInView: (val: number) => void;
  temporalEnabled: boolean;
  setTemporalEnabled: (val: boolean) => void;
  temporalCutoffYear: number | null;
  setTemporalCutoffYear: (year: number | null) => void;
  temporalMode: 'color' | 'toggle';
  setTemporalMode: (mode: 'color' | 'toggle') => void;
}

const CorpusContext = createContext<CorpusContextType | undefined>(undefined);

export const CorpusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [allBooks, setAllBooks] = useState<BookMetadata[]>([]);
  const [activeDhlabids, setActiveDhlabids] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isBrowseTableOpen, setIsBrowseTableOpen] = useState(false);
  const [isCorpusBuilderOpen, setIsCorpusBuilderOpen] = useState(false);
  const [isVisualsOpen, setIsVisualsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGeoConcordanceOpen, setIsGeoConcordanceOpen] = useState(false);
  const [activeWindow, setActiveWindow] = useState<'builder' | 'browse' | 'visuals' | 'settings' | 'temporal' | 'geoConcordance' | 'bookSequence' | 'entityAuthors' | 'entityPlaces' | 'summary' | null>(null);
  
  const [places, setPlaces] = useState<PlacePoint[]>([]);
  const [totalPlaces, setTotalPlaces] = useState<number>(0);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [mapVisualMode, setMapVisualMode] = useState<'map' | 'heatmap' | 'heatmap-all'>('map');
  const [downlightColorMode, setDownlightColorMode] = useState<'red' | 'blue'>('blue');
  const [downlightPercentile, setDownlightPercentile] = useState<number>(0);
  const [lowFreqGreenStrength, setLowFreqGreenStrength] = useState<number>(0);
  const [markerSizeScale, setMarkerSizeScale] = useState<number>(100);
  const [maxPlacesInView, setMaxPlacesInView] = useState<number>(5000);
  const [temporalEnabled, setTemporalEnabled] = useState<boolean>(false);
  const [temporalCutoffYear, setTemporalCutoffYear] = useState<number | null>(null);
  const [temporalMode, setTemporalMode] = useState<'color' | 'toggle'>('color');

  const API_URL = import.meta.env.VITE_API_URL || 'https://api.nb.no/dhlab/imag';
  const LEGACY_API_URL = import.meta.env.VITE_LEGACY_API_URL || 'https://api.nb.no/dhlab';

  useEffect(() => {
    // Fetch all metadata on initial load
    fetch(`${API_URL}/api/metadata/all`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch metadata");
        return res.json();
      })
      .then(data => {
        setAllBooks(data.books || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (activeDhlabids.length === 0) {
      setPlaces([]);
      setTotalPlaces(0);
      return;
    }
    setIsPlacesLoading(true);
    fetch(`${API_URL}/api/places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dhlabids: activeDhlabids, maxPlaces: maxPlacesInView })
    }).then(res => {
      if (!res.ok) throw new Error("Failed to fetch places");
      return res.json();
    })
      .then(data => { 
          setPlaces(data.places || []); 
          setTotalPlaces(data.total_places || (data.places ? data.places.length : 0));
          setIsPlacesLoading(false); 
      })
      .catch(err => { console.error(err); setIsPlacesLoading(false); });
  }, [activeDhlabids, API_URL, maxPlacesInView]);

  const activeBooksMetadata = useMemo(() => {
    const activeSet = new Set(activeDhlabids);
    return allBooks.filter(b => activeSet.has(b.dhlabid));
  }, [allBooks, activeDhlabids]);

  return (
    <CorpusContext.Provider value={{
      allBooks,
      activeDhlabids,
      setActiveDhlabids,
      API_URL,
      LEGACY_API_URL,
      isLoading,
      error,
      activeBooksMetadata,
      isBrowseTableOpen,
      setIsBrowseTableOpen,
      isCorpusBuilderOpen,
      setIsCorpusBuilderOpen,
      isVisualsOpen,
      setIsVisualsOpen,
      isSettingsOpen,
      setIsSettingsOpen,
      isGeoConcordanceOpen,
      setIsGeoConcordanceOpen,
      activeWindow,
      setActiveWindow,
      places,
      totalPlaces,
      isPlacesLoading,
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
      maxPlacesInView,
      setMaxPlacesInView,
      temporalEnabled,
      setTemporalEnabled,
      temporalCutoffYear,
      setTemporalCutoffYear,
      temporalMode,
      setTemporalMode
    }}>
      {children}
    </CorpusContext.Provider>
  );
};

export const useCorpus = () => {
  const context = useContext(CorpusContext);
  if (context === undefined) {
    throw new Error('useCorpus must be used within a CorpusProvider');
  }
  return context;
};
