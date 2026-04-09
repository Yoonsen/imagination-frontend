import React, { useState, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import Select from 'react-select';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import * as XLSX from 'xlsx';
import { useCorpus } from '../context/CorpusContext';
import { useWindowLayout } from '../utils/windowLayout';
import './CorpusBuilderCard.css';

export const CorpusBuilderCard: React.FC = () => {
    const {
        allBooks,
        setActiveDhlabids,
        activeDhlabids,
        isCorpusBuilderOpen,
        setIsCorpusBuilderOpen,
        activeWindow,
        setActiveWindow,
        API_URL
    } = useCorpus();
    const [operationMode, setOperationMode] = useState<'add'|'intersect'|'remove'>('add');
    
    // Form states
    const [yearRange, setYearRange] = useState<[number, number]>([1814, 1905]);
    const [selectedCategories, setSelectedCategories] = useState<{label: string, value: string}[]>([]);
    const [selectedAuthors, setSelectedAuthors] = useState<{label: string, value: string}[]>([]);
    const [selectedTitles, setSelectedTitles] = useState<{label: string, value: string}[]>([]);
    const [keywords, setKeywords] = useState<string>('');
    const [isKeywordSearching, setIsKeywordSearching] = useState(false);
    const { layout, onDragStop, onResizeStop } = useWindowLayout({
        key: 'builder',
        defaultLayout: { x: 30, y: 30, width: 360, height: 620 },
        minWidth: 300,
        minHeight: 360
    });

    // Dynamically calculate options based on allBooks AND mutually exclusive active filters
    const options = useMemo(() => {
        const categories = new Set<string>();
        const authors = new Set<string>();
        const titles = new Set<string>();
        
        const catFilterSet = new Set(selectedCategories.map(c => c.value));
        const authFilterSet = new Set(selectedAuthors.map(a => a.value));
        const titleFilterSet = new Set(selectedTitles.map(t => t.value));

        const inYearRange = (year: number | null) => year !== null && year >= yearRange[0] && year <= yearRange[1];

        allBooks.forEach(b => {
            // First pass: does the book even fall inside the visual slider?
            if (!inYearRange(b.year)) return;

            // Check if the book passes each individual constraint
            const catOk = catFilterSet.size === 0 || (b.category && catFilterSet.has(b.category));
            const authOk = authFilterSet.size === 0 || (b.author && authFilterSet.has(b.author));
            const titleOk = titleFilterSet.size === 0 || (b.title && titleFilterSet.has(b.title));

            // Populate options: A dropdown option is available if the book passes ALL *other* constraints
            if (authOk && titleOk && b.category) categories.add(b.category);
            
            if (catOk && titleOk && b.author) authors.add(b.author);
            
            if (catOk && authOk && b.title) titles.add(b.title);
        });

        return {
            categories: Array.from(categories).sort().map(c => ({value: c, label: c})),
            authors: Array.from(authors).sort().map(a => ({value: a, label: a})),
            titles: Array.from(titles).sort().map(t => ({value: t, label: t}))
        };
    }, [allBooks, yearRange, selectedCategories, selectedAuthors, selectedTitles]);

    const handleUpdate = () => {
        // Filter allBooks locally based on current dropdowns & slider
        let filtered = allBooks.filter(b => {
            if (b.year === null) return false;
            if (b.year < yearRange[0] || b.year > yearRange[1]) return false;
            
            if (selectedCategories.length > 0) {
                if (!b.category || !selectedCategories.map(c => c.value).includes(b.category)) return false;
            }
            if (selectedAuthors.length > 0) {
                if (!b.author || !selectedAuthors.map(a => a.value).includes(b.author)) return false;
            }
            if (selectedTitles.length > 0) {
                if (!b.title || !selectedTitles.map(t => t.value).includes(b.title)) return false;
            }
            return true;
        });

        applyIdsWithMode(filtered.map(b => b.dhlabid));
    };

    const handleKeywordSearch = async () => {
        if (!keywords.trim()) return;
        
        setIsKeywordSearching(true);
        try {
            const terms = keywords.split(',').map(k => k.trim()).filter(Boolean);
            if (terms.length === 0) return;

            const responses = await Promise.all(
                terms.map((term) =>
                    fetch(`${API_URL}/concordance`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wordA: term,
                            window: 5,
                            before: 5,
                            after: 5,
                            perBook: 20,
                            totalLimit: 5000
                        })
                    })
                )
            );
            const failed = responses.find((res) => !res.ok);
            if (failed) throw new Error("Keyword search failed");

            const datasets = await Promise.all(responses.map((res) => res.json()));
            const foundIds = Array.from(
                new Set(
                    datasets
                        .flatMap((data: any) => data.rows || [])
                        .map((row: any) => row.bookId)
                        .filter((id: any) => typeof id === 'number')
                )
            ) as number[];

            if (foundIds.length === 0) {
                alert("Ingen treff på disse nøkkelordene.");
            } else {
                applyIdsWithMode(foundIds);
            }
        } catch (err) {
            console.error(err);
            alert("Feil ved søk i innhold. Sjekk tilkoblingen til API.");
        } finally {
            setIsKeywordSearching(false);
        }
    };

    const applyIdsWithMode = (incomingIds: number[]) => {
        if (operationMode === 'add') {
            if (activeDhlabids.length === 0) {
                setActiveDhlabids(incomingIds);
            } else {
                const added = new Set([...activeDhlabids, ...incomingIds]);
                setActiveDhlabids(Array.from(added));
            }
        } else if (operationMode === 'intersect') {
            const currentSet = new Set(activeDhlabids);
            const intersected = incomingIds.filter(id => currentSet.has(id));
            setActiveDhlabids(Array.from(intersected));
        } else if (operationMode === 'remove') {
            const removeSet = new Set(incomingIds);
            const remaining = activeDhlabids.filter(id => !removeSet.has(id));
            setActiveDhlabids(remaining);
        }
    };

    const handleClear = () => {
        setYearRange([1814, 1905]);
        setSelectedCategories([]);
        setSelectedAuthors([]);
        setSelectedTitles([]);
    }

    const importCorpus = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet);
                
                // Ekstraher dhlabid fra array av objekter
                const ids: number[] = [];
                for (const row of rows as any[]) {
                    if (row.dhlabid) {
                        ids.push(Number(row.dhlabid));
                    }
                }
                
                if (ids.length > 0) {
                    applyIdsWithMode(ids);
                } else {
                    console.warn("Fant ingen 'dhlabid' kolonne i opplastet Excel fil.");
                }
            } catch (err) {
                console.error("Invalid Excel corpus", err);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    if (!isCorpusBuilderOpen) return null;

    return (
        <Rnd
            size={{ width: layout.width, height: layout.height }}
            position={{ x: layout.x, y: layout.y }}
            minWidth={300}
            minHeight={360}
            cancel=".no-drag"
            dragHandleClassName="drag-handle"
            className="corpus-builder-card"
            style={{ zIndex: activeWindow === 'builder' ? 2600 : 1700 }}
            onDragStart={() => setActiveWindow('builder')}
            onResizeStart={() => setActiveWindow('builder')}
            onDragStop={onDragStop}
            onResizeStop={onResizeStop}
        >
            <div className="corpus-builder-shell">
            <div className="card-header drag-handle" onMouseDown={() => setActiveWindow('builder')}>
                <div className="card-title">
                    <i className="fas fa-tools"></i> Corpus Builder
                </div>
                <div className="card-controls no-drag">
                    <button onClick={() => setIsCorpusBuilderOpen(false)} title="Minimer til chip">
                        <i className="fas fa-window-minimize"></i>
                    </button>
                </div>
            </div>

            <div className="card-body no-drag">
                    <div className="toolbar mb-2">
                        <button className="btn-text" onClick={handleClear}>Tøm alle filtre</button>
                        <button className="btn-text danger" onClick={() => setActiveDhlabids([])}>
                            Nullstill korpus <i className="fas fa-trash-alt ms-1"></i>
                        </button>
                    </div>

                    <div className="form-group mb-3">
                        <label>Årsspenn ({yearRange[0]} - {yearRange[1]})</label>
                        <div style={{ padding: '0 8px' }}>
                            <Slider 
                                range 
                                min={1800} 
                                max={2025} 
                                value={yearRange} 
                                onChange={(val) => setYearRange(val as [number, number])} 
                                trackStyle={[{ backgroundColor: '#4B6CB7' }]}
                                handleStyle={[{ borderColor: '#4B6CB7', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }, { borderColor: '#4B6CB7', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }]}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Metadata</label>
                        <Select 
                            isMulti 
                            options={options.categories} 
                            value={selectedCategories}
                            onChange={(val) => setSelectedCategories(val as any)}
                            placeholder="Kategorier..."
                            className="react-select-container mt-1"
                            classNamePrefix="react-select"
                        />
                        <Select 
                            isMulti 
                            options={options.authors} 
                            value={selectedAuthors}
                            onChange={(val) => setSelectedAuthors(val as any)}
                            placeholder="Forfattere..."
                            className="react-select-container mt-2"
                            classNamePrefix="react-select"
                        />
                        <Select 
                            isMulti 
                            options={options.titles} 
                            value={selectedTitles}
                            onChange={(val) => setSelectedTitles(val as any)}
                            placeholder="Titler..."
                            className="react-select-container mt-2 mb-2"
                            classNamePrefix="react-select"
                        />
                    </div>

                    <div className="action-row mt-3">
                        <div className="btn-group">
                            <button className={`btn-op outline ${operationMode === 'add' ? 'active' : ''}`} onClick={() => setOperationMode('add')} title="Start / Legg til">+</button>
                            <button className={`btn-op outline ${operationMode === 'intersect' ? 'active' : ''}`} onClick={() => setOperationMode('intersect')} title="Behold kun de som overlapper">&#38;</button>
                            <button className={`btn-op outline ${operationMode === 'remove' ? 'active' : ''}`} onClick={() => setOperationMode('remove')} title="Fjern fra aktivt korpus">-</button>
                        </div>
                        <button className="btn-primary flex-grow-1" onClick={handleUpdate}>
                            <i className="fas fa-sync-alt me-2"></i> Filter
                        </button>
                    </div>

                    <div className="form-group mt-3">
                        <label>Innholdsfilter (Nøkkelord)</label>
                        <div className="d-flex gap-2">
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="f.eks krig, fred" 
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleKeywordSearch()}
                            />
                            <button 
                                className="btn-primary" 
                                style={{ padding: '4px 12px' }} 
                                onClick={handleKeywordSearch}
                                disabled={isKeywordSearching}
                            >
                                {isKeywordSearching ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                            </button>
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>Søker i fulltekst via concordance-endepunktet</small>
                    </div>

                    <div className="action-row mt-3 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <label className="btn-op outline flex-grow-1" style={{ fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', padding: '6px' }} title="Last opp regneark for modifisering">
                            <i className="fas fa-file-upload"></i> Import
                            <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={importCorpus} />
                        </label>
                    </div>
            </div>
            </div>
        </Rnd>
    );
};
