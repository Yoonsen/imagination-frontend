import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import { useCorpus } from '../context/CorpusContext';
import { mixHex } from '../utils/colors';
import { fetchFirstYearByTokenForCorpus } from '../utils/temporal';
import type { GeoSequenceRow } from '../utils/geoApi';

interface MapMarkersProps {
    onSelectPlace: (place: { token: string; placeId?: string }) => void;
    bookSequence?: {
        rows: GeoSequenceRow[];
        dimOthers: boolean;
        showLine: boolean;
        shortStepsMode: boolean;
        maxStepKm: number;
    };
}

const MAP_MARKER_LIMIT = 1800;

const normalizeType = (value: unknown): 'geonames' | 'internal' | null => {
    if (value === 'geonames' || value === 'internal') return value;
    if (value === 1 || value === '1') return 'geonames';
    if (value === 0 || value === '0') return 'internal';
    return null;
};

const normalizePlaceIdCandidates = (value: unknown): string[] => {
    if (value === null || value === undefined) return [];
    const raw = String(value).trim().toLowerCase();
    if (!raw) return [];
    const stripped = raw.startsWith('#geo:') ? raw.slice(5) : raw;
    const candidates = new Set<string>([raw, stripped]);
    if (/^\d+$/.test(stripped)) {
        // Numeric ids are usually geonames in current backend conventions.
        candidates.add(`geonames:${stripped}`);
    }
    return [...candidates];
};

const toCoordKey = (lat: number, lon: number): string => `${lat.toFixed(5)}:${lon.toFixed(5)}`;

const haversineKm = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const aa =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
};

const filterByShortSteps = (rows: GeoSequenceRow[], maxStepKm: number): GeoSequenceRow[] => {
    if (!rows.length) return rows;
    const filtered: GeoSequenceRow[] = [];
    let lastCoord: { lat: number; lon: number } | null = null;
    rows.forEach((row) => {
        const lat = row.place?.lat;
        const lon = row.place?.lon;
        if (typeof lat !== 'number' || typeof lon !== 'number') {
            // Keep unresolved points so id-based highlight can still work.
            filtered.push(row);
            return;
        }
        if (!lastCoord) {
            filtered.push(row);
            lastCoord = { lat, lon };
            return;
        }
        const jumpKm = haversineKm(lastCoord.lat, lastCoord.lon, lat, lon);
        if (jumpKm <= maxStepKm) {
            filtered.push(row);
            lastCoord = { lat, lon };
        }
    });
    return filtered;
};

export const MapMarkers: React.FC<MapMarkersProps> = ({ onSelectPlace, bookSequence }) => {
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

    const renderedLayers = useMemo(() => {
        if (!temporalMappingReady) return [];
        if (places.length === 0) return [];
        const mapPlaces = [...places]
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, MAP_MARKER_LIMIT);
        const mapPlaceById = new Map(
            mapPlaces
                .filter(place => typeof place.id === 'string' && place.id.length > 0)
                .map(place => [String(place.id).toLowerCase(), place] as const)
        );
        const rawSequenceRows = bookSequence?.rows || [];
        const sequenceRows = bookSequence?.shortStepsMode
            ? filterByShortSteps(rawSequenceRows, Math.max(1, bookSequence?.maxStepKm || 1))
            : rawSequenceRows;
        const sequenceIds = new Set<string>();
        const sequenceCoords = new Set<string>();
        sequenceRows.forEach((row) => {
            const normalizedType = normalizeType((row as any).placeKeyType);
            const keyRaw = (row as any).placeKey;
            const key = keyRaw === null || keyRaw === undefined ? '' : String(keyRaw).trim();
            if (normalizedType && key) {
                sequenceIds.add(`${normalizedType}:${key}`.toLowerCase());
            }
            if (typeof (row as any).geonamesId === 'number') {
                sequenceIds.add(`geonames:${String((row as any).geonamesId)}`.toLowerCase());
            }
            if (typeof (row as any).placeId === 'number') {
                sequenceIds.add(`internal:${String((row as any).placeId)}`.toLowerCase());
            }
            const lat = (row as any).place?.lat;
            const lon = (row as any).place?.lon;
            if (typeof lat === 'number' && typeof lon === 'number') {
                sequenceCoords.add(toCoordKey(lat, lon));
            }
        });
        const hasSequence = sequenceIds.size > 0 || sequenceCoords.size > 0;
        
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

        const markers = mapPlaces.map(place => {
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
            const placeIdCandidates = normalizePlaceIdCandidates(place.id);
            const inBookSequence = (
                (hasSequence && placeIdCandidates.some((candidate) => sequenceIds.has(candidate)))
                || sequenceCoords.has(toCoordKey(place.lat, place.lon))
            );
            const shouldDimBySequence = hasSequence && bookSequence?.dimOthers && !inBookSequence;
            const displayRadius = inBookSequence ? Math.max(3.5, radius * 1.18) : radius;
            const displayStroke = inBookSequence ? '#facc15' : temporalStroke;
            const displayFill = inBookSequence ? '#fde047' : temporalFill;
            const displayOpacity = shouldDimBySequence ? 0.06 : (inBookSequence ? 0.86 : temporalOpacity);
            const displayWeight = shouldDimBySequence ? 0 : (inBookSequence ? 2.2 : (isDownlighted ? 0 : 1.5));
            const fallbackFill = shouldDimBySequence ? '#cbd5e1' : dimFill;

            return (
                <CircleMarker
                    key={place.id}
                    center={[place.lat, place.lon]}
                    radius={displayRadius}
                    pathOptions={{ 
                        color: isDownlighted && !inBookSequence ? 'transparent' : displayStroke,
                        fillColor: isDownlighted && !inBookSequence ? fallbackFill : displayFill,
                        fillOpacity: isDownlighted && !inBookSequence ? Math.min(displayOpacity, 0.12) : displayOpacity,
                        weight: displayWeight
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

        const polylinePoints: [number, number][] = sequenceRows
            .map((row) => {
                const normalizedType = normalizeType((row as any).placeKeyType);
                const key = normalizedType && (row as any).placeKey
                    ? `${normalizedType}:${String((row as any).placeKey)}`
                    : '';
                const lat = row.place?.lat;
                const lon = row.place?.lon;
                if (typeof lat === 'number' && typeof lon === 'number') return [lat, lon] as [number, number];
                const fallback = key ? mapPlaceById.get(key.toLowerCase()) : null;
                if (fallback) return [fallback.lat, fallback.lon] as [number, number];
                return null;
            })
            .filter((point): point is [number, number] => Array.isArray(point));

        if (!bookSequence?.showLine || polylinePoints.length < 2) {
            return markers;
        }
        return [
            ...markers,
            <Polyline
                key="book-sequence-line"
                positions={polylinePoints}
                pathOptions={{ color: '#f59e0b', weight: 3, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }}
            />
        ];
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
        , temporalMappingReady,
        bookSequence
    ]);

    if (isPlacesLoading || !temporalMappingReady) {
        // En elegant måte å vise kart-loading på kan implementeres
        return null;
    }

    return <>{renderedLayers}</>;
}
