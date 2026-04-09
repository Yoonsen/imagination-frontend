import React, { useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import * as XLSX from 'xlsx';
import { useCorpus } from '../context/CorpusContext';
import { useWindowLayout } from '../utils/windowLayout';
import './GeoConcordanceCard.css';

interface GeoConcordanceCardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GeoRow {
  bookId: number;
  pos: number;
  seqStart?: number;
  tokenLen?: number;
  placeKeyType?: string;
  placeKey?: string;
  surfaceText?: string;
}

interface RenderedRow {
  bookId: number;
  pos: number;
  frag: string;
}

interface GroupedConcordance {
  id: string;
  label: string;
  type: string;
  key: string;
  totalCount: number;
  rows: Array<{
    row: GeoRow;
    frag: string;
  }>;
  capped: boolean;
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

function formatPlaceId(row: GeoRow): string {
  if (!row.placeKey) return '';
  return row.placeKeyType === 'geonames' ? row.placeKey : `intern:${row.placeKey}`;
}

function highlightGeoBracket(fragment: string): string {
  return fragment.replace(/\[([^\]]+)\]/g, (_m, inner: string) => {
    return `[<mark class="geo-place-mark">${inner}</mark>]`;
  });
}

export const GeoConcordanceCard: React.FC<GeoConcordanceCardProps> = ({ isOpen, onClose }) => {
  const { activeDhlabids, API_URL, activeWindow, setActiveWindow } = useCorpus();
  const [query, setQuery] = useState('');
  const [proximity, setProximity] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<GeoRow[]>([]);
  const [rendered, setRendered] = useState<RenderedRow[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const lastQuerySignatureRef = useRef('');
  const lastWindowRef = useRef(8);
  const { layout, onDragStop, onResizeStop } = useWindowLayout({
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

  const grouped = useMemo(() => {
    const byKey = new Map<string, GroupedConcordance>();
    rows.forEach((row) => {
      const frag = renderedMap.get(`${row.bookId}:${row.pos}`) || '';
      const extracted = extractPlaceFromFrag(frag);
      const type = row.placeKeyType || 'internal';
      const key = row.placeKey || row.surfaceText || extracted || 'ukjent';
      const label = extracted || row.surfaceText || key;
      const groupId = `${type}:${label.toLowerCase()}`;

      if (!byKey.has(groupId)) {
        byKey.set(groupId, {
          id: groupId,
          key,
          type,
          label,
          totalCount: 0,
          rows: [],
          capped: false
        });
      }

      const group = byKey.get(groupId);
      if (!group) return;
      group.totalCount += 1;
      if (group.rows.length < MAX_ROWS_PER_GROUP) {
        group.rows.push({ row, frag });
      } else {
        group.capped = true;
      }
    });

    return Array.from(byKey.values())
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, MAX_GROUPS);
  }, [rows, renderedMap]);

  const totalGroupCount = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((row) => {
      const frag = renderedMap.get(`${row.bookId}:${row.pos}`) || '';
      const extracted = extractPlaceFromFrag(frag);
      const type = row.placeKeyType || 'internal';
      const fallback = row.placeKey || row.surfaceText || extracted || 'ukjent';
      const label = extracted || row.surfaceText || fallback;
      ids.add(`${type}:${label.toLowerCase()}`);
    });
    return ids.size;
  }, [rows, renderedMap]);

  const runTermsQuery = async (terms: string[], withRendered = true) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/or_query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terms,
          useFilter: true,
          filterIds: activeDhlabids,
          totalLimit: 5000,
          window: proximity,
          before: proximity,
          after: proximity,
          renderHits: withRendered
        })
      });
      if (!res.ok) throw new Error('Feil ved kall til /or_query');
      const data = await res.json();
      return {
        rows: (data.rows || []) as GeoRow[],
        rendered: withRendered ? ((data.rendered || []) as RenderedRow[]) : []
      };
    } catch (err) {
      console.error(err);
      setError('Klarte ikke å hente geo-konkordans.');
      return { rows: [] as GeoRow[], rendered: [] as RenderedRow[] };
    } finally {
      setIsLoading(false);
    }
  };

  const runQuery = async () => {
    const term = query.trim();
    const terms = term ? ['#geo', ...term.split(/\s+/).filter(Boolean)] : ['#geo'];
    const currentSignature = `${activeDhlabids.join(',')}::${term.toLowerCase()}`;
    const previousRows = rows;
    const previousRendered = rendered;
    const result = await runTermsQuery(terms, true);

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
    setCollapsedGroups({});
    lastQuerySignatureRef.current = currentSignature;
    lastWindowRef.current = proximity;
  };

  const downloadExcel = () => {
    if (rows.length === 0) return;
    try {
      const freqMap = new Map<string, { sted: string; sted_id: string; freq: number }>();
      const concordanceRows = rows.map((row) => {
        const frag = renderedMap.get(`${row.bookId}:${row.pos}`) || '';
        const placeName = extractPlaceFromFrag(frag) || row.surfaceText || row.placeKey || 'ukjent';
        const placeId = formatPlaceId(row);
        const freqKey = `${placeId}::${placeName}`;
        const existing = freqMap.get(freqKey);
        if (existing) {
          existing.freq += 1;
        } else {
          freqMap.set(freqKey, { sted: placeName, sted_id: placeId, freq: 1 });
        }
        return {
          bok_id: row.bookId,
          pos: row.pos,
          stedsnavn: placeName,
          stedsid: placeId,
          konk: frag
        };
      });

      const freqRows = Array.from(freqMap.values())
        .sort((a, b) => b.freq - a.freq);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(freqRows), 'Frekvens');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(concordanceRows), 'Konkordanser');

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `geo-konkordans-${stamp}.xlsx`);
    } catch (err) {
      console.error(err);
      setError('Klarte ikke å lage Excel-fil.');
    }
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
            <input
              value={query}
              placeholder="Skriv ord (f.eks. krig) => #geo + ord"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runQuery();
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
            <button type="button" onClick={runQuery} disabled={isLoading || activeDhlabids.length === 0}>
              {isLoading ? 'Laster...' : 'Søk'}
            </button>
            <button type="button" onClick={downloadExcel} disabled={isLoading || rows.length === 0}>
              Last ned Excel
            </button>
          </div>

          {error && <div className="geo-conc-error">{error}</div>}
          {!error && !isLoading && rows.length === 0 && (
            <div className="geo-conc-empty">Ingen treff ennå. Kjør et søk mot aktivt korpus.</div>
          )}

          <div className="geo-conc-results">
            {totalGroupCount > MAX_GROUPS && (
              <div className="geo-conc-cap-note">
                Viser topp {MAX_GROUPS.toLocaleString()} steder av {totalGroupCount.toLocaleString()} (sortert på treff).
              </div>
            )}
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
                    <strong>{group.label}</strong>
                  </button>
                  <span>{group.type}:{group.key}</span>
                  <span>{group.totalCount.toLocaleString()} treff</span>
                </header>
                {!(collapsedGroups[group.id] ?? true) && (
                  <div className="geo-conc-snippets">
                    {group.rows.map(({ row, frag }) => {
                      const fragment = frag || '';
                      const term = query.trim();
                      const withTerm = term
                        ? fragment.replace(new RegExp(escapeRegExp(term), 'gi'), (m) => `<mark>${m}</mark>`)
                        : fragment;
                      const html = highlightGeoBracket(withTerm);
                      return (
                        <article key={`${row.bookId}:${row.pos}`} className="geo-conc-snippet">
                          <div className="geo-conc-meta">bok {row.bookId} · pos {row.pos}</div>
                          <div dangerouslySetInnerHTML={{ __html: html || '(ingen snippet)' }} />
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
