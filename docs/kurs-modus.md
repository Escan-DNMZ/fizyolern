# Kurs-Modus (class version) – plan

> Status: **plan + prototype**. Steps marked 🟢 work today without any school approval.
> Steps marked 🔒 need the school (Microsoft tenant admin, data protection officer).
> All example data in this repo is made up.

FizyoLern today works best for one person: it needs a private Notion workspace and a
Notion key, and the questions come from that person's own Notion. Kurs-Modus lets a whole
class use the app on their school iPads **without Notion**, fed by one central,
teacher-reviewed question bank and the class's own plan.

**Top rule: nothing that works today may break.** Kurs-Modus is an *addition*:

- new files (`js/kurs.js`, `tools/build_kurs.mjs`, `tools/redaktion/`);
- only small, guarded hooks in existing code (each one is a no-op when no course pack is installed);
- the feature is **invisible** unless a course pack is installed (or the setup link `#/kurs` is opened);
- the personal Notion flow, `fizyo.v1` progress and `fizyo.private` data stay exactly as they are.

---

## a) Content model

```
               ┌─────────────────────────── course pack (one JSON file per class) ──┐
shared bank ──►│ bank:  rows (Kern / MCQ / Offen / Wort) per subject + lesson       │
(per school    │        reused by every class of the same year                      │
 year)         │                                                                    │
class part ───►│ class: id, name, year                                              │
(per class)    │ plan:  weeks (same shape as the Notion "Weekly Plan")              │
               │ ck:    Checkliste learning goals, ✅ dates = covered lessons        │
               │ exams: exams and homework dates                                    │
               └────────────────────────────────────────────────────────────────────┘
```

- **Shared bank**: one bank per school year (`bank.id`, e.g. `jahr1`). A slide deck is turned
  into questions once and reused by all classes of that year (1A, 1B …). Rows use the same
  fields as the Notion database "FizyoLern Questions" (see `docs/ai-setup.md`), so the app's
  existing lesson logic (`js/lessons.js → mergeLessons`) handles them unchanged.
- **Class part**: weekly plan, Checkliste items (with `done` + `date` = when the lesson was
  covered), exam and homework dates. This is what makes "new topics of the day" and the
  morning test fit the class.
- **Course pack** = shared bank + class part, one validated JSON file.

### Course pack format (version 1)

```jsonc
{
  "kind": "fizyolern-kurs",
  "version": 1,
  "id": "beispielschule-1a",              // [a-z0-9-], stable per class
  "built": "2026-11-01T09:00:00Z",        // ISO time of the build
  "class": { "id": "1a", "name": "Klasse 1A", "year": 1 },
  "update": "https://…/kurs-1a.json",     // optional: where the app re-checks for a newer pack
  "bank": {
    "id": "jahr1",
    "rows": [
      {
        "h": "3f9a0c1d2e4b5a69",          // 16 hex chars, stable id (hash of the draft id)
        "fach": "Trainingslehre",          // exact subject name (CLAUDE.md list)
        "lektion": "Kraft – Teil 2",
        "typ": "MCQ",                      // Kern | MCQ | Offen | Wort
        "frage": "…", "antwort": "…",
        "ablenker": ["…", "…", "…"],       // MCQ only
        "kw": ["…"],                       // Offen only (key terms, "a|b" = alternatives)
        "erkl": "…",                       // TR helper text (machine translated)
        "erklEn": "…",                     // EN helper text (machine translated)
        "antwortEn": "…",                  // Wort only: EN translation
        "ck": "ck:0123456789abcdef",       // optional link to a Checkliste goal
        "auto": true,                      // helper texts are machine translated
        "created": "2026-10-28T08:00:00Z"  // optional: new topics get priority in tests
      }
    ]
  },
  "plan":  { "weeks": [ /* same shape as fizyo.private weeks */ ] },
  "ck":    [ { "id": "ck:…", "fach": "…", "sec": "…", "text": "…", "done": true, "date": "2026-10-20" } ],
  "exams": [ { "typ": "Sınav", "fach": "Anatomie", "topic": "Becken", "date": "2026-11-20" } ]
}
```

Rules (enforced by `js/kurs.js → cleanKurs`, tested in `tools/test_kurs.mjs`):

- every field is checked for type and length; unknown fields are dropped;
- `h` must be 16 hex characters, `ck` ids `ck:` + 16 hex, dates `YYYY-MM-DD`;
- MCQ rows need an answer and exactly 3 different distractors, Offen rows need key terms;
- `update` must be an `https://` URL; the app only fetches it if the Content-Security-Policy allows the host;
- a pack is at most 5 MB and 20 000 rows.

### How the app uses a pack

`js/kurs.js` stores the pack under its own key `fizyo.kurs` and hands its class part to
`js/private.js` as a **second layer** next to the personal Notion data:

| Data | Personal Notion only (today) | Pack only (classmate) | Both (e.g. Escan + pack) |
|---|---|---|---|
| Questions | Notion rows | pack rows | both; the personal row wins on the same question |
| Weekly plan | Notion | pack | Notion |
| Checkliste | Notion | pack | both (merged by id) |
| Exams / homework | Notion | pack | both |
| Mistake cards, vocabulary, Notion links | Notion | — | Notion |

Without a pack the second layer is `null` and `getPrivate()` returns the very same object as
before; `tools/test_kurs.mjs` checks this. Notion sync always reads and writes only the
personal layer, so pack data never ends up in `fizyo.private`.

---

## b) Editorial pipeline (central, never on student devices)

Runs on the computer of Escan or a teacher ("editor"). Students' iPads never call an AI and
never hold an API key.

```
Teams subject folder ──► list new PDFs ──► AI drafts rows ──► review page ──► publish
 (class team files /      (tools script,     (Kern, MCQ,        "FizyoLern       (rebuild one
  SharePoint, e.g.         Microsoft Graph   Offen, Wort, ck,   Redaktion",      course pack
  "Trainingslehre/         🔒 later; local   + TR/EN auto)      German only)     per class)
  Kraft – Teil 2.pdf")     folder 🟢 now)
```

1. **New PDFs** – 🔒 later: a tools script lists new files in the class team's subject folders
   via Microsoft Graph (`/drives/{id}/root/children`, delegated, read-only). 🟢 Now: a local
   folder `redaktion-daten/folien/<Fach>/*.pdf`.
2. **AI drafts** – one call per slide deck produces rows in the existing format
   (`docs/ai-setup.md`): Kern 8–12, MCQ 10–15, Offen 3–5, Wort 10–20, each with an optional
   `ck` link to the Checkliste goal it tests and the slide number as source. Under the
   textbook rule (`CLAUDE.md`), the AI adds a `hinweis` when a slide contradicts a standard
   textbook; the review page shows it as a yellow note.
3. **Review page "FizyoLern Redaktion"** (`tools/redaktion/`, local only, German UI), three columns:
   - left: slide decks (new / done);
   - middle: each draft row → **Freigeben**, **Bearbeiten**, **Löschen**; yellow AI notes;
   - right: which classes get it (same bank for all classes of a year), counts, estimated review time.
4. **Publish** – approved rows go into the shared bank; then one course pack per class is
   rebuilt (`bank + class part`) and validated with the same `cleanKurs` the app uses.
   🔒 later: uploaded to each class team's "FizyoLern" folder. 🟢 now: written to `redaktion-daten/ausgabe/`.

## c) Translations are automatic

- Teachers only see and edit **German**. The review page never shows TR/EN fields.
- When drafts are made, the AI also writes the helper texts from the German content:
  `erkl` (TR explanation / translation), `erklEn`, and for Wort rows `antwort` (TR) + `antwortEn`.
- Every row stores `deHash` (hash of its German fields). When a teacher edits German text,
  the hash changes and the helper texts are **regenerated automatically** on save.
- Helper texts are marked `auto: true` so they can be re-run at any time.
- Learning content stays German/Latin (`CLAUDE.md`); only helper texts are translated.
- Interface: `tools/redaktion/ki.mjs` exports `translate(rows)` and `draftFromPdf(pdf)`.
  The provider is chosen by environment variables on the editor's computer
  (`FIZYO_KI=anthropic` + `ANTHROPIC_API_KEY`); without them a "manual" provider leaves the
  helper texts empty and marked as pending. **No key is ever stored in the repo.**

## d) Distribution without our own server

- **Preferred** 🔒: the course pack JSON lives in a folder "FizyoLern" in the class team's
  files. The iPad reads it with the student's own Microsoft login: MSAL.js in the browser,
  auth code flow with PKCE, delegated read-only scope (`Files.Read` or, better, a
  `Sites.Selected` grant for just that folder). No secret in the app.
- **Fallback** 🟢: a static file on a school-controlled host (or the same host as the app).
  The app re-checks the pack's `update` URL on start, like the Notion sync
  (at most every 3 hours, silent, old pack stays if offline or invalid).
- **Today** 🟢: import from a file (AirDrop / Files app) or from a same-origin URL on the
  setup screen.

## e) Homework

- 🔒 Teams "Aufgaben" read-only via Graph Education
  (`/education/me/assignments`, scope `EduAssignments.ReadBasic`): title, subject (from the
  class), due date. Shown in Today and as a hint in the morning test. Not stored beyond the device.
- 🟢 In-app **"Ödev ekle"** (visible only with a course pack): the student types a fact to
  memorise (front / back, subject, homework title). It becomes a homework card in the
  existing "📌 Ödev" deck. Stored only on the device under `fizyo.kurs`.

## f) Onboarding

1. Teacher shows a QR code → opens `…/#/kurs?paket=<url>` (or the school's own domain).
2. 🔒 Microsoft login → choose class → done. 🟢 now: the setup screen loads the pack from the
   link or from a file and shows class name, subjects and question count before installing.
3. Notion stays optional. Escan's flow is unchanged; a student can use both.
4. Settings shows a "Kurs" section only when a pack is installed (update, remove).

## g) What the school must provide

| Item | Why |
|---|---|
| Entra ID app registration + tenant admin consent | MSAL login, read-only Graph scopes (files of the class team, assignments) |
| Approval by the data protection officer | processing on devices, Graph access, AI drafting of teacher slides |
| CSP entries `login.microsoftonline.com`, `graph.microsoft.com` (+ the pack host) | the app blocks every other host today |
| Permission to use teacher material | slides are sent to an AI provider for drafting (central, not from student devices) |
| Impressum / Datenschutzerklärung, own domain (e.g. `fizyolern.<schule>.de`) | legal basis for a school-wide app; same-origin pack hosting |
| AI budget | estimate: one deck (20–40 slides) ≈ 30–60k input + 10–15k output tokens ≈ well under 1 € per deck incl. translations |
| Teacher review time | estimate: ~40 drafts per deck × ~20 s ≈ **10–15 min per deck** |
| **Open question:** where the timetable lives | Teams calendar, a file in Teams, or WebUntis – decides how `plan.weeks` is filled |

## What exists now (prototype, no school approval needed)

| Piece | File |
|---|---|
| Pack format, validator, merge into the app | `js/kurs.js`, hooks in `js/private.js`, `js/lessons.js` |
| Setup screen (link / file), Settings section, "Ödev ekle" | `js/kurs.js` + small hooks in `js/app.js` |
| Tests (format, merge, "nothing changed without a pack") | `tools/test_kurs.mjs` |
| Build a pack from the private Notion bundle | `tools/build_kurs.mjs` |
| Review page with local PDFs / JSON drafts | `tools/redaktion/` (`node tools/redaktion/server.mjs`) |
| Made-up example pack | `examples/kurs-beispiel.json` |

Not done on purpose: no Microsoft app registration, no Graph calls, no CSP change.
