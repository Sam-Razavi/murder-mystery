// Plays many random games straight against the engine and checks invariants.
// Run: node test/engine.js
const { Game } = require('../game');
const CF = require('../content');
const CE = require('../content.en');
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

async function playOne(n, gameNo, lang = 'fa') {
  const C = lang === 'en' ? CE : CF;
  const game = new Game({ timeScale: 1000, minPlayers: 4 });
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  ids.forEach((id, i) => game.join(id, `Bot${i}`));
  if (lang === 'en') check(`[${n}] set English`, game.setSetting('p0', 'lang', 'en').ok);
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
    if (leaveOneOut) await sleep(60); // search timer at 1000x = 40ms
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
      const r = await playOne(n, k, k % 2 ? 'en' : 'fa');
      stats.games += 1;
      if (r.caught) stats.caught += 1;
      stats.delivered += r.delivered;
    }
  }
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

  console.log(`\n${stats.games} games simulated, killer caught in ${stats.caught}, forged cards delivered: ${stats.delivered}`);
  console.log(`PASS ${pass}  FAIL ${fail}`);
  failures.forEach((f) => console.log('  ✗', f));
  process.exit(fail ? 1 : 0);
})();
