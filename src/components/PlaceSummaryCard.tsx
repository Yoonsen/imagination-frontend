import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Rnd } from 'react-rnd';
import { useCorpus } from '../context/CorpusContext';
import { useWindowLayout } from '../utils/windowLayout';
import './PlaceSummaryCard.css';

interface PlaceSummaryCardProps {
    token: string | null;
    placeId?: string | null;
    onClose: () => void;
    onShowBookSequence?: (bookId: number) => void;
}

interface PlaceBookDetail {
    dhlabid: number;
    urn: string;
    author: string | null;
    year: number | null;
    title: string | null;
    category: string | null;
    mentions: number;
}

interface ConcordanceHit {
    bookId: number;
    pos: number;
    frag: string;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightPlaceInFragment(fragment: string, fallbackToken: string): string {
    const withBracketHighlight = fragment.replace(/\[([^\]]+)\]/g, (_m, inner: string) => {
        return `[<mark class="place-hit-mark">${inner}</mark>]`;
    });
    if (withBracketHighlight !== fragment) return withBracketHighlight;
    const token = fallbackToken.trim();
    if (!token) return fragment;
    return fragment.replace(new RegExp(escapeRegExp(token), 'gi'), (match) => `<mark class="place-hit-mark">${match}</mark>`);
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

function extractHits(data: any): ConcordanceHit[] {
    const renderedHits = (data?.rendered || []).map((row: any) => {
        const fragment = typeof row?.frag === 'string' ? row.frag : '';
        if (!fragment) return null;
        const bookId = Number(row?.bookId);
        const pos = Number(row?.pos ?? row?.seqStart ?? 0);
        if (!Number.isFinite(bookId)) return null;
        return { bookId, pos: Number.isFinite(pos) ? pos : 0, frag: `...${fragment}...` };
    }).filter((row: ConcordanceHit | null): row is ConcordanceHit => row !== null);

    if (renderedHits.length > 0) return renderedHits;

    return (data?.rows || []).map((row: any) => {
        const fragment = typeof row?.frag === 'string' ? row.frag : '';
        if (!fragment) return null;
        const bookId = Number(row?.bookId);
        const pos = Number(row?.pos ?? row?.seqStart ?? 0);
        if (!Number.isFinite(bookId)) return null;
        return { bookId, pos: Number.isFinite(pos) ? pos : 0, frag: `...${fragment}...` };
    }).filter((row: ConcordanceHit | null): row is ConcordanceHit => row !== null);
}

function uniqueHits(hits: ConcordanceHit[]): ConcordanceHit[] {
    const seen = new Set<string>();
    const unique: ConcordanceHit[] = [];
    hits.forEach((hit) => {
        const key = `${hit.bookId}:${hit.pos}:${hit.frag}`;
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(hit);
    });
    return unique;
}

export const PlaceSummaryCard: React.FC<PlaceSummaryCardProps> = ({ token, placeId, onClose, onShowBookSequence }) => {
    const { activeDhlabids, activeBooksMetadata, API_URL, activeWindow, setActiveWindow, places } = useCorpus();
    const [books, setBooks] = useState<PlaceBookDetail[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [collapsedBooks, setCollapsedBooks] = useState<Record<number, boolean>>({});
    const [bookConcordances, setBookConcordances] = useState<Record<number, ConcordanceHit[]>>({});
    const [bookConcordanceLoading, setBookConcordanceLoading] = useState<Record<number, boolean>>({});
    const [isFullExportLoading, setIsFullExportLoading] = useState(false);
    const [fullExportProgress, setFullExportProgress] = useState<{ done: number; total: number } | null>(null);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const concordanceCacheRef = useRef<Map<string, ConcordanceHit[]>>(new Map());
    const downloadMenuRef = useRef<HTMLDivElement | null>(null);

    const selectedPlace = useMemo(() => {
        if (!token) return null;
        if (placeId) {
            return places.find((p) => String(p.id) === String(placeId)) || null;
        }
        return places.find((p) => p.token === token) || null;
    }, [token, placeId, places]);
    const effectivePlaceId = placeId || selectedPlace?.id;
    const sortedBooks = useMemo(
        () => [...books].sort((a, b) => b.mentions - a.mentions),
        [books]
    );
    const booksById = useMemo(() => {
        const map = new Map<number, PlaceBookDetail>();
        books.forEach((book) => map.set(book.dhlabid, book));
        return map;
    }, [books]);
    const metadataById = useMemo(() => {
        const map = new Map<number, { urn: string; author: string | null; year: number | null; title: string | null; category: string | null }>();
        activeBooksMetadata.forEach((book) => {
            map.set(book.dhlabid, {
                urn: book.urn,
                author: book.author,
                year: book.year,
                title: book.title,
                category: book.category
            });
        });
        return map;
    }, [activeBooksMetadata]);
    const activatedBookCount = useMemo(
        () => Object.keys(bookConcordances).length,
        [bookConcordances]
    );
    const { layout, onDrag, onDragStop, onResizeStop } = useWindowLayout({
        key: 'placeSummary',
        defaultLayout: { x: 760, y: 24, width: 380, height: 600 },
        minWidth: 320,
        minHeight: 320
    });

    useEffect(() => {
        if (!token || activeDhlabids.length === 0) {
            setBooks([]);
            setBookConcordances({});
            setBookConcordanceLoading({});
            return;
        }

        setIsLoading(true);
        setBooks([]);
        setBookConcordances({});
        setBookConcordanceLoading({});
        setCollapsedBooks({});
        let cancelled = false;
        const run = async () => {
            const fetchBooksFromGeo = async (): Promise<PlaceBookDetail[]> => {
                const geoTerms = buildGeoTermCandidates(effectivePlaceId);
                if (geoTerms.length === 0) return [];
                for (const geoTerm of geoTerms) {
                    try {
                        const res = await fetch(`${API_URL}/or_query`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                terms: [geoTerm],
                                useFilter: true,
                                filterIds: activeDhlabids,
                                totalLimit: 5000,
                                before: 1,
                                after: 1,
                                renderHits: false,
                                _perf: true
                            })
                        });
                        if (!res.ok) continue;
                        const data = await res.json();
                        const rows = Array.isArray(data?.rows) ? data.rows : [];
                        if (rows.length === 0) continue;
                        const mentionsByBook = new Map<number, number>();
                        rows.forEach((row: any) => {
                            const bookId = Number(row?.bookId ?? row?.dhlabid);
                            if (!Number.isFinite(bookId)) return;
                            mentionsByBook.set(bookId, (mentionsByBook.get(bookId) || 0) + 1);
                        });
                        const out: PlaceBookDetail[] = [];
                        mentionsByBook.forEach((mentions, dhlabid) => {
                            const meta = metadataById.get(dhlabid);
                            out.push({
                                dhlabid,
                                urn: meta?.urn || '',
                                author: meta?.author || null,
                                year: meta?.year ?? null,
                                title: meta?.title || null,
                                category: meta?.category || null,
                                mentions
                            });
                        });
                        return out;
                    } catch {
                        // Try next candidate term.
                    }
                }
                return [];
            };

            try {
                const geoBooks = await fetchBooksFromGeo().catch(() => [] as PlaceBookDetail[]);
                if (cancelled) return;
                const merged = new Map<number, PlaceBookDetail>();
                geoBooks.forEach((book) => {
                    const current = merged.get(book.dhlabid);
                    if (!current) {
                        merged.set(book.dhlabid, book);
                        return;
                    }
                    merged.set(book.dhlabid, {
                        ...current,
                        mentions: Math.max(current.mentions || 0, book.mentions || 0),
                        urn: current.urn || book.urn,
                        author: current.author || book.author,
                        year: current.year ?? book.year,
                        title: current.title || book.title,
                        category: current.category || book.category
                    });
                });
                setBooks([...merged.values()]);
            } catch (err) {
                if (!cancelled) console.error(err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [token, effectivePlaceId, selectedPlace, activeDhlabids, metadataById, API_URL]);

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (!downloadMenuRef.current) return;
            if (!downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, []);

    const fetchBookConcordance = async (bookId: number) => {
        if (!token) return;
        const resolveHits = async (): Promise<ConcordanceHit[]> => {
            const geoTerms = buildGeoTermCandidates(effectivePlaceId);
            let hits: ConcordanceHit[] = [];
            if (geoTerms.length > 0) {
                for (const geoTerm of geoTerms) {
                    try {
                        const payload: Record<string, unknown> = {
                            terms: [geoTerm],
                            window: 8,
                            before: 8,
                            after: 8,
                            totalLimit: 12,
                            renderHits: true,
                            _perf: true,
                            useFilter: true,
                            filterIds: [bookId]
                        };
                        const res = await fetch(`${API_URL}/or_query`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (!res.ok) continue;
                        const data = await res.json();
                        const candidateHits = uniqueHits(extractHits(data));
                        if (candidateHits.length > 0) {
                            hits = candidateHits;
                            break;
                        }
                    } catch {
                        // Ignore and try next candidate/fallback.
                    }
                }
            }

            return hits;
        };

        const cacheKey = `${token}::${effectivePlaceId || ''}::${bookId}`;
        const cached = concordanceCacheRef.current.get(cacheKey);
        if (cached) {
            setBookConcordances((prev) => ({ ...prev, [bookId]: cached }));
            return;
        }

        setBookConcordanceLoading((prev) => ({ ...prev, [bookId]: true }));
        try {
            const hits = await resolveHits();
            concordanceCacheRef.current.set(cacheKey, hits);
            setBookConcordances((prev) => ({ ...prev, [bookId]: hits }));
        } catch (err) {
            console.error(err);
            setBookConcordances((prev) => ({ ...prev, [bookId]: [] }));
        } finally {
            setBookConcordanceLoading((prev) => ({ ...prev, [bookId]: false }));
        }
    };

    const buildPlaceListRows = () => (
        sortedBooks.map((book) => ({
            dhlabid: book.dhlabid,
            forfatter: book.author || '',
            tittel: book.title || '',
            år: book.year ?? '',
            treff_i_bok: book.mentions
        }))
    );

    const downloadPlaceListExcel = () => {
        const placeListRows = buildPlaceListRows();
        if (placeListRows.length === 0) return;
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(placeListRows), 'Stedsliste');
        const stamp = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `stedsliste-${token || 'sted'}-${stamp}.xlsx`);
    };

    const downloadActivatedConcordanceWorkbook = () => {
        const placeListRows = buildPlaceListRows();
        const activeBookRows = Object.entries(bookConcordances).map(([bookIdRaw, hits]) => {
            const bookId = Number(bookIdRaw);
            const meta = booksById.get(bookId);
            return {
                dhlabid: bookId,
                forfatter: meta?.author || '',
                tittel: meta?.title || '',
                år: meta?.year ?? '',
                antall_eksempler: hits.length
            };
        });
        if (activeBookRows.length === 0) return;

        const concordanceRows = Object.entries(bookConcordances).flatMap(([bookIdRaw, hits]) => {
            const bookId = Number(bookIdRaw);
            const meta = booksById.get(bookId);
            return hits.map((hit) => ({
                dhlabid: bookId,
                forfatter: meta?.author || '',
                tittel: meta?.title || '',
                år: meta?.year ?? '',
                konk: hit.frag
            }));
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(placeListRows), 'Stedsliste');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(activeBookRows), 'Bokliste_aktivert');
        if (concordanceRows.length > 0) {
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(concordanceRows), 'Konkordanser');
        }
        const stamp = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `stedskonkordans-aktivert-${token || 'sted'}-${stamp}.xlsx`);
    };

    const buildAllConcordanceRows = async () => {
        const allRows: Array<{ dhlabid: number; forfatter: string; tittel: string; år: number | ''; konk: string }> = [];
        for (let i = 0; i < sortedBooks.length; i += 1) {
            const book = sortedBooks[i];
            const cacheKey = `${token}::${effectivePlaceId || ''}::${book.dhlabid}`;
            let hits = concordanceCacheRef.current.get(cacheKey);
            if (!hits) {
                await fetchBookConcordance(book.dhlabid);
                hits = concordanceCacheRef.current.get(cacheKey) || [];
            }

            hits.forEach((hit) => {
                allRows.push({
                    dhlabid: book.dhlabid,
                    forfatter: book.author || '',
                    tittel: book.title || '',
                    år: book.year ?? '',
                    konk: hit.frag
                });
            });
            setFullExportProgress({ done: i + 1, total: sortedBooks.length });
        }
        return allRows;
    };

    const downloadFullConcordanceWorkbook = async () => {
        if (!token || sortedBooks.length === 0 || isFullExportLoading) return;
        setIsFullExportLoading(true);
        setFullExportProgress({ done: 0, total: sortedBooks.length });
        try {
            const allRows = await buildAllConcordanceRows();
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildPlaceListRows()), 'Stedsliste');
            if (allRows.length > 0) {
                XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(allRows), 'Konkordanser');
            }
            const stamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(workbook, `stedskonkordans-full-${token || 'sted'}-${stamp}.xlsx`);
        } finally {
            setIsFullExportLoading(false);
            setFullExportProgress(null);
        }
    };

    const toNbLink = (book: PlaceBookDetail) => {
        const searchText = encodeURIComponent(token || '');
        if (book.urn) {
            return `https://www.nb.no/items/${encodeURIComponent(book.urn)}?searchText=${searchText}`;
        }
        return `https://www.nb.no/search?searchText=${searchText}`;
    };

    if (!token) return null;

    return (
        <Rnd
            size={{ width: layout.width, height: layout.height }}
            position={{ x: layout.x, y: layout.y }}
            minWidth={320}
            minHeight={320}
            dragHandleClassName="summary-header"
            className="place-summary-rnd"
            style={{ zIndex: activeWindow === 'summary' ? 2600 : 2000 }}
            onDragStart={() => setActiveWindow('summary')}
            onDrag={onDrag}
            onResizeStart={() => setActiveWindow('summary')}
            onDragStop={onDragStop}
            onResizeStop={onResizeStop}
        >
        <div
            className="place-summary-card glassmorphism"
            onMouseDown={() => setActiveWindow('summary')}
        >
            <div className="summary-header" onMouseDown={() => setActiveWindow('summary')}>
                <h3><i className="fas fa-map-marker-alt" style={{color: '#dc2626'}}></i> {token}</h3>
                <button onClick={onClose}><i className="fas fa-times"></i></button>
            </div>
            
            <div className="summary-body">
                {isLoading ? (
                    <div className="loading-state">
                        <i className="fas fa-circle-notch fa-spin"></i> Laster bøker for {token}...
                    </div>
                ) : (
                    <>
                        <div className="summary-stats">
                            <span>Forekomster: <strong>{books.reduce((sum, b) => sum + b.mentions, 0)}</strong></span>
                            <span>Unike bøker: <strong>{books.length}</strong></span>
                            <span>
                                {effectivePlaceId?.startsWith('geonames:')
                                    ? 'GeonameID'
                                    : (effectivePlaceId?.startsWith('internal:') || effectivePlaceId?.startsWith('intern:'))
                                        ? 'Intern-ID'
                                        : 'Steds-ID'}:{' '}
                                <strong>{effectivePlaceId || 'mangler i datasettet'}</strong>
                            </span>
                        </div>

                        <div className="concordance-toolbar">
                            <div className="summary-download-menu" ref={downloadMenuRef}>
                                <button
                                    className="btn-op outline summary-download-toggle"
                                    onClick={() => setIsDownloadMenuOpen((prev) => !prev)}
                                    style={{ fontSize: '0.8rem' }}
                                    disabled={sortedBooks.length === 0 || isFullExportLoading}
                                    title="Velg eksporttype for Excel"
                                >
                                    {isFullExportLoading ? 'Lager full Excel...' : 'Last ned Excel'}
                                    <i className="fas fa-chevron-down" style={{ marginLeft: 6 }}></i>
                                </button>
                                {isDownloadMenuOpen && !isFullExportLoading && (
                                    <div className="summary-download-dropdown">
                                        <button
                                            type="button"
                                            className="summary-download-option"
                                            onClick={() => {
                                                downloadPlaceListExcel();
                                                setIsDownloadMenuOpen(false);
                                            }}
                                        >
                                            Stedsliste
                                        </button>
                                        <button
                                            type="button"
                                            className="summary-download-option"
                                            disabled={activatedBookCount === 0}
                                            title={activatedBookCount === 0 ? 'Åpne minst én bok for å aktivere konkordans' : ''}
                                            onClick={() => {
                                                downloadActivatedConcordanceWorkbook();
                                                setIsDownloadMenuOpen(false);
                                            }}
                                        >
                                            Stedsliste + aktive konkordanser
                                        </button>
                                        <button
                                            type="button"
                                            className="summary-download-option"
                                            onClick={async () => {
                                                setIsDownloadMenuOpen(false);
                                                await downloadFullConcordanceWorkbook();
                                            }}
                                        >
                                            Stedsliste + alle konkordanser
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                            <div className="concordance-group-meta">
                                Klikk på pilen ved boka for å åpne konkordans (teksteksempler).
                            </div>
                            {isFullExportLoading && fullExportProgress && (
                                <div className="concordance-group-meta">
                                    Henter bok {fullExportProgress.done} av {fullExportProgress.total}...
                                </div>
                            )}

                        <ul className="book-list">
                            {sortedBooks.map((book) => {
                                const collapsed = collapsedBooks[book.dhlabid] ?? true;
                                const hits = bookConcordances[book.dhlabid] || [];
                                const isBookLoading = Boolean(bookConcordanceLoading[book.dhlabid]);
                                return (
                                    <li key={book.dhlabid} className="book-item">
                                        <button
                                            type="button"
                                            className="book-item-toggle"
                                            onClick={() => {
                                                const nextCollapsed = !collapsed;
                                                setCollapsedBooks((prev) => ({
                                                    ...prev,
                                                    [book.dhlabid]: nextCollapsed
                                                }));
                                                if (!nextCollapsed && !bookConcordances[book.dhlabid] && !bookConcordanceLoading[book.dhlabid]) {
                                                    fetchBookConcordance(book.dhlabid);
                                                }
                                            }}
                                        >
                                            <span className="book-item-toggle-left">
                                                <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}`}></i>
                                                <span className="book-author">{book.author || 'Ukjent'} ({book.year || '?'})</span>
                                            </span>
                                            <span className="book-mentions">
                                                {book.mentions} treff
                                                {!collapsed && !isBookLoading ? ` · ${hits.length} eksempler` : ''}
                                            </span>
                                        </button>

                                        <div className="book-title-row">
                                            <a
                                                className="book-title book-title-link"
                                                href={toNbLink(book)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {book.title || 'Uten tittel'}
                                            </a>
                                            {onShowBookSequence && (
                                                <button
                                                    type="button"
                                                    className="book-sequence-btn-inline"
                                                    title="Vis bokforløp på kart"
                                                    onClick={() => onShowBookSequence(book.dhlabid)}
                                                >
                                                    <i className="fas fa-route"></i>
                                                </button>
                                            )}
                                        </div>
                                        {book.category && <div className="book-category">{book.category}</div>}

                                        {!collapsed && (
                                            <div className="concordance-group-body">
                                                <div className="concordance-group-meta">dhlabid {book.dhlabid}</div>
                                                {isBookLoading ? (
                                                    <div className="text-center p-2"><i className="fas fa-spinner fa-spin"></i></div>
                                                ) : hits.length > 0 ? (
                                                    hits.map((hit, i) => (
                                                        <div
                                                            key={`${book.dhlabid}:${hit.pos}:${i}`}
                                                            className="concordance-item"
                                                            dangerouslySetInnerHTML={{
                                                                __html: highlightPlaceInFragment(hit.frag, token)
                                                            }}
                                                        />
                                                    ))
                                                ) : (
                                                    <div className="text-muted small">Ingen teksteksempler for denne boka.</div>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </div>
        </div>
        </Rnd>
    );
};
