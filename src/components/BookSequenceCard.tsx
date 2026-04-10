import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import type { GeoSequenceRow } from '../utils/geoApi';
import { createGeoApi } from '../utils/geoApi';
import { useCorpus } from '../context/CorpusContext';
import { useWindowLayout } from '../utils/windowLayout';
import './BookSequenceCard.css';

interface BookSequenceCardProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBookId: number | null;
  onSelectBookId: (bookId: number | null) => void;
  sequenceRows: GeoSequenceRow[];
  onSetSequenceRows: (rows: GeoSequenceRow[]) => void;
  dimOthers: boolean;
  onSetDimOthers: (value: boolean) => void;
  showLine: boolean;
  onSetShowLine: (value: boolean) => void;
  shortStepsMode: boolean;
  onSetShortStepsMode: (value: boolean) => void;
  maxStepKm: number;
  onSetMaxStepKm: (value: number) => void;
  progressPct: number;
  onSetProgressPct: (value: number) => void;
}

export const BookSequenceCard: React.FC<BookSequenceCardProps> = ({
  isOpen,
  onClose,
  selectedBookId,
  onSelectBookId,
  sequenceRows,
  onSetSequenceRows,
  dimOthers,
  onSetDimOthers,
  showLine,
  onSetShowLine,
  shortStepsMode,
  onSetShortStepsMode,
  maxStepKm,
  onSetMaxStepKm,
  progressPct,
  onSetProgressPct
}) => {
  const { activeBooksMetadata, API_URL, activeWindow, setActiveWindow } = useCorpus();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookQuery, setBookQuery] = useState('');
  const lastLoadedBookRef = useRef<number | null>(null);

  const books = useMemo(
    () => [...activeBooksMetadata].sort((a, b) => (b.year || 0) - (a.year || 0)),
    [activeBooksMetadata]
  );
  const filteredBooks = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    if (!q) return books.slice(0, 400);
    return books
      .filter((book) => {
        const haystack = [
          String(book.dhlabid),
          book.author || '',
          book.title || '',
          String(book.year || ''),
          book.urn || ''
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 400);
  }, [books, bookQuery]);
  const selectedBook = books.find((book) => book.dhlabid === selectedBookId) || null;
  const selectedInFiltered = !!selectedBookId && filteredBooks.some((book) => book.dhlabid === selectedBookId);
  const cumulativeCount = sequenceRows.length === 0
    ? 0
    : Math.max(0, Math.floor((Math.max(0, Math.min(100, Math.round(progressPct))) / 100) * sequenceRows.length));
  const { layout, onDragStop, onResizeStop } = useWindowLayout({
    key: 'bookSequence',
    defaultLayout: { x: 560, y: 24, width: 420, height: 280 },
    minWidth: 320,
    minHeight: 220
  });

  const runSequence = async () => {
    if (!selectedBookId || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const geoApi = createGeoApi(API_URL);
      const response = await geoApi.getGeoSequenceByBookId({
        bookId: selectedBookId,
        namespace: 'geo',
        limit: 50000
      });
      onSetSequenceRows(response.rows || []);
      lastLoadedBookRef.current = selectedBookId;
    } catch (err) {
      console.error(err);
      setError('Klarte ikke å hente boksekvens.');
      onSetSequenceRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !selectedBookId) return;
    if (lastLoadedBookRef.current === selectedBookId) return;
    runSequence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedBookId]);

  if (!isOpen) return null;

  return (
    <Rnd
      size={{ width: layout.width, height: layout.height }}
      position={{ x: layout.x, y: layout.y }}
      minWidth={320}
      minHeight={220}
      dragHandleClassName="drag-handle"
      className="book-sequence-rnd"
      style={{ zIndex: activeWindow === 'bookSequence' ? 2600 : 1750 }}
      onDragStart={() => setActiveWindow('bookSequence')}
      onResizeStart={() => setActiveWindow('bookSequence')}
      onDragStop={onDragStop}
      onResizeStop={onResizeStop}
    >
      <div className="book-sequence-card" onMouseDown={() => setActiveWindow('bookSequence')}>
        <div className="book-sequence-header drag-handle">
          <div className="book-sequence-title">
            <i className="fas fa-route"></i> Bokforløp
          </div>
          <div className="book-sequence-controls no-drag">
            <button onClick={onClose} title="Minimer">
              <i className="fas fa-window-minimize"></i>
            </button>
          </div>
        </div>

        <div className="book-sequence-body no-drag">
          <div className="book-sequence-row">
            <label>Velg bok</label>
            <input
              type="text"
              value={bookQuery}
              onChange={(e) => setBookQuery(e.target.value)}
              placeholder="Søk på dhlabid, forfatter, tittel, år eller URN..."
            />
            <select
              value={selectedBookId ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw) {
                  onSelectBookId(null);
                  return;
                }
                const next = Number(raw);
                onSelectBookId(Number.isFinite(next) ? next : null);
              }}
            >
              <option value="">-- Velg en bok --</option>
              {selectedBook && !selectedInFiltered && (
                <option value={selectedBook.dhlabid}>
                  {selectedBook.year || '?'} · {selectedBook.author || 'Ukjent'} · {selectedBook.title || 'Uten tittel'}
                </option>
              )}
              {filteredBooks.map((book) => (
                <option key={book.dhlabid} value={book.dhlabid}>
                  {book.year || '?'} · {book.author || 'Ukjent'} · {book.title || 'Uten tittel'}
                </option>
              ))}
            </select>
            <div className="book-sequence-filter-meta">
              {bookQuery.trim()
                ? `Treff: ${filteredBooks.length.toLocaleString()} (viser maks 400)`
                : `Viser ${filteredBooks.length.toLocaleString()} av ${books.length.toLocaleString()} (skriv for å søke)`}
            </div>
          </div>

          <div className="book-sequence-actions">
            <button className="book-sequence-btn" onClick={runSequence} disabled={!selectedBookId || isLoading}>
              {isLoading ? 'Laster...' : 'Vis forløp'}
            </button>
            <button
              className="book-sequence-btn outline"
              onClick={() => onSetSequenceRows([])}
              disabled={sequenceRows.length === 0}
            >
              Nullstill
            </button>
          </div>

          <div className="book-sequence-toggles">
            <label>
              <input type="checkbox" checked={dimOthers} onChange={(e) => onSetDimOthers(e.target.checked)} />
              Demp andre steder
            </label>
            <label>
              <input type="checkbox" checked={showLine} onChange={(e) => onSetShowLine(e.target.checked)} />
              Vis linje
            </label>
            <label>
              <input
                type="checkbox"
                checked={shortStepsMode}
                onChange={(e) => onSetShortStepsMode(e.target.checked)}
              />
              Gjett tur (korte skritt)
            </label>
          </div>

          <div className="book-sequence-row">
            <label>Maks sprang: {maxStepKm} km</label>
            <input
              type="range"
              min={80}
              max={1500}
              step={10}
              value={maxStepKm}
              disabled={!shortStepsMode}
              onChange={(e) => onSetMaxStepKm(Number(e.target.value))}
            />
          </div>

          <div className="book-sequence-row">
            <label>Sekvensforløp: {Math.max(0, Math.round(progressPct))}%</label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.max(0, Math.min(100, Math.round(progressPct)))}
              disabled={sequenceRows.length === 0}
              onChange={(e) => onSetProgressPct(Number(e.target.value))}
            />
            <div className="book-sequence-filter-meta">
              Viser kumulativt fra første sted til valgt punkt i forløpet.
            </div>
          </div>

          <div className="book-sequence-status">
            {selectedBook && (
              <span>
                Aktiv bok: <strong>{selectedBook.title || selectedBook.dhlabid}</strong>
              </span>
            )}
            <span>Treff i sekvens: <strong>{sequenceRows.length.toLocaleString()}</strong></span>
            <span>Kumulativ visning: <strong>{cumulativeCount.toLocaleString()} / {sequenceRows.length.toLocaleString()}</strong></span>
          </div>

          {error && <div className="book-sequence-error">{error}</div>}
        </div>
      </div>
    </Rnd>
  );
};

