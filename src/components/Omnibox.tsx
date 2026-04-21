import { useMemo, useState } from 'react';
import { useCorpus } from '../context/CorpusContext';
import './Omnibox.css';

interface OmniboxProps {
  onSelectPlace: (place: { token: string; placeId?: string }) => void;
  onSetSearchMapLayer: (places: Array<{ id: string; token: string; lat: number; lon: number; frequency: number; doc_count: number }>) => void;
}

interface AuthorMatch {
  name: string;
  count: number;
  dhlabids: number[];
}

function tokenize(text: string): string[] {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function hasAllTokens(value: string | null | undefined, tokens: string[]): boolean {
  if (!value) return false;
  const lowered = value.toLowerCase();
  return tokens.every((token) => lowered.includes(token));
}

function splitAuthors(raw: string): string[] {
  return raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildGeoTermCandidates(placeId: string | null | undefined): string[] {
  if (!placeId) return [];
  const raw = placeId.trim();
  if (!raw) return [];
  const strippedGeo = raw.replace(/^#?geo:/i, '');
  const strippedNb = strippedGeo.replace(/^nb:/i, '').trim();
  if (!/^\d+$/.test(strippedNb)) return [];
  return [`#geo:${strippedNb}`, `#geo:nb:${strippedNb}`];
}

const OR_QUERY_PAGE_LIMIT = 5000;
const OR_QUERY_MAX_PAGES = 80;

export const Omnibox: React.FC<OmniboxProps> = ({ onSelectPlace, onSetSearchMapLayer }) => {
  const { allBooks, activeDhlabids, setActiveDhlabids, API_URL } = useCorpus();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [globalPlaces, setGlobalPlaces] = useState<Array<{
    id: string;
    token: string;
    name: string | null;
    lat: number;
    lon: number;
    frequency: number;
    doc_count: number;
  }>>([]);
  const [isGlobalPlacesLoading, setIsGlobalPlacesLoading] = useState(false);
  const [globalPlacesLoaded, setGlobalPlacesLoaded] = useState(false);
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);

  const authorIndex = useMemo(() => {
    const byAuthor = new Map<string, Set<number>>();
    for (const book of allBooks) {
      if (!book.author) continue;
      for (const author of splitAuthors(book.author)) {
        if (!byAuthor.has(author)) byAuthor.set(author, new Set<number>());
        byAuthor.get(author)?.add(book.dhlabid);
      }
    }
    return byAuthor;
  }, [allBooks]);

  const results = useMemo(() => {
    const term = submittedQuery.trim();
    if (term.length < 2) {
      return { books: [], authors: [], placeResults: [] };
    }
    const tokens = tokenize(term);

    const books = allBooks
      .filter((book) => hasAllTokens(book.title, tokens))
      .sort((a, b) => {
        const aExact = (a.title || '').toLowerCase() === term.toLowerCase();
        const bExact = (b.title || '').toLowerCase() === term.toLowerCase();
        if (aExact !== bExact) return aExact ? -1 : 1;
        return (b.year || 0) - (a.year || 0);
      })
      .slice(0, 6);

    const authors: AuthorMatch[] = Array.from(authorIndex.entries())
      .filter(([author]) => hasAllTokens(author, tokens))
      .map(([name, ids]) => ({
        name,
        count: ids.size,
        dhlabids: Array.from(ids)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const placeResults = globalPlaces
      .filter((place) => hasAllTokens(`${place.token} ${place.name || ''}`, tokens))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 6);

    return { books, authors, placeResults };
  }, [submittedQuery, allBooks, authorIndex, globalPlaces]);

  const fetchGlobalPlaces = async () => {
    if (isGlobalPlacesLoading || allBooks.length === 0) return globalPlaces;
    setIsGlobalPlacesLoading(true);
    try {
      const allIds = Array.from(new Set(allBooks.map((book) => book.dhlabid)));
      const response = await fetch(`${API_URL}/api/places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dhlabids: allIds,
          maxPlaces: 20000
        })
      });
      if (response.ok) {
        const data = await response.json();
        const normalized = (Array.isArray(data?.places) ? data.places : [])
          .map((row: any) => ({
            id: String(row?.nb_place_id ?? row?.id ?? '').trim(),
            token: String(row?.token ?? row?.surface ?? row?.historical_name ?? '').trim(),
            name: row?.name ?? row?.canonicalName ?? null,
            lat: Number(row?.lat ?? row?.latitude),
            lon: Number(row?.lon ?? row?.longitude),
            frequency: Number(row?.frequency ?? row?.mentions ?? row?.count) || 0,
            doc_count: Number(row?.doc_count ?? row?.book_count ?? row?.docs) || 0
          }))
          .filter((row: any) => row.id && row.token && Number.isFinite(row.lat) && Number.isFinite(row.lon));
        setGlobalPlaces(normalized);
        setGlobalPlacesLoaded(true);
        return normalized;
      } else {
        const errorText = await response.text();
        console.error('Global place search failed', response.status, errorText);
        setGlobalPlaces([]);
        return [];
      }
    } catch (error) {
      console.error('Global place search failed', error);
      setGlobalPlaces([]);
      return [];
    } finally {
      setIsGlobalPlacesLoading(false);
    }
    return [];
  };

  const runSearch = async () => {
    const term = query.trim();
    if (term.length < 2) {
      setIsOpen(false);
      onSetSearchMapLayer([]);
      return;
    }
    const searchPool = !globalPlacesLoaded ? await fetchGlobalPlaces() : globalPlaces;
    const tokens = tokenize(term);
    const nextSearchMapLayer = searchPool
      .filter((place) => hasAllTokens(`${place.token} ${place.name || ''}`, tokens))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 6)
      .map((place) => ({
        id: place.id,
        token: place.token,
        lat: place.lat,
        lon: place.lon,
        frequency: place.frequency,
        doc_count: place.doc_count
      }));
    onSetSearchMapLayer(nextSearchMapLayer);
    setSubmittedQuery(term);
    setIsOpen(true);
  };

  const addBookToCorpus = (dhlabid: number) => {
    setActiveDhlabids(Array.from(new Set([...activeDhlabids, dhlabid])));
  };

  const addAuthorToCorpus = (dhlabids: number[]) => {
    setActiveDhlabids(Array.from(new Set([...activeDhlabids, ...dhlabids])));
  };

  const addPlaceToCorpus = async (placeId: string) => {
    const terms = buildGeoTermCandidates(placeId);
    if (terms.length === 0) return;
    setAddingPlaceId(placeId);
    try {
      for (const term of terms) {
        const idSet = new Set<number>();
        for (let page = 0; page < OR_QUERY_MAX_PAGES; page += 1) {
          const offset = page * OR_QUERY_PAGE_LIMIT;
          const res = await fetch(`${API_URL}/or_query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              terms: [term],
              useFilter: false,
              totalLimit: OR_QUERY_PAGE_LIMIT,
              offset,
              before: 1,
              after: 1,
              renderHits: false,
              _perf: true
            })
          });
          if (!res.ok) break;
          const data = await res.json();
          const rows = Array.isArray(data?.rows) ? data.rows : [];
          rows.forEach((row: any) => {
            const id = Number(row?.bookId ?? row?.dhlabid);
            if (Number.isFinite(id)) idSet.add(id);
          });
          if (rows.length < OR_QUERY_PAGE_LIMIT) break;
        }
        if (idSet.size > 0) {
          setActiveDhlabids(Array.from(new Set([...activeDhlabids, ...Array.from(idSet)])));
          return;
        }
      }
    } catch (error) {
      console.error('Could not add place books to corpus', error);
    } finally {
      setAddingPlaceId(null);
    }
  };

  const hasAnyResults = results.books.length > 0 || results.authors.length > 0 || results.placeResults.length > 0;

  return (
    <div className="omnibox-container">
      <div className="omnibox-input-row">
        <i className="fas fa-search" aria-hidden="true"></i>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runSearch();
            if (e.key === 'Escape') setIsOpen(false);
          }}
          placeholder="Søk i steder, bøker, forfattere..."
        />
        <button onClick={() => { void runSearch(); }}>Søk</button>
      </div>

      {isOpen && (
        <div className="omnibox-results">
          <div className="omnibox-header">
            <span>Søketreff</span>
            <button onClick={() => setIsOpen(false)}>Lukk</button>
          </div>

          {!hasAnyResults && <div className="omnibox-empty">Ingen treff for "{submittedQuery}".</div>}

          {(isGlobalPlacesLoading || results.placeResults.length > 0) && (
            <section>
              <h4>
                Steder{' '}
                <button
                  type="button"
                  onClick={() => { void fetchGlobalPlaces(); }}
                  disabled={isGlobalPlacesLoading}
                  title="Oppdater global stedsindeks"
                >
                  Oppdater
                </button>
              </h4>
              {isGlobalPlacesLoading && (
                <div className="omnibox-empty">Laster global stedsindeks...</div>
              )}
              {results.placeResults.map((place) => (
                <div key={place.id} className="omnibox-row">
                  <div>
                    <strong>{place.token}</strong>
                    <small>
                      {place.frequency.toLocaleString()} treff i {place.doc_count.toLocaleString()} bøker
                    </small>
                  </div>
                  <button
                    onClick={() => {
                      onSelectPlace({ token: place.token, placeId: place.id });
                      setIsOpen(false);
                    }}
                  >
                    Vis i kart
                  </button>
                  <button
                    onClick={() => { void addPlaceToCorpus(place.id); }}
                    disabled={addingPlaceId === place.id}
                    title="Legg bøker med dette stedet til korpus"
                  >
                    {addingPlaceId === place.id ? 'Legger til...' : 'Legg til korpus'}
                  </button>
                </div>
              ))}
            </section>
          )}

          {results.books.length > 0 && (
            <section>
              <h4>Bøker</h4>
              {results.books.map((book) => (
                <div key={book.dhlabid} className="omnibox-row">
                  <div>
                    <strong>{book.title || 'Uten tittel'}</strong>
                    <small>
                      {book.author || 'Ukjent'} {book.year ? `(${book.year})` : ''}
                    </small>
                  </div>
                  <button onClick={() => addBookToCorpus(book.dhlabid)}>Legg til korpus</button>
                </div>
              ))}
            </section>
          )}

          {results.authors.length > 0 && (
            <section>
              <h4>Forfattere</h4>
              {results.authors.map((author) => (
                <div key={author.name} className="omnibox-row">
                  <div>
                    <strong>{author.name}</strong>
                    <small>{author.count.toLocaleString()} bøker</small>
                  </div>
                  <button onClick={() => addAuthorToCorpus(author.dhlabids)}>Legg bøker til korpus</button>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
