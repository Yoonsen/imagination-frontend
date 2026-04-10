# Posisjonell kontekstlesning

Kort metode-notat for arbeid med stedsekvenser, geo-konkordans og modellbasert kontekst i litterære korpus.

## 1) Påstand

Det tradisjonelle skillet mellom nærlesing og fjernlesing er utilstrekkelig når tekst er forankret i sekvensielle bokposisjoner.

- Klassisk "fjernlesing" er ofte aggregert kontekstkonstruksjon (kollokasjoner, topic-modeller, embeddings, LLM-sammendrag).
- Klassisk "nærlesing" er lokal tolkning av konkrete tekststeder.
- Med sekvensforankring kan vi koble disse direkte:
  - modellering i aggregat
  - tilbakeføring til eksakt bokposisjon
  - lokal verifikasjon i tekstsnitt

Dette gir en ny arbeidsform: **posisjonell kontekstlesning**.

## 2) Definisjon

**Posisjonell kontekstlesning** er en metode der beregnede kontekster (statistiske eller generative) kobles tilbake til konkrete tekstposisjoner i en boksekvens, slik at fortolkning skjer i et kontinuum mellom aggregat og punkt.

## 3) Hvorfor dette er nyttig

Metoden gjør tre ting samtidig:

1. Bevarer skalerbarheten fra fjernlesing.
2. Bevarer etterprøvbarheten fra nærlesing.
3. Gjør overgangen mellom nivåene eksplisitt og reproduserbar.

I praksis: en forsker kan gå fra "mønster" til "tekststed" uten å miste metodisk sporbarhet.

## 4) Operasjonell pipeline

1. **Kontekstkonstruksjon**
   - bygg signaler: geo-konkordans, kollokasjoner, topic-fordeling, sentiment, LLM-etiketter
2. **Sekvensforankring**
   - knytt signalene til `book_id + pos` (eller `seqStart`)
3. **Romlig kobling**
   - map `pos` til `place_id` / koordinat (når relevant)
4. **Kumulativ visning**
   - vis utvikling gjennom teksten (0% -> 100%)
5. **Lokal verifikasjon**
   - åpne snippet/fulltekst ved valgt punkt
6. **Tilbakekobling**
   - juster modeller/hypoteser basert på funn i punktlesning

## 5) Forslag til begreper

- **Aggregatnivå**: modellert kontekst (tematisk/semantisk/affektiv)
- **Punktnivå**: konkret tekstlokalitet (`book_id`, `pos`)
- **Koblingsnivå**: strukturen som binder aggregat og punkt (sekvens + steds-ID)

Alternativ terminologi:

- "Digital nærlesning" (fokus på lokal lesning med beregningsstøtte)
- "Sekvensiell kontekstlesning" (fokus på posisjonell progresjon)

## 6) Forskningsspørsmål som blir mulige

- Hvordan endres stedlige mønstre gjennom bokas progresjon?
- Hvordan varierer sentiment langs reiseruten i en fortelling?
- Når divergerer modellert tema fra lokal teksttolkning?
- Hvilke steder fungerer som "overgangsnoder" i narrativ geografi?

## 7) Minimumskrav til data

- Stabil `book_id`
- Posisjonsfelt (`pos` eller `seqStart`)
- Stedsnøkkel (`geonames/internal`) når romlig analyse inngår
- Reproduserbar mapping fra modellresultat -> tekstpunkt

## 8) Metodegevinst

Skillet nær/fjern kan omformuleres fra et enten/eller til en iterativ praksis:

- fjernlesing som **hypotesegenerering**
- posisjonell kobling som **lokaliseringsmekanisme**
- nærlesing som **tolkningsvalidering**

Resultatet er en metodisk sirkel der kontekst ikke bare bygges, men også gjenvinnes og testes på punktnivå.

## 9) Kort formulering til prosjekttekst

"Vi utvikler en metode for posisjonell kontekstlesning der beregnede kontekster (kollokasjon, tema, sentiment, LLM-annotasjon) forankres i bokas sekvensielle punkter. Metoden knytter aggregert mønsteranalyse til verifiserbar punktlesning, og redefinerer forholdet mellom fjern- og nærlesing som en iterativ, sporbar forskningsprosess."

