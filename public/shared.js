/* Shared client helpers for tv.js and play.js */
(function () {
  // Current language (set from each state). num() writes digits for it;
  // t() translates interface text (public/i18n.js).
  let lang = 'fa';
  const setLang = (l) => {
    if (l === lang) return false;
    lang = l;
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'en' ? 'ltr' : 'rtl';
    applyStatic();
    return true;
  };
  const getLang = () => lang;
  const num = (v) => window.I18N.digits(lang, v);
  const t = (text, vars) => window.I18N.tr(lang, text, vars);
  // Static page text carries its Farsi source in data-i18n / data-i18n-ph.
  const applyStatic = () => {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  // crypto.randomUUID needs a secure context; the game runs on plain http LAN.
  const makeId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  let clockOffset = 0;
  const syncClock = (serverNow) => { if (serverNow) clockOffset = serverNow - Date.now(); };
  const now = () => Date.now() + clockOffset;

  function remaining(timer) {
    if (!timer) return null;
    return Math.max(0, timer.endsAt - now());
  }

  // Elements with data-timer get their text + --p (0..1 progress) updated every frame.
  let currentTimer = null;
  const setTimer = (t) => { currentTimer = t; };
  function tick() {
    const els = document.querySelectorAll('[data-timer]');
    if (els.length) {
      const ms = remaining(currentTimer);
      els.forEach((el) => {
        if (ms == null) { el.style.visibility = 'hidden'; return; }
        el.style.visibility = '';
        const secs = Math.ceil(ms / 1000);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        const label = el.querySelector('[data-timer-label]') || el;
        label.textContent = m ? `${num(m)}:${num(String(s).padStart(2, '0'))}` : num(s);
        el.style.setProperty('--p', currentTimer.duration ? (ms / currentTimer.duration).toFixed(4) : 0);
        el.classList.toggle('urgent', secs <= 10);
      });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------------------------------------------------------- clue meaning (classic)
  // Each clue card carries `about`: what it claims, in data. clueTag() turns
  // that into a one-line tag; caseFacts() adds a set of cards up.
  // h = { C: content bundle, artOf(obj), nameOf(playerId) }.
  function clueTag(a, h) {
    if (!a) return '';
    const by = (list, id) => list.find((x) => x.id === id);
    let body = '';
    if (a.type === 'weapon') { const w = by(h.C.weapons, a.id); body = t('سلاح نیست: {x}', { x: `${h.artOf(w)} <b>${esc(w.name)}</b>` }); }
    else if (a.type === 'room') { const r = by(h.C.rooms, a.id); body = t('محل قتل نیست: {x}', { x: `${h.artOf(r)} <b>${esc(r.name)}</b>` }); }
    else if (a.type === 'trait') { const tr = by(h.C.traits, a.id); body = t('قاتل: {x}', { x: `${h.artOf(tr)} <b>${esc(a.has ? tr.name : tr.no)}</b>` }); }
    else if (a.type === 'alibi') body = t('شاهد دارد: {x}', { x: `<b>${esc(h.nameOf(a.playerId))}</b>` });
    else if (a.type === 'motive') body = t('انگیزه داشت: {x}', { x: `<b>${esc(h.nameOf(a.playerId))}</b>` });
    return body ? `<div class="ctag ctag-${a.type}">${body}</div>` : '';
  }

  // cards: [{about, text?, playerId?}]. True clues never contradict each
  // other, so every conflict found here means a forged clue is among them.
  function caseFacts(cards, C) {
    const f = { weaponsOut: new Set(), roomsOut: new Set(), traits: {}, alibis: new Set(), motives: new Set(), conflicts: [] };
    const shownBy = new Map(); // text -> first player who showed it
    const dupes = new Set();
    cards.forEach((c) => {
      const a = c.about;
      if (!a) return;
      if (a.type === 'weapon') f.weaponsOut.add(a.id);
      else if (a.type === 'room') f.roomsOut.add(a.id);
      else if (a.type === 'trait') f.traits[a.id] = f.traits[a.id] === undefined || f.traits[a.id] === a.has ? a.has : 'conflict';
      else if (a.type === 'alibi') f.alibis.add(a.playerId);
      else if (a.type === 'motive') f.motives.add(a.playerId);
      // The same clue shown by two players: one of them holds the killer's copy.
      if (c.playerId && c.text) {
        if (shownBy.has(c.text) && shownBy.get(c.text) !== c.playerId) dupes.add(c.text);
        else if (!shownBy.has(c.text)) shownBy.set(c.text, c.playerId);
      }
    });
    C.traits.forEach((tr) => { if (f.traits[tr.id] === 'conflict') f.conflicts.push({ type: 'trait', id: tr.id }); });
    if (f.weaponsOut.size >= C.weapons.length) f.conflicts.push({ type: 'weapons' });
    if (f.roomsOut.size >= C.rooms.length) f.conflicts.push({ type: 'rooms' });
    dupes.forEach((text) => f.conflicts.push({ type: 'dupe', text }));
    f.knownTraits = C.traits.filter((tr) => typeof f.traits[tr.id] === 'boolean').length;
    // Does a character's trait list match every trait the clues agree on?
    f.fits = (charTraits) => C.traits.every((tr, i) => typeof f.traits[tr.id] !== 'boolean' || !!charTraits[i] === f.traits[tr.id]);
    return f;
  }

  window.Z = { num, t, setLang, getLang, esc, store, makeId, syncClock, now, remaining, setTimer, clueTag, caseFacts };
})();
