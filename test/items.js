// Plays many random «دست‌به‌دست» (items mode) games against the engine and checks invariants.
// Run: node test/items.js
const { Game } = require('../game');
const C = require('../content');
const { ITEM_ROUNDS, killersFor } = require('../items');

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
const KNIFE = C.KNIFE.id;

async function playOne(n) {
  const game = new Game({ timeScale: 1000, minPlayers: 4, durations: { gossipResult: 5000 } });
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  ids.forEach((id, i) => game.join(id, `Bot${i}`));
  check(`[${n}] non-vip cannot change mode`, !game.setSetting('p1', 'mode', 'items').ok);
  check(`[${n}] bad mode rejected`, !game.setSetting('p0', 'mode', 'nope').ok);
  check(`[${n}] vip sets items mode`, game.setSetting('p0', 'mode', 'items').ok);
  ids.forEach((id) => game.setReady(id, true));
  check(`[${n}] start ok`, game.start('p0').ok);
  check(`[${n}] cannot change mode mid-game`, !game.setSetting('p0', 'mode', 'classic').ok);

  const g = game.g;
  const k = killersFor(n);
  check(`[${n}] killer count`, g.killers.length === k && k === (n === 4 ? 1 : 2));
  check(`[${n}] killers are exactly the starting knives`, ids.filter((id) => g.start[id] === KNIFE).join() === g.killers.join());
  const nonKnives = Object.values(g.start).filter((x) => x !== KNIFE);
  check(`[${n}] non-knife items unique`, new Set(nonKnives).size === nonKnives.length);
  check(`[${n}] roles match starting item`, ids.every((id) => game.privateState(id).role === (g.start[id] === KNIFE ? 'killer' : 'innocent')));
  const startMultiset = sorted(g.start);

  const leakCheck = (label) => {
    const pub = JSON.stringify(game.publicState());
    check(`[${n}] ${label}: public hides holdings/roles`, !/"(killers|start|hold|finalHold|turn|actorId|answers)"/.test(pub));
  };
  leakCheck('intro');
  check(`[${n}] public knows killer count`, game.publicState().game.killerCount === k);
  check(`[${n}] classic final rejected in items game`, !game.final('p0', { suspect: 'p1', weapon: C.WEAPONS[0].id, room: C.ROOMS[0].id }).ok);
  check(`[${n}] classic search rejected`, !game.search('p0', C.ROOMS[0].id).ok);

  game.skip('p0'); // intro -> gossip
  const actors = [];
  for (let r = 1; r <= ITEM_ROUNDS; r++) {
    check(`[${n}] r${r} gossip phase (${game.phase})`, game.phase === 'gossip' && game.round === r);
    leakCheck(`r${r} gossip`);
    const t = g.turn;
    actors.push(t.actorId);
    const withTurn = ids.filter((id) => game.privateState(id).turn);
    check(`[${n}] exactly one phone gets the secret action`, withTurn.length === 1 && withTurn[0] === t.actorId);
    check(`[${n}] non-actor cannot act`, !game.itAct(ids.find((x) => x !== t.actorId), { targets: [] }).ok);
    check(`[${n}] self answer rejected`, !game.itAnswer('p0', 'p0').ok);

    const before = { ...g.hold };
    const others = ids.filter((x) => x !== t.actorId);
    const timeout = Math.random() < 0.15;
    let targets = [];
    if (!timeout) {
      if (t.type === 'shuffle') {
        check(`[${n}] shuffle needs two`, !game.itAct(t.actorId, { targets: [others[0]] }).ok);
        check(`[${n}] shuffle cannot include self`, !game.itAct(t.actorId, { targets: [t.actorId, others[0]] }).ok);
        targets = [others[0], others[1]];
      } else if (t.type !== 'swap') {
        check(`[${n}] cannot target self`, !game.itAct(t.actorId, { targets: [t.actorId] }).ok);
        targets = [pick(others)];
      }
      check(`[${n}] secret action ok (${t.type})`, game.itAct(t.actorId, { targets }).ok);
      check(`[${n}] cannot act twice`, !game.itAct(t.actorId, { targets }).ok);
      if (t.type === 'snoop') {
        const ps = game.privateState(t.actorId);
        check(`[${n}] snoop shows the target's current item`, ps.turn.result.item === before[targets[0]]);
      }
    }
    ids.forEach((id) => game.itAnswer(id, pick(ids.filter((x) => x !== id))));
    if (timeout) {
      check(`[${n}] round waits for the secret action`, game.phase === 'gossip');
      game.skip('p0'); // host ends the round; the game acts for the actor
    } else await sleep(6);
    check(`[${n}] r${r} gossip result (${game.phase})`, game.phase === 'gossipResult');
    const e = g.log[g.log.length - 1];
    check(`[${n}] action logged`, g.log.length === r && e.actorId === t.actorId && e.auto === timeout);
    check(`[${n}] items conserved`, sorted(g.hold) === startMultiset);
    const tg = e.targets;
    if (e.type === 'snoop') check(`[${n}] snoop moves nothing`, ids.every((id) => g.hold[id] === before[id]) && e.seen === before[tg[0]]);
    if (e.type === 'swap' || e.type === 'steal') {
      check(`[${n}] ${e.type} exchanges actor and target`, g.hold[e.actorId] === before[tg[0]] && g.hold[tg[0]] === before[e.actorId]
        && ids.filter((id) => id !== e.actorId && id !== tg[0]).every((id) => g.hold[id] === before[id]));
    }
    if (e.type === 'shuffle') {
      check(`[${n}] shuffle exchanges the two others, not the actor`, g.hold[tg[0]] === before[tg[1]] && g.hold[tg[1]] === before[tg[0]]
        && g.hold[e.actorId] === before[e.actorId] && !tg.includes(e.actorId));
    }
    // Victims are told only when their item visibly changed.
    ids.filter((id) => id !== e.actorId).forEach((id) => {
      const told = g.notes[id].some((x) => x.round === r && x.type === 'changed');
      check(`[${n}] victim notice iff item changed`, told === (before[id] !== g.hold[id]));
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
  const firstN = actors.slice(0, Math.min(n, ITEM_ROUNDS));
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
  check(`[${n}] step 3 shows timeline`, game.publicState().game.reveal.log.length === ITEM_ROUNDS);
  game.next('p0');
  check(`[${n}] results phase`, game.phase === 'results');

  const res = g.results;
  const verdict = game._itVerdict(g.finalVotes, g.killers);
  check(`[${n}] results match verdict`, res.innocentsWin === verdict.innocentsWin);
  res.points.forEach((p) => check(`[${n}] breakdown sums`, p.total === p.breakdown.reduce((s, b) => s + b.pts, 0)));
  check(`[${n}] scores applied`, game.players.reduce((s, p) => s + p.score, 0) === res.points.reduce((s, p) => s + p.total, 0));
  check(`[${n}] every phone gets its points`, ids.every((id) => game.privateState(id).myPoints));

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
  game.dispose();
}

(async () => {
  verdictCases();
  let innocentWins = 0;
  let games = 0;
  for (let i = 0; i < 30; i++) {
    for (const n of [4, 5, 6, 7, 8]) {
      if (await playOne(n)) innocentWins += 1;
      games += 1;
    }
  }
  console.log(`\n${games} items-mode games simulated, innocents won ${innocentWins}`);
  console.log(`PASS ${pass}  FAIL ${fail}`);
  failures.forEach((f) => console.log('  ✗', f));
  process.exit(fail ? 1 : 0);
})();
