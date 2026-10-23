# CLAUDE.md – FizyoLern

Anleitung für Claude (und andere KI-Agenten), die an diesem Repo arbeiten. Vor jeder Änderung lesen.

## Was das ist
FizyoLern ist eine offline-fähige Lern-PWA für die Physiotherapie-Ausbildung (VIDACTA Essen) von Escan Dönmez.
Live: https://escan-dnmz.github.io/fizyolern/ (GitHub Pages, Branch `main`, Root-Ordner).
Escan nutzt sie täglich auf dem iPhone (Start: 15.10.2026). Die Prüfungen sind auf Deutsch.

## Kommunikation mit Escan
- Antworten an Escan auf **Türkisch**, kurz und konkret. Er liest oft am Handy.
- Fachinhalte (Fragen, Musterlösungen, Begriffe) bleiben **Deutsch/Latein**. Nicht ins Türkische übersetzen.
- Trennbare Verben in Lerninhalten kennzeichnen (z. B. `auf|klären`).

## Architektur
- **Kein Framework, kein Build-Schritt.** Reines HTML/CSS/JS (ES-Module). `index.html` → `js/app.js`.
- `js/data/*.js` = Lerninhalte (Anatomie, Landmarks, Fragen, Lektionen, Wörter, Fälle). `js/data/lessons.js` wird von `tools/build_lessons.py` erzeugt – nicht von Hand groß umbauen.
- `js/store.js` = Fortschritt in `localStorage` (`fizyo.v1`), inkl. Migrationen (`mig`-Liste). Alte Stände müssen weiter laden.
- `js/private.js` / `js/notion.js` = private Daten (Wochenplan, ✗-Fehler, Hausaufgaben, Prüfungen), live aus Notion gelesen (read-only), nur auf dem Gerät gespeichert.
- `js/anatomy3d.js` + `models/*.glb` (Draco) + `vendor/` (Three.js) = 3D-Modell.
- Oberflächentexte nur in `js/strings.js` als `key: ['Türkçe', 'English']`, über `t()` aus `js/i18n.js`. Keine festen UI-Strings im Code.
- Kommentare im Code sind auf Deutsch – so weitermachen.

## Pflicht nach jeder Änderung
1. **`python3 tools/bump_sw.py`** – erhöht die Version in `sw.js`. Ohne das lädt das Handy die neue Version nicht.
2. Neue JS-Datei? In die `FILES`-Liste von `sw.js` eintragen, dann **`python3 tools/check_sw.py`** (muss „fehlen: keine“ und „nicht gecacht: keine“ melden).
3. **Alle Tests laufen lassen:** `for t in tools/test_*.mjs; do node $t; done` – alle müssen bestehen. Für neue Logik einen Test im gleichen Stil ergänzen (eigene `ok()`-Funktion, kein Test-Framework).
4. Inhalte geändert? **`node tools/audit_content.mjs`** – keine neuen Auffälligkeiten einführen.
5. In Commit/Antwort kurz sagen, was Escan am Handy prüfen soll.

## Datenschutz (nicht verhandelbar)
- **Niemals** Lehrernamen, Stundenplan, persönliche Fehlerlisten, Notion-Links oder Checklisten der Lehrkräfte ins öffentliche Repo. Alles Private liegt in `private/` (gitignored).
- Escan nie nach seinem Notion-Key (`ntn_…`) fragen und ihn nie in Dateien schreiben.
- Die Content-Security-Policy in `index.html` erlaubt Netzwerk nur zu `api.notion.com`. Nicht aufweichen, keine externen CDNs/Tracker. Inline-Script-Hash bei Änderung am Inline-Script anpassen.
- Importierte Daten (Backup, Notion) werden in `private.js` feldweise geprüft. Neue Felder genauso validieren.

## Lernlogik – bekannte Entscheidungen
- Neue Fragen kommen **nur** aus der Notion-Datenbank „FizyoLern Sorular“ (bzw. Fragen/Questions). Die App erzeugt keine Fragen aus Notizen.
- Ein Fehler gilt als gelernt nach **2 verschiedenen Tagen** richtig. Fällige Fehler haben feste Plätze im Morgentest.
- Tests dürfen **neue Themen nicht** wegen Fehlerwiederholung vernachlässigen – neue Themen des Tages müssen vorkommen.
- Berichte: Gesamtzahlen seit Start klar von „heute falsch“ trennen. Immer berücksichtigen, dass die App erst seit 15.10.2026 läuft.
- Fächernamen exakt: Anatomie, Physiologie, PT Grundlagen, PT Befund, O/C, Trainingslehre, KMT, Hygiene, PPS.

## Doku synchron halten
Bei neuen Funktionen oder geänderten Notion-Formaten auch `README.md`, `llms.txt`, `docs/ai-setup.md` und `docs/notion-template.md` anpassen – andere Nutzer und ihre KIs richten sich danach.

## Git
- Kleine, thematische Commits mit klarer Nachricht. Direkt auf `main` ist ok (Single-Maintainer), außer Escan wünscht einen Branch/PR.
- Keine großen Binärdateien neu einchecken ohne Grund (Modelle über `tools/compress_models.sh`).
