# FizyoLern – a daily study companion for physiotherapy training

**Live app:** https://escan-dnmz.github.io/fizyolern/ (open it in Safari on an iPhone and choose *Add to Home Screen*)

FizyoLern is a free, offline-capable web app (PWA) for a first-year physiotherapy student in the German *Ausbildung*. It turns the student's own lesson notes, weekly timetable and test mistakes into short daily study sessions that fit on the phone: in the morning before class, on the way home, and on the weekly review day.

The subject matter is in **German and Latin**, as it is taught and examined at school. The app's interface and all explanations are in **Turkish**, so a learner whose first language is not German understands *why* an answer is right while practising the exact German wording needed for exams.

> The app's interface language is Turkish. This README explains in English what it does and how to use it.

---

## Why it is useful

Vocational physiotherapy training packs a lot into the first months: anatomy (bones, muscles with origin, insertion, innervation and function, joints with range of motion), physiology, training theory, hygiene, assessment (*Befund*), massage and psychology. Mostly it has to be reproduced **word for word** in written and oral exams.

FizyoLern helps with the parts that are hardest to do alone:

- **Every day has a plan.** The *Today* screen knows which subjects are on the timetable today and tomorrow. It schedules the matching morning test, your mistake cards, five vocabulary words, a muscle and a bone of the day, and a review session for the commute home.
- **Mistakes come back until they stick.** Every wrong answer, in the app or in a test at school, becomes a flash card. Spaced repetition decides when it returns.
- **Memorisation homework is planned in.** Lists you have to learn by heart, such as pelvic landmarks or hip range-of-motion values, become their own homework deck. Separate drills and an exam countdown support it (see [Homework and memorisation](#homework-and-memorisation)).
- **Answers are checked the way a teacher would check them.** Typed answers allow small spelling mistakes and umlaut variants (ä = ae). They insist on the correct article. Words that look alike but mean the opposite (*Abduktion* vs. *Adduktion*, *Sympathikus* vs. *Parasympathikus*) are never mixed up.
- **Anatomy is shown, not just named.** Any muscle, bone, joint or bony landmark mentioned in a question or card can be opened in an interactive 3D model.
- **Content is checked against the textbook.** Questions are generated from the student's notes and then compared with them. Where a slide contradicts the standard textbook, the app teaches the textbook version and notes the difference.

---

## A typical day

| When | What the app offers |
|---|---|
| **Morning, before class** | Morning test for today's subjects, 5 new words (German → Turkish, typing, cloze, *Partizip II*), the muscle and bone of the day |
| **During the day** | Flash cards: mistake cards first (max. 20 per day), then homework cards, vocabulary, muscles, bones, joints |
| **On the way home (after 14:30)** | *Dönüş yolu*: today's wrong answers → mistake cards for today's subjects → homework cards → the same 5 words in a different question type → today's lesson notes in a large-print reading mode with a 5-question mini test. Every step can be skipped with one tap. |
| **Saturday** | Weekly review: all wrong answers of the week, all mistake cards, the week's words, open (essay) questions for the week's subjects |
| **Any time** | Status report: one tap turns today's progress into a ready-to-send message for an AI tutor (Claude). The tutor can then explain weak topics and set a mini exam. |

---

## Features

### Today (*Bugün*)
- Today's and tomorrow's classes from the weekly timetable in Notion. If several weeks are planned ahead, the right week is chosen by date.
- A checklist of the day's tasks with a progress ring and a study streak 🔥.
- Weak topics with a one-tap "test this" button.
- An exam countdown card ("5 days until the PT Befund exam") when exams are entered in Notion.

### Tests (*Test*)
- **More than 800 multiple-choice questions** from three sources:
  - questions written from the lesson notes, including *which statement is false*, matching, ordering, case studies and numbers;
  - hand-written clinical and anatomy questions;
  - questions generated automatically from the anatomy data (origin, insertion, nerve and function of each muscle, bones, joint types, range of motion, gym exercises).
- **Adaptive selection:**
  - weak topics and recently missed questions come more often;
  - questions answered correctly yesterday are skipped today;
  - harder question types unlock as accuracy improves.
- **Distractors that make you think:** wrong options for a muscle come from the same body region and are of similar length. The explanation says which muscle each wrong option belongs to.
- **Mock exam (*Deneme sınavı*)** per subject:
  - 15 multiple-choice and 3 open questions in 30 minutes;
  - no feedback until the end;
  - then a result per topic with every wrong answer listed.

### Open questions (*Sorular*)
- About 100 essay-style questions, as in the written exams.
- You type your answer in German. The app checks it for the required key terms, in any order and with tolerance for word forms (*gesteigert* counts for *steigern*). It then shows the model answer, and you rate yourself.

### Flash cards (*Kartlar*)
- Spaced repetition with learning steps: *Again* returns in 1 minute and *Hard* in 10 minutes. After that *Hard* < *Good* < *Easy* always.
- Decks:
  - mistake cards from Notion;
  - homework cards;
  - lesson vocabulary per subject;
  - basic vocabulary (*Grundwortschatz*);
  - muscles, each with a typical gym exercise 💪;
  - bones and joints.
- You can add your own words.

### Words of the day
- Five words from the *Grundwortschatz* each day, chosen from the categories that match today's classes.
- The morning and the way home ask the same words with different question types, which reinforces them.
- Separable verbs are marked like `auf|richten`, and the *Partizip II* is drilled.

### 3D anatomy
- Real bone and muscle models (BodyParts3D).
- **Focus mode** for one muscle at a time:
  - its parts in different colours (e.g. *Pars clavicularis / acromialis / spinalis*);
  - origin and insertion marked on the bone with the name of the landmark ("Ursprung: Spina ischiadica");
  - deeper muscles shown semi-transparent.
- **Layers** (superficial / middle / deep).
- **Bony landmarks:** SIAS, SIAI, SIPS, Crista iliaca, Tuber ischiadicum, Trochanter major/minor, Linea aspera and more. Tap one to see which muscles start or end there.
- **Joint axes:** transverse, sagittal and longitudinal axes drawn through a joint, with the movement around each one.
- **Step-by-step viewer:** a question that mentions several structures (e.g. *Wirbelsäule* → cervical, thoracic, lumbar spine and sacrum) opens them one after another, then all together in different colours.

### Lesson notes (*Ders notları*)
- 21 lessons across Anatomy, Physiology, PT basics, PT assessment, orthopaedics/surgery, training theory, massage, hygiene and psychology.
- Each lesson has key sentences (German + Turkish), a test, open questions and vocabulary, plus a link back to the original Notion page.

---

## Homework and memorisation

Much of the first year is pure memorisation homework: *"learn the pelvic landmarks and the origin/insertion of the hip muscles for next week"*. FizyoLern treats this as its own kind of work, separate from mistakes:

1. **Write it once in Notion.** In the weekly plan, write a list headed e.g. `✗ Ezber kartları – Becken & Hüft-ROM`; any heading containing *Ezber*, *Ödev* or *Hausaufgabe* counts. Write one line per fact and put the answer in **bold**:
   `SIAS = **Spina iliaca anterior superior** → Ursprung **M. sartorius** und **M. tensor fasciae latae**`
2. **The app turns each line into a cloze card.** The bold parts become gaps, and the card goes into the **📌 Ödevlerim** (my homework) deck, not into the mistake list.
3. **It is scheduled for you.**
   - The homework appears as a task on *Today* and as a step on the way home.
   - There is no daily limit, so the whole list can be learned before the deadline.
   - Spaced repetition keeps it fresh afterwards.
4. **Practise it in 3D.** The **🎯 Noktayı bul** ("find the point") drill asks "Show the SIAS" or "Where does M. sartorius originate?". You tap the bone in the 3D model; a tap within 2 cm on either side of the body counts. A wrong tap shows the correct point with its label.
5. **Track it.**
   - The daily report has its own homework section ("Becken & Hüft-ROM: 29 cards · 12 learned · 9 in progress · 8 not seen yet"), so homework is never confused with mistakes.
   - Exams and homework deadlines from the Notion page *Sınav & Ödev Takibi* show up as a countdown.
   - Subjects with an exam in the next 7 days get priority in tests, cards and the way-home review.

Mistakes from tests at school work the same way: write a line under a `✗ Test 14.10 …` heading with the correct answer in bold. It becomes a mistake card, and at most 20 come per day, today's subjects first.

---

## How content gets into the app

```
Notion (the student's own workspace, read-only)
├── Weekly plan  → timetable, morning tests, ✗ mistake cards, 📌 homework cards
├── Grundwortschatz database → words of the day
├── Lesson notes ("Dersler") → lessons: key sentences, tests, open questions, vocabulary
├── "FizyoLern Sorular" database → extra questions added without an app update
└── "Sınav & Ödev Takibi" → exam and homework countdown
                │
                ▼  synced on the phone, at most every 3 hours (or "Update now")
           FizyoLern on the iPhone (works offline)
```

The lesson content in `js/data/lessons.js` is built from the notes with `tools/build_lessons.py`. The personal parts (timetable, mistakes, homework, exams, teacher names, Notion links) are never part of this repository. They are read live from Notion on the phone.

---

## Privacy by design

- **No server and no account.** All progress is stored only in the phone's browser storage. A backup can be downloaded and restored in the settings.
- **The Notion key never leaves the phone.** The read-only key is stored on the device and sent only to `api.notion.com`. The page's Content-Security-Policy blocks connections to any other server.
- **Nothing personal is in the public repository.** The repository contains only general lesson content. Teacher names are filtered out at build time, and the build fails if one slips through.
- **The daily report contains statistics only**, never the Notion key.

---

## Getting started

### 1. Install on an iPhone
1. Open https://escan-dnmz.github.io/fizyolern/ in **Safari**.
2. Tap **Share** → **Add to Home Screen**.
3. Start the app from the home screen. It works offline from then on.

The app runs as is with the built-in lessons, anatomy, vocabulary and questions. Connecting Notion adds your personal timetable, mistakes, homework and exams.

### 2. Connect your Notion (optional)
1. On a computer, go to https://www.notion.so/profile/integrations → **New integration**.
   - Type **Internal**, name e.g. `FizyoLern`.
   - **Capabilities:** keep only **Read content** switched on.
   - Copy the **Internal Integration Secret** (`ntn_…`) and keep it private.
2. In Notion, open your study dashboard page → **•••** → **Connections** → add `FizyoLern`. Only this page and its sub-pages become visible to the app.
3. In the app: ⚙️ **Settings** → **Notion bağlantısı** → paste the key → **Bağlan ve güncelle** (connect and update).

The app finds these pages by title:

| Page | Expected content |
|---|---|
| `Haftalık Plan` | `## … KW 43 (19.–23.10.2026 …)` headings, each followed by a table (day · class 1 · class 2 · review with "Sabah testi: …" · homework/notes). Under subject headings (`###`), lists after a `✗ …` paragraph become mistake or homework cards; **bold** = answer. |
| `Grundwortschatz` (database) | Wort, Türkçe, Beispiel, Kategorie, Stufe, Nächste Wiederholung |
| `Dersler` | One sub-page per lesson note |
| `FizyoLern Sorular` (database, optional) | Extra rows of type Kern / MCQ / Offen / Wort |
| `Sınav & Ödev Takibi` (optional) | Exams and homework with dates |

If the phone is lost: Notion → integrations → `FizyoLern` → **Delete/refresh secret**. The old key stops working immediately.

---

## Development

No build step: plain HTML, CSS and JavaScript modules. Three.js is vendored in `vendor/`.

```bash
python -m http.server 8765
```
Then open http://localhost:8765. On `localhost`, a private bundle in `private/fizyolern-ozel.json` (git-ignored) is loaded automatically for testing.

| Path | Purpose |
|---|---|
| `js/app.js` | Screens and routing |
| `js/quizgen.js` | Question generation and adaptive selection |
| `js/store.js` | Progress, spaced repetition |
| `js/words.js`, `js/fuzzy.js` | Words of the day, tolerant answer checking |
| `js/notion.js`, `js/private.js` | Read-only Notion sync, private data on the device |
| `js/exam.js` | Mock exam |
| `js/report.js` | Daily status report |
| `js/anatomy3d.js` | 3D viewer (focus mode, landmarks, axes, step-by-step, "find the point") |
| `js/data/` | Anatomy (`anatomy.js`, `landmarks.js`, `axes.js`, `muscle3d.js`), lessons, vocabulary, questions, gym exercises |
| `tools/` | Build scripts (lessons, 3D models, icons) and checks |

Checks:

```bash
node tools/test_check.mjs        # typed-answer and keyword checking
node tools/test_structures.mjs   # finding anatomy terms in text for the 3D buttons
node tools/audit_content.mjs     # every question, card and word: duplicates, two correct options, keywords missing from model answers …
```

After changing anything, run `python tools/bump_sw.py` so that phones load the new version (the service worker caches files for offline use).

---

## Credits

- 3D bone and muscle models: **BodyParts3D**, © The Database Center for Life Science (DBCLS), CC BY 4.0. They are converted with `tools/build_bp3d.py` and `tools/compress_models.sh`. Four muscles missing from BodyParts3D (latissimus dorsi, rectus abdominis, transversus abdominis, quadratus lumborum) are drawn from real skeleton landmarks.
- 3D rendering: [Three.js](https://threejs.org) (MIT).
- The content is a study aid written from the student's own lesson notes and checked against standard textbooks. It does not replace the school's materials or a teacher.
