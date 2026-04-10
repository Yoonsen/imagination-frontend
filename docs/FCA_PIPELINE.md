# FCA pipeline for geo-konk and corpus exploration

This note sketches a practical, incremental pipeline for using Formal Concept Analysis (FCA) in the app.

## 1) Motivation

Current geo-concordance is already strong for retrieval and map highlighting. FCA can add a structure layer:

- discover stable co-occurrence patterns
- move from "hit lists" to "concepts"
- support narrative exploration (places, docs, keywords as linked views)

## 2) Core FCA contexts

### A. Place x Document

- Objects (`G`): `place_id`
- Attributes (`M`): `dhlabid`
- Incidence (`I`): place occurs in document (`mentions > 0` -> `1`)

Interpretation:

- Extent = set of places sharing a document profile
- Intent = set of documents that share the place set

### B. Place x Keyword-group

- Objects (`G`): `place_id`
- Attributes (`M`): keyword groups from geo-konk queries
- Incidence (`I`): place has at least one hit for that group

Interpretation:

- semantic geography (which places "belong" to thematic groups)

### C. Document x Keyword-group (optional baseline)

- Objects (`G`): `dhlabid`
- Attributes (`M`): keyword groups
- Incidence (`I`): document has at least one hit for group

Interpretation:

- thematic corpus structure (non-spatial baseline)

## 3) Data model for first implementation

Use a compact binary incidence format per context:

```json
{
  "contextId": "place_x_doc",
  "objects": ["geonames:123", "internal:55"],
  "attributes": ["100617608", "100617609"],
  "incidence": [
    [0, 0], [0, 1], [1, 1]
  ],
  "meta": {
    "source": "geo_concordance_export",
    "query": "havari, forlis, forliste",
    "proximity": 8
  }
}
```

Notes:

- `incidence` is sparse (`[objectIdx, attributeIdx]`)
- store IDs as strings to preserve typed keys (`geonames:` / `internal:`)

## 4) Minimal algorithm path

Start with a support-limited concept extraction:

1. Build incidence matrix from current geo-konk result set.
2. Remove low-support rows/cols (configurable thresholds).
3. Run FCA extraction (`Next Closure` or existing FCA library).
4. Keep top-N concepts by:
   - extent size
   - intent size
   - stability proxy (later)

For an MVP, exact lattice completeness is less important than fast, interpretable concept slices.

## 5) UI integration plan

### Phase 1: Export only

- Extend geo-konk export with an FCA-ready sheet or JSON attachment:
  - `Objects`
  - `Attributes`
  - `Incidence`
  - `Concepts` (if precomputed)

### Phase 2: In-app concept list

- New panel: `Concept Explorer`
- Each concept row:
  - extent size
  - intent size
  - top place labels
  - top doc IDs

Actions:

- "Show extent on map"
- "Load intent as corpus"
- "Seed geo-konk query from concept"

### Phase 3: Cross-context hopping

- From `place x keyword` concept -> jump to `place x doc` subcontext
- From `place x doc` concept -> load document subset in corpus builder

## 6) Performance strategy

- Build contexts from already filtered active corpus when possible.
- Cache by signature:
  - active `dhlabids`
  - query groups
  - proximity
  - max places
- Use sparse storage and bounded concept extraction (`top-N`).

## 7) Validation checklist

- Monotonic behavior for OR groups (`a, b` should not be less than `a`, cap caveat).
- Deterministic context signatures.
- Export/import roundtrip:
  - geo-konk export -> corpus import via `dhlabid` remains valid.
- Spot-check 3 known books with known route/place patterns.

## 8) Research-facing extensions (later)

- Stability / robustness metrics for concepts.
- Triadic extensions (doc-place-keyword) via scaled contexts.
- Time slicing:
  - concept drift by year intervals
  - temporal concept lineage

## 9) Immediate next step

Implement a tiny context builder from current geo-konk rows:

- output: `place x doc` sparse incidence
- export: `FCA_Context` sheet
- no lattice yet, just clean context extraction and reproducible signatures

This creates a strong base for both app features and formal analysis.

