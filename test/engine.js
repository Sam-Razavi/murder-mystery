// Plays many random games straight against the engine and checks invariants.
// Run: node test/engine.js
const { Game, STORIES } = require('../game');
const CF = require('../content');
const PERSIAN = /[\u0600-\u06FF]/;

let pass = 0;
let fail = 0;
const failures = [];
function check(label, cond) {
  if (cond) pass += 1;
  else { fail += 1; if (failures.length < 30) failures.push(label); }
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The screens' shared helpers (clue tags, case file) need a minimal browser.
global.window = { I18N: require('../public/i18n') };
global.document = { querySelectorAll: () => [], documentElement: {} };
global.requestAnimationFrame = () => {};
require('../public/shared.js');
const { Z } = global.window;
delete global.window;

async function playOne(n, gameNo, lang = 'fa', story = 'yalda') {
  const C = STORIES[story][lang];
  const game = new Game({ timeScale: 1000, minPlayers: 4 });
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  ids.forEach((id, i) => game.join(id, `Bot${i}`));
  if (lang === 'en') check(`[${n}] set English`, game.setSetting('p0', 'lang', 'en').ok);
  if (story !== 'yalda') check(`[${n}] set story ${story}`, game.setSetting('p0', 'story', story).ok && game.publicState().story === story);
  // In English, nothing any screen receives may contain Persian.
  const noPersian = (label) => {
    if (lang !== 'en') return;
    const all = JSON.stringify([game.publicState(), ...ids.map((id) => game.privateState(id))]);
    check(`[${n}] en ${label}: no Persian`, !PERSIAN.test(all));
  };
  check(`[${n}] vip is first player`, game.vipId === 'p0');
  check(`[${n}] cannot start as non-vip`, !game.start('p1').ok);
  check(`[${n}] cannot start before everyone is ready`, !game.start('p0').ok);
  ids.slice(0, -1).forEach((id) => game.setReady(id, true));
  check(`[${n}] one player still not ready`, !game.start('p0').ok && game.phase === 'lobby');
  game.setReady(ids[n - 1], true);
  check(`[${n}] start ok`, game.start('p0').ok);
  check(`[${n}] ready flags reset on start`, game.players.every((p) => !p.ready));
  check(`[${n}] cannot toggle ready mid-game`, !game.setReady('p1', true).ok);
  check(`[${n}] cannot join mid-game`, !game.join('late', 'Late').ok);
  check(`[${n}] language locked mid-game`, !game.setSetting('p0', 'lang', lang === 'en' ? 'fa' : 'en').ok);
  if (lang === 'en') check(`[${n}] en error text`, !PERSIAN.test(game.join('late', 'Late').error));
  noPersian('intro');

  const g = game.g;
  const killer = g.killerId;
  const kChar = C.CHARACTERS.find((c) => c.id === g.chars[killer]);
  const weapon = C.WEAPONS.find((w) => w.id === g.weapon);
  const room = C.ROOMS.find((r) => r.id === g.room);

  check(`[${n}] unique characters`, new Set(Object.values(g.chars)).size === n);
  check(`[${n}] public state hides killer`, !JSON.stringify(game.publicState()).includes('"killerId"'));
  const roles = ids.map((id) => game.privateState(id).role);
  check(`[${n}] exactly one killer`, roles.filter((r) => r === 'killer').length === 1);
  check(`[${n}] killer sees truth`, game.privateState(killer).truth.weapon === g.weapon);
  check(`[${n}] innocents have missions`, ids.filter((id) => id !== killer).every((id) => game.privateState(id).mission));

  game.skip('p0'); // intro -> search

  for (let r = 1; r <= 3; r++) {
    check(`[${n}] round ${r} search phase`, game.phase === 'search' && game.round === r);
    const kp = game.privateState(killer);
    check(`[${n}] killer has forgery options r${r}`, kp.forgeryOptions.length >= 1);
    check(`[${n}] innocent cannot forge`, !game.forge(ids.find((x) => x !== killer), kp.forgeryOptions[0].key, 'library').ok);
    // Plant in a room an innocent will search, sometimes.
    const plantRoom = pick(C.ROOMS).id;
    game.forge(killer, pick(kp.forgeryOptions).key, plantRoom);
    const before = Object.fromEntries(ids.map((id) => [id, g.hands[id].length]));
    const leaveOneOut = Math.random() < 0.2; // someone forgets to search -> timer path
    ids.filter((id) => id !== killer).forEach((id, i) => {
      if (leaveOneOut && i === 0) return;
      game.search(id, Math.random() < 0.5 ? plantRoom : pick(C.ROOMS).id);
    });
    if (leaveOneOut) await sleep(100); // search timer at 1000x = 40ms (60ms in beginner mode)
    else await sleep(5);
    check(`[${n}] r${r} moved to discuss (${game.phase})`, game.phase === 'discuss');
    noPersian(`r${r} discuss`);
    ids.forEach((id) => {
      const got = g.hands[id].length - before[id];
      if (id === killer) check(`[${n}] killer got 1 forged copy`, got === 1);
      else check(`[${n}] innocent got cards (${got})`, got >= 1 && got <= g.cardsPerSearch);
      check(`[${n}] visit recorded`, g.visits[id].length === r);
    });
    // Pins
    ids.forEach((id) => {
      const card = g.hands[id].find((c) => !c.pinned && c.kind !== 'nothing');
      if (card && Math.random() < 0.7) check(`[${n}] pin ok`, game.pin(id, card.id).ok);
      if (card && card.pinned) check(`[${n}] double pin rejected`, !game.pin(id, card.id).ok);
    });
    game.skip('p0');
    if (r < 3) {
      check(`[${n}] vote phase`, game.phase === 'vote');
      check(`[${n}] self vote rejected`, !game.vote('p1', 'p1').ok);
      ids.forEach((id) => game.vote(id, pick(ids.filter((x) => x !== id))));
      await sleep(5);
      check(`[${n}] spotlight phase`, game.phase === 'spotlight');
      const sp = game.publicState().game.spotlight;
      check(`[${n}] spotlight lists rooms`, sp && sp.rooms.length === r);
      game.skip('p0');
    }
  }
  check(`[${n}] final phase`, game.phase === 'final');
  ids.forEach((id) => {
    const suspect = Math.random() < 0.5 && id !== killer ? killer : pick(ids.filter((x) => x !== id));
    game.final(id, { suspect, weapon: pick(C.WEAPONS).id, room: pick(C.ROOMS).id });
  });
  await sleep(5);
  check(`[${n}] reveal phase`, game.phase === 'reveal');
  check(`[${n}] reveal step 0 hides killer`, game.publicState().game.reveal.killerId === undefined);
  check(`[${n}] non-vip cannot skip reveal`, !game.skipReveal('p1').ok);
  if (gameNo % 2) check(`[${n}] vip skips to results`, game.skipReveal('p0').ok && game.phase === 'results');
  else for (let s = 0; s < 5; s++) game.next('p0');
  check(`[${n}] results phase`, game.phase === 'results');
  noPersian('results');
  check(`[${n}] skip reveal only during reveal`, !game.skipReveal('p0').ok);
  const res = game.publicState().game.reveal;
  check(`[${n}] results show killer`, res.killerId === killer && res.points.length === n);

  // ---- clue consistency: every genuine clue must be TRUE
  const allCards = ids.flatMap((id) => g.hands[id]);
  allCards.filter((c) => !c.forged).forEach((c) => {
    if (c.kind === 'weapon') check(`[${n}] true weapon clue never clears real weapon`, !c.text.includes(weapon.clear));
    if (c.kind === 'room') check(`[${n}] true room clue never clears real room`, !c.text.includes(room.clear));
    if (c.kind === 'trait') {
      const t = C.TRAITS.find((tt) => c.text.includes(tt.yesClue) || c.text.includes(tt.noClue));
      const i = C.TRAITS.indexOf(t);
      const says = c.text.includes(t.yesClue) ? 1 : 0;
      check(`[${n}] trait clue matches killer`, says === kChar.traits[i]);
    }
    if (c.kind === 'alibi') check(`[${n}] alibi never for killer`, !c.text.includes(kChar.name + ' ('));
  });
  // every forged card is a lie or a fake alibi for the killer
  allCards.filter((c) => c.forged).forEach((c) => {
    const lie = c.text.includes(weapon.clear) || c.text.includes(room.clear) || c.kind === 'alibi'
      || C.TRAITS.some((t, i) => c.text.includes(kChar.traits[i] ? t.noClue : t.yesClue));
    check(`[${n}] forged card is a lie`, lie);
  });
  // every card says in data what it proves, and that matches its text
  allCards.filter((c) => c.kind !== 'nothing').forEach((c) => {
    const a = c.about || {};
    check(`[${n}] card has about of its kind`, a.type === c.kind);
    if (a.type === 'weapon') check(`[${n}] weapon about matches text`, c.text === C.WEAPONS.find((w) => w.id === a.id).clear);
    if (a.type === 'room') check(`[${n}] room about matches text`, c.text === C.ROOMS.find((r) => r.id === a.id).clear);
    if (a.type === 'trait') {
      const t = C.TRAITS.find((tt) => tt.id === a.id);
      check(`[${n}] trait about matches text`, c.text === (a.has ? t.yesClue : t.noClue));
      check(`[${n}] trait about true unless forged`, (a.has === !!kChar.traits[C.TRAITS.indexOf(t)]) === !c.forged);
    }
    if (a.type === 'alibi') check(`[${n}] alibi about names the right player`, (a.playerId === killer) === !!c.forged);
  });
  // the case file over every genuine clue: no conflicts, never rules out the truth
  const trueCards = allCards.filter((c) => !c.forged).map((c) => ({ about: c.about, text: c.text, playerId: 'x' }));
  const facts = Z.caseFacts(trueCards, { weapons: C.WEAPONS, rooms: C.ROOMS, traits: C.TRAITS });
  check(`[${n}] true clues never conflict`, facts.conflicts.length === 0);
  check(`[${n}] true clues never clear the real weapon/room`, !facts.weaponsOut.has(g.weapon) && !facts.roomsOut.has(g.room));
  check(`[${n}] killer always fits the true trait clues`, facts.fits(kChar.traits));
  check(`[${n}] killer never has a true alibi`, !facts.alibis.has(killer));
  // board entries carry what they prove and the round they were pinned in
  g.board.forEach((b) => check(`[${n}] board entry has about + pinRound`, b.about && b.about.type === b.kind && b.pinRound >= 1 && b.pinRound <= 3));
  // a forged clue pinned by both its finder and the killer shows up as a duplicate
  const plant = g.plants.find((p) => p.deliveredTo);
  if (plant) {
    const both = [{ about: { type: 'motive' }, text: plant.text, playerId: plant.deliveredTo }, { about: { type: 'motive' }, text: plant.text, playerId: killer }];
    check(`[${n}] duplicate pinned clue is flagged`, Z.caseFacts(both, { weapons: C.WEAPONS, rooms: C.ROOMS, traits: C.TRAITS }).conflicts.some((x) => x.type === 'dupe'));
  }
  // innocents never see a forged flag
  ids.filter((id) => id !== killer).forEach((id) => {
    check(`[${n}] no forged flag leaks`, game.privateState(id).hand.every((c) => c.forged === undefined));
  });
  // scoring adds up
  game.g.results.points.forEach((p) => {
    check(`[${n}] breakdown sums`, p.total === p.breakdown.reduce((s, b) => s + b.pts, 0));
  });
  const totalScore = game.players.reduce((s, p) => s + p.score, 0);
  check(`[${n}] scores applied`, totalScore === game.g.results.points.reduce((s, p) => s + p.total, 0));

  // play again keeps scores
  check(`[${n}] play again`, game.start('p0').ok && game.phase === 'intro');
  check(`[${n}] scores kept`, game.players.reduce((s, p) => s + p.score, 0) === totalScore);
  game.dispose();
  return { caught: res.caught, delivered: g.plants.filter((p) => p.deliveredTo).length };
}

(async () => {
  const stats = { games: 0, caught: 0, delivered: 0 };
  for (let k = 0; k < 40; k++) {
    for (const n of [4, 5, 6, 7, 8]) {
      const r = await playOne(n, k, k % 2 ? 'en' : 'fa', k % 4 >= 2 ? 'nowruz' : 'yalda');
      stats.games += 1;
      if (r.caught) stats.caught += 1;
      stats.delivered += r.delivered;
    }
  }
  // Every story keeps the family (ids, traits) and six weapons and rooms.
  for (const [id, L] of Object.entries(STORIES)) {
    for (const lang of ['fa', 'en']) {
      const B = L[lang];
      check(`story ${id}/${lang}: same characters and traits`, JSON.stringify(B.CHARACTERS.map((c) => [c.id, c.traits])) === JSON.stringify(CF.CHARACTERS.map((c) => [c.id, c.traits])));
      check(`story ${id}/${lang}: same trait ids`, B.TRAITS.map((t) => t.id).join() === CF.TRAITS.map((t) => t.id).join());
      check(`story ${id}/${lang}: 6 weapons, 6 rooms, unique ids`, B.WEAPONS.length === 6 && B.ROOMS.length === 6 && new Set(B.WEAPONS.map((w) => w.id)).size === 6 && new Set(B.ROOMS.map((r) => r.id)).size === 6);
      check(`story ${id}/${lang}: eyebrow and victim`, !!B.STORY.eyebrow && !!B.STORY.victim);
      check(`story ${id}/${lang}: same ids in both languages`, JSON.stringify([B.WEAPONS, B.ROOMS].map((l) => l.map((x) => x.id))) === JSON.stringify([L.fa.WEAPONS, L.fa.ROOMS].map((l) => l.map((x) => x.id))));
      if (lang === 'en') check(`story ${id}/en: no Persian`, !PERSIAN.test(JSON.stringify([B.STORY, B.TRAITS, B.CHARACTERS, B.WEAPONS, B.ROOMS, B.ALIBI_TEMPLATES, B.MOTIVE_TEMPLATES])));
    }
  }
  // Hand to Hand ignores the story setting.
  const sg = new Game({ minPlayers: 4 });
  ['a', 'b', 'c', 'd'].forEach((x) => sg.join(x, x));
  sg.setSetting('a', 'story', 'nowruz');
  sg.setSetting('a', 'mode', 'items');
  check('items mode always plays Yalda', sg.publicState().story === 'yalda');
  sg.dispose();

  // Lobby edge cases
  const C = CF;
  const lg = new Game({ minPlayers: 4 });
  check('cannot start with 3', (() => { ['a', 'b', 'c'].forEach((x) => lg.join(x, x)); return !lg.start('a').ok; })());
  check('duplicate name rejected', !lg.join('d', 'A').ok);
  check('empty name rejected', !lg.join('e', '  ').ok);
  lg.setConnected('a', false);
  check('vip moves when vip disconnects', lg.vipId === 'b');
  check('kick by vip', lg.kick('b', 'c').ok && !lg.player('c'));
  ['f', 'g', 'h', 'i', 'j', 'k'].forEach((x) => lg.join(x, x));
  check('8 players in lobby', lg.players.length === 8);
  check('portraits unique on join', new Set(lg.players.map((p) => p.portrait)).size === 8 && lg.players.every((p) => C.PORTRAITS.includes(p.portrait)));
  const freeP = C.PORTRAITS.find((x) => !lg.players.some((p) => p.portrait === x));
  check('pick a free portrait', lg.setPortrait('b', freeP).ok && lg.player('b').portrait === freeP);
  check('taken portrait rejected', !lg.setPortrait('f', freeP).ok);
  check('unknown portrait rejected', !lg.setPortrait('f', '🔪').ok);
  check('portrait is public', lg.publicState().players.find((p) => p.id === 'b').portrait === freeP);
  ['m', 'n', 'o', 'q'].forEach((x) => lg.join(x, x));
  check('up to 12 players can join', lg.players.length === 12 && !lg.join('p', 'p').ok);
  check('portraits still unique at 12', new Set(lg.players.map((p) => p.portrait)).size === 12);
  lg.players.forEach((p) => lg.setReady(p.id, true));
  check('modeMax is 8 in classic', lg.publicState().modeMax === 8 && lg.publicState().maxPlayers === 12);
  check('classic start refused with 12', !lg.start('b').ok && lg.phase === 'lobby');
  ['m', 'n', 'o', 'q'].forEach((x) => lg.setConnected(x, false));
  ['m', 'n', 'o', 'q'].forEach((x) => lg.kick('b', x));
  lg.players.forEach((p) => lg.setReady(p.id, true));
  check('classic start allowed again at 8', lg.players.length === 8 && lg.start('b').ok);
  lg.backToLobby('b');
  ['m', 'n', 'o', 'q'].forEach((x) => lg.join(x, x));
  lg.setSetting('b', 'mode', 'items');
  lg.players.forEach((p) => lg.setReady(p.id, true));
  check('modeMax is 12 in items', lg.publicState().modeMax === 12);
  check('items start allowed with 12', lg.start('b').ok && lg.g.killers.length === 3);
  // Play-again path: switching back to classic after a 12-player game is refused at start.
  for (let i = 0; i < 60 && lg.phase !== 'reveal'; i++) lg.skip('b');
  check('12-player game reaches reveal', lg.skipReveal('b').ok && lg.phase === 'results');
  check('switch to classic on results screen', lg.setSetting('b', 'mode', 'classic').ok);
  check('classic play-again refused with 12', !lg.start('b').ok && lg.phase === 'results');
  lg.dispose();

  // Cinematic prologue + lobby tutorial, in both modes.
  for (const mode of ['classic', 'items']) {
    const cg = new Game({ timeScale: 1, minPlayers: 4, cinematic: 30 });
    ['a', 'b', 'c', 'd'].forEach((id) => cg.join(id, id));
    if (mode === 'items') cg.setSetting('a', 'mode', 'items');
    const tag = `prologue ${mode}`;
    // tutorial: host only, lobby only, clamped, cleared by start
    check(`${tag}: tutorial closed by default`, cg.publicState().tutorial === null);
    check(`${tag}: non-host cannot open tutorial`, !cg.tutorialAction('b', 'open').ok);
    check(`${tag}: cannot step a closed tutorial`, !cg.tutorialAction('a', 'next').ok);
    check(`${tag}: host opens tutorial at slide 0`, cg.tutorialAction('a', 'open').ok && cg.publicState().tutorial === 0);
    for (let i = 0; i < 20; i++) cg.tutorialAction('a', 'next');
    check(`${tag}: tutorial stops at the last slide (5)`, cg.publicState().tutorial === 5);
    for (let i = 0; i < 20; i++) cg.tutorialAction('a', 'prev');
    check(`${tag}: tutorial stops at the first slide`, cg.publicState().tutorial === 0);
    check(`${tag}: bad tutorial action refused`, !cg.tutorialAction('a', 'explode').ok);
    cg.players.forEach((p) => cg.setReady(p.id, true));
    check(`${tag}: start ok with tutorial open`, cg.start('a').ok && cg.publicState().tutorial === null);
    // prologue: first skip ends only the cinematic, second skip ends the intro
    check(`${tag}: starts in intro with prologue`, cg.phase === 'intro' && cg.publicState().prologue === true);
    check(`${tag}: prologue timer is the cinematic length`, Math.round(cg.timer.duration / 1000) === 30);
    check(`${tag}: tutorial refused outside the lobby`, !cg.tutorialAction('a', 'open').ok);
    check(`${tag}: non-host cannot skip prologue`, !cg.skip('b').ok && cg.publicState().prologue === true);
    check(`${tag}: host skip ends the prologue only`, cg.skip('a').ok && cg.phase === 'intro' && cg.publicState().prologue === false);
    check(`${tag}: story intro has its own timer`, Math.round(cg.timer.duration / 1000) === 35);
    check(`${tag}: second skip leaves the intro`, cg.skip('a').ok && cg.phase !== 'intro');
    cg.backToLobby('a');
    check(`${tag}: lobby clears prologue`, cg.publicState().prologue === false);
    cg.dispose();
  }
  // Slides and captions: 6 per mode in each language, English free of Persian,
  // and the same count the engine clamps to.
  global.window = {};
  require('../public/guide.js');
  const { GUIDE, CINEMA, steps } = global.window.Guide;
  for (const lang of ['fa', 'en']) {
    for (const mode of ['classic', 'items']) {
      const slides = GUIDE[lang][mode];
      check(`guide ${lang}/${mode}: 6 complete slides`, slides.length === 6 && slides.every((s) => s.icon && s.title && s.text));
      if (lang === 'en') check('guide en/' + mode + ': no Persian', !PERSIAN.test(JSON.stringify(slides)));
    }
    for (const [id, st] of Object.entries(global.window.Guide.STORIES)) {
      check(`guide story ${id}/${lang}: opening slide`, !!(st.slide[lang].icon && st.slide[lang].title && st.slide[lang].text));
      check(`cinema story ${id}/${lang}: captions in order`, st.captions[lang].length === CINEMA[lang].captions.length && st.captions[lang].every((c, i, a) => c[0] < c[1] && (i === 0 || a[i - 1][1] <= c[0])));
      if (lang === 'en') check(`story ${id} slide/captions en: no Persian`, !PERSIAN.test(JSON.stringify([st.slide.en, st.captions.en])));
    }
    check(`cinema ${lang}: captions in order`, CINEMA[lang].captions.every((c, i, a) => c[0] < c[1] && (i === 0 || a[i - 1][1] <= c[0]) && c[1] <= 1) && !!CINEMA[lang].skip);
  }
  check('cinema en: no Persian', !PERSIAN.test(JSON.stringify(CINEMA.en)));
  check('guide step count matches the engine', steps === 6);
  // Kāragāh Kamali: the same moments in both languages, same placeholders, English free of Persian.
  require('../public/kamali.js');
  const KL = global.window.Kamali.LINES;
  check('kamali: same moments in both languages', JSON.stringify(Object.keys(KL.fa).sort()) === JSON.stringify(Object.keys(KL.en).sort()));
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  Object.keys(KL.fa).forEach((k) => {
    check(`kamali ${k}: lines in both languages`, KL.fa[k].length > 0 && KL.en[k].length > 0);
    check(`kamali ${k}: same placeholders`, new Set([...KL.fa[k], ...KL.en[k]].map(holes)).size === 1);
  });
  check('kamali en: no Persian', !PERSIAN.test(JSON.stringify(KL.en)));
  check('kamali: portrait for every mood', ['neutral', 'sus', 'surprised', 'pleased'].every((m) => global.window.Kamali.svg(m).includes(`m-${m}`)));
  delete global.window;

  // Bots (ids "bot-…") never host, even when the only person drops.
  const bg = new Game({ timeScale: 1, minPlayers: 4 });
  bg.join('bot-0', 'Bot A');
  check('bot alone: no person to host yet', bg.vipId === 'bot-0' || bg.vipId === null);
  bg.join('h1', 'Her'); bg.join('bot-1', 'Bot B'); bg.join('h2', 'Him');
  check('first person becomes host over an earlier bot', bg.vipId === 'h1');
  bg.setConnected('h1', false);
  check('host passes to the other person, not a bot', bg.vipId === 'h2');
  bg.setConnected('h2', false);
  check('no person online: host stays with a person', bg.vipId === 'h1' || bg.vipId === 'h2');
  bg.setConnected('h1', true);
  check('a person reconnecting hosts again', bg.vipId === 'h1');
  bg.dispose();

  // Without a cinematic (the default) the intro behaves exactly as before.
  const ng = new Game({ timeScale: 1, minPlayers: 4 });
  ['a', 'b', 'c', 'd'].forEach((id) => ng.join(id, id));
  ng.players.forEach((p) => ng.setReady(p.id, true));
  ng.start('a');
  check('no cinematic: no prologue, one skip leaves the intro', ng.publicState().prologue === false && ng.skip('a').ok && ng.phase !== 'intro');
  check('beginner mode is on by default and public', ng.publicState().beginner === true && ng.g.beginner === true);
  check('beginner: search timer is 1.5× (60s)', ng.phase === 'search' && Math.round(ng.timer.duration / 1000) === 60);
  check('beginner setting locked mid-game', !ng.setSetting('a', 'beginner', 'false').ok);
  check('case file can be switched mid-game', ng.setSetting('a', 'caseFile', 'false').ok && ng.settings.caseFile === false);
  ng.backToLobby('a');
  check('beginner can be turned off in the lobby', ng.setSetting('a', 'beginner', 'false').ok && ng.settings.beginner === false);
  ng.players.forEach((p) => ng.setReady(p.id, true));
  ng.start('a');
  ng.skip('a');
  check('without beginner: normal search timer (40s)', ng.phase === 'search' && Math.round(ng.timer.duration / 1000) === 40 && ng.publicState().beginner === false);
  ng.dispose();

  // Host pause: freezes the timer, blocks auto-advance, resumes where it was.
  const pg = new Game({ timeScale: 1000, minPlayers: 4 });
  const pids = ['a', 'b', 'c', 'd'];
  pids.forEach((id) => pg.join(id, id));
  pids.forEach((id) => pg.setReady(id, true));
  pg.start('a');
  pg.skip('a'); // intro -> search
  check('pause: non-host refused', !pg.togglePause('b').ok && !pg.paused);
  check('pause: host pauses', pg.togglePause('a').ok && pg.publicState().paused === true && pg.publicState().timer.paused === true);
  const left = pg.publicState().timer.left;
  await sleep(120); // far past the 60ms search timer at 1000×
  check('pause: timer does not fire', pg.phase === 'search' && pg.publicState().timer.left === left);
  pids.forEach((id) => (id === pg.g.killerId ? pg.forge(id, pg.g.forgeryOptions[0].key, 'library') : pg.search(id, 'library')));
  await sleep(30);
  check('pause: everyone done still waits', pg.phase === 'search');
  check('pause: host resumes', pg.togglePause('a').ok && !pg.paused && pg.timer);
  await sleep(30);
  check('pause: everyone done advances after resume', pg.phase === 'discuss');
  pg.togglePause('a');
  check('pause: skip ends the pause', pg.skip('a').ok && !pg.paused && pg.phase === 'vote');
  pg.dispose();

  // End of the night: stats add up across games, awards, and a fresh night.
  const ng2 = new Game({ timeScale: 1000, minPlayers: 4 });
  pids.forEach((id) => ng2.join(id, id));
  pids.forEach((id) => ng2.setReady(id, true));
  for (let k = 0; k < 2; k++) {
    if (k === 1) ng2.setSetting('a', 'mode', 'items');
    ng2.start('a');
    for (let i = 0; i < 80 && ng2.phase !== 'reveal'; i++) ng2.skip('a');
    ng2.skipReveal('a');
  }
  check('night: refused outside results', !ng2.endNight('b').ok);
  check('night: host ends the night', ng2.endNight('a').ok && ng2.phase === 'summary');
  const sm = ng2.publicState().summary;
  check('night: two games counted', sm.games === 2 && pids.every((id) => sm.stats[id].games === 2));
  check('night: killer games add up (1 classic + 1 items killer)', pids.reduce((s, id) => s + sm.stats[id].killerGames, 0) === 2);
  check('night: champion has the top score', sm.champions.every((id) => ng2.player(id).score === Math.max(...ng2.players.map((p) => p.score))));
  check('night: awards only for earned values', sm.awards.every((a) => a.value > 0 && a.ids.length));
  check('night: start refused from the summary', !ng2.start('a').ok);
  check('night: new night resets', ng2.newNight('a').ok && ng2.phase === 'lobby' && ng2.gamesPlayed === 0 && !Object.keys(ng2.stats).length && ng2.players.every((p) => p.score === 0));
  ng2.dispose();

  // Quick game: 2 rounds, shorter timers, discussion capped, no Stubborn mission.
  for (let k = 0; k < 6; k++) {
    const qg = new Game({ timeScale: 1000, minPlayers: 4 });
    pids.forEach((id) => qg.join(id, id));
    pids.forEach((id) => qg.setReady(id, true));
    qg.setSetting('a', 'beginner', 'false');
    qg.setSetting('a', 'quick', 'true');
    qg.start('a');
    check('quick: 2 rounds, public', qg.g.totalRounds === 2 && qg.publicState().totalRounds === 2);
    check('quick: intro timer trimmed', Math.round(qg.timer.duration) === Math.round(35 * 0.75));
    check('quick: no Stubborn mission', Object.values(qg.g.missions).every((m) => m.id !== 'stubborn'));
    qg.skip('a');
    check('quick: search timer 30s', qg.phase === 'search' && Math.round(qg.timer.duration) === 30);
    qg.skip('a');
    check('quick: discussion capped at 1:30', qg.phase === 'discuss' && Math.round(qg.timer.duration) === 90);
    qg.skip('a'); // -> vote
    qg.skip('a'); // -> search round 2 (no votes)
    qg.skip('a');
    qg.skip('a');
    check('quick: final after round 2', qg.phase === 'final' && qg.round === 2);
    qg.skip('a');
    check('quick: game ends', qg.phase === 'reveal');
    qg.dispose();
  }

  // Seat takeover rules.
  const tk = new Game({ timeScale: 1000, minPlayers: 4 });
  pids.forEach((id) => tk.join(id, `P${id}`));
  pids.forEach((id) => tk.setReady(id, true));
  check('takeover: refused in the lobby', !tk.requestTakeover('g1', 'New', 'b').ok);
  tk.start('a');
  check('takeover: refused for an online seat', !tk.requestTakeover('g1', 'New', 'b').ok);
  tk.setConnected('b', false);
  check('takeover: refused with a taken name', !tk.requestTakeover('g1', 'Pa', 'b').ok);
  check('takeover: refused without a name', !tk.requestTakeover('g1', '  ', 'b').ok);
  check('takeover: refused for a player id as guest', !tk.requestTakeover('c', 'New', 'b').ok);
  check('takeover: the seat\'s own name is fine', tk.requestTakeover('g1', 'Pb', 'b').ok);
  check('takeover: newest request for a seat wins', tk.requestTakeover('g2', 'New', 'b').ok && tk.takeovers.length === 1 && tk.takeovers[0].guestId === 'g2');
  check('takeover: public, with names', tk.publicState().takeovers[0].name === 'New');
  check('takeover: host only', !tk.answerTakeover('c', 'g2', true).ok);
  check('takeover: deny removes it', tk.answerTakeover('a', 'g2', false).ok && tk.takeovers.length === 0 && tk.player('b').name === 'Pb');
  tk.requestTakeover('g3', 'Newer', 'b');
  const ans = tk.answerTakeover('a', 'g3', true);
  check('takeover: allow renames the seat and hands over its id', ans.ok && ans.adopt === 'b' && tk.player('b').name === 'Newer');
  tk.requestTakeover('g4', 'Late', 'b');
  tk.setConnected('b', true);
  check('takeover: owner coming back drops requests', tk.takeovers.length === 0);
  tk.setConnected('c', false);
  tk.requestTakeover('g5', 'Late', 'c');
  tk.backToLobby('a');
  check('takeover: lobby clears requests', tk.takeovers.length === 0 && tk.publicState().takeovers.length === 0);
  tk.dispose();

  // Balance log: one outcome per finished game, numbers only (no names or ids).
  const outcomes = [];
  const lg2 = new Game({ timeScale: 1000, minPlayers: 4, onGameEnd: (o) => outcomes.push(o) });
  pids.forEach((id) => lg2.join(id, `Secret${id}`));
  pids.forEach((id) => lg2.setReady(id, true));
  for (const mode of ['classic', 'items']) {
    lg2.setSetting('a', 'mode', mode);
    lg2.start('a');
    for (let i = 0; i < 80 && lg2.phase !== 'reveal'; i++) lg2.skip('a');
    lg2.skipReveal('a');
  }
  check('balance log: one outcome per game', outcomes.length === 2 && outcomes[0].mode === 'classic' && outcomes[1].mode === 'items');
  check('balance log: classic numbers', typeof outcomes[0].caught === 'boolean' && outcomes[0].forgeries >= 1 && outcomes[0].players === 4 && outcomes[0].bots === 0);
  check('balance log: items numbers', typeof outcomes[1].innocentsWin === 'boolean' && outcomes[1].killers === 1);
  check('balance log: no names or ids', !/Secret|"[abcd]"/.test(JSON.stringify(outcomes)));
  lg2.dispose();

  // Save / restore: scores, stats, settings and the host survive a restart.
  const sv = new Game({ timeScale: 1000, minPlayers: 4 });
  pids.forEach((id) => sv.join(id, `N${id}`));
  pids.forEach((id) => sv.setReady(id, true));
  sv.setSetting('a', 'lang', 'en');
  sv.setSetting('a', 'story', 'nowruz');
  sv.start('a');
  for (let i = 0; i < 40 && sv.phase !== 'reveal'; i++) sv.skip('a');
  sv.skipReveal('a');
  const snap = JSON.parse(JSON.stringify(sv.snapshot()));
  sv.dispose();
  const rs = new Game({ minPlayers: 4 });
  check('restore: accepted', rs.restore(snap) === true && rs.phase === 'lobby');
  check('restore: players, names and scores', rs.players.length === 4 && pids.every((id) => rs.player(id).name === `N${id}` && rs.player(id).score === snap.players.find((p) => p.id === id).score));
  check('restore: everyone offline and not ready', rs.players.every((p) => !p.connected && !p.ready));
  check('restore: settings, stats, games, host', rs.settings.lang === 'en' && rs.settings.story === 'nowruz' && rs.gamesPlayed === 1 && Object.keys(rs.stats).length === 4 && rs.vipId === 'a');
  check('restore: a phone reconnects by id', rs.join('b', '').ok && rs.player('b').connected);
  check('restore: bad data refused', !new Game().restore({ v: 2 }) && !new Game().restore(null));
  const junk = new Game();
  check('restore: unknown settings dropped', junk.restore({ v: 1, players: [], settings: { lang: 'xx', evil: 1 } }) && junk.settings.lang === 'fa' && !('evil' in junk.settings));
  rs.dispose();

  // The host's first look at the slides is remembered (the phone's start button uses it).
  const tg = new Game({ minPlayers: 4 });
  ['a', 'b', 'c', 'd'].forEach((id) => tg.join(id, id));
  check('tutorial not seen at first', tg.publicState().tutorialSeen === false);
  tg.tutorialAction('a', 'open');
  tg.tutorialAction('a', 'close');
  check('tutorial seen after opening it', tg.publicState().tutorialSeen === true);
  tg.dispose();

  console.log(`\n${stats.games} games simulated, killer caught in ${stats.caught}, forged cards delivered: ${stats.delivered}`);
  console.log(`PASS ${pass}  FAIL ${fail}`);
  failures.forEach((f) => console.log('  ✗', f));
  process.exit(fail ? 1 : 0);
})();
