# API Changelog

Bruk dette dokumentet for å beskrive kontraktsendringer mellom backend og frontend.
Hold det kort, konkret og søkbart.

---

## YYYY-MM-DD

### Added

- `METHOD /path` - kort beskrivelse av ny funksjon.

### Changed

- `METHOD /path` - hva som er endret i request/response.
  - request: `<felt> <type>`, default `<verdi>`
  - response: `<felt> <type|null>`
  - impact frontend: `lav/middels/høy`

### Deprecated

- `METHOD /path` - hva som fases ut, og anbefalt erstatning.

### Removed

- `METHOD /path` - fjernet fra API, dato for fjerning.

### Breaking Changes

- Beskriv eksplisitt breaking endringer her.
- Legg ved migreringsnote:
  - før: `<gammel payload>`
  - etter: `<ny payload>`

### Verification

- [ ] OpenAPI oppdatert
- [ ] Kontraktstest(er) oppdatert
- [ ] Frontend verifisert mot ekte endpoint

---

## Konvensjoner

- Én oppføring per dato.
- Skriv endepunkt på format `METHOD /path`.
- Bruk `Breaking Changes` kun når frontend/backend faktisk må endres.
