# Fitman (web-app)

Eén app voor Fitman, Fitman Max en Fit Woman. Werkt op de iPhone (Safari, "Zet op beginscherm"), op Android in de browser, en binnen de Android-app Fitman, die dezelfde pagina laadt en er Samsung Health (Health Connect) aan toevoegt.

Geen build-stap: gewone HTML, CSS en JavaScript-modules. Alle gegevens staan in `localStorage` op de telefoon; er gaat niets naar een server.

## Indeling

Vier tabs plus instellingen achter het tandwiel:

| Tab | Wat |
|---|---|
| Training | de training van vandaag, sets loggen, rusttimer, weegkaart op weegdag |
| Schema | Huidig · Mijn schema's · Nieuw schema (vragenlijst) |
| Voortgang | Training (weken op schema, records, per oefening) en Lichaam (gewicht, stappen, omtrek) |
| Coach | advies, Plan je week, cyclus, kennis |
| Instellingen | kleurenpalet (groen, blauw, wit, roze), rusttimer, RIR, supersets/dropsets, weegdag, omtrekmaten, back-up, feedback, bronnen |

Wat vroeger een aparte app was, is nu een startschema plus instellingen: Full body 2 dagen (Fitman), Billen & benen 3 dagen (Fit Woman) en Push/pull/legs 6 dagen (Fitman Max).

## Bestanden

| Bestand | Wat |
|---|---|
| `index.html`, `style.css` | pagina en de vier kleurenpaletten (contrast WCAG AA) |
| `logic.js` | trainingslogica (overgezet uit de Kotlin-code), startschema's, set-opbouw, weekplanner, coachtips |
| `generator.js` | schemagenerator achter de vragenlijst |
| `library.js` | oefeningen en bronnen |
| `app.js` | schermen, instellingen, back-up en de koppeling met de Android-app |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline werken en het beginscherm-icoon |

## Gegevens overzetten

- **Fit Woman**: staat op hetzelfde adres. Bij de eerste start leest Fitman `fitwoman.v1` en bewaart alles onder `fitman.v1` (de oude sleutel blijft staan als reserve). Thema roze, RIR en supersets aan.
- **Oude Android-app (Fitman en Fitman Max)**: de nieuwe Android-app geeft het oude gegevensbestand door; het welkomstscherm biedt "Overzetten" aan. Een back-up uit de oude app kan ook via Instellingen › Terugzetten.

## Koppeling met de Android-app

De Android-app zet `window.FitmanAndroid` klaar met `legacyData()`, `flavor()`, `healthStatus()`, `readHealth(dagen)`, `requestHealth()`, `keepScreenOn(aan)`, `vibrate(json)`, `setTheme(kleur, licht)`, `shareText(titel, tekst)` en `saveFile(naam, tekst)`. Antwoorden van Health Connect komen binnen via `window.onFitmanHealth(json)`.

## Lokaal draaien

`python3 -m http.server` in deze map en open `http://localhost:8000`. Na een wijziging: verhoog `CACHE` in `sw.js`, zodat telefoons de nieuwe versie ophalen.
