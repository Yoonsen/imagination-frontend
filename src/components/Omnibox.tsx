import { useMemo, useState } from 'react';
import { useCorpus } from '../context/CorpusContext';
import './Omnibox.css';

interface OmniboxProps {
  onSelectPlace: (token: string) => void;
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

export const Omnibox: React.FC<OmniboxProps> = ({ onSelectPlace }) => {
  const { allBooks, activeDhlabids, setActiveDhlabids, places } = useCorpus();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

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

    const placeResults = places
      .filter((place) => hasAllTokens(place.name || place.token, tokens))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 6);

    return { books, authors, placeResults };
  }, [submittedQuery, allBooks, authorIndex, places]);

  const runSearch = () => {
    const term = query.trim();
    if (term.length < 2) {
      setIsOpen(false);
      return;
    }
    setSubmittedQuery(term);
    setIsOpen(true);
  };

  const addBookToCorpus = (dhlabid: number) => {
    setActiveDhlabids(Array.from(new Set([...activeDhlabids, dhlabid])));
  };

  const addAuthorToCorpus = (dhlabids: number[]) => {
    setActiveDhlabids(Array.from(new Set([...activeDhlabids, ...dhlabids])));
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
            if (e.key === 'Enter') runSearch();
            if (e.key === 'Escape') setIsOpen(false);
          }}
          placeholder="Søk i steder, bøker, forfattere..."
        />
        <button onClick={runSearch}>Søk</button>
      </div>

      {isOpen && (
        <div className="omnibox-results">
          <div className="omnibox-header">
            <span>Søketreff</span>
            <button onClick={() => setIsOpen(false)}>Lukk</button>
          </div>

          {!hasAnyResults && <div className="omnibox-empty">Ingen treff for "{submittedQuery}".</div>}

          {results.placeResults.length > 0 && (
            <section>
              <h4>Steder</h4>
              {results.placeResults.map((place) => (
                <div key={place.id} className="omnibox-row">
                  <div>
                    <strong>{place.name || place.token}</strong>
                    <small>
                      {place.frequency.toLocaleString()} treff i {place.doc_count.toLocaleString()} bøker
                    </small>
                  </div>
                  <button
                    onClick={() => {
                      onSelectPlace(place.token);
                      setIsOpen(false);
                    }}
                  >
                    Vis i kart
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
