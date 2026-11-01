// Oberfläche der Redaktion (nur Deutsch). Spricht nur mit dem lokalen Server (tools/redaktion/server.mjs).
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEK_PRO_ZEILE = 20; // Schätzung: so lange braucht eine Lehrkraft pro Entwurf

async function api(pfad, body) {
  const res = await fetch(pfad, body ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-redaktion': '1' }, body: JSON.stringify(body) } : {});
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.fehler || 'Fehler ' + res.status);
  return json;
}
function melde(text, bad = false) {
  const m = $('#meldung');
  m.textContent = text;
  m.className = 'meldung' + (bad ? ' bad' : '');
  m.hidden = !text;
}

let stand = null, aktiv = null, entwurf = null, filter = 'neu', bearbeite = null;

async function ladeStand() {
  stand = await api('/api/stand');
  $('#kiPill').textContent = stand.ki === 'anthropic' ? 'KI: ' + stand.modell : 'KI nicht eingerichtet · Import';
  $('#kiPill').className = 'pill' + (stand.ki === 'anthropic' ? '' : ' warn');
  $('#impFach').innerHTML = stand.faecher.map((f) => `<option>${esc(f)}</option>`).join('');
  $('#folien').innerHTML = stand.neueFolien.length ? stand.neueFolien.map((p) => `
    <div class="f"><span>📄</span><span><span>${esc(p.lektion)}.pdf</span><small>${esc(p.fach)} · ${esc(new Date(p.zeit).toLocaleDateString('de-DE'))}</small>
      <button class="btn small ghost" data-ki="${esc(p.datei)}" ${stand.ki === 'anthropic' ? '' : 'disabled title="KI nicht eingerichtet"'} style="margin-top:6px">Entwürfe erstellen</button></span><span class="tag neu">neu</span></div>`).join('')
    : '<p class="muted small">Keine neuen PDFs im Ordner „folien“.</p>';
  $('#decks').innerHTML = stand.decks.length ? stand.decks.map((d) => `
    <button class="f ${aktiv === d.id ? 'on' : ''}" data-deck="${esc(d.id)}"><span>📝</span><span><span>${esc(d.lektion)}</span><small>${esc(d.fach)} · ${d.ok} frei · ${d.neu} offen</small></span>
      <span class="tag ${d.neu ? 'neu' : 'fertig'}">${d.neu ? 'prüfen' : 'fertig'}</span></button>`).join('')
    : '<p class="muted small">Noch keine Entwürfe.</p>';
  const ok = stand.decks.reduce((n, d) => n + d.ok, 0), offen = stand.decks.reduce((n, d) => n + d.neu, 0);
  $('#sNeu').textContent = stand.neueFolien.length;
  $('#sOk').textContent = ok;
  $('#sOffen').textContent = offen;
  $('#sZeit').textContent = offen ? '~' + Math.max(1, Math.round((offen * SEK_PRO_ZEILE) / 60)) + ' min' : '–';
  $('#publish').textContent = `Freigeben & veröffentlichen (${ok})`;
  document.querySelectorAll('[data-deck]').forEach((b) => b.addEventListener('click', () => oeffne(b.dataset.deck)));
  document.querySelectorAll('[data-ki]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'KI arbeitet …';
    try { const r = await api('/api/entwurf/ki', { datei: b.dataset.ki }); melde('Entwürfe erstellt.'); await ladeStand(); await oeffne(r.id); } catch (e) { melde(e.message, true); b.disabled = false; b.textContent = 'Entwürfe erstellen'; }
  }));
}

async function oeffne(id) {
  aktiv = id; bearbeite = null;
  entwurf = await api('/api/entwurf?id=' + encodeURIComponent(id));
  zeichne();
  await ladeStand();
}

const ziel = (ck) => (entwurf.ziele.find((z) => z.id === ck) || {}).text;
const STATUS = { ok: '✓ freigegeben', geloescht: 'gelöscht', neu: '' };

function zeile(r) {
  if (bearbeite === r.id) return formular(r);
  const inhalt = r.typ === 'MCQ' ? [`<div class="o r">${esc(r.antwort)}</div>`, ...r.ablenker.map((a) => `<div class="o w">${esc(a)}</div>`)].join('')
    : r.typ === 'Offen' ? `<div class="small">Musterlösung: ${esc(r.antwort)}</div><div class="src">Schlüsselbegriffe: ${r.kw.map(esc).join(' · ')}</div>`
    : r.typ === 'Wort' ? (r.beispiel ? `<div class="small">Beispiel: „${esc(r.beispiel)}“</div>` : '')
    : r.antwort ? `<div class="small">${esc(r.antwort)}</div>` : '';
  return `<div class="q ${r.status}" data-id="${esc(r.id)}">
    <div class="meta"><span class="typ">${esc(r.typ)}</span>${r.ck && ziel(r.ck) ? `<span>· Lernziel: ${esc(ziel(r.ck))}</span>` : ''}${STATUS[r.status] ? `<span>· ${STATUS[r.status]}</span>` : ''}<span>· ${r.uebersetzung === 'ok' ? 'Übersetzung automatisch ✓' : 'Übersetzung folgt automatisch'}</span></div>
    <div class="txt">${esc(r.frage)}</div>${inhalt}
    ${r.quelle ? `<div class="src">Quelle: ${esc(r.quelle)}</div>` : ''}
    ${r.hinweis ? `<div class="warnbox">⚠️ KI-Hinweis: ${esc(r.hinweis)} Bitte prüfen.</div>` : ''}
    <div class="acts">
      ${r.status === 'ok' ? '' : '<button class="btn small" data-a="freigeben">✓ Freigeben</button>'}
      <button class="btn small ghost" data-a="edit">✎ Bearbeiten</button>
      ${r.status === 'geloescht' ? '<button class="btn small ghost" data-a="zuruecksetzen">Wiederherstellen</button>' : '<button class="btn small bad" data-a="loeschen">✕ Löschen</button>'}
    </div></div>`;
}

function formular(r) {
  const feld = (name, label, wert, rows = 2) => `<label>${label}<textarea name="${name}" rows="${rows}">${esc(wert)}</textarea></label>`;
  return `<div class="q" data-id="${esc(r.id)}"><div class="meta"><span class="typ">${esc(r.typ)}</span><span>· bearbeiten (nur Deutsch)</span></div>
    ${feld('frage', r.typ === 'Wort' ? 'Begriff (mit Artikel, trennbare Verben „auf|richten“)' : r.typ === 'Kern' ? 'Satz' : 'Frage', r.frage)}
    ${r.typ === 'MCQ' ? `${feld('antwort', 'Richtige Antwort', r.antwort, 1)}${feld('ablenker', 'Falsche Antworten (eine pro Zeile, genau 3)', r.ablenker.join('\n'), 3)}` : ''}
    ${r.typ === 'Offen' ? `${feld('antwort', 'Musterlösung', r.antwort, 4)}${feld('kw', 'Schlüsselbegriffe (durch Komma; Alternativen „a|b“)', r.kw.join(', '), 1)}` : ''}
    ${r.typ === 'Wort' ? feld('beispiel', 'Beispielsatz (Deutsch)', r.beispiel, 1) : ''}
    ${feld('quelle', 'Quelle', r.quelle, 1)}
    <div class="acts"><button class="btn small" data-a="speichern">Speichern</button><button class="btn small ghost" data-a="abbrechen">Abbrechen</button></div></div>`;
}

function zeichne() {
  const rows = entwurf.rows.filter((r) => !filter || r.status === filter);
  $('#midTitle').textContent = `Entwürfe prüfen – ${entwurf.deck.lektion} · ${entwurf.rows.filter((r) => r.status === 'ok').length} von ${entwurf.rows.filter((r) => r.status !== 'geloescht').length} frei`;
  $('#rows').innerHTML = rows.length ? rows.map(zeile).join('') : '<p class="muted">Nichts in dieser Ansicht.</p>';
  $('#klassen').innerHTML = stand.klassen.length ? stand.klassen.map((k) => `<label class="cls"><input type="checkbox" value="${esc(k.id)}" ${entwurf.klassen.includes(k.id) ? 'checked' : ''}> ${esc(k.name)}${k.year ? ` (${k.year}. Jahr)` : ''}</label>`).join('')
    : '<p class="muted small">Keine Klassen im Ordner „klassen“.</p>';
  document.querySelectorAll('#klassen input').forEach((c) => c.addEventListener('change', async () => {
    const ids = [...document.querySelectorAll('#klassen input:checked')].map((x) => x.value);
    try { entwurf.klassen = (await api('/api/klassen', { deck: entwurf.deck.id, klassen: ids })).klassen; } catch (e) { melde(e.message, true); }
  }));
}

$('#rows').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const box = b.closest('[data-id]'), id = box.dataset.id, a = b.dataset.a;
  const r = entwurf.rows.find((x) => x.id === id);
  if (a === 'edit') { bearbeite = id; return zeichne(); }
  if (a === 'abbrechen') { bearbeite = null; return zeichne(); }
  b.disabled = true;
  try {
    let neu;
    if (a === 'speichern') {
      const v = (n) => { const el = box.querySelector(`[name="${n}"]`); return el ? el.value : undefined; };
      const felder = { frage: v('frage'), quelle: v('quelle') };
      if (r.typ === 'MCQ') { felder.antwort = v('antwort'); felder.ablenker = v('ablenker').split('\n').map((x) => x.trim()).filter(Boolean); }
      if (r.typ === 'Offen') { felder.antwort = v('antwort'); felder.kw = v('kw').split(',').map((x) => x.trim()).filter(Boolean); }
      if (r.typ === 'Wort') felder.beispiel = v('beispiel');
      if (r.typ === 'MCQ' && felder.ablenker.length !== 3) throw new Error('Bitte genau 3 falsche Antworten.');
      neu = await api('/api/zeile', { deck: entwurf.deck.id, id, aktion: 'bearbeiten', felder });
      bearbeite = null;
    } else neu = await api('/api/zeile', { deck: entwurf.deck.id, id, aktion: a });
    entwurf.rows[entwurf.rows.indexOf(r)] = neu;
    zeichne();
    ladeStand();
  } catch (err) { melde(err.message, true); b.disabled = false; }
});

$('#filter').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  document.querySelectorAll('#filter button').forEach((x) => x.classList.toggle('on', x === b));
  if (entwurf) zeichne();
});

$('#impBtn').addEventListener('click', async () => {
  try {
    const r = await api('/api/entwurf/import', { fach: $('#impFach').value, lektion: $('#impLektion').value, text: $('#impText').value });
    $('#impText').value = '';
    melde(`${r.n} Entwürfe importiert.`);
    await ladeStand();
    await oeffne(r.id);
  } catch (e) { melde(e.message, true); }
});

$('#publish').addEventListener('click', async () => {
  const b = $('#publish');
  b.disabled = true;
  try {
    const r = await api('/api/veroeffentlichen', {});
    melde([
      `Kurspakete gebaut (Ordner ${r.ordner}):`, ...r.pakete.map((p) => `• ${p.name}: ${p.n} Fragen`),
      r.offenUebersetzung ? `Hinweis: ${r.offenUebersetzung} freigegebene Zeilen ohne automatische Übersetzung (KI nicht eingerichtet).` : '',
      r.uebersprungen.length ? `Nicht übernommen (unvollständig):\n${r.uebersprungen.join('\n')}` : '',
    ].filter(Boolean).join('\n'), !!r.uebersprungen.length);
  } catch (e) { melde(e.message, true); }
  b.disabled = false;
});

ladeStand().catch((e) => melde(e.message, true));
