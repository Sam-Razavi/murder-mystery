// Plays many random «دست‌به‌دست» (items mode) games against the engine and checks invariants.
// Run: node test/items.js
const { Game } = require('../game');
const CF = require('../content');
const CE = require('../content.en');
const PERSIAN = /[\u0600-\u06FF]/;
let C = CF;
const { killersFor } = require('../items');

let pass = 0;
let fail = 0;
const failures = [];
function check(label, cond) {
  if (cond) pass += 1;
  else { fail += 1; if (failures.length < 30) failures.push(label); }
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sorted = (o) => Object.values(o).slice().sort().join(',');
const shuffleArr = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const KNIFE = C.KNIFE.id;

async function playOne(n, lang = 'fa') {
  C = lang === 'en' ? CE : CF;
  const game = new Game({ timeScale: 1000, minPlayers: 4, durations: { gossipResult: 5000 } });
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  ids.forEach((id, i) => game.join(id, `Bot${i}`));
  check(`[${n}] non-vip cannot change mode`, !game.setSetting('p1', 'mode', 'items').ok);
  check(`[${n}] bad mode rejected`, !game.setSetting('p0', 'mode', 'nope').ok);
  check(`[${n}] vip sets items mode`, game.setSetting('p0', 'mode', 'items').ok);
  const rounds = pick([4, 6, 8]);
  check(`[${n}] rounds setting accepted`, game.setSetting('p0', 'itemRounds', rounds).ok);
  check(`[${n}] bad rounds rejected`, !game.setSetting('p0', 'itemRounds', 5).ok);
  check(`[${n}] gossip time setting accepted`, game.setSetting('p0', 'gossipSeconds', pick([30, 40, 60])).ok);
  check(`[${n}] unknown setting rejected`, !game.setSetting('p0', 'toString', 'x').ok);
  const quiet = Math.random() < 0.5;
  const know = Math.random() < 0.5;
  check(`[${n}] quiet rounds setting`, game.setSetting('p0', 'quietRounds', String(quiet)).ok && game.settings.quietRounds === quiet);
  check(`[${n}] killers-know setting`, game.setSetting('p0', 'killersKnow', know).ok && game.settings.killersKnow === know);
  check(`[${n}] bad boolean rejected`, !game.setSetting('p0', 'killersKnow', 'yes').ok);
  if (lang === 'en') check(`[${n}] set English`, game.setSetting('p0', 'lang', 'en').ok);
  ids.forEach((id) => game.setReady(id, true));
  check(`[${n}] start ok`, game.start('p0').ok);
  check(`[${n}] cannot change mode mid-game`, !game.setSetting('p0', 'mode', 'classic').ok);

  if (lang === 'en') check(`[${n}] English not settable by non-host`, !game.setSetting('p1', 'lang', 'en').ok);
  const g = game.g;
  const k = killersFor(n);
  check(`[${n}] killer count`, g.killers.length === k && k === (n === 4 ? 1 : n <= 8 ? 2 : 3));
  check(`[${n}] killers are exactly the starting knives`, ids.filter((id) => g.start[id] === KNIFE).join() === g.killers.join());
  const nonKnives = Object.values(g.start).filter((x) => x !== KNIFE);
  check(`[${n}] non-knife items unique`, new Set(nonKnives).size === nonKnives.length);
  check(`[${n}] roles match starting item`, ids.every((id) => game.privateState(id).role === (g.start[id] === KNIFE ? 'killer' : 'innocent')));
  const startMultiset = sorted(g.start);
  ids.forEach((id) => {
    const partners = game.privateState(id).partners;
    if (know && g.killers.includes(id)) check(`[${n}] killer sees the other killer`, partners.join() === g.killers.filter((x) => x !== id).join());
    else check(`[${n}] no partner info unless the rule is on and you're a killer`, partners === undefined);
  });
  check(`[${n}] action count hidden with quiet rounds`, (game.publicState().game.actionsSoFar === null) === quiet);

  const leakCheck = (label) => {
    const pub = JSON.stringify(game.publicState());
    check(`[${n}] ${label}: public hides holdings/roles`, !/"(killers|start|hold|finalHold|turn|turns|actorId|answers|partners)"/.test(pub));
    if (lang === 'en') {
      const all = JSON.stringify([game.publicState(), ...ids.map((id) => game.privateState(id))]);
      check(`[${n}] en ${label}: no Persian`, !PERSIAN.test(all));
    }
  };
  leakCheck('intro');
  check(`[${n}] public knows killer count`, game.publicState().game.killerCount === k);
  check(`[${n}] classic final rejected in items game`, !game.final('p0', { suspect: 'p1', weapon: C.WEAPONS[0].id, room: C.ROOMS[0].id }).ok);
  check(`[${n}] classic search rejected`, !game.search('p0', C.ROOMS[0].id).ok);

  game.skip('p0'); // intro -> gossip
  const actors = [];
  check(`[${n}] game uses the rounds setting`, g.totalRounds === rounds && game.publicState().totalRounds === rounds);
  check(`[${n}] rounds locked mid-game`, !game.setSetting('p0', 'itemRounds', 4).ok);
  for (let r = 1; r <= rounds; r++) {
    check(`[${n}] r${r} gossip phase (${game.phase})`, game.phase === 'gossip' && game.round === r);
    leakCheck(`r${r} gossip`);
    const turns = g.turns.slice();
    if (!turns.length) {
      check(`[${n}] quiet only when the rule is on`, quiet);
      check(`[${n}] quiet round: no phone gets an action`, ids.every((id) => !game.privateState(id).turn));
      const prev = g.log[g.log.length - 1];
      check(`[${n}] never two quiet rounds in a row`, !prev || prev.type !== 'quiet');
      const before = { ...g.hold };
      ids.forEach((id) => game.itAnswer(id, pick(ids.filter((x) => x !== id))));
      await sleep(6);
      check(`[${n}] quiet round ends once everyone answers (${game.phase})`, game.phase === 'gossipResult');
      check(`[${n}] quiet round logged, nothing moved`, g.log[g.log.length - 1].type === 'quiet' && ids.every((id) => g.hold[id] === before[id]));
      leakCheck(`r${r} quiet result`);
      game.skip('p0');
      if (r % 2 === 0) game.skip('p0');
      continue;
    }
    const apr = n >= 9 ? 2 : 1;
    const actorIds = turns.map((t) => t.actorId);
    check(`[${n}] ${apr} secret action(s) per round`, turns.length === apr && g.actionsPerRound === apr && game.publicState().game.actionsPerRound === apr);
    check(`[${n}] actors are distinct`, new Set(actorIds).size === actorIds.length);
    actors.push(...actorIds);
    const withTurn = ids.filter((id) => game.privateState(id).turn);
    check(`[${n}] exactly the actors' phones get a secret action`, withTurn.slice().sort().join() === actorIds.slice().sort().join());
    check(`[${n}] each phone sees its own action type`, turns.every((t) => game.privateState(t.actorId).turn.type === t.type));
    check(`[${n}] non-actor cannot act`, !game.itAct(ids.find((x) => !actorIds.includes(x)), { targets: [] }).ok);
    check(`[${n}] self answer rejected`, !game.itAnswer('p0', 'p0').ok);

    const before = { ...g.hold };
    const logStart = g.log.length;
    const timeout = Math.random() < 0.15; // the last actor freezes
    const frozen = timeout ? turns[turns.length - 1].actorId : null;
    turns.forEach((t) => {
      if (t.actorId === frozen) return;
      const others = ids.filter((x) => x !== t.actorId);
      let targets = [];
      if (t.type === 'shuffle') {
        check(`[${n}] shuffle needs two`, !game.itAct(t.actorId, { targets: [others[0]] }).ok);
        check(`[${n}] shuffle cannot include self`, !game.itAct(t.actorId, { targets: [t.actorId, others[0]] }).ok);
        targets = shuffleArr(others).slice(0, 2);
      } else if (t.type !== 'swap') {
        check(`[${n}] cannot target self`, !game.itAct(t.actorId, { targets: [t.actorId] }).ok);
        targets = [pick(others)];
      }
      check(`[${n}] secret action ok (${t.type})`, game.itAct(t.actorId, { targets }).ok);
      check(`[${n}] cannot act twice`, !game.itAct(t.actorId, { targets }).ok);
      if (t.type === 'snoop') {
        check(`[${n}] snoop shows the target's item at round start`, game.privateState(t.actorId).turn.result.item === before[targets[0]]);
      }
    });
    ids.forEach((id) => game.itAnswer(id, pick(ids.filter((x) => x !== id))));
    if (timeout) {
      check(`[${n}] round waits for every secret action`, game.phase === 'gossip');
      game.skip('p0'); // host ends the round; the game acts for the frozen actor
    } else await sleep(6);
    check(`[${n}] r${r} gossip result (${game.phase})`, game.phase === 'gossipResult');

    const entries = g.log.slice(logStart);
    check(`[${n}] one log entry per action`, entries.length === turns.length && entries.every((e) => e.round === r)
      && entries.map((e) => e.actorId).sort().join() === actorIds.slice().sort().join());
    check(`[${n}] only the frozen actor is marked automatic`, entries.every((e) => e.auto === (e.actorId === frozen)));
    const firstMove = entries.findIndex((e) => e.type !== 'snoop');
    check(`[${n}] snoops resolve before moves`, firstMove < 0 || entries.slice(firstMove).every((e) => e.type !== 'snoop'));
    check(`[${n}] items conserved`, sorted(g.hold) === startMultiset);

    // Replay the log from the round-start holdings: each action must do exactly what it says.
    const replay = { ...before };
    const known = { ...before }; // what each player last knew they held
    entries.forEach((e) => {
      const pre = { ...replay };
      e.moves.forEach((m) => { check(`[${n}] move starts from the right item`, replay[m.playerId] === m.from); replay[m.playerId] = m.to; });
      const tg = e.targets;
      const untouched = (except) => ids.filter((id) => !except.includes(id)).every((id) => replay[id] === pre[id]);
      if (e.type === 'snoop') check(`[${n}] snoop moves nothing`, !e.moves.length && e.seen === before[tg[0]]);
      if (e.type === 'swap' || e.type === 'steal') {
        check(`[${n}] ${e.type} exchanges actor and target`, replay[e.actorId] === pre[tg[0]] && replay[tg[0]] === pre[e.actorId] && untouched([e.actorId, tg[0]]));
        known[e.actorId] = replay[e.actorId];
      }
      if (e.type === 'shuffle') {
        check(`[${n}] shuffle exchanges the two others, not the actor`, replay[tg[0]] === pre[tg[1]] && replay[tg[1]] === pre[tg[0]]
          && !tg.includes(e.actorId) && untouched(tg));
      }
      check(`[${n}] log snapshot matches replay`, ids.every((id) => e.holdAfter[id] === replay[id]));
    });
    check(`[${n}] replay ends at the real holdings`, ids.every((id) => replay[id] === g.hold[id]));
    // One net "your item changed" notice per player per round, only when it differs from what they knew.
    ids.forEach((id) => {
      const told = g.notes[id].filter((x) => x.round === r && x.type === 'changed');
      check(`[${n}] net change notice`, told.length === (g.hold[id] !== known[id] ? 1 : 0)
        && (!told.length || (told[0].from === known[id] && told[0].to === g.hold[id])));
    });
    check(`[${n}] killers never change`, ids.filter((id) => g.start[id] === KNIFE).join() === g.killers.join());
    const gr = game.publicState().game.gossipResult;
    check(`[${n}] gossip tally counts every answer`, gr.tally.reduce((s, x) => s + x.votes, 0) === n);
    leakCheck(`r${r} result`);

    game.skip('p0');
    if (r % 2 === 0) {
      check(`[${n}] discussion after r${r} (${game.phase})`, game.phase === 'discuss');
      game.skip('p0');
    }
  }
  const firstN = actors.slice(0, Math.min(n, actors.length));
  check(`[${n}] everyone acts once before anyone acts twice`, new Set(firstN).size === firstN.length);

  check(`[${n}] final phase (${game.phase})`, game.phase === 'final');
  check(`[${n}] self vote rejected`, !game.itFinal('p1', 'p1').ok);
  ids.forEach((id) => {
    const target = !g.killers.includes(id) && Math.random() < 0.5 ? pick(g.killers.filter((x) => x !== id)) : pick(ids.filter((x) => x !== id));
    game.itFinal(id, target);
  });
  await sleep(6);
  check(`[${n}] reveal phase`, game.phase === 'reveal');
  let rv = game.publicState().game.reveal;
  check(`[${n}] reveal step 0 hides verdict and killers`, rv.innocentsWin === undefined && rv.killers === undefined);
  game.next('p0');
  rv = game.publicState().game.reveal;
  check(`[${n}] step 1 shows verdict but not killers`, rv.innocentsWin !== undefined && rv.killers === undefined);
  game.next('p0');
  check(`[${n}] step 2 shows killers`, game.publicState().game.reveal.killers.length === k);
  game.next('p0');
  check(`[${n}] step 3 shows timeline`, Array.from({ length: rounds }, (_, i) => i + 1).every((r) => game.publicState().game.reveal.log.some((e) => e.round === r)));
  game.next('p0');
  check(`[${n}] results phase`, game.phase === 'results');

  const res = g.results;
  const verdict = game._itVerdict(g.finalVotes, g.killers);
  check(`[${n}] results match verdict`, res.innocentsWin === verdict.innocentsWin);
  res.points.forEach((p) => check(`[${n}] breakdown sums`, p.total === p.breakdown.reduce((s, b) => s + b.pts, 0)));
  check(`[${n}] scores applied`, game.players.reduce((s, p) => s + p.score, 0) === res.points.reduce((s, p) => s + p.total, 0));
  check(`[${n}] every phone gets its points`, ids.every((id) => game.privateState(id).myPoints));
  if (lang === 'en') check(`[${n}] en results: no Persian`, !PERSIAN.test(JSON.stringify([game.publicState(), ...ids.map((id) => game.privateState(id))])));

  check(`[${n}] play again stays in items mode`, game.start('p0').ok && game.g.mode === 'items');
  game.dispose();
  return res.innocentsWin;
}

function verdictCases() {
  const game = new Game();
  const V = (votes, killers) => game._itVerdict(votes, killers);
  check('majority on killer → innocents win', V({ a: 'k', b: 'k', c: 'x' }, ['k']).innocentsWin === true);
  check('majority on innocent → killers win', V({ a: 'x', b: 'x', c: 'k' }, ['k']).innocentsWin === false);
  check('tie killer/innocent → killers win', V({ a: 'k', b: 'x' }, ['k', 'k2']).innocentsWin === false);
  check('tie between the two killers → innocents win', V({ a: 'k', b: 'k2', c: 'k', d: 'k2' }, ['k', 'k2']).innocentsWin === true);
  check('three-way tie incl. both killers → killers win', V({ a: 'k', b: 'k2', c: 'x' }, ['k', 'k2']).innocentsWin === false);
  check('no votes → killers win', V({}, ['k']).innocentsWin === false);
  check('one killer is enough with two killers', V({ a: 'k2', b: 'k2', c: 'k' }, ['k', 'k2']).innocentsWin === true);
  const K3 = ['k1', 'k2', 'k3'];
  check('3 killers: tie between two killers → innocents win', V({ a: 'k1', b: 'k3', c: 'k1', d: 'k3' }, K3).innocentsWin === true);
  check('3 killers: tie between all three → innocents win', V({ a: 'k1', b: 'k2', c: 'k3' }, K3).innocentsWin === true);
  check('3 killers: killer tied with innocent → killers win', V({ a: 'k2', b: 'x' }, K3).innocentsWin === false);
  check('3 killers: majority on one killer → innocents win', V({ a: 'k3', b: 'k3', c: 'x' }, K3).innocentsWin === true);
  game.dispose();
}

(async () => {
  verdictCases();
  let innocentWins = 0;
  let games = 0;
  for (let i = 0; i < 25; i++) {
    for (const n of [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      if (await playOne(n, i % 2 ? 'en' : 'fa')) innocentWins += 1;
      games += 1;
    }
  }
  console.log(`\n${games} items-mode games simulated, innocents won ${innocentWins}`);
  console.log(`PASS ${pass}  FAIL ${fail}`);
  failures.forEach((f) => console.log('  ✗', f));
  process.exit(fail ? 1 : 0);
})();
