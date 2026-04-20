import React, { useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import * as XLSX from 'xlsx';
import { useCorpus } from '../context/CorpusContext';
import { useWindowLayout } from '../utils/windowLayout';
import './GeoConcordanceCard.css';

interface GeoConcordanceCardProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMapFocus: (payload: { placeIds: string[]; dimOthers: boolean; style: 'fill' | 'ring' }) => void;
  onClearMapFocus: () => void;
  mapFocusAppliedCount: number;
}

interface GeoRow {
  bookId: number;
  pos: number;
  seqStart?: number;
  tokenLen?: number;
  placeId?: number;
  placeKeyType?: string;
  placeKey?: string;
  surfaceText?: string;
  place?: {
    canonicalName?: string | null;
  };
}

interface RenderedRow {
  bookId: number;
  pos: number;
  frag: string;
}

interface GroupedConcordance {
  id: string;
  label: string;
  historicalName: string;
  canonicalName: string;
  historicalVotes: Record<string, number>;
  canonicalVotes: Record<string, number>;
  type: string;
  key: string;
  totalCount: number;
  rows: Array<{
    row: GeoRow;
    frag: string;
  }>;
  capped: boolean;
}

interface QueryGroupStatus {
  group: string;
  status: 'ok' | 'empty';
  rowCount: number;
}

interface NearQueryResult {
  rows: GeoRow[];
  rendered: RenderedRow[];
  count: number;
}

const MAX_GROUPS = 120;
const MAX_ROWS_PER_GROUP = 140;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractPlaceFromFrag(fragment: string): string | null {
  const match = fragment.match(/\[([^\]]+)\]/);
  return match?.[1]?.trim() || null;
}

function normalizeNbPlaceId(row: GeoRow): string[] {
  const out = new Set<string>();
  const placeId = Number(row.placeId);
  if (Number.isFinite(placeId)) {
    out.add(String(placeId));
  }
  const keyType = String(row.placeKeyType || '').trim().toLowerCase();
  const key = String(row.placeKey || '').trim().toLowerCase();
  if ((keyType === 'nb' || !keyType) && /^\d+$/.test(key)) {
    out.add(key);
  }
  return Array.from(out);
}

function formatPlaceId(row: GeoRow): string {
  const ids = normalizeNbPlaceId(row);
  if (ids.length === 0) return '';
  return ids[0];
}

function highlightGeoBracket(fragment: string): string {
  return fragment.replace(/\[([^\]]+)\]/g, (_m, inner: string) => {
    return `[<mark class="geo-place-mark">${inner}</mark>]`;
  });
}

function parseQueryGroups(input: string): { groups: string[][]; flatTerms: string[]; hasExplicitGroups: boolean } {
  const raw = input.trim();
  if (!raw) return { groups: [], flatTerms: [], hasExplicitGroups: false };
  const hasExplicitGroups = raw.includes(',');
  const groups = raw
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((group) => group.split(/\s+/).map((token) => token.trim()).filter(Boolean));
  const filtered = groups.filter((g) => g.length > 0);
  const flatTerms = filtered.flat();
  return { groups: filtered, flatTerms, hasExplicitGroups };
}

function escapeSearchTerm(value: string): string {
  return value.replace(/"/g, '\\"').trim();
}

function buildNbNearSearchText(surface: string, terms: string[], proximity: number): string {
  const cleanSurface = escapeSearchTerm(surface);
  const cleanTerms = Array.from(new Set(terms.map(escapeSearchTerm).filter(Boolean)));
  if (!cleanSurface) return cleanTerms.join(' OR ');
  if (cleanTerms.length === 0) return `"${cleanSurface}"`;
  const phrases = cleanTerms.flatMap((term) => ([
    `"${cleanSurface} + ${term}"~${proximity}`,
    `"${term} + ${cleanSurface}"~${proximity}`
  ]));
  return Array.from(new Set(phrases)).join(' OR ');
}

export const GeoConcordanceCard: React.FC<GeoConcordanceCardProps> = ({
  isOpen,
  onClose,
  onApplyMapFocus,
  onClearMapFocus,
  mapFocusAppliedCount
}) => {
  const { activeDhlabids, activeBooksMetadata, API_URL, activeWindow, setActiveWindow } = useCorpus();
  const [query, setQuery] = useState('');
  const [proximity, setProximity] = useState(8);
  const [perBookLimit, setPerBookLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null);
  const [rows, setRows] = useState<GeoRow[]>([]);
  const [rendered, setRendered] = useState<RenderedRow[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [mapDimOthers, setMapDimOthers] = useState(true);
  const [queryGroupStatuses, setQueryGroupStatuses] = useState<QueryGroupStatus[]>([]);
  const [groupSort, setGroupSort] = useState<'count' | 'name'>('count');
  const lastQuerySignatureRef = useRef('');
  const lastWindowRef = useRef(8);
  const { layout, onDrag, onDragStop, onResizeStop } = useWindowLayout({
    key: 'geoConcordance',
    defaultLayout: { x: 740, y: 24, width: 520, height: 560 },
    minWidth: 420,
    minHeight: 340
  });

  const renderedMap = useMemo(() => {
    const map = new Map<string, string>();
    rendered.forEach((item) => {
      map.set(`${item.bookId}:${item.pos}`, item.frag || '');
    });
    return map;
  }, [rendered]);
  const metadataById = useMemo(() => {
    const map = new Map<number, { urn: string; title: string | null; author: string | null; year: number | null; category: string | null }>();
    activeBooksMetadata.forEach((book) => {
      map.set(book.dhlabid, {
        urn: book.urn,
        title: book.title,
        author: book.author,
        year: book.year,
        category: book.category
      });
    });
    return map;
  }, [activeBooksMetadata]);

  const grouped = useMemo(() => {
    const byKey = new Map<string, GroupedConcordance>();
    rows.forEach((row) => {
      const frag = renderedMap.get(`${row.bookId}:${row.pos}`) || '';
      const extracted = extractPlaceFromFrag(frag);
      const normalizedPlaceIds = normalizeNbPlaceId(row);
      const primaryPlaceId = normalizedPlaceIds[0] || '';
      const type = row.placeKeyType || 'nb';
      const key = primaryPlaceId || row.placeKey || row.surfaceText || extracted || 'ukjent';
      const historicalName = row.surfaceText || extracted || key;
      const canonicalCandidate = String(row.place?.canonicalName || '').trim();
      const canonicalName = canonicalCandidate || historicalName;
      const label = historicalName;
      const groupId = primaryPlaceId ? `nb:${primaryPlaceId}` : `${type}:${label.toLowerCase()}`;

      if (!byKey.has(groupId)) {
        byKey.set(groupId, {
          id: groupId,
          key,
          type,
          label,
          historicalName,
          canonicalName,
          historicalVotes: historicalName ? { [historicalName]: 1 } : {},
          canonicalVotes: canonicalName ? { [canonicalName]: 1 } : {},
          totalCount: 0,
          rows: [],
          capped: false
        });
      }

      const group = byKey.get(groupId);
      if (!group) return;
      group.totalCount += 1;
      if (historicalName) {
        group.historicalVotes[historicalName] = (group.historicalVotes[historicalName] || 0) + 1;
      }
      if (canonicalName) {
        group.canonicalVotes[canonicalName] = (group.canonicalVotes[canonicalName] || 0) + 1;
      }
      if (group.rows.length < MAX_ROWS_PER_GROUP) {
        group.rows.push({ row, frag });
      } else {
        group.capped = true;
      }
    });

    const list = Array.from(byKey.values()).map((group) => {
      const topHistorical = Object.entries(group.historicalVotes)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      const topCanonical = Object.entries(group.canonicalVotes)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      return {
        ...group,
        historicalName: topHistorical || group.historicalName,
        canonicalName: topCanonical || group.canonicalName || group.historicalName
      };
    });
    if (groupSort === 'name') {
      list.sort((a, b) => a.historicalName.localeCompare(b.historicalName, 'nb'));
    } else {
      list.sort((a, b) => b.totalCount - a.totalCount);
    }
    return list.slice(0, MAX_GROUPS);
  }, [rows, renderedMap, groupSort]);

  const totalGroupCount = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((row) => {
      const frag = renderedMap.get(`${row.bookId}:${row.pos}`) || '';
      const extracted = extractPlaceFromFrag(frag);
      const normalizedPlaceIds = normalizeNbPlaceId(row);
      const primaryPlaceId = normalizedPlaceIds[0] || '';
      const type = row.placeKeyType || 'nb';
      const fallback = row.placeKey || row.surfaceText || extracted || 'ukjent';
      const label = row.surfaceText || extracted || fallback;
      ids.add(primaryPlaceId ? `nb:${primaryPlaceId}` : `${type}:${label.toLowerCase()}`);
    });
    return ids.size;
  }, [rows, renderedMap]);

  const mapPlaceIds = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((row) => {
      normalizeNbPlaceId(row).forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  }, [rows]);
  const highlightTerms = useMemo(() => parseQueryGroups(query).flatTerms, [query]);
  const queryTermsForNb = useMemo(
    () => Array.from(new Set(parseQueryGroups(query).flatTerms.filter(Boolean))),
    [query]
  );

  const toNbSearchLink = (bookId: number, surface: string) => {
    const searchText = buildNbNearSearchText(surface, queryTermsForNb, proximity);
    const meta = metadataById.get(bookId);
    if (meta?.urn) {
      return `https://www.nb.no/items/${encodeURIComponent(meta.urn)}?searchText=${encodeURIComponent(searchText)}`;
    }
    return `https://www.nb.no/search?searchText=${encodeURIComponent(searchText)}`;
  };

  const buildSnippetTooltip = (row: GeoRow, surface: string) => {
    const meta = metadataById.get(row.bookId);
    const bits = [
      `dhlabid: ${row.bookId}`,
      `pos: ${row.pos}`,
      `sted: ${surface || row.placeKey || 'ukjent'}`,
      `steds-id: ${formatPlaceId(row) || 'ukjent'}`,
      `forfatter: ${meta?.author || 'ukjent'}`,
      `tittel: ${meta?.title || 'ukjent'}`,
      `år: ${meta?.year ?? 'ukjent'}`
    ];
    if (meta?.category) bits.push(`kategori: ${meta.category}`);
    return bits.join('\n');
  };

  const executeNearQuery = async (termGroups: string[][], mode: 'count' | 'hits' | 'render'): Promise<NearQueryResult> => {
    try {
      const res = await fetch(`${API_URL}/near_query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termGroups,
          useFilter: true,
          filterIds: activeDhlabids,
          mode,
          perBook: perBookLimit,
          totalLimit: 5000,
          docSamples: 0,
          schema: 'unigrams',
          symmetric: true,
          excludeSelf: false,
          window: proximity,
          before: proximity,
          after: proximity
        })
      });
      if (!res.ok) {
        // Backend uses 404 for valid "no-hit" outcomes.
        if (res.status === 404) {
          return { rows: [] as GeoRow[], rendered: [] as RenderedRow[], count: 0 };
        }
        throw new Error('Feil ved kall til /near_query');
      }
      const data = await res.json();
      const rows = (data.rows || []) as GeoRow[];
      const rendered = mode === 'render'
        ? (
          Array.isArray(data.rendered)
            ? (data.rendered as RenderedRow[])
            : rows
                .filter((row: any) => typeof row?.frag === 'string' && Number.isFinite(Number(row?.bookId)) && Number.isFinite(Number(row?.pos ?? row?.seqStart)))
                .map((row: any) => ({
                  bookId: Number(row.bookId),
                  pos: Number(row.pos ?? row.seqStart),
                  frag: String(row.frag || '')
                }))
        )
        : [];
      const count = typeof data?.total === 'number'
        ? data.total
        : typeof data?.count === 'number'
          ? data.count
          : rows.length;
      return {
        rows,
        rendered,
        count
      };
    } catch (err) {
      throw err;
    }
  };

  const runNearQuery = async (termGroups: string[][], mode: 'count' | 'hits' | 'render') => {
    setIsLoading(true);
    setError(null);
    try {
      return await executeNearQuery(termGroups, mode);
    } catch (err) {
      console.error(err);
      setError('Klarte ikke å hente geo-konkordans.');
      return { rows: [] as GeoRow[], rendered: [] as RenderedRow[], count: 0 };
    } finally {
      setIsLoading(false);
    }
  };

  const runQuery = async () => {
    const queryStart = performance.now();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Skriv inn minst ett søkeord før du kjører geo-konkordans.');
      return;
    }
    const { flatTerms } = parseQueryGroups(trimmedQuery);
    const queryTerms = Array.from(new Set(flatTerms.map((t) => t.toLowerCase()).filter(Boolean)));
    const mainTermGroups = queryTerms.length > 0
      ? [['#geo'], queryTerms]
      : [['#geo']];
    const currentSignature = `${activeDhlabids.join(',')}::${query.trim().toLowerCase()}`;
    const previousRows = rows;
    const previousRendered = rendered;
    const result = await runNearQuery(mainTermGroups, 'render');

    let nextRows = result.rows;
    let nextRendered = result.rendered;

    const shouldMergeForMonotonicIncrease =
      currentSignature === lastQuerySignatureRef.current && proximity > lastWindowRef.current;

    if (shouldMergeForMonotonicIncrease) {
      const seenRows = new Set<string>();
      const mergedRows: GeoRow[] = [];
      [...previousRows, ...result.rows].forEach((row) => {
        const id = `${row.bookId}:${row.pos}:${row.placeKeyType || ''}:${row.placeKey || ''}`;
        if (seenRows.has(id)) return;
        seenRows.add(id);
        mergedRows.push(row);
      });
      nextRows = mergedRows;

      const renderedMapMerged = new Map<string, RenderedRow>();
      [...previousRendered, ...result.rendered].forEach((item) => {
        renderedMapMerged.set(`${item.bookId}:${item.pos}`, item);
      });
      nextRendered = Array.from(renderedMapMerged.values());
    }

    setRows(nextRows);
    setRendered(nextRendered);
    if (queryTerms.length > 0) {
      const pool = (nextRendered.length > 0
        ? nextRendered.map((r) => r.frag || '')
        : nextRows.map((r: any) => String(r?.frag || ''))
      ).join('\n');
      const statuses: QueryGroupStatus[] = queryTerms.map((term) => {
        const re = new RegExp(escapeRegExp(term), 'gi');
        const matches = pool.match(re);
        const rowCount = matches ? matches.length : 0;
        return {
          group: term,
          status: rowCount > 0 ? 'ok' : 'empty',
          rowCount
        };
      });
      setQueryGroupStatuses(statuses);
    } else {
      setQueryGroupStatuses([]);
    }
    setCollapsedGroups({});
    lastQuerySignatureRef.current = currentSignature;
    lastWindowRef.current = proximity;
    setLastElapsedMs(performance.now() - queryStart);
  };

  const downloadExcel = () => {
    if (rows.length === 0) return;
    try {
      const freqMap = new Map<string, { sted: string; sted_id: string; freq: number }>();
      const concordanceRows = rows.map((row) => {
        const frag = renderedMap.get(`${row.bookId}:${row.pos}`) || '';
        const placeName = row.surfaceText || extractPlaceFromFrag(frag) || row.placeKey || 'ukjent';
        const placeId = formatPlaceId(row);
        const freqKey = `${placeId}::${placeName}`;
        const existing = freqMap.get(freqKey);
        if (existing) {
          existing.freq += 1;
        } else {
          freqMap.set(freqKey, { sted: placeName, sted_id: placeId, freq: 1 });
        }
        return {
          dhlabid: row.bookId,
          bok_id: row.bookId,
          pos: row.pos,
          stedsnavn: placeName,
          stedsid: placeId,
          konk: frag
        };
      });

      const freqRows = Array.from(freqMap.values())
        .sort((a, b) => b.freq - a.freq);
      const uniqueCorpusRows = Array.from(new Set(rows.map((row) => row.bookId)))
        .sort((a, b) => a - b)
        .map((id) => ({ dhlabid: id }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(freqRows), 'Frekvens');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(concordanceRows), 'Konkordanser');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(uniqueCorpusRows), 'Korpus');

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `geo-konkordans-${stamp}.xlsx`);
    } catch (err) {
      console.error(err);
      setError('Klarte ikke å lage Excel-fil.');
    }
  };

  const applyCurrentMapFocus = (
    nextPlaceIds = mapPlaceIds,
    nextDimOthers = mapDimOthers
  ) => {
    onApplyMapFocus({
      placeIds: nextPlaceIds,
      dimOthers: nextDimOthers,
      style: 'ring'
    });
  };

  if (!isOpen) return null;

  return (
    <Rnd
      size={{ width: layout.width, height: layout.height }}
      position={{ x: layout.x, y: layout.y }}
      minWidth={420}
      minHeight={340}
      dragHandleClassName="drag-handle"
      className="geo-conc-rnd"
      style={{ zIndex: activeWindow === 'geoConcordance' ? 2600 : 1750 }}
      onDragStart={() => setActiveWindow('geoConcordance')}
      onDrag={onDrag}
      onResizeStart={() => setActiveWindow('geoConcordance')}
      onDragStop={onDragStop}
      onResizeStop={onResizeStop}
    >
      <div className="geo-conc-card">
        <div className="geo-conc-header drag-handle" onMouseDown={() => setActiveWindow('geoConcordance')}>
          <div className="geo-conc-title"><i className="fas fa-stream"></i> Geo-konkordans</div>
          <div className="geo-conc-controls no-drag">
            <button onClick={onClose} title="Minimer">
              <i className="fas fa-window-minimize"></i>
            </button>
          </div>
        </div>

        <div className="geo-conc-body no-drag">
          <div className="geo-conc-search">
            <textarea
              value={query}
              placeholder="Kommaseparerte grupper: oslo, london paris, england"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && query.trim()) {
                  e.preventDefault();
                  runQuery();
                }
              }}
            />
            <label className="geo-conc-proximity">
              <span>Nærhet</span>
              <select
                value={proximity}
                onChange={(e) => setProximity(Number(e.target.value) || 8)}
                disabled={isLoading}
              >
                <option value={5}>5</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={12}>12</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
            </label>
            <label className="geo-conc-proximity">
              <span>Treff/bok</span>
              <select
                value={perBookLimit}
                onChange={(e) => setPerBookLimit(Number(e.target.value) || 10)}
                disabled={isLoading}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </label>
            <button type="button" onClick={runQuery} disabled={isLoading || activeDhlabids.length === 0 || !query.trim()}>
              {isLoading ? 'Laster...' : 'Søk'}
            </button>
            <button
              type="button"
              onClick={downloadExcel}
              disabled={isLoading || rows.length === 0}
              title="Excel inkluderer alle treff i nåværende svarsett, ikke bare viste grupper"
            >
              Last ned Excel
            </button>
          </div>
          <div className="geo-conc-sort-row">
            <label>
              Sortering
              <select value={groupSort} onChange={(e) => setGroupSort((e.target.value as 'count' | 'name') || 'count')}>
                <option value="count">Topp (antall treff)</option>
                <option value="name">Navn (A-Å)</option>
              </select>
            </label>
          </div>

          <div className="geo-conc-map-tools">
            <button
              type="button"
              onClick={() => {
                if (mapFocusAppliedCount > 0) {
                  onClearMapFocus();
                } else {
                  applyCurrentMapFocus();
                }
              }}
              disabled={isLoading || (mapFocusAppliedCount === 0 && mapPlaceIds.length === 0)}
              title={
                mapFocusAppliedCount > 0
                  ? 'Slå av kartfokus'
                  : 'Vis kun stedene fra nåværende geo-konkordans i kartet'
              }
            >
              {mapFocusAppliedCount > 0 ? 'Skjul kartfokus' : 'Vis steder på kart'}
            </button>
            <label>
              <input
                type="checkbox"
                checked={mapDimOthers}
                onChange={(e) => {
                  const next = e.target.checked;
                  setMapDimOthers(next);
                  if (mapFocusAppliedCount > 0) {
                    applyCurrentMapFocus(mapPlaceIds, next);
                  }
                }}
              />
              Demp resten
            </label>
            {mapFocusAppliedCount > 0 && (
              <span className="geo-conc-map-applied">
                Aktivt på kart: {mapFocusAppliedCount.toLocaleString()} steder
              </span>
            )}
          </div>

          {error && <div className="geo-conc-error">{error}</div>}
          {!error && queryGroupStatuses.length > 0 && (
            <div className="geo-conc-group-statuses">
              {queryGroupStatuses.map((item) => (
                <span
                  key={item.group}
                  className={`geo-conc-group-status geo-conc-group-status--${item.status}`}
                  title={`${item.rowCount} råtreff`}
                >
                  {item.group}: {item.status === 'ok' ? `${item.rowCount} treff` : 'ingen treff'}
                </span>
              ))}
            </div>
          )}
          {!isLoading && lastElapsedMs !== null && (
            <div className="geo-conc-cap-note">
              Søk tid: {(lastElapsedMs / 1000).toFixed(2)} sek
            </div>
          )}
          {!error && !isLoading && rows.length === 0 && (
            <div className="geo-conc-empty">Ingen treff ennå. Kjør et søk mot aktivt korpus.</div>
          )}

          <div className="geo-conc-results">
            <div className="geo-conc-cap-note">
              {groupSort === 'count'
                ? `Viser ${grouped.length.toLocaleString()} steder av ${totalGroupCount.toLocaleString()} (sortert på treff${totalGroupCount > MAX_GROUPS ? ', capped' : ''}).`
                : `Viser ${grouped.length.toLocaleString()} steder av ${totalGroupCount.toLocaleString()} (sortert på navn${totalGroupCount > MAX_GROUPS ? ', capped' : ''}).`}
            </div>
            {grouped.map((group) => (
              <section key={group.id} className="geo-conc-group">
                <header className="geo-conc-group-header">
                  <button
                    type="button"
                    className="geo-conc-toggle"
                    onClick={() =>
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [group.id]: !(prev[group.id] ?? true)
                      }))
                    }
                    title={(collapsedGroups[group.id] ?? true) ? 'Utvid sted' : 'Kollaps sted'}
                  >
                    <i className={`fas ${(collapsedGroups[group.id] ?? true) ? 'fa-chevron-right' : 'fa-chevron-down'}`}></i>
                    <strong>{group.historicalName}</strong>
                    <span className="geo-conc-canonical-name">{group.canonicalName}</span>
                  </button>
                  <span>{group.type}:{group.key}</span>
                  <span>{group.totalCount.toLocaleString()} treff</span>
                </header>
                {!(collapsedGroups[group.id] ?? true) && (
                  <div className="geo-conc-snippets">
                    {group.rows.map(({ row, frag }) => {
                      const fragment = frag || '';
                      const placeSurface = extractPlaceFromFrag(fragment) || row.surfaceText || group.label || '';
                      const hoverTitle = buildSnippetTooltip(row, placeSurface);
                      const withTerm = highlightTerms.length > 0
                        ? highlightTerms.reduce((acc, token) => {
                            if (!token) return acc;
                            return acc.replace(new RegExp(escapeRegExp(token), 'gi'), (m) => `<mark>${m}</mark>`);
                          }, fragment)
                        : fragment;
                      const html = highlightGeoBracket(withTerm);
                      return (
                        <article
                          key={`${row.bookId}:${row.pos}`}
                          className="geo-conc-snippet"
                          data-tooltip={hoverTitle}
                        >
                          <div className="geo-conc-meta">
                            bok {row.bookId} · pos {row.pos}
                            {placeSurface && (
                              <>
                                {' · '}
                                <a
                                  className="geo-conc-nb-link"
                                  href={toNbSearchLink(row.bookId, placeSurface)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Søk i Nettbiblioteket
                                </a>
                              </>
                            )}
                          </div>
                          <div
                            className="geo-conc-snippet-body"
                            dangerouslySetInnerHTML={{ __html: html || '(ingen snippet)' }}
                          />
                        </article>
                      );
                    })}
                    {group.capped && (
                      <div className="geo-conc-cap-note">
                        Viser de første {MAX_ROWS_PER_GROUP.toLocaleString()} av {group.totalCount.toLocaleString()} treff for dette stedet.
                      </div>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </Rnd>
  );
};
