import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { useCorpus } from '../context/CorpusContext';
import { mixHex } from '../utils/colors';
import { fetchFirstYearByTokenForCorpus } from '../utils/temporal';

interface MapMarkersProps {
    onSelectPlace: (place: { token: string; placeId?: string }) => void;
}

const MAP_MARKER_LIMIT = 1800;

export const MapMarkers: React.FC<MapMarkersProps> = ({ onSelectPlace }) => {
    const {
        places,
        totalPlaces,
        activeBooksMetadata,
        API_URL,
        maxPlacesInView,
        isPlacesLoading,
        downlightPercentile,
        downlightColorMode,
        lowFreqGreenStrength,
        markerSizeScale,
        temporalEnabled,
        temporalCutoffYear,
        temporalMode
    } = useCorpus();
    const map = useMap();
    const [firstYearByToken, setFirstYearByToken] = useState<Map<string, number> | null>(null);
    const temporalMappingReady = !temporalEnabled || firstYearByToken !== null;

    useEffect(() => {
        if (!temporalEnabled) {
            setFirstYearByToken(null);
            return;
        }

        // Avoid rendering with stale year mapping while recomputing.
        setFirstYearByToken(null);
        let cancelled = false;
        const run = async () => {
            const firstSeen = await fetchFirstYearByTokenForCorpus({
                apiUrl: API_URL,
                activeBooksMetadata,
                maxPlacesInView,
                totalPlaces
            });
            if (!cancelled) setFirstYearByToken(firstSeen);
        };

        run().catch((err) => {
            if (cancelled) return;
            console.error(err);
            setFirstYearByToken(null);
        });

        return () => {
            cancelled = true;
        };
    }, [temporalEnabled, activeBooksMetadata, API_URL, maxPlacesInView, totalPlaces]);

    // Beregn størrelsene iterativt med np.log1p math ekvivalent for React
    const renderedMarkers = useMemo(() => {
        if (!temporalMappingReady) return [];
        if (places.length === 0) return [];
        const mapPlaces = [...places]
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, MAP_MARKER_LIMIT);
        
        const frequencies = mapPlaces.map(p => p.frequency);
        const minFreq = Math.min(...frequencies);
        const maxFreq = Math.max(...frequencies);
        const logMin = Math.log1p(minFreq);
        const logMax = Math.log1p(maxFreq);
        
        // Calculate the absolute frequency threshold based on the percentile
        let thresholdFreq = 0;
        if (downlightPercentile > 0) {
           const sortedFreqs = [...frequencies].sort((a,b)=>a-b);
           const pIdx = Math.floor((downlightPercentile / 100) * (mapPlaces.length - 1));
           thresholdFreq = sortedFreqs[pIdx];
        }

        return mapPlaces.map(place => {
            // Normalisert radius
            let radius = 6;
            if (logMax > logMin) {
                const norm = (Math.log1p(place.frequency) - logMin) / (logMax - logMin);
                radius = 6 + norm * 18;
            }
            radius = Math.max(2, Math.min(60, radius * (markerSizeScale / 100)));
            
            const isDownlighted = place.frequency <= thresholdFreq;
            const firstYear = firstYearByToken?.get(place.token);
            const isAfterOnly = temporalEnabled
                && temporalCutoffYear !== null
                && typeof firstYear === 'number'
                && firstYear >= temporalCutoffYear;
            const isUnknown = temporalEnabled
                && temporalCutoffYear !== null
                && typeof firstYear !== 'number';

            if (temporalEnabled && temporalMode === 'toggle' && (isAfterOnly || isUnknown)) {
                return null;
            }

            const baseStroke = downlightColorMode === 'red' ? '#dc2626' : '#1d4ed8';
            const baseFill = downlightColorMode === 'red' ? '#ef4444' : '#3b82f6';
            const greenBase = '#22c55e';
            const greenStrength = lowFreqGreenStrength / 100;
            const lowFreqBias = logMax > logMin
                ? 1 - ((Math.log1p(place.frequency) - logMin) / (logMax - logMin))
                : 1;
            const greenMix = greenStrength * Math.max(0, Math.min(1, lowFreqBias));
            const activeStroke = mixHex(baseStroke, '#15803d', greenMix * 0.9);
            const activeFill = mixHex(baseFill, greenBase, greenMix);
            const dimFill = mixHex(downlightColorMode === 'red' ? '#fca5a5' : '#93c5fd', '#86efac', greenMix);
            const temporalFill = temporalEnabled && temporalMode === 'color' && (isAfterOnly || isUnknown) ? '#cbd5e1' : activeFill;
            const temporalStroke = temporalEnabled && temporalMode === 'color' && (isAfterOnly || isUnknown) ? '#94a3b8' : activeStroke;
            const temporalOpacity = temporalEnabled && temporalMode === 'color' && (isAfterOnly || isUnknown) ? 0.28 : (downlightColorMode === 'red' ? 0.62 : 0.54);

            return (
                <CircleMarker
                    key={place.id}
                    center={[place.lat, place.lon]}
                    radius={radius}
                    pathOptions={{ 
                        color: isDownlighted ? 'transparent' : temporalStroke,
                        fillColor: isDownlighted ? dimFill : temporalFill,
                        fillOpacity: isDownlighted ? 0.12 : temporalOpacity,
                        weight: isDownlighted ? 0 : 1.5
                    }}
                    eventHandlers={{
                        click: () => {
                            onSelectPlace({ token: place.token, placeId: place.id });
                            map.panTo([place.lat, place.lon]);
                        }
                    }}
                >
                    <Tooltip sticky>
                        <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                            <strong>{place.token}</strong> {place.name ? `(${place.name})` : ''}<br />
                            Nevnt: <strong>{place.frequency.toLocaleString()}</strong> ganger<br />
                            Forekommer i: <strong>{place.doc_count.toLocaleString()}</strong> bøker
                            {temporalEnabled && temporalCutoffYear !== null && (
                                <>
                                    <br />
                                    Første nevningsår: <strong>{typeof firstYear === 'number' ? firstYear : 'ukjent'}</strong>
                                </>
                            )}
                        </div>
                    </Tooltip>
                </CircleMarker>
            );
        }).filter(Boolean);
    }, [
        places,
        onSelectPlace,
        map,
        downlightPercentile,
        downlightColorMode,
        lowFreqGreenStrength,
        markerSizeScale,
        temporalEnabled,
        temporalCutoffYear,
        temporalMode,
        firstYearByToken
        , temporalMappingReady
    ]);

    if (isPlacesLoading || !temporalMappingReady) {
        // En elegant måte å vise kart-loading på kan implementeres
        return null;
    }

    return <>{renderedMarkers}</>;
}
