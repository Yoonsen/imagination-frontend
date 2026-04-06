import { useEffect, useMemo, useState } from 'react';
import { useCorpus } from '../context/CorpusContext';
import { fetchNbCatalogImages, type CatalogImage } from '../utils/iiif';
import './EntityInspectorPanel.css';

interface EntityInspectorPanelProps {
  mode: 'authors' | 'places' | null;
  initialTab?: 'list' | 'images';
  onClose: () => void;
  onSelectPlace: (token: string) => void;
}

interface ListItem {
  key: string;
  label: string;
  sublabel: string;
}

function splitAuthors(raw: string): string[] {
  return raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

export const EntityInspectorPanel: React.FC<EntityInspectorPanelProps> = ({
  mode,
  initialTab = 'list',
  onClose,
  onSelectPlace
}) => {
  const { activeBooksMetadata, places, isPlacesLoading } = useCorpus();
  const [activeTab, setActiveTab] = useState<'list' | 'images'>(initialTab);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [images, setImages] = useState<CatalogImage[]>([]);
  const [isImagesLoading, setIsImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!mode) return;
    if (items.length === 0) {
      setSelectedKey('');
      return;
    }
    setSelectedKey((current) => (items.some((item) => item.key === current) ? current : items[0].key));
  }, [mode, items]);

  useEffect(() => {
    if (!mode || !selectedKey) {
      setImages([]);
      setImagesError(null);
      return;
    }

    let cancelled = false;
    setIsImagesLoading(true);
    setImagesError(null);

    fetchNbCatalogImages(selectedKey, 8)
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
  }, [mode, selectedKey]);

  if (!mode) return null;

  const title = mode === 'authors' ? 'Forfattere' : 'Steder';
  const hasRows = items.length > 0;

  return (
    <div className="entity-panel">
      <div className="entity-panel-header">
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
            <strong>{selectedKey || 'Velg en rad'}</strong>
            {mode === 'places' && selectedKey && (
              <button className="entity-action" onClick={() => onSelectPlace(selectedKey)}>
                Vis i kart
              </button>
            )}
          </div>

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
    </div>
  );
};
