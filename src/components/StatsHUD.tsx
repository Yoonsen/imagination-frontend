import React, { useMemo, useRef, useState } from 'react';
import { useCorpus } from '../context/CorpusContext';
import './StatsHUD.css';

interface StatsHUDProps {
    onBooksDefaultClick: () => void;
    onBooksCorpusBuilderClick: () => void;
    onBooksTableClick: () => void;
    onAuthorsClick: () => void;
    onPlacesDefaultClick: () => void;
    onPlacesListClick: () => void;
    onPlacesImagesClick: () => void;
}

export const StatsHUD: React.FC<StatsHUDProps> = ({
    onBooksDefaultClick,
    onBooksCorpusBuilderClick,
    onBooksTableClick,
    onAuthorsClick,
    onPlacesDefaultClick,
    onPlacesListClick,
    onPlacesImagesClick
}) => {
    const { activeBooksMetadata, allBooks, isLoading, places, totalPlaces } = useCorpus();
    const [openMenu, setOpenMenu] = useState<'books' | 'places' | null>(null);
    const closeTimer = useRef<number | null>(null);

    const stats = useMemo(() => {
        const uniqueAuthors = new Set(activeBooksMetadata.map(b => b.author).filter(Boolean));
        const years = activeBooksMetadata.map(b => b.year).filter(y => y !== null);
        const minYear = years.length > 0 ? Math.min(...years as number[]) : 0;
        const maxYear = years.length > 0 ? Math.max(...years as number[]) : 0;
        return {
            authors: uniqueAuthors.size,
            books: activeBooksMetadata.length,
            yearString: minYear ? `${minYear} - ${maxYear}` : "n/a"
        };
    }, [activeBooksMetadata]);

    const scheduleClose = () => {
        if (closeTimer.current) window.clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => setOpenMenu(null), 250);
    };

    const cancelClose = () => {
        if (closeTimer.current) {
            window.clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    const openMenuNow = (menu: 'books' | 'places') => {
        cancelClose();
        setOpenMenu(menu);
    };

    if (isLoading) {
        return (
            <div className="stats-hud-container loading">
                <span className="chip">
                    <i className="fas fa-spinner fa-spin"></i> Laster database...
                </span>
            </div>
        );
    }

    return (
        <div className="stats-hud-container">
            <div
                className="chip-menu-wrapper"
                onMouseEnter={() => openMenuNow('books')}
                onMouseLeave={scheduleClose}
            >
                <button className="chip chip-button" onClick={onBooksDefaultClick} title="Åpne bokfunksjoner">
                    <i className="fas fa-book"></i>
                    <span className="chip-text">
                        <span className="chip-value">{stats.books.toLocaleString()}</span> Bøker
                    </span>
                    <span className="chip-caret" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'books' ? null : 'books'); }}>
                        <i className="fas fa-chevron-down"></i>
                    </span>
                </button>
                {openMenu === 'books' && (
                    <div className="chip-menu" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
                        <button onClick={() => { onBooksCorpusBuilderClick(); setOpenMenu(null); }}>Corpus Builder</button>
                        <button onClick={() => { onBooksTableClick(); setOpenMenu(null); }}>Vis tabell</button>
                    </div>
                )}
            </div>
            <button className="chip chip-button" onClick={onAuthorsClick} title="Åpne forfatterliste med bilder">
                <i className="fas fa-user-edit"></i>
                <span className="chip-text">
                    <span className="chip-value">{stats.authors.toLocaleString()}</span> Forfattere
                </span>
            </button>
            <div className="chip">
                <i className="fas fa-calendar-alt"></i>
                <span className="chip-text">
                    {stats.yearString}
                </span>
            </div>
            <div
                className="chip-menu-wrapper"
                onMouseEnter={() => openMenuNow('places')}
                onMouseLeave={scheduleClose}
            >
                <button className="chip chip-button" onClick={onPlacesDefaultClick} title="Åpne stedsfunksjoner">
                    <i className="fas fa-map-marker-alt"></i>
                    <span className="chip-text">
                        <span className="chip-value">{totalPlaces.toLocaleString()}</span> Steder
                        {totalPlaces > places.length && <span style={{ fontSize: '0.7em', marginLeft: 4, opacity: 0.7 }}>(Vist: {places.length})</span>}
                    </span>
                    <span className="chip-caret" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'places' ? null : 'places'); }}>
                        <i className="fas fa-chevron-down"></i>
                    </span>
                </button>
                {openMenu === 'places' && (
                    <div className="chip-menu" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
                        <button onClick={() => { onPlacesListClick(); setOpenMenu(null); }}>Interaktiv liste</button>
                        <button onClick={() => { onPlacesImagesClick(); setOpenMenu(null); }}>Bilder (IIIF)</button>
                    </div>
                )}
            </div>
            <div className="chip active-db">
                <i className="fas fa-database"></i>
                <span className="chip-text">
                    Klar ({allBooks.length.toLocaleString()})
                </span>
            </div>
        </div>
    );
};
