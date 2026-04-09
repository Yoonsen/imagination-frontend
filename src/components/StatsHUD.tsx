import React, { useMemo, useRef, useState } from 'react';
import { useCorpus } from '../context/CorpusContext';
import './StatsHUD.css';

interface StatsHUDProps {
    onBooksDefaultClick: () => void;
    onBooksCorpusBuilderClick: () => void;
    onBooksTableClick: () => void;
    onAuthorsDefaultClick: () => void;
    onAuthorsListClick: () => void;
    onAuthorsImagesClick: () => void;
    onPlacesDefaultClick: () => void;
    onPlacesListClick: () => void;
    onPlacesImagesClick: () => void;
    onPlacesGeoConcordanceClick: () => void;
    onPlacesBookSequenceClick: () => void;
    onYearClick: () => void;
}

export const StatsHUD: React.FC<StatsHUDProps> = ({
    onBooksDefaultClick,
    onBooksCorpusBuilderClick,
    onBooksTableClick,
    onAuthorsDefaultClick,
    onAuthorsListClick,
    onAuthorsImagesClick,
    onPlacesDefaultClick,
    onPlacesListClick,
    onPlacesImagesClick,
    onPlacesGeoConcordanceClick,
    onPlacesBookSequenceClick,
    onYearClick
}) => {
    const {
        activeBooksMetadata,
        isLoading,
        places,
        totalPlaces
    } = useCorpus();
    const [openMenu, setOpenMenu] = useState<'books' | 'authors' | 'places' | null>(null);
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

    const openMenuNow = (menu: 'books' | 'authors' | 'places') => {
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
            <div className="chip-cluster">
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
                            <button type="button" onClick={() => { onBooksCorpusBuilderClick(); setOpenMenu(null); }}>
                                <i className="fas fa-tools"></i> Corpus Builder
                            </button>
                            <button type="button" onClick={() => { onBooksTableClick(); setOpenMenu(null); }}>
                                <i className="fas fa-list"></i> Vis tabell
                            </button>
                        </div>
                    )}
                </div>
                <div
                    className="chip-menu-wrapper"
                    onMouseEnter={() => openMenuNow('authors')}
                    onMouseLeave={scheduleClose}
                >
                    <button className="chip chip-button" onClick={onAuthorsDefaultClick} title="Åpne forfatterfunksjoner">
                        <i className="fas fa-user-edit"></i>
                        <span className="chip-text">
                            <span className="chip-value">{stats.authors.toLocaleString()}</span> Forfattere
                        </span>
                        <span className="chip-caret" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'authors' ? null : 'authors'); }}>
                            <i className="fas fa-chevron-down"></i>
                        </span>
                    </button>
                    {openMenu === 'authors' && (
                        <div className="chip-menu" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
                            <button type="button" onClick={() => { onAuthorsListClick(); setOpenMenu(null); }}>
                                <i className="fas fa-list"></i> Forfatterliste
                            </button>
                            <button type="button" onClick={() => { onAuthorsImagesClick(); setOpenMenu(null); }}>
                                <i className="fas fa-camera"></i> Forfatterbilder (IIIF)
                            </button>
                        </div>
                    )}
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
                            <button type="button" onClick={() => { onPlacesListClick(); setOpenMenu(null); }}>
                                <i className="fas fa-list"></i> Interaktiv liste
                            </button>
                            <button type="button" onClick={() => { onPlacesImagesClick(); setOpenMenu(null); }}>
                                <i className="fas fa-camera"></i> Bilder (IIIF)
                            </button>
                            <button type="button" onClick={() => { onPlacesGeoConcordanceClick(); setOpenMenu(null); }}>
                                <i className="fas fa-stream"></i> Geo-konkordans
                            </button>
                            <button type="button" onClick={() => { onPlacesBookSequenceClick(); setOpenMenu(null); }}>
                                <i className="fas fa-route"></i> Bokforløp
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <button className="chip chip-button" onClick={onYearClick} title="Åpne tidsfilter">
                <i className="fas fa-calendar-alt"></i>
                <span className="chip-text">
                    {stats.yearString}
                </span>
            </button>
        </div>
    );
};
