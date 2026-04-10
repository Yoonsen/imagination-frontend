# Sidecar mismatch note: `book/sequence` vs geo concordance

## Summary

We have a reproducible mismatch where a place is present in:

- map places (`/api/places`)
- place concordance (`/or_query` / PlaceSummaryCard)

but missing from:

- book sequence (`/api/geo/book/sequence`)

This suggests a sidecar construction gap for sequence extraction.

## Repro case

- Book: `Tre i Norge` (`dhlabid: 100623584`)
- Place: `Montenegro`
- Place ID: `3194884` (geonames)

### Evidence from frontend behavior

- PlaceSummaryCard for `Montenegro` shows:
  - `Forekomster: 1`
  - `Unike bøker: 1`
  - `Steds-ID: 3194884`
  - snippet in `Tre i Norge`

### API checks

1) `POST /api/places` with `dhlabids=[100623584]`:

- contains place with:
  - `id: "3194884"`
  - `token: "Montenegro"`
  - `frequency: 1`

2) `POST /api/places/details` with `token="Montenegro"` and `dhlabids=[100623584]`:

- returns book `100623584` with `mentions: 1`

3) `POST /api/geo/book/sequence` with `bookId=100623584`:

- returns ~606 rows
- no row with:
  - `placeKey == "3194884"`
  - `geonamesId == 3194884`
  - or surface/canonical text match for Montenegro

## Expected behavior

If a place has geo concordance hits in a book and appears in `/api/places` for that same book, it should also appear in `/api/geo/book/sequence` for that book (same ID namespace/normalization).

## Likely cause

Sidecar build/transform for `book/sequence` is dropping or remapping some geo rows inconsistently compared to concordance/places pipeline.

## Suggested backend checks

- Compare source rows for `bookId=100623584` and key `3194884` across:
  - sequence builder input
  - concordance resolver input
  - places aggregation input
- Verify namespace consistency (`geonames` vs `internal`) and ID normalization.
- Verify no filtering step excludes low-frequency singleton rows in sequence export.
