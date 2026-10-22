# Set up your Notion with an AI (ChatGPT, Gemini, Claude …)

> 🇬🇧 Give your school slides and your timetable to an AI. It builds the Notion pages that FizyoLern reads.
> 🇩🇪 Gib deine Folien und deinen Stundenplan einer KI. Sie baut daraus die Notion-Seiten, die FizyoLern liest.
> 🇹🇷 Okuldan aldığın folyoları ve ders programını bir yapay zekâya ver. FizyoLern'in okuduğu Notion sayfalarını o kursun.

You don't need to know how to take notes or how Notion works. The AI turns your slides into:
- a **lesson note** you can read and learn from;
- **questions for the app**: key sentences, multiple choice, open questions and vocabulary;
- your **weekly plan**, with the right morning test for each day;
- later, from your test results, **mistake cards** and **homework cards**.

> ⚠️ **The app does not make questions from your lesson notes by itself.** It only learns from the **FizyoLern Questions** database. A lesson note without question rows never shows up in your tests, cards or exams. So every new lesson note must come **together with** its question rows. The setup prompt below tells your AI to do this automatically every time, so you never have to ask.
>
> 🇩🇪 Die App erstellt aus deinen Notizen **keine** Fragen selbst, sie liest nur die Datenbank **FizyoLern Fragen**. Deshalb muss die KI zu jeder neuen Notiz sofort auch die Fragen anlegen.
> 🇹🇷 Uygulama ders notlarından kendisi soru **üretmez**, sadece **FizyoLern Sorular** veritabanını okur. Bu yüzden yapay zekâ her yeni nottan sonra soruları da hemen eklemeli.

---

> 🔒 **Never paste your Notion key (`ntn_…`) into an AI chat.** The AI does not need it. You paste it only into the app's Settings.

## What you need
- A free **Notion** account and the **FizyoLern** app (see the [README](../README.md#install-and-start)).
- Any AI chat: **ChatGPT, Gemini, Claude, Copilot …**
- Your **timetable** (photo, PDF or text) and your **slides** (PDF, photos or copied text).

## Two ways, depending on your AI

| Your AI can … | What happens |
|---|---|
| **write to Notion** (for example Claude or ChatGPT with the Notion connector switched on) | The AI creates the pages and databases in Notion directly. |
| **not** connect to Notion | The AI gives you text to **paste** into Notion and **CSV files** to **import**. This works with every AI. |

---

## Step by step

1. In Notion, create an empty page called **Physiotherapy** (any name). Everything goes inside it.
2. Start a new AI chat. Copy the **setup prompt** below, attach your timetable and **one** slide deck, and send it.
3. Put the results into Notion:
   - **Pages** (Weekly Plan, the lesson note): create the page inside *Physiotherapy* and paste the text. Notion turns it into headings, tables and bold text.
   - **CSV files** (FizyoLern Questions, Vocabulary): inside *Physiotherapy*, type `/` and choose **Import**, or use **•••** → **Import**, then **CSV**. Then rename the new database exactly **FizyoLern Questions** or **Vocabulary**. If you already have the database, import the CSV into it so the rows are added.
4. Connect the app once, as in the README ([Connecting your Notion](../README.md#connecting-your-notion-step-by-step)): create the read-only key, connect it to *Physiotherapy*, and paste it in the app.
5. For every new slide deck, send the **"new slides" prompt** in the same chat. For a new week, mistakes or homework, use the short prompts further below.

The app updates itself (or tap ⚙️ → **Update now**). New lessons appear under **Lesson notes**, and their questions come up in the tests, cards, mock exam and oral exam.

---

## The setup prompt (copy everything in the box)

```text
You are setting up a Notion study workspace for "FizyoLern", a study app for
physiotherapy students in German vocational training (Ausbildung). The app reads
these Notion pages, so the FORMAT below must be followed exactly.

Answer me in my language, but keep all learning content in German (and Latin terms).
My helper language for explanations and translations is: <ENGLISH / TURKISH / …>

I attached: (1) my timetable, (2) slides of one lesson.

If you can write to Notion directly, create everything inside my page
"Physiotherapy". Otherwise give me (a) each page as Markdown in its own code block
and (b) each database as a CSV file (or a CSV code block).

== 1. Page "Weekly Plan" ==
For each week a heading and a simple table (not a database):

## Week <ISO week number> (<Mon date>–<Fri date with year, e.g. 19.–23.10.2026>)

| Day | Class 1 (<start>–<end>) | Class 2 (<start>–<end>) | Review | Notes |
|---|---|---|---|---|
| Mon 19.10 | <subject> | <subject or —> | Morning test: <subject(s) of the day, joined with +> | <note> |
... one row per day, Mon to Sun (use — for no class).
Put the usual class times into the header, e.g. "Class 2 (11:30–15:00)", taken from my
timetable. If a day ends at a different time, write it in that day's class cell,
e.g. "13:30 free". The app opens my way-home program when the last class ends.

Use these subject names when they fit, exactly as written:
Anatomie, Physiologie, PT Grundlagen, PT Befund, O/C, Trainingslehre, KMT, Hygiene, PPS.
For other subjects use the German subject name from the timetable, and use exactly
the same name everywhere (plan and questions). Don't put teacher names or rooms
into the Class columns (put them into Notes if wanted).

== 2. Page "<Subject> – <lesson title>" (lesson note, for me to read) ==
A clear German summary of the slides: headings, short sentences, tables where
useful, every important term in bold, and after each section one line
"🌐 <helper language>: <short explanation>". At the end: "Bilmem gerekenler /
What I must know" as a checklist (- [ ] …). Create it inside a page "Lessons".

== 3. Database "FizyoLern Questions" (this is what the app learns from) ==
IMPORTANT, for this whole chat: the app does NOT read the lesson notes to make
questions; it only reads this database. So EVERY time you create or update a
lesson note (from slides, photos, a recording, or my own summary of the lesson),
ALWAYS add its rows to this database in the same answer, without me asking.
Never deliver a lesson note without its question rows. Base the rows on the
note's content, including any mini test at the end of the note.

Columns in this order (CSV header exactly):
Frage,Typ,Fach,Lektion,Antwort,Ablenker 1,Ablenker 2,Ablenker 3,Erklärung TR,Schlüsselbegriffe,Gizle

One row per item. Typ is one of: Kern, MCQ, Offen, Wort.
- Fach = subject name (see above). Lektion = the lesson title, the same for all rows of this lesson.
- Kern (8–12 rows): Frage = one important German sentence from the slides;
  Erklärung TR = its translation/explanation in my helper language.
- MCQ (10–15 rows): Frage = German question; Antwort = the correct answer;
  Ablenker 1–3 = three wrong but plausible answers of similar length;
  Erklärung TR = why the answer is right and the others are wrong (helper language).
  Exactly one answer may be correct. Don't give the answer away in the question.
- Offen (3–5 rows): Frage = German exam-style open question; Antwort = German
  model answer in 2–5 full sentences; Schlüsselbegriffe = 3–7 key terms separated
  by commas (use "a|b" for alternatives). Every key term must literally appear in
  the model answer.
- Wort (10–20 rows): Frage = German term (nouns with article, separable verbs as
  "auf|richten"); Antwort = translation in my helper language;
  Erklärung TR = a short German example sentence.
- Gizle = empty.
CSV rules: UTF-8, comma-separated, every field in double quotes, no line breaks
inside fields.

== 4. Database "Vocabulary" (optional, general German words) ==
CSV header: Word,English,Turkish,Example,Category,Level,Next review
Level = Neu. Leave Next review empty.

== 5. Page "Exams & Homework" ==
A simple table: | Type | Subject | Topic | Date | Status | Note |
Type = Exam or Homework, Date like 28.10.2026. Fill it from the timetable if
exams are listed; otherwise leave one empty example row.

Content rules:
- Never ask me for my Notion key (ntn_…) and never include it anywhere.
- Use only what is on the slides. If a slide contradicts a standard German
  physiotherapy textbook (e.g. Prometheus, Schünke), use the textbook-correct fact
  and add "(Folie abweichend)" in the explanation.
- No patient names or other personal data.
- At the end, list anything on the slides you could not read or were unsure about.
```

---

## Short prompts for later (same chat)

**New slides** (also for photos, a recording, or "today we did …"):
```text
New lesson material attached (subject: <Fach>). Create the lesson note page and
the rows for "FizyoLern Questions" in exactly the same format as before.
```

**Questions missing for older notes:**
```text
Check every lesson note in "Lessons". For each note that has no rows in
"FizyoLern Questions" yet (match by Lektion), create its rows now in the same format.
```

**New week:**
```text
Here is my timetable for next week. Add a new "## Week …" heading with the table
to the "Weekly Plan" page in the same format. Keep the old weeks.
```

**After a test – mistakes:**
```text
These were my mistakes in today's <Fach> test: <paste or photo>. Add them to the
"Weekly Plan" page under "### <Fach>" as:
✗ Test <date>:
- ✗ <short fact with the correct answer in **bold**>
Use ½ instead of ✗ for half-right answers. Put the bold part only on the answer.
```

**Homework to memorise:**
```text
My homework: <e.g. learn the pelvic landmarks and hip muscles>. Add it to the
"Weekly Plan" page under "### <Fach>" as:
✗ Homework – <topic>:
- ✗ <one fact per line, answer in **bold**>
```

**Exam date:**
```text
Add to "Exams & Homework": Exam · <Fach> · <topic> · <date>.
```

---

## Check that it worked
- In the app: ⚙️ → **Update now**. The message lists weeks, mistake cards, words and questions.
- **Lesson notes:** your new lesson appears with its summary, test and terms.
- **New lesson but no new questions?** Its rows are missing in *FizyoLern Questions*. Send the "Questions missing for older notes" prompt.
- **Today:** shows today's classes and the morning test.
- If something is missing, see [Troubleshooting](../README.md#troubleshooting). The usual causes are a wrong page title, the page not being inside *Physiotherapy*, or a database whose name isn't exactly *FizyoLern Questions*.
