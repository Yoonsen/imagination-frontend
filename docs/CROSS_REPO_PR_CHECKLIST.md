# Cross-Repo PR Checklist

Bruk denne sjekklisten når en PR i frontend påvirker backend (eller motsatt).

- [ ] Endringen beskriver tydelig om den er backend-, frontend- eller begge deler.
- [ ] API-endringer er dokumentert i `docs/API_CHANGELOG.md`.
- [ ] Handoff er oppdatert i `docs/AGENT_HANDOFF.md`.
- [ ] OpenAPI er oppdatert (hvis API-kontrakt er endret).
- [ ] Frontend bruker oppdatert payload/response-felter.
- [ ] Breaking changes er tydelig merket i PR-beskrivelsen.
- [ ] Deploy-rekkefølge er avklart (`backend -> frontend` ved kontraktsendring).
- [ ] Manuell smoke-test er kjørt mot ekte API.
- [ ] GitHub Actions er grønn.

## Kort PR-mal (valgfri)

```md
## Scope
- [ ] Frontend
- [ ] Backend
- [ ] Begge

## API impact
- Endepunkt(er):
- Breaking: ja/nei
- Migrering:

## Test
- Hva ble kjørt:
- Resultat:
```
