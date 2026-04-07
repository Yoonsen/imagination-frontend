import { useEffect, useMemo, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useCorpus } from '../context/CorpusContext';
import { fetchNbCatalogImages, type CatalogImage } from '../utils/iiif';
import './EntityInspectorPanel.css';

interface EntityInspectorPanelProps {
  mode: 'authors' | 'places' | null;
  initialTab?: 'list' | 'images';
  windowKey?: 'entityAuthors' | 'entityPlaces';
  defaultPosition?: { x: number; y: number };
  onClose: () => void;
  onSelectPlace: (token: string) => void;
}

interface ListItem {
  key: string;
  label: string;
  sublabel: string;
}

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

export const EntityInspectorPanel: React.FC<EntityInspectorPanelProps> = ({
  mode,
  initialTab = 'list',
  windowKey = 'entityPlaces',
  defaultPosition,
  onClose,
  onSelectPlace
}) => {
  const { activeBooksMetadata, places, isPlacesLoading, activeWindow, setActiveWindow } = useCorpus();
  const [activeTab, setActiveTab] = useState<'list' | 'images'>(initialTab);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [images, setImages] = useState<CatalogImage[]>([]);
  const [isImagesLoading, setIsImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [authorImageQuery, setAuthorImageQuery] = useState('');
  const [authorImageSearchTerm, setAuthorImageSearchTerm] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSortKey, setPlaceSortKey] = useState<PlaceSortKey>('frequency');
  const [placeSortDir, setPlaceSortDir] = useState<'asc' | 'desc'>('desc');
  const [sampleEnabled, setSampleEnabled] = useState(false);
  const [sampleSeed, setSampleSeed] = useState(1);
  const [sampleSize, setSampleSize] = useState(500);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [placePage, setPlacePage] = useState(1);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, mode]);

  const items = useMemo<ListItem[]>(() => {
    if (mode === 'authors') {
      const counts = new Map<string, number>();
      for (const book of activeBooksMetadata) {
        if (!book.author) continue;
        for (const author of splitAuthors(book.author)) {
          counts.set(author, (counts.get(author) || 0) + 1);
        }
      }
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([author, count]) => ({
          key: author,
          label: author,
          sublabel: `${count.toLocaleString()} bøker`
        }));
    }

    if (mode === 'places') {
      return [...places]
        .sort((a, b) => b.frequency - a.frequency)
        .map((place) => ({
          key: place.token,
          label: place.token,
          sublabel: `${place.frequency.toLocaleString()} treff i ${place.doc_count.toLocaleString()} bøker`
        }));
    }

    return [];
  }, [mode, activeBooksMetadata, places]);

  const placeRows = useMemo(() => {
    const query = placeQuery.trim().toLowerCase();
    let rows = [...places];
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
  }, [places, placeQuery, placeSortKey, placeSortDir]);

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
    return placeRowsView.slice(start, start + rowsPerPage);
  }, [placeRowsView, placePage, rowsPerPage]);

  const placePageStart = placeRowsView.length === 0 ? 0 : (placePage - 1) * rowsPerPage + 1;
  const placePageEnd = placeRowsView.length === 0
    ? 0
    : Math.min(placeRowsView.length, placePage * rowsPerPage);

  useEffect(() => {
    setPlacePage(1);
  }, [placeQuery, sampleEnabled, sampleSize, rowsPerPage]);

  useEffect(() => {
    if (placePage > placeTotalPages) setPlacePage(placeTotalPages);
  }, [placePage, placeTotalPages]);

  useEffect(() => {
    if (!mode) return;
    if (items.length === 0) {
      setSelectedKey('');
      return;
    }
    setSelectedKey((current) => (items.some((item) => item.key === current) ? current : items[0].key));
  }, [mode, items]);

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
  const hasRows = items.length > 0;

  return (
    <Rnd
      default={{ x: defaultPosition?.x ?? 80, y: defaultPosition?.y ?? 24, width: 760, height: 560 }}
      minWidth={520}
      minHeight={360}
      dragHandleClassName="drag-handle"
      className="entity-panel-rnd"
      style={{ zIndex: activeWindow === windowKey ? 2600 : 1800 }}
      onDragStart={() => setActiveWindow(windowKey)}
      onResizeStart={() => setActiveWindow(windowKey)}
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
        <button
          className={`entity-tab ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          Bilder (IIIF)
        </button>
      </div>

      {mode === 'places' && activeTab === 'list' ? (
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
                {placePageRows.map((place) => (
                  <tr key={place.id} className={selectedKey === place.token ? 'active' : ''}>
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
                          onSelectPlace(place.token);
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
          {!hasRows ? (
            <div className="entity-empty">
              {mode === 'places' && isPlacesLoading ? 'Laster steder...' : `Ingen ${title.toLowerCase()} i aktivt korpus`}
            </div>
          ) : (
            items.slice(0, 200).map((item) => (
              <button
                key={item.key}
                className={`entity-row ${selectedKey === item.key ? 'active' : ''}`}
                onClick={() => setSelectedKey(item.key)}
              >
                <div className="entity-row-label">{item.label}</div>
                <div className="entity-row-sub">{item.sublabel}</div>
              </button>
            ))
          )}
        </div>

        <div className="entity-media">
          <div className="entity-media-header">
            <strong>{(mode === 'authors' ? imageLookupKey : selectedKey) || 'Velg en rad'}</strong>
            {mode === 'places' && selectedKey && (
              <button className="entity-action" onClick={() => onSelectPlace(selectedKey)}>
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
