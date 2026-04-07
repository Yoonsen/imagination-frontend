import React, { useMemo, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useCorpus, type BookMetadata } from '../context/CorpusContext';
import './CorpusBrowseTable.css';

type SortKey = keyof BookMetadata;

export const CorpusBrowseTable: React.FC = () => {
    const { activeBooksMetadata, isBrowseTableOpen, setIsBrowseTableOpen, activeWindow, setActiveWindow } = useCorpus();
    const [sortKey, setSortKey] = useState<SortKey>('author');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
            default={{ x: 50, y: 50, width: 800, height: 500 }}
            minWidth={400}
            minHeight={300}
            cancel=".no-drag"
            className="corpus-browse-table-rnd"
            style={{ zIndex: activeWindow === 'browse' ? 2600 : 1700 }}
            onDragStart={() => setActiveWindow('browse')}
            onResizeStart={() => setActiveWindow('browse')}
        >
            <div className="table-card glassmorphism">
                <div className="table-header drag-handle" onMouseDown={() => setActiveWindow('browse')}>
                    <div className="table-title">
                        <i className="fas fa-list"></i> Aktivt Korpus ({activeBooksMetadata.length} bøker)
                    </div>
                    <div className="table-controls no-drag">
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
