# FizyoLern

### A personal study app for physiotherapy training, with an interactive 3D anatomy model, adaptive tests and spaced repetition

**Idea, concept and content:** Escan Dönmez · [LinkedIn](https://www.linkedin.com/in/escan-donmez/)  
**Code and design:** [Claude Code](https://claude.com/claude-code) (Anthropic)

**▶ Live app:** https://escan-dnmz.github.io/fizyolern/ (works in any browser; on an iPhone use Safari → *Share* → *Add to Home Screen*)

<p align="center">
  <img src="docs/screenshots/today.png" width="230" alt="Daily plan">
  <img src="docs/screenshots/3d-muscle-focus.png" width="230" alt="3D muscle with origin and insertion">
  <img src="docs/screenshots/test.png" width="230" alt="Test question with explanation">
</p>

---

## In one minute

**The problem.** I am training as a physiotherapist in Germany. My first language is not German. In the first months we learn hundreds of anatomical structures, every muscle's origin, insertion, nerve supply and function, joint ranges of motion, and definitions in physiology, training science, hygiene, assessment and psychology. Much of it has to be reproduced *word for word* in German in written and oral exams. Classic flash-card apps did not know my timetable, my teachers' slides or my mistakes, and textbooks only show anatomy in 2D.

**The solution.** FizyoLern is an installable web app that turns my own lesson notes, weekly timetable and test mistakes into a short, guided study plan for every day:

- it knows which subjects I have today and tomorrow;
- it tests me on exactly those subjects;
- it brings back every mistake until I know it;
- it schedules memorisation homework before the deadline;
- it shows any muscle, bone, joint or bony landmark in an interactive 3D model.

Explanations are in my native language, Turkish; the content stays in the German and Latin that the exams require.

**The result.** One app replaces flash cards, a quiz book, a vocabulary trainer, an anatomy atlas and a study planner. It works offline on the phone, has no server or account, and my personal data never leaves the device.

---

## Key numbers

| | |
|---|---|
| **21** lessons in **9** subjects | Anatomy, physiology, PT basics, PT assessment, orthopaedics/surgery, training science, massage, hygiene, psychology |
| **830+** multiple-choice questions | 377 hand-written (337 of them from the lesson notes), plus questions generated automatically from the anatomy data |
| **100+** open (essay) questions | Answers typed in German, checked for the required key terms |
| **56** muscles, **23** bone groups, **12** joints | Each with origin, insertion, innervation and function, or range of motion, in German and Latin with Turkish explanations |
| **19** bony landmarks in 3D | SIAS, Tuber ischiadicum, Trochanter major and others, each linked to the muscles attached there |
| **600+** vocabulary items | Basic medical vocabulary, lesson terms, and 55 gym exercises linked to the muscles they train |
| **~2 MB** of 3D models | Real anatomical meshes (BodyParts3D), compressed so the whole app runs offline on a phone |

---

## Who did what

The whole idea behind FizyoLern belongs to **Escan Dönmez**. The code and the design were created by **Claude Code**, Anthropic's AI programming assistant, following Escan's ideas and instructions.

**Escan Dönmez**
- **Idea and concept.** Identified the problem from personal experience as a student, came up with every feature and the daily study routine, and decided what stays private.
- **Content.** All learning content comes from Escan's own lesson notes in Notion. Every lesson was cross-checked against those notes and standard textbooks. Where a slide contradicted the textbook, the app teaches the textbook-correct version.
- **Testing and feedback.** Used the app every day on an iPhone and reported what was confusing or wrong. Examples: an answer being marked wrong for a different spelling, homework mixed up with mistakes, a 3D view showing too much at once. Each round of feedback became the next improvement.

**Claude Code (Anthropic)**
- **Code and design.** It wrote the app's code and designed the user interface, the 3D viewer and the technical architecture from Escan's requirements.
- **Content support.** It turned Escan's notes into questions and cross-checked every lesson against those notes and standard textbooks.

The project shows how someone with a clear idea and deep knowledge of a field can turn a real need into working software with modern AI tools.

---

## Features

The interface is in Turkish. A short glossary is at the end of this page.

### 1. A plan for every day (*Bugün* = Today)
- Today's and tomorrow's classes, read from my weekly timetable in Notion. If several weeks are planned ahead, the right one is picked by date.
- A checklist with a progress ring and a streak: morning test for today's subjects, mistake cards, homework cards, 5 words of the day, the muscle and bone of the day.
- **Way-home mode** (after 14:30), steps that can each be skipped with one tap:
  1. today's wrong answers;
  2. mistake cards for today's subjects;
  3. homework;
  4. the same 5 words in a new question type;
  5. today's lesson notes in a large-print reading mode, followed by a 5-question mini test.
- **Saturday review**: everything I got wrong this week, all mistake cards, the week's words and open questions.
- **Exam countdown** ("5 days until the PT assessment exam"), read from Notion. Subjects with an exam within 7 days get priority everywhere.

### 2. Tests that adapt (*Test*)
- **Adaptive selection.** Questions I missed come back more often; questions I answered correctly yesterday are skipped today; harder question types unlock as accuracy rises.
- **Varied formats.** Single answer, "which statement is false", matching, ordering, case studies and numbers.
- **Generated anatomy questions.** "Where does M. … insert?", "Which nerve supplies …?". The wrong options come from the same body region and have similar length, so the answer cannot be guessed from the layout. The explanation names the muscle each wrong option belongs to.
- **Mock exam.** 15 multiple-choice and 3 essay questions in 30 minutes, with no feedback until the end, then a result per topic.
- **3D button.** When a question mentions anatomy, a button after the answer opens every structure it names in the 3D model.

### 3. Essay questions with a smart answer check (*Sorular*)
<img src="docs/screenshots/open-question.png" width="230" align="right" alt="Open question with key-term check">

- I type my answer in German. The app checks it for the exam-relevant key terms (green ✓ found, red ✗ missing), then shows the model answer.
- The check works the way a teacher marks:
  - word order does not matter;
  - different word forms count (*gesteigert* for *steigern*);
  - small typos are tolerated;
  - umlauts may be written as *ae/oe/ue*.
- **Opposites are never accepted as typos.** *Abduktion* ≠ *Adduktion*, *Sympathikus* ≠ *Parasympathikus*, *hyper-* ≠ *hypo-*. They differ by a letter or two but mean the opposite.

<br clear="right">

### 4. Flash cards with spaced repetition (*Kartlar*)
- An Anki-style algorithm with learning steps. *Again* comes back in 1 minute and *Hard* in 10 minutes. After that, *Hard* < *Good* < *Easy* in days, which can never be equal.
- Decks:
  - mistake cards and homework cards from Notion;
  - lesson vocabulary per subject and basic medical vocabulary;
  - muscles (each with a typical gym exercise), bones and joints.
- At most 20 mistake cards per day, today's subjects first, so reviewing never becomes overwhelming.

### 5. Words of the day
- 5 words a day, chosen from categories that match today's classes.
- The morning and the way home ask the same words in different formats: German→Turkish, typing the German word with its article, cloze sentence, *Partizip II* of separable verbs (`an|schwellen` → *angeschwollen*). Practising each word twice in different ways helps it stick.

### 6. Interactive 3D anatomy
<p>
  <img src="docs/screenshots/3d-step-by-step.png" width="230" alt="Spine shown step by step in four colours">
  <img src="docs/screenshots/3d-joint-axes.png" width="230" alt="Hip joint with three movement axes">
  <img src="docs/screenshots/3d-find-the-point.png" width="230" alt="Find-the-point drill on the pelvis">
</p>

- **Real anatomical models** of the skeleton and 56 muscles from the BodyParts3D research database. 4 muscles missing from the database are reconstructed from skeletal landmarks. Rotate with one finger, zoom with two.
- **Focus mode** for one muscle at a time:
  - its parts in different colours (e.g. the three parts of the deltoid);
  - origin and insertion marked on the bone with the landmark name ("Ursprung: Spina ischiadica");
  - the deeper muscles underneath shown semi-transparent.
- **Layers:** superficial / middle / deep.
- **Bony landmarks:** 19 points on the pelvis and leg. Tap one to see which muscles start, end or change direction there.
- **Joint axes:** transverse, sagittal and longitudinal axes drawn through a joint (left picture), each with the movement that happens around it.
- **Step-by-step viewer:** a question about "the spine" opens the cervical, thoracic and lumbar spine and the sacrum one after another, then all together in four colours (middle picture).
- **"Find the point" drill:** the app asks "Show the SIAS" or "Where does M. sartorius originate?" and I tap the bone. A wrong tap shows the correct point with its name (right picture).

### 7. Homework and memorisation
<img src="docs/screenshots/homework-card.png" width="230" align="right" alt="Homework flash card">

Much of the first year is homework like *"learn the pelvic landmarks and the hip muscles by next week"*. FizyoLern keeps it separate from mistakes:

1. I write the list once in Notion and put the answers in **bold**.
2. Each line becomes a fill-in-the-gap card in the **📌 homework deck** (picture).
3. The homework appears as a task every day and in the way-home routine until it is learned. Spaced repetition keeps it fresh afterwards.
4. The 3D "find the point" drill trains the same landmarks visually.
5. The daily report shows homework progress separately ("29 cards · 12 learned · 9 in progress · 8 not seen yet"), next to the exam and homework countdown.

<br clear="right">

### 8. Lesson notes and AI tutor report
- Each lesson has key sentences in German with a Turkish translation, a test, essay questions and vocabulary, plus a link to the original note.
- **Status report.** One tap turns the day's progress into a message for an AI tutor. The message gives context, the study streak, cards (reviews vs. new), weak subjects, the most frequent mistakes in readable form, and homework. The tutor can then explain weak topics and set a mini exam.

---

## Built on learning science

| Principle | How the app applies it |
|---|---|
| **Retrieval practice** | Everything is asked, never just shown: tests, typed answers, cloze cards, essay questions |
| **Spaced repetition** | Cards, words and mistakes come back at growing intervals |
| **Interleaving** | Mixed tests across subjects; the same word in different question types |
| **Immediate, explained feedback** | Every answer explains why it is right and what each wrong option actually is |
| **Dual coding** | Words and 3D pictures together: every term in a question can be opened in the model |
| **Desirable difficulty** | Plausible distractors from the same region; harder levels unlock with accuracy |
| **Low barrier to start** | A clear daily list; the way-home routine runs in short, skippable steps on the phone |

---

## Engineering highlights

```
                ┌──────────────── iPhone (offline PWA) ────────────────┐
 Notion  ──────▶│ read-only sync ─▶ private data (on device only)      │
 (my notes,     │                                                      │
  timetable,    │ lessons + anatomy data ─▶ question generator         │
  mistakes,     │   ─▶ adaptive selection ─▶ spaced repetition store   │
  exams)        │                                                      │
                │ Three.js 3D viewer ◀─ BodyParts3D meshes (Draco)     │
                └──────────────────────────────────────────────────────┘
       No server · no account · progress stored in the browser
```

- **No framework, no build step.** Plain HTML, CSS and JavaScript modules, hosted for free on GitHub Pages. A service worker caches everything for offline use.
- **3D pipeline.** Python scripts convert the BodyParts3D anatomy models into compressed glTF files: welded, simplified, Draco-compressed, about 2 MB for all bones and muscles.
  - Bony landmarks were placed by geometry rules on the real meshes. Example: SIAS = the most anterior point of the upper iliac crest.
  - Origin and insertion markers are found by measuring where a muscle mesh touches the bone.
  - Muscles missing from the database are drawn as surfaces between real skeletal landmarks.
- **Tolerant answer checking for German.** Edit distance scaled to word length, umlaut folding, article checks, word-stem and word-order tolerance, plus a guard so that medical opposites never count as typos.
- **Notion integration with privacy by design.**
  - The app reads Notion directly from the phone with a read-only key that stays on the device.
  - A Content-Security-Policy allows network connections only to Notion's API.
  - Weekly plans, mistakes, homework and exams are parsed from ordinary Notion pages (headings, tables, bold text), so no special format is needed.
- **Content quality checks.** An audit script checks every question, card and word. It catches:
  - duplicate or empty options;
  - two defensible correct answers;
  - answers given away by the question;
  - model answers that would fail their own key-term check;
  - homework cards whose answer shows on the front.

  Unit tests cover the answer checker and the term detection.
- **Privacy filter.** The build script removes teacher names from public content and fails if one remains. Personal files are excluded from the repository.

---

## Privacy and security

- **No backend, no account, no tracking.** Progress lives only in the phone's browser storage. A backup file can be downloaded and restored.
- **The Notion key never leaves the device.** It is read-only and sent only to `api.notion.com`; the browser blocks every other destination.
- **The public repository contains only general learning content.** It holds no timetable, mistakes, teacher names or links to personal pages.

---

## Try it

1. Open https://escan-dnmz.github.io/fizyolern/ (best on a phone).
2. On an iPhone: Safari → **Share** → **Add to Home Screen**. It then starts like a normal app and works offline.
3. Without any setup you can use the tests, essay questions, flash cards, words and 3D anatomy with the built-in content. Connecting your own Notion (⚙️ Settings) adds a personal timetable, mistakes, homework and exams.

<details>
<summary><b>Connecting Notion (optional)</b></summary>

1. Go to https://www.notion.so/profile/integrations → **New integration** (type *Internal*, only **Read content**). Copy the secret and keep it private.
2. In Notion, open your study dashboard → **•••** → **Connections** → add the integration.
3. In the app: ⚙️ → *Notion bağlantısı* → paste the key → *Bağlan ve güncelle* (connect and update).

| Notion page | Used for |
|---|---|
| `Haftalık Plan` (weekly plan) | `## … KW 43 (19.–23.10.2026)` headings with a timetable table; lists after a `✗ …` line become mistake cards, or homework cards if the heading says *Ezber/Ödev/Hausaufgabe*; **bold** = answer |
| `Grundwortschatz` (database) | Words of the day |
| `Dersler` | Lesson notes |
| `FizyoLern Sorular` (database) | Extra questions without an app update |
| `Sınav & Ödev Takibi` | Exam and homework dates |

If a phone is lost, delete or renew the key in Notion. The old key stops working immediately.
</details>

<details>
<summary><b>Development</b></summary>

```bash
python -m http.server 8765          # then open http://localhost:8765
node tools/test_check.mjs           # answer checking
node tools/test_structures.mjs      # term detection for the 3D buttons
node tools/audit_content.mjs        # content audit of all questions and cards
python tools/bump_sw.py             # after any change, so phones load the new version
```

| Path | Purpose |
|---|---|
| `js/app.js` | Screens and routing |
| `js/quizgen.js` | Question generation, adaptive selection |
| `js/store.js` | Progress and spaced repetition |
| `js/words.js`, `js/fuzzy.js` | Words of the day, tolerant answer checking |
| `js/notion.js`, `js/private.js` | Read-only Notion sync, on-device private data |
| `js/exam.js`, `js/report.js` | Mock exam, daily status report |
| `js/anatomy3d.js` | 3D viewer: focus mode, landmarks, axes, step-by-step, "find the point" |
| `js/data/` | Anatomy, landmarks, axes, lessons, vocabulary, questions, gym exercises |
| `tools/` | Build scripts (lessons, 3D models, icons) and checks |
</details>

---

## Glossary of the Turkish interface

| Turkish | English |
|---|---|
| Bugün | Today |
| Test / Sorular / Kartlar | Test / (Essay) questions / Flash cards |
| 3D Anatomi | 3D anatomy |
| Dönüş yolu | Way home (afternoon review) |
| Ödevlerim · Hatalarım | My homework · My mistakes |
| Günün kası / kemiği | Muscle / bone of the day |
| Noktayı bul | Find the point |
| Deneme sınavı | Mock exam |
| 3D'de göster | Show in 3D |
| Tekrar · Zor · İyi · Kolay | Again · Hard · Good · Easy |
| Doğru · Yanlış | Correct · Wrong |

---

## Credits

- 3D anatomy models: **BodyParts3D**, © The Database Center for Life Science (DBCLS), licensed CC BY 4.0.
- 3D rendering: [Three.js](https://threejs.org) (MIT).
- Idea, concept and content: **Escan Dönmez** ([LinkedIn](https://www.linkedin.com/in/escan-donmez/)).
- Code and design: [Claude Code](https://claude.com/claude-code) by Anthropic.
- The learning content is a personal study aid based on my own lesson notes and checked against standard textbooks. It does not replace official course materials.
