import React, { useMemo, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useCorpus, type BookMetadata } from '../context/CorpusContext';
import { downloadCsv } from '../utils/download';
import { useWindowLayout } from '../utils/windowLayout';
import './CorpusBrowseTable.css';

type SortKey = keyof BookMetadata;

export const CorpusBrowseTable: React.FC = () => {
    const { activeBooksMetadata, isBrowseTableOpen, setIsBrowseTableOpen, activeWindow, setActiveWindow } = useCorpus();
    const [sortKey, setSortKey] = useState<SortKey>('author');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const { layout, onDragStop, onResizeStop } = useWindowLayout({
        key: 'browse',
        defaultLayout: { x: 50, y: 50, width: 800, height: 500 },
        minWidth: 400,
        minHeight: 300
    });

    const handleDownload = () => {
        const rows = sortedBooks.map((b) => ([
            b.urn.replace('URN:NBN:no-nb_digibok_', ''),
            b.author || '',
            b.year ?? '',
            b.title || '',
            b.category || '',
            b.unique_places ?? 0,
            b.total_mentions ?? 0,
            b.dhlabid
        ]));
        downloadCsv(
            `imagination_korpus_${sortedBooks.length}_boker.csv`,
            ['URN', 'Forfatter', 'År', 'Tittel', 'Kategori', 'Antall steder', 'Antall mentions', 'dhlabid'],
            rows
        );
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    // Dynamisk sortering
    const sortedBooks = useMemo(() => {
        return [...activeBooksMetadata].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            let comparison = 0;
            if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [activeBooksMetadata, sortKey, sortOrder]);

    if (!isBrowseTableOpen) return null;

    const renderHeader = (label: string, key: SortKey) => (
        <th onClick={() => handleSort(key)} className="sortable-header">
            {label} {sortKey === key ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
        </th>
    );

    return (
        <Rnd
            size={{ width: layout.width, height: layout.height }}
            position={{ x: layout.x, y: layout.y }}
            minWidth={400}
            minHeight={300}
            cancel=".no-drag"
            dragHandleClassName="drag-handle"
            className="corpus-browse-table-rnd"
            style={{ zIndex: activeWindow === 'browse' ? 2600 : 1700 }}
            onDragStart={() => setActiveWindow('browse')}
            onResizeStart={() => setActiveWindow('browse')}
            onDragStop={onDragStop}
            onResizeStop={onResizeStop}
        >
            <div className="table-card glassmorphism">
                <div className="table-header drag-handle" onMouseDown={() => setActiveWindow('browse')}>
                    <div className="table-title">
                        <i className="fas fa-list"></i> Aktivt Korpus ({activeBooksMetadata.length} bøker)
                    </div>
                    <div className="table-controls no-drag">
                        <button onClick={handleDownload} title="Last ned korpusliste (CSV)">
                            <i className="fas fa-download"></i>
                        </button>
                        <button onClick={() => setIsBrowseTableOpen(false)}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div className="table-body no-drag">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    {renderHeader('URN', 'urn')}
                                    {renderHeader('Forfatter', 'author')}
                                    {renderHeader('År', 'year')}
                                    {renderHeader('Tittel', 'title')}
                                    {renderHeader('Kategori', 'category')}
                                    {renderHeader('Steder', 'unique_places')}
                                    {renderHeader('Mentions', 'total_mentions')}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedBooks.map(b => (
                                    <tr key={b.dhlabid}>
                                        <td className="monospace">{b.urn.replace('URN:NBN:no-nb_digibok_', '')}</td>
                                        <td>{b.author || '-'}</td>
                                        <td>{b.year || '-'}</td>
                                        <td>{b.title || '-'}</td>
                                        <td>{b.category || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>{b.unique_places?.toLocaleString() || '0'}</td>
                                        <td style={{ textAlign: 'right' }}>{b.total_mentions?.toLocaleString() || '0'}</td>
                                    </tr>
                                ))}
                                {sortedBooks.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="empty-state">Ingen bøker i aktivt korpus</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Rnd>
    );
};
