# Fit Woman

Web-app voor de iPhone (Safari, "Zet op beginscherm"), gebouwd op de functies van Fitman Max: eigen schema, RIR per set, supersets, dropsets, dubbele progressie en een coach. Focus op billen en benen, 3 dagen per week, met een knop om uit te bouwen naar 4.

Geen build-stap: gewone HTML, CSS en JavaScript-modules. Alle gegevens staan in `localStorage` op de telefoon; er gaat niets naar een server.

| Bestand | Wat |
|---|---|
| `index.html`, `style.css` | pagina en roze/paars thema (contrast WCAG AA op de donkere achtergrond) |
| `logic.js` | trainingslogica, overgezet uit de Kotlin-code van Fitman Max, plus startschema en coachtips |
| `library.js` | oefeningen en bronnen, gegenereerd uit `Library.kt` en `Sources.kt` |
| `app.js` | de vijf schermen: Training, Schema, Progressie, Lichaam, Coach |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline werken en het beginscherm-icoon |

## Startschema

- **Billen & benen A**: hip thrust, squat, seated leg curl, hip abduction (+ dropset), calf raise
- **Bovenlichaam**: lat pulldown, incline DB press, cable row, lateral raise, curl + triceps (superset)
- **Billen & benen B**: Romanian deadlift, Bulgarian split squat, leg press, 45° back extension, cable kickback
- **4e dag (optioneel)**: bovenlichaam + billen, lichter en met meer reps

Ongeveer 20 sets per week voor de bilspieren (direct 1, meehelpend 0,5).

## Lokaal draaien

`python3 -m http.server` in deze map en open `http://localhost:8000`. Na een wijziging: verhoog `CACHE` in `sw.js`, zodat telefoons de nieuwe versie ophalen.
