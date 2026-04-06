import React, { useEffect, useState } from 'react';
import { useCorpus } from '../context/CorpusContext';
import './PlaceSummaryCard.css';

interface PlaceSummaryCardProps {
    token: string | null;
    onClose: () => void;
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

export const PlaceSummaryCard: React.FC<PlaceSummaryCardProps> = ({ token, onClose }) => {
    const { activeDhlabids, API_URL, activeWindow, setActiveWindow } = useCorpus();
    const [books, setBooks] = useState<PlaceBookDetail[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [concordance, setConcordance] = useState<string[]>([]);
    const [isConcLoading, setIsConcLoading] = useState(false);
    const [showConc, setShowConc] = useState(false);

    useEffect(() => {
        if (!token || activeDhlabids.length === 0) {
            setBooks([]);
            setShowConc(false);
            setConcordance([]);
            return;
        }

        setIsLoading(true);
        fetch(`${API_URL}/api/places/details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dhlabids: activeDhlabids, token })
        })
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch place details");
            return res.json();
        })
        .then(data => {
            setBooks(data.books || []);
            setIsLoading(false);
        })
        .catch(err => {
            console.error(err);
            setIsLoading(false);
        });
    }, [token, activeDhlabids, API_URL]);

    const fetchConcordance = () => {
        if (!token || isConcLoading) return;
        setIsConcLoading(true);
        setShowConc(true);

        fetch(`${API_URL}/concordance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wordA: token,
                window: 25,
                before: 15,
                after: 15,
                perBook: 2,
                totalLimit: 10,
                useFilter: true,
                filterIds: activeDhlabids
            })
        })
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch concordance");
            return res.json();
        })
        .then(data => {
            const snippets = (data.rows || []).map((row: any) => {
                const fragment = typeof row.frag === 'string' ? row.frag : '';
                return fragment ? `...${fragment}...` : '';
            }).filter(Boolean);
            setConcordance(snippets);
            setIsConcLoading(false);
        })
        .catch(err => {
            console.error(err);
            setIsConcLoading(false);
        });
    };

    if (!token) return null;

    return (
        <div
            className="place-summary-card glassmorphism"
            style={{ zIndex: activeWindow === 'summary' ? 2600 : 2000 }}
            onMouseDown={() => setActiveWindow('summary')}
        >
            <div className="summary-header">
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
                        </div>

                        <div className="concordance-section mt-2 mb-3">
                            <button 
                                className="btn-op outline w-100" 
                                onClick={showConc ? () => setShowConc(false) : fetchConcordance}
                                style={{ fontSize: '0.8rem' }}
                            >
                                {showConc ? "Skjul eksempler" : "Se eksempler (Konkordans)"}
                            </button>
                            
                            {showConc && (
                                <div className="concordance-list mt-2">
                                    {isConcLoading ? (
                                        <div className="text-center p-2"><i className="fas fa-spinner fa-spin"></i></div>
                                    ) : concordance.length > 0 ? (
                                        concordance.map((c, i) => (
                                            <div
                                                key={i}
                                                className="concordance-item"
                                                dangerouslySetInnerHTML={{
                                                    __html: c.replaceAll(token, `<mark>${token}</mark>`)
                                                }}
                                            />
                                        ))
                                    ) : (
                                        <div className="text-muted small">Ingen teksteksempler funnet.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <ul className="book-list">
                            {books.map(b => (
                                <li key={b.dhlabid} className="book-item">
                                    <div className="book-meta">
                                        <span className="book-author">{b.author || 'Ukjent'} ({b.year || '?'})</span>
                                        <span className="book-mentions">{b.mentions} treff</span>
                                    </div>
                                    <div className="book-title">{b.title || 'Uten tittel'}</div>
                                    {b.category && <div className="book-category">{b.category}</div>}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};
