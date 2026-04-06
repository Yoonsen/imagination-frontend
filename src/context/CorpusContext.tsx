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
  activeWindow: 'builder' | 'browse' | 'visuals' | 'entity' | 'summary' | null;
  setActiveWindow: (window: 'builder' | 'browse' | 'visuals' | 'entity' | 'summary' | null) => void;
  // Map properties
  places: PlacePoint[];
  totalPlaces: number;
  isPlacesLoading: boolean;
  mapVisualMode: 'map' | 'heatmap';
  setMapVisualMode: (mode: 'map' | 'heatmap') => void;
  downlightPercentile: number;
  setDownlightPercentile: (val: number) => void;
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
  const [activeWindow, setActiveWindow] = useState<'builder' | 'browse' | 'visuals' | 'entity' | 'summary' | null>(null);
  
  const [places, setPlaces] = useState<PlacePoint[]>([]);
  const [totalPlaces, setTotalPlaces] = useState<number>(0);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [mapVisualMode, setMapVisualMode] = useState<'map' | 'heatmap'>('map');
  const [downlightPercentile, setDownlightPercentile] = useState<number>(0);

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
        body: JSON.stringify({ dhlabids: activeDhlabids, maxPlaces: 5000 })
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
  }, [activeDhlabids, API_URL]);

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
      activeWindow,
      setActiveWindow,
      places,
      totalPlaces,
      isPlacesLoading,
      mapVisualMode,
      setMapVisualMode,
      downlightPercentile,
      setDownlightPercentile
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
