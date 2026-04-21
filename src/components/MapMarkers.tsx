import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import { useCorpus } from '../context/CorpusContext';
import { mixHex } from '../utils/colors';
import { fetchFirstYearByTokenForCorpus } from '../utils/temporal';
import type { GeoSequenceRow } from '../utils/geoApi';

interface MapMarkersProps {
    onSelectPlace: (place: { token: string; placeId?: string }) => void;
    omniboxSearchPlaces?: Array<{
        id: string;
        token: string;
        lat: number;
        lon: number;
        frequency: number;
        doc_count: number;
    }>;
    bookSequence?: {
        rows: GeoSequenceRow[];
        dimOthers: boolean;
        showLine: boolean;
        shortStepsMode: boolean;
        maxStepKm: number;
        progressPct: number;
    };
    geoFocus?: {
        placeIds: string[];
        dimOthers: boolean;
        style: 'fill' | 'ring';
    };
}

interface ComparePlacePoint {
    id: string;
    token: string;
    name: string | null;
    lat: number;
    lon: number;
    frequencyA: number;
    frequencyB: number;
    docCountA: number;
    docCountB: number;
}

const MAP_MARKER_LIMIT = 1800;

const toFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const n = Number(value.trim());
        return Number.isFinite(n) ? n : null;
    }
    return null;
};

const normalizeNbPlaceIdCandidates = (value: unknown): string[] => {
    if (value === null || value === undefined) return [];
    const raw = String(value).trim().toLowerCase();
    if (!raw) return [];
    const strippedGeo = raw.startsWith('#geo:') ? raw.slice(5) : raw;
    const strippedNb = strippedGeo.startsWith('nb:') ? strippedGeo.slice(3) : strippedGeo;
    return [strippedNb];
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

export const MapMarkers: React.FC<MapMarkersProps> = ({ onSelectPlace, omniboxSearchPlaces, bookSequence, geoFocus }) => {
    const {
        places,
        activeDhlabids,
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
        temporalMode,
        compareSegmentsEnabled,
        segmentABookIds,
        segmentBBookIds
    } = useCorpus();
    const map = useMap();
    const [firstYearByToken, setFirstYearByToken] = useState<Map<string, number> | null>(null);
    const [comparePlaces, setComparePlaces] = useState<ComparePlacePoint[] | null>(null);
    const temporalMappingReady = !temporalEnabled || firstYearByToken !== null;
    const activeCorpusSet = useMemo(() => new Set(activeDhlabids), [activeDhlabids]);
    const compareABookIds = useMemo(
        () => segmentABookIds.filter((id) => activeCorpusSet.has(id)),
        [segmentABookIds, activeCorpusSet]
    );
    const compareBBookIds = useMemo(
        () => segmentBBookIds.filter((id) => activeCorpusSet.has(id)),
        [segmentBBookIds, activeCorpusSet]
    );
    const compareReady = compareSegmentsEnabled
        && compareABookIds.length > 0
        && compareBBookIds.length > 0;

    useEffect(() => {
        if (!compareReady) {
            setComparePlaces(null);
            return;
        }

        let cancelled = false;
        const fetchPlaces = async (ids: number[]) => {
            const res = await fetch(`${API_URL}/api/places`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dhlabids: ids, maxPlaces: maxPlacesInView })
            });
            if (!res.ok) throw new Error('Failed to fetch compare places');
            const data = await res.json();
            return Array.isArray(data?.places) ? data.places : [];
        };

        const run = async () => {
            const [placesA, placesB] = await Promise.all([
                fetchPlaces(compareABookIds),
                fetchPlaces(compareBBookIds)
            ]);
            if (cancelled) return;
            const merged = new Map<string, ComparePlacePoint>();
            const ingest = (rows: any[], side: 'A' | 'B') => {
                rows.forEach((row) => {
                    const placeId = String(row?.nb_place_id ?? row?.id ?? '').toLowerCase().trim();
                    if (!placeId) return;
                    const lat = Number(row?.lat ?? row?.latitude);
                    const lon = Number(row?.lon ?? row?.longitude);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
                    const current = merged.get(placeId) || {
                        id: placeId,
                        token: String(row?.token ?? row?.historical_name ?? row?.name ?? ''),
                        name: row?.name ?? row?.modern_name ?? row?.token ?? null,
                        lat,
                        lon,
                        frequencyA: 0,
                        frequencyB: 0,
                        docCountA: 0,
                        docCountB: 0
                    };
                    if (side === 'A') {
                        current.frequencyA = Number(row?.frequency ?? row?.mentions ?? row?.count) || 0;
                        current.docCountA = Number(row?.doc_count ?? row?.book_count ?? row?.docs) || 0;
                    } else {
                        current.frequencyB = Number(row?.frequency ?? row?.mentions ?? row?.count) || 0;
                        current.docCountB = Number(row?.doc_count ?? row?.book_count ?? row?.docs) || 0;
                    }
                    merged.set(placeId, current);
                });
            };
            ingest(placesA, 'A');
            ingest(placesB, 'B');
            setComparePlaces(Array.from(merged.values()));
        };

        run().catch((err) => {
            if (cancelled) return;
            console.error(err);
            setComparePlaces(null);
        });

        return () => {
            cancelled = true;
        };
    }, [compareReady, compareABookIds, compareBBookIds, API_URL, maxPlacesInView]);

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
        const omniboxMarkers = (omniboxSearchPlaces || []).map((place) => (
            <CircleMarker
                key={`omnibox-${place.id}`}
                center={[place.lat, place.lon]}
                radius={7}
                pathOptions={{ color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: 0.22, weight: 2.8 }}
                eventHandlers={{
                    add: (e) => e.target.bringToFront(),
                    click: () => {
                        onSelectPlace({ token: place.token, placeId: place.id });
                        map.panTo([place.lat, place.lon]);
                    }
                }}
            >
                <Tooltip sticky>
                    <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        <strong>{place.token}</strong><br />
                        Omnibox-søk<br />
                        <strong>{place.frequency.toLocaleString()}</strong> treff i <strong>{place.doc_count.toLocaleString()}</strong> bøker
                    </div>
                </Tooltip>
            </CircleMarker>
        ));

        if (compareReady && !comparePlaces) {
            // Avoid showing stale non-compare markers while compare places are loading.
            return omniboxMarkers;
        }
        if (compareReady && comparePlaces && comparePlaces.length > 0) {
            const mapPlaces = [...comparePlaces]
                .sort((a, b) => (b.frequencyA + b.frequencyB) - (a.frequencyA + a.frequencyB))
                .slice(0, MAP_MARKER_LIMIT);
            const frequencies = mapPlaces.map((p) => p.frequencyA + p.frequencyB);
            const minFreq = Math.min(...frequencies);
            const maxFreq = Math.max(...frequencies);
            const logMin = Math.log1p(minFreq);
            const logMax = Math.log1p(maxFreq);
            const compareMarkers = mapPlaces.map((place) => {
                let radius = 6;
                if (logMax > logMin) {
                    const norm = (Math.log1p(place.frequencyA + place.frequencyB) - logMin) / (logMax - logMin);
                    radius = 6 + norm * 18;
                }
                // Keep compare markers stable; markerSizeScale only affects normal map mode.
                radius = Math.max(2, Math.min(60, radius));
                const inA = place.frequencyA > 0;
                const inB = place.frequencyB > 0;
                const color = inA && inB ? '#7c3aed' : (inA ? '#1d4ed8' : '#dc2626');
                const fill = inA && inB ? '#a78bfa' : (inA ? '#60a5fa' : '#f87171');
                const label = inA && inB ? 'Begge segmenter' : (inA ? 'Kun segment A' : 'Kun segment B');
                return (
                    <CircleMarker
                        key={`cmp-${place.id}-${markerSizeScale}`}
                        center={[place.lat, place.lon]}
                        radius={radius}
                        pathOptions={{ color, fillColor: fill, fillOpacity: 0.72, weight: 1.8 }}
                        eventHandlers={{
                            click: () => {
                                onSelectPlace({ token: place.token, placeId: place.id });
                                map.panTo([place.lat, place.lon]);
                            }
                        }}
                    >
                        <Tooltip sticky>
                            <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                                <strong>{place.token}</strong><br />
                                <strong>{label}</strong><br />
                                A: <strong>{place.frequencyA.toLocaleString()}</strong> treff i <strong>{place.docCountA.toLocaleString()}</strong> bøker<br />
                                B: <strong>{place.frequencyB.toLocaleString()}</strong> treff i <strong>{place.docCountB.toLocaleString()}</strong> bøker
                            </div>
                        </Tooltip>
                    </CircleMarker>
                );
            });
            return [...compareMarkers, ...omniboxMarkers];
        }

        if (!temporalMappingReady) return omniboxMarkers;
        if (places.length === 0) return omniboxMarkers;
        const mapPlaces = [...places]
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, MAP_MARKER_LIMIT);
        const renderedMapPlaceIds = new Set(
            mapPlaces
                .map((place) => String(place.id || '').toLowerCase())
                .filter(Boolean)
        );
        const mapPlaceById = new Map(
            places
                .filter(place => typeof place.id === 'string' && place.id.length > 0)
                .map(place => [String(place.id).toLowerCase(), place] as const)
        );
        const rawSequenceRows = bookSequence?.rows || [];
        const progressPct = Math.max(0, Math.min(100, Math.round(bookSequence?.progressPct || 0)));
        const cappedLength = rawSequenceRows.length === 0
            ? 0
            : Math.max(0, Math.floor((progressPct / 100) * rawSequenceRows.length));
        const progressRows = rawSequenceRows.slice(0, cappedLength);
        const lineRows = bookSequence?.shortStepsMode
            ? filterByShortSteps(progressRows, Math.max(1, bookSequence?.maxStepKm || 1))
            : progressRows;
        const sequenceIds = new Set<string>();
        const sequenceCoords = new Set<string>();
        progressRows.forEach((row) => {
            const placeId = toFiniteNumber((row as any).placeId);
            if (placeId !== null) {
                sequenceIds.add(String(placeId));
            }
            const lat = toFiniteNumber((row as any).place?.lat);
            const lon = toFiniteNumber((row as any).place?.lon);
            if (lat !== null && lon !== null) {
                sequenceCoords.add(toCoordKey(lat, lon));
            }
        });
        const hasSequence = sequenceIds.size > 0 || sequenceCoords.size > 0;
        const geoFocusIds = new Set((geoFocus?.placeIds || []).map((id) => String(id).toLowerCase()));
        const hasGeoFocus = geoFocusIds.size > 0;
        
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
            const placeIdCandidates = normalizeNbPlaceIdCandidates(place.id);
            const inBookSequence = (
                (hasSequence && placeIdCandidates.some((candidate) => sequenceIds.has(candidate)))
                || sequenceCoords.has(toCoordKey(place.lat, place.lon))
            );
            const inGeoFocus = hasGeoFocus && placeIdCandidates.some((candidate) => geoFocusIds.has(candidate));
            if (hasGeoFocus && geoFocus?.dimOthers && !inGeoFocus) {
                return null;
            }
            const shouldDimBySequence = hasSequence && bookSequence?.dimOthers && !inBookSequence;
            const shouldDimByGeo = hasGeoFocus && geoFocus?.dimOthers && !inGeoFocus && !inBookSequence;
            const shouldDimByFocus = shouldDimBySequence || shouldDimByGeo;
            const isAnyFocused = inBookSequence || inGeoFocus;
            const displayRadius = inBookSequence
                ? Math.max(3.5, radius * 1.18)
                : inGeoFocus
                    ? Math.max(3.2, radius * 1.12)
                    : radius;
            const geoStroke = '#0ea5e9';
            const geoFill = '#38bdf8';
            const useGeoRing = inGeoFocus && geoFocus?.style === 'ring';
            const displayStroke = inBookSequence
                ? '#ca8a04'
                : inGeoFocus
                    ? geoStroke
                    : temporalStroke;
            const displayFill = inBookSequence
                ? '#eab308'
                : inGeoFocus && !useGeoRing
                    ? geoFill
                    : temporalFill;
            const baseFocusOpacity = inBookSequence ? 0.86 : (inGeoFocus ? 0.92 : temporalOpacity);
            const displayOpacity = shouldDimByFocus ? 0.06 : baseFocusOpacity;
            const displayWeight = shouldDimByFocus
                ? 0
                : inBookSequence
                    ? 2.2
                    : inGeoFocus
                        ? (useGeoRing ? 2.8 : 2.1)
                        : (isDownlighted ? 0 : 1.5);
            const fallbackFill = shouldDimByFocus ? '#cbd5e1' : dimFill;

            return (
                <CircleMarker
                    key={`${place.id}-${markerSizeScale}`}
                    center={[place.lat, place.lon]}
                    radius={displayRadius}
                    pathOptions={{ 
                        color: isDownlighted && !isAnyFocused ? 'transparent' : displayStroke,
                        fillColor: isDownlighted && !isAnyFocused ? fallbackFill : displayFill,
                        fillOpacity: isDownlighted && !isAnyFocused ? Math.min(displayOpacity, 0.12) : (useGeoRing ? 0.06 : displayOpacity),
                        weight: displayWeight
                    }}
                    eventHandlers={{
                        add: (e) => {
                            if (isAnyFocused) e.target.bringToFront();
                        },
                        click: () => {
                            onSelectPlace({ token: place.token, placeId: place.id });
                            map.panTo([place.lat, place.lon]);
                        }
                    }}
                >
                    <Tooltip sticky>
                        <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                            <strong>{place.token}</strong><br />
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

        const sequenceOverlayMarkers = progressRows
            .map((row, idx) => {
                const placeId = toFiniteNumber((row as any).placeId);
                const key = placeId !== null ? String(placeId).toLowerCase() : null;
                if (key && renderedMapPlaceIds.has(key)) return null;

                let lat = toFiniteNumber(row.place?.lat);
                let lon = toFiniteNumber(row.place?.lon);
                if ((lat === null || lon === null) && key) {
                    const fallback = mapPlaceById.get(key);
                    if (fallback) {
                        lat = fallback.lat;
                        lon = fallback.lon;
                    }
                }
                if (lat === null || lon === null) return null;
                return (
                    <CircleMarker
                        key={`seq-extra-${idx}-${lat}-${lon}`}
                        center={[lat, lon]}
                        radius={4.6}
                        pathOptions={{
                            color: '#ca8a04',
                            fillColor: '#eab308',
                            fillOpacity: 0.9,
                            weight: 1.8
                        }}
                        eventHandlers={{
                            add: (e) => e.target.bringToFront()
                        }}
                    />
                );
            })
            .filter(Boolean);

        const polylinePoints: [number, number][] = lineRows
            .map((row) => {
                const placeId = toFiniteNumber((row as any).placeId);
                const key = placeId !== null ? String(placeId) : '';
                const lat = toFiniteNumber(row.place?.lat);
                const lon = toFiniteNumber(row.place?.lon);
                if (lat !== null && lon !== null) return [lat, lon] as [number, number];
                const fallback = key ? mapPlaceById.get(key.toLowerCase()) : null;
                if (fallback) return [fallback.lat, fallback.lon] as [number, number];
                return null;
            })
            .filter((point): point is [number, number] => Array.isArray(point));

        if (!bookSequence?.showLine || polylinePoints.length < 2) {
            return [...markers, ...sequenceOverlayMarkers, ...omniboxMarkers];
        }
        return [
            ...markers,
            ...sequenceOverlayMarkers,
            ...omniboxMarkers,
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
        bookSequence,
        geoFocus,
        compareReady,
        comparePlaces,
        omniboxSearchPlaces
    ]);

    const markerRenderKey = `${compareReady ? 'compare' : 'normal'}:${markerSizeScale}`;

    const hasOmniboxOverlay = (omniboxSearchPlaces?.length || 0) > 0;
    if ((isPlacesLoading || !temporalMappingReady) && !hasOmniboxOverlay) {
        // En elegant måte å vise kart-loading på kan implementeres
        return null;
    }

    return <React.Fragment key={markerRenderKey}>{renderedLayers}</React.Fragment>;
}
