// Renders the real TV and phone screens (public/tv.js, public/play.js) in
// jsdom, fed with states from the real engine, through every phase of both
// modes, both languages and both stories. Fails on any script error, an empty
// screen, a missing translation, or Persian on an English screen.
// Run: node test/screens.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { Game } = require('../game');
const { screenContent } = require('../bundle');

const PERSIAN = /[؀-ۿ]/;
const CONTENT = screenContent('http://localhost:3100/');
const pub = (f) => path.join(__dirname, '..', 'public', f);
const TV_SCRIPTS = ['i18n.js', 'shared.js', 'art.js', 'faces.js', 'scene.js', 'guide.js', 'cinema.js', 'audio.js', 'kamali.js', 'tv.js'];
const PHONE_SCRIPTS = ['i18n.js', 'shared.js', 'art.js', 'faces.js', 'guide.js', '../node_modules/nosleep.js/dist/NoSleep.min.js', 'play.js'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
const failures = [];
function check(label, cond) {
  if (cond) pass += 1;
  else { fail += 1; if (failures.length < 40) failures.push(label); }
}

// One screen: its page without script tags, browser stubs, a fake socket,
// then the real scripts. `handlers` are the screen's socket listeners.
function makeScreen(htmlFile, scripts, url = 'http://localhost:3100/', setup = () => {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String((e && e.message) || e)));
  vc.on('error', (...a) => errors.push(a.join(' ')));
  vc.on('warn', (...a) => { if (String(a[0]).includes('[i18n]')) errors.push(a.join(' ')); });
  const html = fs.readFileSync(pub(htmlFile), 'utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  // Reduced motion: no curtains or animation loops, every render is immediate.
  w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {} });
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  w.scrollTo = () => {};
  w.HTMLMediaElement.prototype.play = function play() { return Promise.resolve(); }; // NoSleep's video
  w.HTMLMediaElement.prototype.pause = () => {};
  w.HTMLMediaElement.prototype.load = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.fetch = async () => ({ json: async () => ({ theme: null, intro: null }) });
  w.Audio = class { play() { return Promise.resolve(); } pause() {} addEventListener() {} };
  setup(w);
  const handlers = {};
  w.io = () => ({ on: (ev, fn) => { handlers[ev] = fn; }, emit: (ev, p, cb) => { if (typeof cb === 'function') cb({ ok: true }); } });
  for (const f of scripts) {
    try { w.eval(fs.readFileSync(pub(f), 'utf8')); } catch (e) { errors.push(`${f}: ${e.message}`); }
  }
  const feed = (state) => { try { handlers.state(state); } catch (e) { errors.push(`render: ${e.stack || e.message}`); } };
  try { handlers.content(CONTENT); } catch (e) { errors.push(`content: ${e.message}`); }
  return { w, doc: w.document, errors, feed, close: () => w.close() };
}

// Click every tab (and reveal the hidden role / journal) so each tab renders.
function clickAround(phone) {
  const d = phone.doc;
  const click = (el) => { try { el.dispatchEvent(new phone.w.MouseEvent('click', { bubbles: true })); } catch (e) { phone.errors.push(`click: ${e.message}`); } };
  const tabs = [...d.querySelectorAll('#tabs [data-act="tab"]')].map((b) => b.dataset.id);
  tabs.forEach((id) => {
    const b = d.querySelector(`#tabs [data-act="tab"][data-id="${id}"]`);
    if (b) click(b);
    const veil = d.querySelector('[data-act="showRole"]');
    if (veil) click(veil);
  });
  const first = d.querySelector('#tabs [data-act="tab"]');
  if (first) click(first);
}

async function run(mode, lang, story) {
  const tag = `${mode}/${lang}/${story}`;
  const game = new Game({ timeScale: 1000, minPlayers: 4 });
  const names = ['Ana', 'Ben', 'Cyrus', 'Dara', 'Elin'];
  const ids = names.map((_, i) => `p${i}`);
  ids.forEach((id, i) => game.join(id, names[i]));
  game.setSetting('p0', 'lang', lang);
  game.setSetting('p0', 'mode', mode);
  if (mode === 'classic') game.setSetting('p0', 'story', story);
  ids.forEach((id) => game.setReady(id, true));

  const tv = makeScreen('tv.html', TV_SCRIPTS);
  // Each phone remembers its own player id (play.js reads ziafat:id).
  const phones = ids.map((id) => makeScreen('play.html', PHONE_SCRIPTS, 'http://localhost:3100/', (w) => w.localStorage.setItem('ziafat:id', JSON.stringify(id))));
  const latecomer = makeScreen('play.html', PHONE_SCRIPTS, 'http://127.0.0.1:3100/');

  const shown = new Set();
  const show = (label) => {
    const state = game.publicState();
    shown.add(state.phase);
    tv.feed({ ...state, me: null });
    phones.forEach((ph, i) => { ph.feed({ ...state, me: game.privateState(ids[i]) }); clickAround(ph); });
    latecomer.feed({ ...state, me: null });
    const where = `${tag} ${label}`;
    check(`${where}: TV renders`, tv.doc.getElementById('stage').innerHTML.trim().length > 0);
    check(`${where}: phones render`, phones.every((ph) => ph.doc.getElementById('action').innerHTML.trim().length > 0));
    if (state.phase !== 'lobby') check(`${where}: latecomer watches`, !latecomer.doc.getElementById('watch').classList.contains('hidden') && latecomer.doc.getElementById('watch').innerHTML.length > 0);
    for (const [name, sc] of [['TV', tv], ['latecomer', latecomer], ...phones.map((ph, i) => [`phone ${i}`, ph])]) {
      check(`${where}: ${name} has no errors${sc.errors.length ? ` (${sc.errors[0].slice(0, 160)})` : ''}`, sc.errors.length === 0);
      sc.errors.length = 0;
      if (lang === 'en') {
        // The language switch names each language in its own script («فارسی»).
        const body = sc.doc.body.cloneNode(true);
        body.querySelectorAll('[data-k="lang"]').forEach((b) => b.remove());
        const text = body.textContent;
        const m = text.match(/[؀-ۿ][^\n]{0,40}/);
        check(`${where}: ${name} has no Persian${m ? ` («${m[0]}»)` : ''}`, !PERSIAN.test(text));
      }
    }
  };

  show('lobby');
  game.tutorialAction('p0', 'open');
  game.tutorialAction('p0', 'next');
  show('lobby + tutorial');
  game.tutorialAction('p0', 'close');
  check(`${tag}: start`, game.start('p0').ok);
  show('intro');
  game.skip('p0');

  if (mode === 'classic') {
    for (let r = 1; r <= 3; r++) {
      if (game.phase === 'blackout') {
        // Lights out: everyone sees the board's clues; the killer douses, the rest guard.
        show(`lights out r${r}`);
        const clues = game.g.board.filter((b) => b.playerId).map((b) => b.cardId);
        check(`${tag}: phones offer the board in the dark`, !clues.length || phones.every((ph) => ph.doc.querySelector('[data-act="dark"]')));
        // The killer goes for the first clue; the others guard the last (so it vanishes when there are two or more).
        if (clues.length) ids.forEach((id) => game.darkPick(id, id === game.g.killerId ? clues[0] : clues[clues.length - 1]));
        show(`lights out r${r} chosen`);
        game.skip('p0');
      }
      show(`search r${r}`);
      if (r === 1) {
        // A phone drops: the latecomer is offered the seat, the host is asked.
        game.setConnected('p3', false);
        show('seat open');
        check(`${tag}: latecomer is offered the seat`, !!latecomer.doc.querySelector('#takeover:not(.hidden) [data-act="takeSeat"]'));
        game.requestTakeover('guest-zed', 'Zed', 'p3');
        show('takeover requested');
        check(`${tag}: host is asked`, !!phones[0].doc.querySelector('[data-act="answerTake"]'));
        game.answerTakeover('p0', 'guest-zed', false);
        game.setConnected('p3', true);
      }
      game.togglePause('p0');
      show(`search r${r} paused`);
      game.togglePause('p0');
      const killer = game.g.killerId;
      game.forge(killer, game.g.forgeryOptions[0].key, 'kitchen');
      ids.filter((id) => id !== killer).forEach((id) => game.search(id, 'kitchen'));
      await sleep(5);
      ids.forEach((id) => game.g.hands[id].filter((c) => c.kind !== 'nothing' && !c.pinned).forEach((c) => game.pin(id, c.id)));
      show(`discuss r${r}`);
      game.skip('p0');
      if (r < 3) {
        show(`vote r${r}`);
        ids.forEach((id) => game.vote(id, id === 'p1' ? 'p2' : 'p1'));
        await sleep(5);
        show(`spotlight r${r}`);
        game.skip('p0');
      }
    }
    show('final');
    ids.forEach((id) => game.final(id, { suspect: id === 'p1' ? 'p2' : 'p1', weapon: game.L.WEAPONS[0].id, room: game.L.ROOMS[0].id }));
    await sleep(5);
    for (let s = 0; s <= 4; s++) { show(`reveal ${s}`); game.next('p0'); }
  } else {
    while (game.phase !== 'final') {
      if (game.phase === 'gossip') {
        show(`gossip r${game.round}`);
        game.g.turns.forEach((t) => game.itAct(t.actorId, { targets: t.type === 'shuffle' ? ids.filter((x) => x !== t.actorId).slice(0, 2) : t.type === 'swap' ? [] : [ids.find((x) => x !== t.actorId)] }));
        show(`gossip r${game.round} acted`);
        ids.forEach((id) => game.itAnswer(id, id === 'p1' ? 'p2' : 'p1'));
        await sleep(5);
      } else {
        show(`${game.phase} r${game.round}`);
        game.skip('p0');
      }
    }
    show('final');
    ids.forEach((id) => game.itFinal(id, game.g.killers.find((k) => k !== id) || ids.find((x) => x !== id)));
    await sleep(5);
    for (let s = 0; s <= 3; s++) { show(`reveal ${s}`); game.next('p0'); }
  }
  show('results');
  check(`${tag}: end the night`, game.endNight('p0').ok);
  show('summary');
  check(`${tag}: every phase shown`, ['lobby', 'intro', 'final', 'reveal', 'results', 'summary'].every((p) => shown.has(p)));
  game.backToLobby('p0');
  show('back in the lobby');

  [tv, latecomer, ...phones].forEach((sc) => sc.close());
  game.dispose();
}

(async () => {
  for (const lang of ['fa', 'en']) {
    await run('classic', lang, 'yalda');
    await run('classic', lang, 'nowruz');
    await run('items', lang, 'yalda');
  }
  console.log(`PASS ${pass}  FAIL ${fail}`);
  failures.forEach((f) => console.log('  ✗', f));
  process.exit(fail ? 1 : 0);
})();
