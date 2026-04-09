import { useEffect, useMemo, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useCorpus } from '../context/CorpusContext';
import { fetchNbCatalogImages, type CatalogImage } from '../utils/iiif';
import { downloadCsv } from '../utils/download';
import { useWindowLayout } from '../utils/windowLayout';
import './EntityInspectorPanel.css';

interface EntityInspectorPanelProps {
  mode: 'authors' | 'places' | null;
  initialTab?: 'list' | 'images';
  windowKey?: 'entityAuthors' | 'entityPlaces';
  defaultPosition?: { x: number; y: number };
  onClose: () => void;
  onSelectPlace: (place: { token: string; placeId?: string }) => void;
}

interface AuthorStat {
  key: string;
  label: string;
  books: number;
  places: number;
  mentions: number;
}

type AuthorSortKey = 'label' | 'books' | 'places' | 'mentions';
type PlaceSortKey = 'token' | 'name' | 'doc_count' | 'frequency';

function splitAuthors(raw: string): string[] {
  return raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function hashToken(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
  }
  return hash >>> 0;
}

function toCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const EntityInspectorPanel: React.FC<EntityInspectorPanelProps> = ({
  mode,
  initialTab = 'list',
  windowKey = 'entityPlaces',
  defaultPosition,
  onClose,
  onSelectPlace
}) => {
  const {
    activeBooksMetadata,
    activeDhlabids,
    places,
    totalPlaces,
    isPlacesLoading,
    API_URL,
    activeWindow,
    setActiveWindow
  } = useCorpus();
  const [activeTab, setActiveTab] = useState<'list' | 'images'>(initialTab);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [images, setImages] = useState<CatalogImage[]>([]);
  const [isImagesLoading, setIsImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [authorImageQuery, setAuthorImageQuery] = useState('');
  const [authorImageSearchTerm, setAuthorImageSearchTerm] = useState('');
  const [authorQuery, setAuthorQuery] = useState('');
  const [authorSortKey, setAuthorSortKey] = useState<AuthorSortKey>('books');
  const [authorSortDir, setAuthorSortDir] = useState<'asc' | 'desc'>('desc');
  const [authorRowsPerPage, setAuthorRowsPerPage] = useState(100);
  const [authorPage, setAuthorPage] = useState(1);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSortKey, setPlaceSortKey] = useState<PlaceSortKey>('frequency');
  const [placeSortDir, setPlaceSortDir] = useState<'asc' | 'desc'>('desc');
  const [sampleEnabled, setSampleEnabled] = useState(false);
  const [sampleSeed, setSampleSeed] = useState(1);
  const [sampleSize, setSampleSize] = useState(500);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [placePage, setPlacePage] = useState(1);
  const [allPlaceRows, setAllPlaceRows] = useState<typeof places | null>(null);
  const { layout, onDragStop, onResizeStop } = useWindowLayout({
    key: windowKey,
    defaultLayout: { x: defaultPosition?.x ?? 80, y: defaultPosition?.y ?? 24, width: 760, height: 560 },
    minWidth: 520,
    minHeight: 360
  });

  useEffect(() => {
    if (mode !== 'places' || activeDhlabids.length === 0) {
      setAllPlaceRows(null);
      return;
    }
    if (totalPlaces <= places.length) {
      setAllPlaceRows(places);
      return;
    }

    let cancelled = false;
    fetch(`${API_URL}/api/places`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dhlabids: activeDhlabids,
        maxPlaces: totalPlaces
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch full places set');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setAllPlaceRows(data.places || []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setAllPlaceRows(places);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, activeDhlabids, totalPlaces, places, API_URL]);

  const placesData = mode === 'places' ? (allPlaceRows || places) : places;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, mode]);

  const authorRows = useMemo<AuthorStat[]>(() => {
    const stats = new Map<string, AuthorStat>();
    for (const book of activeBooksMetadata) {
      if (!book.author) continue;
      for (const author of splitAuthors(book.author)) {
        const existing = stats.get(author) || {
          key: author,
          label: author,
          books: 0,
          places: 0,
          mentions: 0
        };
        existing.books += 1;
        existing.places += toCount(book.unique_places);
        existing.mentions += toCount(book.total_mentions);
        stats.set(author, existing);
      }
    }
    return Array.from(stats.values());
  }, [activeBooksMetadata]);

  const authorStatsAvailability = useMemo(() => {
    const withPlaces = activeBooksMetadata.some((book) => toCount(book.unique_places) > 0);
    const withMentions = activeBooksMetadata.some((book) => toCount(book.total_mentions) > 0);
    return { withPlaces, withMentions };
  }, [activeBooksMetadata]);

  const authorRowsSorted = useMemo(() => {
    const query = authorQuery.trim().toLowerCase();
    let rows = query ? authorRows.filter((row) => row.label.toLowerCase().includes(query)) : [...authorRows];
    rows.sort((a, b) => {
      let cmp = 0;
      if (authorSortKey === 'label') cmp = a.label.localeCompare(b.label, 'no');
      if (authorSortKey === 'books') cmp = a.books - b.books;
      if (authorSortKey === 'places') cmp = a.places - b.places;
      if (authorSortKey === 'mentions') cmp = a.mentions - b.mentions;
      return authorSortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [authorRows, authorQuery, authorSortKey, authorSortDir]);

  const authorTotalPages = Math.max(1, Math.ceil(authorRowsSorted.length / authorRowsPerPage));
  const authorPageRows = useMemo(() => {
    const start = (authorPage - 1) * authorRowsPerPage;
    return authorRowsSorted.slice(start, start + authorRowsPerPage);
  }, [authorRowsSorted, authorPage, authorRowsPerPage]);
  const authorPageStart = authorRowsSorted.length === 0 ? 0 : (authorPage - 1) * authorRowsPerPage + 1;
  const authorPageEnd = authorRowsSorted.length === 0
    ? 0
    : Math.min(authorRowsSorted.length, authorPage * authorRowsPerPage);

  const handleDownloadAuthors = () => {
    const rows = authorRowsSorted.map((row) => ([
      row.label,
      row.books,
      authorStatsAvailability.withPlaces ? row.places : '',
      authorStatsAvailability.withMentions ? row.mentions : ''
    ]));
    downloadCsv(
      `imagination_forfattere_${authorRowsSorted.length}.csv`,
      ['Forfatter', 'Antall bøker', 'Antall steder', 'Antall mentions'],
      rows
    );
  };

  const handleDownloadPlaces = () => {
    const rows = placeRowsView.map((place) => ([
      place.token,
      place.name || '',
      place.doc_count,
      place.frequency,
      place.lat,
      place.lon
    ]));
    downloadCsv(
      `imagination_steder_${placeRowsView.length}.csv`,
      ['Historisk navn', 'Moderne', 'Antall bøker', 'Antall mentions', 'Lat', 'Lon'],
      rows
    );
  };

  const placeRows = useMemo(() => {
    const query = placeQuery.trim().toLowerCase();
    let rows = [...placesData];
    if (query) {
      rows = rows.filter((place) =>
        (place.token || '').toLowerCase().includes(query) ||
        (place.name || '').toLowerCase().includes(query)
      );
    }
    rows.sort((a, b) => {
      let cmp = 0;
      if (placeSortKey === 'token') cmp = a.token.localeCompare(b.token, 'no');
      if (placeSortKey === 'name') cmp = (a.name || '').localeCompare(b.name || '', 'no');
      if (placeSortKey === 'doc_count') cmp = a.doc_count - b.doc_count;
      if (placeSortKey === 'frequency') cmp = a.frequency - b.frequency;
      return placeSortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [placesData, placeQuery, placeSortKey, placeSortDir]);

  const placeRowsView = useMemo(() => {
    if (!sampleEnabled || placeRows.length <= sampleSize) return placeRows;
    return [...placeRows]
      .sort((a, b) => {
        const ah = hashToken(`${a.id}:${sampleSeed}`);
        const bh = hashToken(`${b.id}:${sampleSeed}`);
        return ah - bh;
      })
      .slice(0, sampleSize);
  }, [placeRows, sampleEnabled, sampleSize, sampleSeed]);

  const placeTotalPages = Math.max(1, Math.ceil(placeRowsView.length / rowsPerPage));

  const placePageRows = useMemo(() => {
    const start = (placePage - 1) * rowsPerPage;
    return placeRowsView.slice(start, start + rowsPerPage).map((place, index) => ({
      place,
      globalIndex: start + index + 1
    }));
  }, [placeRowsView, placePage, rowsPerPage]);

  const placePageStart = placeRowsView.length === 0 ? 0 : (placePage - 1) * rowsPerPage + 1;
  const placePageEnd = placeRowsView.length === 0
    ? 0
    : Math.min(placeRowsView.length, placePage * rowsPerPage);

  useEffect(() => {
    setAuthorPage(1);
  }, [authorQuery, authorSortKey, authorSortDir, authorRowsPerPage]);

  useEffect(() => {
    if (authorPage > authorTotalPages) setAuthorPage(authorTotalPages);
  }, [authorPage, authorTotalPages]);

  useEffect(() => {
    setPlacePage(1);
  }, [placeQuery, sampleEnabled, sampleSize, rowsPerPage]);

  useEffect(() => {
    if (placePage > placeTotalPages) setPlacePage(placeTotalPages);
  }, [placePage, placeTotalPages]);

  useEffect(() => {
    if (mode === 'authors') {
      if (authorRowsSorted.length === 0) {
        setSelectedKey('');
        return;
      }
      setSelectedKey((current) => (authorRowsSorted.some((row) => row.key === current) ? current : authorRowsSorted[0].key));
      return;
    }
    if (mode === 'places') {
      if (placeRows.length === 0) {
        setSelectedKey('');
        return;
      }
      setSelectedKey((current) => (placeRows.some((row) => row.token === current) ? current : placeRows[0].token));
    }
  }, [mode, authorRowsSorted, placeRows]);

  useEffect(() => {
    if (mode !== 'authors') return;
    setAuthorImageQuery(selectedKey);
    setAuthorImageSearchTerm(selectedKey);
  }, [mode, selectedKey]);

  const imageLookupKey = mode === 'authors'
    ? (authorImageSearchTerm.trim() || selectedKey)
    : selectedKey;

  useEffect(() => {
    if (!mode || !imageLookupKey) {
      setImages([]);
      setImagesError(null);
      return;
    }

    let cancelled = false;
    setIsImagesLoading(true);
    setImagesError(null);

    fetchNbCatalogImages(imageLookupKey, 8)
      .then((result) => {
        if (cancelled) return;
        setImages(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setImages([]);
        setImagesError('Fant ingen bilder akkurat nå.');
      })
      .finally(() => {
        if (cancelled) return;
        setIsImagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, imageLookupKey]);

  if (!mode) return null;

  const title = mode === 'authors' ? 'Forfattere' : 'Steder';

  return (
    <Rnd
      size={{ width: layout.width, height: layout.height }}
      position={{ x: layout.x, y: layout.y }}
      minWidth={520}
      minHeight={360}
      dragHandleClassName="drag-handle"
      className="entity-panel-rnd"
      style={{ zIndex: activeWindow === windowKey ? 2600 : 1800 }}
      onDragStart={() => setActiveWindow(windowKey)}
      onResizeStart={() => setActiveWindow(windowKey)}
      onDragStop={onDragStop}
      onResizeStop={onResizeStop}
    >
      <div className="entity-panel">
      <div className="entity-panel-header drag-handle">
        <h3>
          <i className={mode === 'authors' ? 'fas fa-user-edit' : 'fas fa-map-marker-alt'}></i>
          {title}
        </h3>
        <button onClick={onClose} aria-label="Lukk panel">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="entity-tabs">
        <button
          className={`entity-tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          Liste
        </button>
      </div>

      {mode === 'authors' && activeTab === 'list' ? (
        <div className="entity-places-layout">
          <div className="entity-places-toolbar">
            <input
              className="entity-search-input"
              placeholder="Søk forfatter..."
              value={authorQuery}
              onChange={(e) => setAuthorQuery(e.target.value)}
            />
            <select
              className="entity-select"
              value={authorRowsPerPage}
              onChange={(e) => setAuthorRowsPerPage(Number(e.target.value))}
            >
              <option value={50}>50 / side</option>
              <option value={100}>100 / side</option>
              <option value={200}>200 / side</option>
            </select>
            <button type="button" className="entity-action" onClick={handleDownloadAuthors}>
              <i className="fas fa-download"></i> Last ned
            </button>
          </div>

          <div className="entity-places-meta">
            Viser {authorPageStart.toLocaleString()}-{authorPageEnd.toLocaleString()} av {authorRowsSorted.length.toLocaleString()} forfattere
            {(!authorStatsAvailability.withPlaces || !authorStatsAvailability.withMentions) && (
              <span>
                {' '}(
                {!authorStatsAvailability.withPlaces ? 'antall steder mangler i metadata' : ''}
                {!authorStatsAvailability.withPlaces && !authorStatsAvailability.withMentions ? ', ' : ''}
                {!authorStatsAvailability.withMentions ? 'antall mentions mangler i metadata' : ''}
                )
              </span>
            )}
          </div>

          <div className="entity-places-table-wrap">
            <table className="entity-places-table">
              <thead>
                <tr>
                  <th onClick={() => {
                    if (authorSortKey === 'label') setAuthorSortDir(authorSortDir === 'asc' ? 'desc' : 'asc');
                    else { setAuthorSortKey('label'); setAuthorSortDir('asc'); }
                  }}>
                    Forfatter {authorSortKey === 'label' ? (authorSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => {
                    if (authorSortKey === 'books') setAuthorSortDir(authorSortDir === 'asc' ? 'desc' : 'asc');
                    else { setAuthorSortKey('books'); setAuthorSortDir('desc'); }
                  }}>
                    Antall bøker {authorSortKey === 'books' ? (authorSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => {
                    if (authorSortKey === 'places') setAuthorSortDir(authorSortDir === 'asc' ? 'desc' : 'asc');
                    else { setAuthorSortKey('places'); setAuthorSortDir('desc'); }
                  }}>
                    Antall steder {authorSortKey === 'places' ? (authorSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => {
                    if (authorSortKey === 'mentions') setAuthorSortDir(authorSortDir === 'asc' ? 'desc' : 'asc');
                    else { setAuthorSortKey('mentions'); setAuthorSortDir('desc'); }
                  }}>
                    Antall mentions {authorSortKey === 'mentions' ? (authorSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {authorPageRows.map((row) => (
                  <tr key={row.key} className={selectedKey === row.key ? 'active' : ''} onClick={() => setSelectedKey(row.key)}>
                    <td>{row.label}</td>
                    <td>{row.books.toLocaleString()}</td>
                    <td>{authorStatsAvailability.withPlaces ? row.places.toLocaleString() : '—'}</td>
                    <td>{authorStatsAvailability.withMentions ? row.mentions.toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {authorPageRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="entity-empty">Ingen forfattere i dette utvalget.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="entity-pagination">
            <button type="button" onClick={() => setAuthorPage((p) => Math.max(1, p - 1))} disabled={authorPage <= 1}>
              Forrige
            </button>
            <span>Side {authorPage} / {authorTotalPages}</span>
            <button type="button" onClick={() => setAuthorPage((p) => Math.min(authorTotalPages, p + 1))} disabled={authorPage >= authorTotalPages}>
              Neste
            </button>
          </div>
        </div>
      ) : mode === 'places' && activeTab === 'list' ? (
        <div className="entity-places-layout">
          <div className="entity-places-toolbar">
            <input
              className="entity-search-input"
              placeholder="Søk sted (historisk eller moderne)..."
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
            />
            <button
              type="button"
              className={`entity-action ${sampleEnabled ? 'active' : ''}`}
              onClick={() => setSampleEnabled((v) => !v)}
            >
              {sampleEnabled ? 'Sample på' : 'Sample av'}
            </button>
            {sampleEnabled && (
              <>
                <select
                  className="entity-select"
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Number(e.target.value))}
                >
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
                <button type="button" className="entity-action" onClick={() => setSampleSeed((s) => s + 1)}>
                  Ny sample
                </button>
              </>
            )}
            <select
              className="entity-select"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
            >
              <option value={50}>50 / side</option>
              <option value={100}>100 / side</option>
              <option value={200}>200 / side</option>
            </select>
            <button type="button" className="entity-action" onClick={handleDownloadPlaces}>
              <i className="fas fa-download"></i> Last ned
            </button>
          </div>

          <div className="entity-places-meta">
            Viser {placePageStart.toLocaleString()}-{placePageEnd.toLocaleString()} av {placeRowsView.length.toLocaleString()}
            {sampleEnabled && placeRows.length > sampleSize
              ? ` (sample fra ${placeRows.length.toLocaleString()})`
              : ` (totalt ${placeRows.length.toLocaleString()})`}
          </div>

          <div className="entity-places-table-wrap">
            <table className="entity-places-table">
              <thead>
                <tr>
                  <th onClick={() => {
                    if (placeSortKey === 'token') setPlaceSortDir(placeSortDir === 'asc' ? 'desc' : 'asc');
                    else { setPlaceSortKey('token'); setPlaceSortDir('asc'); }
                  }}>
                    Historisk navn {placeSortKey === 'token' ? (placeSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => {
                    if (placeSortKey === 'name') setPlaceSortDir(placeSortDir === 'asc' ? 'desc' : 'asc');
                    else { setPlaceSortKey('name'); setPlaceSortDir('asc'); }
                  }}>
                    Moderne {placeSortKey === 'name' ? (placeSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => {
                    if (placeSortKey === 'doc_count') setPlaceSortDir(placeSortDir === 'asc' ? 'desc' : 'asc');
                    else { setPlaceSortKey('doc_count'); setPlaceSortDir('desc'); }
                  }}>
                    Antall bøker {placeSortKey === 'doc_count' ? (placeSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => {
                    if (placeSortKey === 'frequency') setPlaceSortDir(placeSortDir === 'asc' ? 'desc' : 'asc');
                    else { setPlaceSortKey('frequency'); setPlaceSortDir('desc'); }
                  }}>
                    Antall mentions {placeSortKey === 'frequency' ? (placeSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {placePageRows.map(({ place, globalIndex }) => (
                  <tr key={`${place.id}-${place.token}-${globalIndex}`} className={selectedKey === place.token ? 'active' : ''}>
                    <td>{place.token}</td>
                    <td>{place.name || '-'}</td>
                    <td>{place.doc_count.toLocaleString()}</td>
                    <td>{place.frequency.toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="entity-row-action"
                        onClick={() => {
                          setSelectedKey(place.token);
                          onSelectPlace({ token: place.token, placeId: place.id });
                        }}
                      >
                        Vis
                      </button>
                    </td>
                  </tr>
                ))}
                {placePageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="entity-empty">Ingen steder i dette utvalget.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="entity-pagination">
            <button type="button" onClick={() => setPlacePage((p) => Math.max(1, p - 1))} disabled={placePage <= 1}>
              Forrige
            </button>
            <span>Side {placePage} / {placeTotalPages}</span>
            <button type="button" onClick={() => setPlacePage((p) => Math.min(placeTotalPages, p + 1))} disabled={placePage >= placeTotalPages}>
              Neste
            </button>
          </div>
        </div>
      ) : (
      <div className={`entity-panel-body ${activeTab === 'list' ? 'list-only' : ''}`}>
        <div className="entity-list">
          {mode === 'authors' && authorRowsSorted.length === 0 ? (
            <div className="entity-empty">Ingen forfattere i aktivt korpus</div>
          ) : mode === 'places' && placeRows.length === 0 ? (
            <div className="entity-empty">
              {isPlacesLoading ? 'Laster steder...' : `Ingen ${title.toLowerCase()} i aktivt korpus`}
            </div>
          ) : (
            (mode === 'authors' ? authorRowsSorted : placeRows.slice(0, 200).map((row) => ({
              key: row.token,
              label: row.token,
              sublabel: `${row.frequency.toLocaleString()} treff i ${row.doc_count.toLocaleString()} bøker`
            }))).slice(0, 200).map((item) => (
              <button
                key={item.key}
                className={`entity-row ${selectedKey === item.key ? 'active' : ''}`}
                onClick={() => setSelectedKey(item.key)}
              >
                <div className="entity-row-label">{item.label}</div>
                {'sublabel' in item && <div className="entity-row-sub">{item.sublabel}</div>}
              </button>
            ))
          )}
        </div>

        <div className="entity-media">
          <div className="entity-media-header">
            <strong>{(mode === 'authors' ? imageLookupKey : selectedKey) || 'Velg en rad'}</strong>
            {mode === 'places' && selectedKey && (
              <button
                className="entity-action"
                onClick={() => onSelectPlace({ token: selectedKey, placeId: placeRows.find((p) => p.token === selectedKey)?.id })}
              >
                Vis i kart
              </button>
            )}
          </div>

          {mode === 'authors' && activeTab === 'images' && (
            <div className="entity-image-search">
              <input
                className="entity-search-input"
                placeholder="Søk bilder (forfatter/navn)..."
                value={authorImageQuery}
                onChange={(e) => setAuthorImageQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setAuthorImageSearchTerm(authorImageQuery.trim() || selectedKey);
                  }
                }}
              />
              <button
                type="button"
                className="entity-action"
                onClick={() => setAuthorImageSearchTerm(authorImageQuery.trim() || selectedKey)}
              >
                Søk bilder
              </button>
            </div>
          )}

          {isImagesLoading && <div className="entity-empty">Laster IIIF-bilder...</div>}
          {!isImagesLoading && imagesError && <div className="entity-empty">{imagesError}</div>}
          {!isImagesLoading && !imagesError && images.length === 0 && selectedKey && (
            <div className="entity-empty">Ingen bilder funnet for dette oppslaget.</div>
          )}

          <div className="entity-image-grid">
            {images.map((image) => (
              <article key={`${image.thumbnail}-${image.viewUrl}`} className="entity-image-card">
                <img src={image.thumbnail} alt={image.title} loading="lazy" />
                <div className="entity-image-meta">
                  <div className="entity-image-title">{image.title}</div>
                  <div className="entity-image-date">{image.date || 'Udatert'}</div>
                  <div className="entity-image-links">
                    <a href={image.viewUrl} target="_blank" rel="noreferrer">
                      Åpne
                    </a>
                    {image.manifest && (
                      <a href={image.manifest} target="_blank" rel="noreferrer">
                        IIIF
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      )}
      </div>
    </Rnd>
  );
};
