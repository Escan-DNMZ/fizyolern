# FizyoLern – Notion template

Copy the blocks below into Notion to get pages that FizyoLern can read. Notion turns pasted Markdown into headings, tables and bold text.

**How to paste:** create a page in Notion, click into it and paste. Tables become simple Notion tables, which is exactly what the app expects. Do **not** convert the timetable into a database.

All page titles and keywords work in **English, German or Turkish**. Pick one language and stay with it.

| Page | English title | German title | Turkish title |
|---|---|---|---|
| Weekly plan | `Weekly Plan` | `Wochenplan` | `Haftalık Plan` |
| Vocabulary (database) | `Vocabulary` | `Wortschatz` / `Grundwortschatz` | `Grundwortschatz` |
| Lesson notes | `Lessons` | `Unterricht` | `Dersler` |
| Extra questions (database) | `FizyoLern Questions` | `FizyoLern Fragen` | `FizyoLern Sorular` |
| Exams and homework | `Exams & Homework` | `Prüfungen & Hausaufgaben` | `Sınav & Ödev Takibi` |
| Learning goals (one page per subject, optional) | `Checkliste – <Subject>` | `Checkliste – <Fach>` | `Checkliste – <Ders>` |

A title only has to **contain** the name, and capital letters don't matter, so `Weekly Plan (iPad)` works too. Put all these pages **inside one parent page** (e.g. "Physiotherapy") and connect the FizyoLern integration to that parent page.

---

## 1. Weekly Plan

Copy everything from here to the next line of dashes into a page called **Weekly Plan**. One `##` heading per week; the date range tells the app which week is "now".

```markdown
## Week 43 (19.–23.10.2026)

| Day | Class 1 | Class 2 | Review | Notes |
|---|---|---|---|---|
| Mon 19.10 | Anatomie | PT Befund | Morning test: Anatomie | Record the lesson |
| Tue 20.10 | Physiologie | Trainingslehre | Morning test: Physiologie | |
| Wed 21.10 | PT Grundlagen | PT Befund | Morning test: PT Grundlagen + PT Befund | |
| Thu 22.10 | Anatomie | — | Morning test: Anatomie | Best day for review |
| Fri 23.10 | Hygiene | PPS | Morning test: Hygiene | |
| Sat 24.10 | — | — | Weekly review | |
| Sun 25.10 | — | — | Rest | |

### Anatomie

✗ Test 14.10 (review):

- ✗ Fossa = **Grube** (Crista = Kamm, Processus = Fortsatz)
- ✗ Syndesmose = **Tibia–Fibula**
- ½ Bestandteile echtes Gelenk: **Gelenkpartner · Gelenkknorpel · Gelenkspalt · Gelenkkapsel · Bänder**

### PT Befund

✗ Homework – Pelvis landmarks:

- ✗ SIAS = **Spina iliaca anterior superior** → Ursprung **M. sartorius** und **M. tensor fasciae latae**
- ✗ Tuber ischiadicum = **Sitzbeinhöcker** → Ursprung der **Ischiocruralen**
- ✗ Hüfte Flexion / Extension (Neutral-Null): **130° – 0° – 10°**
```

**Rules the app follows**
- **Week heading:** `## Week 43 (19.–23.10.2026)` (also `## KW 43 …`, `## Woche 43 …`, `## Hafta 43 …`). Several weeks can be planned ahead on the same page.
- **Days:** `Mon`, `Tue` … (also German `Mo`, `Di` … or Turkish `Pzt`, `Sal` …) at the start of the first column.
- **Morning test:** `Morning test: Anatomie` in the 4th column (also `Morgentest:` / `Sabah testi:`). The subject names must match the app's subjects: Anatomie, Physiologie, PT Grundlagen, PT Befund, O/C, Trainingslehre, KMT, Hygiene, PPS.
- **Mistakes:** under a subject heading (`###`), a line starting with `✗`, followed by bullets starting with `✗` (wrong) or `½` (half right). The **bold** part is the answer and becomes a gap on the card.
- **Homework:** the same, but the `✗` line contains *Homework*, *Memorisation*, *Hausaufgabe*, *Ezber* or *Ödev*. These cards go to the 📌 homework deck, not to the mistakes.

---

## 2. Vocabulary (database)

Create a **table database** called **Vocabulary** with these columns:

| Column | Type | Example |
|---|---|---|
| `Word` (or `Wort`) | Title | `die Wirbelsäule (WS)` |
| `English` | Text | `spine` |
| `Turkish` (or `Türkçe`) | Text, optional | `omurga` |
| `Example` (or `Beispiel`) | Text | `Die Wirbelsäule hat eine Doppel-S-Form.` |
| `Category` (or `Kategorie`) | Select | `Körper` |
| `Level` (or `Stufe`) | Select: Neu / Lerne / Kann ich | `Neu` |
| `Next review` (or `Nächste Wiederholung`) | Date | |

Write separable verbs with a bar, e.g. `auf|richten`, and nouns with their article.

---

## 3. Exams & Homework

A simple table (with a header row), one row per exam or homework:

```markdown
| Type | Subject | Topic | Date | Status | Note |
|---|---|---|---|---|---|
| Exam | PT Befund | Hip and pelvis | 28.10.2026 | | written |
| Homework | Anatomie | Muscles of the hip | 22.10.2026 | done | |
```

You can also use to-do items (type `[] ` in Notion, or paste `- [ ] Anatomie exam 28.10.`). A checked to-do or a status of *done* / *erledigt* / *tamam* counts as finished. Exams in the next 7 days get priority in the app.

---

## 4. FizyoLern Questions (database, optional)

New questions without an app update. **This database is the only way new lessons get questions:** the app does not read the text of your lesson notes to make questions. Add rows here for every new lesson note (the [AI setup prompt](ai-setup.md) does this automatically). Columns (German names):

| Column | Type | Meaning |
|---|---|---|
| `Frage` | Title | question (or the German sentence for *Kern*, the word for *Wort*) |
| `Typ` | Select | `Kern` (key sentence) · `MCQ` · `Offen` (open question) · `Wort` (vocabulary) |
| `Fach` | Select | subject, e.g. `Hygiene` |
| `Lektion` | Text | lesson title (optional) |
| `Antwort` | Text | correct answer / model answer / translation |
| `Ablenker 1`, `Ablenker 2`, `Ablenker 3` | Text | three wrong options (MCQ only) |
| `Erklärung TR` | Text | explanation |
| `Schlüsselbegriffe` | Text | key terms for open questions, separated by commas; `a\|b` = alternatives |
| `Gizle` | Checkbox | hide this row |

---

## 5. Checkliste – learning goals per subject (optional)

Many teachers hand out a checklist of learning goals for the whole year ("this is what the exam asks"). Put it into Notion as one page per subject; the app then shows a **📋 Checkliste** screen for that subject: which goals were covered in class, how sure you are about each goal (😊 🙂 😕 😵), and quick tests for each goal. Without such a page the feature stays hidden.

The texts stay private: the app reads them only from your Notion on your phone; they are never part of the public app.

```markdown
Fach: Hygiene · Source: teacher's checklist

## Händehygiene
- [x] Die Indikationen der hygienischen Händedesinfektion nennen → Skript 2.1 → Notu 1 ✅ 14.10
- [x] Desinfektion und Sterilisation voneinander abgrenzen → Skript 2.3 → Notu 1 ✅ 14.10
- [ ] Ablauf der chirurgischen Händedesinfektion erklären → Skript 2.4

## Infektionsketten
- [ ] Übertragungswege von Krankheitserregern erklären → Skript 3.1
```

**Rules the app follows**
- **Title:** must contain `Checkliste`, e.g. `Checkliste – Hygiene`. One page per subject.
- **Subject:** a line `Fach: <name>` near the top. The name must be one of the app's subjects (Anatomie, Physiologie, PT Grundlagen, PT Befund, O/C, Trainingslehre, KMT, Hygiene, PPS, or a subject from the questions database). Text after `·` is ignored.
- **Sections:** `##` headings (heading 2).
- **Goals:** to-do items. **Ticked** = covered in class. Only covered goals are used in the morning test and the mixed test.
- `✅ 14.10` (or `✅ 14.10.2026`) after the text = the date it was covered. Goals covered in the last 7 days come up more often.
- `→ Skript 2.4` = where to read the answer (shown as a reference only).
- `→ Notu 1` = the lesson note with that number for this subject (e.g. `hygiene-1`); several: `→ Notu 2, Notu 3`. A Notion link (@-mention) to the lesson note page works too.
- Each goal is identified by subject + section + goal text. Ticking, dates and `→` references can change any time; if you reword a goal or move it to another section, its self-rating starts again.
- Questions are matched to goals automatically (optional `ck` keywords on built-in questions, otherwise by similar words). A wrong answer lowers the goal by one step; you can raise it again by hand.
