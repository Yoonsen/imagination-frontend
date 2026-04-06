# Agent Handoff

Bruk denne malen når du overleverer arbeid mellom backend/frontend (eller mellom to kodemodeller).

## 1) Snapshot

- **Dato:** YYYY-MM-DD
- **Repo:** `imagination-frontend` / `sqlite-backend`
- **Branch:** `<branch-navn>`
- **Commit SHA:** `<sha>`
- **Ansvarlig agent/modell:** `<navn>`

## 2) Hva ble endret

- Kort punktliste over endringer.
- Fokuser på atferd, ikke implementasjonsdetaljer.

## 3) API-kontrakt (hvis relevant)

- **Endepunkt:** `METHOD /path`
- **Status:** `ny` / `oppdatert` / `deprecated` / `fjernet`
- **Request-endringer:** felter, typer, defaults
- **Response-endringer:** felter, typer, nullability
- **Breaking:** `ja/nei` + hvorfor

## 4) Eksempel (minimum ett kall)

### Request

```json
{
  "example": "payload"
}
```

### Response

```json
{
  "example": "response"
}
```

## 5) Verifisering utført

- [ ] Enhetstester
- [ ] Integrasjonstester
- [ ] Manuell API-smoke
- [ ] Frontend build/lint
- [ ] GitHub Actions grønn

Skriv kort hva som faktisk ble kjørt.

## 6) Frontend TODO (hvis backend-handoff)

- [ ] Oppdater klienttyper
- [ ] Oppdater API-kall/payload
- [ ] Oppdater feiltilstander i UI
- [ ] Verifiser med ekte API-data

## 7) Backend TODO (hvis frontend-handoff)

- [ ] Bekreft feltnavn/typer i OpenAPI
- [ ] Legg inn kontraktstest for endringen
- [ ] Dokumenter breaking/non-breaking i changelog

## 8) Risikopunkter

- Hva kan ryke?
- Hvilke funksjoner berøres indirekte?
- Hvilke antakelser er gjort?

## 9) Handoff til neste agent

- **Neste oppgave:**
- **Input som må brukes:** (f.eks. denne filen + commit SHA + OpenAPI)
- **Definition of done:**
