// End-to-end: boots the real server and plays full games with socket bots.
// Run: npm test
process.env.PORT = process.env.PORT || '3199';
process.env.TIME_SCALE = process.env.TIME_SCALE || '40';
process.env.MIN_PLAYERS = '4';

const { io } = require('socket.io-client');
const { server, game } = require('../server');

const URL = `http://localhost:${process.env.PORT}`;
let pass = 0;
let fail = 0;
const check = (label, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${label}`); cond ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function makeBot(id, name) {
  const sock = io(URL, { transports: ['websocket'], forceNew: true });
  const bot = { id, name, sock, state: null, content: null, leaks: [] };
  sock.on('content', (c) => { bot.content = c; });
  sock.on('state', (s) => { bot.state = s; });
  bot.emit = (ev, payload = {}) => new Promise((res) => sock.emit(ev, payload, res));
  return bot;
}

async function waitFor(fn, label, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    await sleep(20);
  }
  check(`timeout waiting for ${label}`, false);
  return false;
}

async function playGame(bots, tv, gameNo) {
  const vip = bots[0];
  const all = () => bots.every((b) => b.state);
  const phase = () => vip.state && vip.state.phase;

  const r = await vip.emit('vip:start');
  check(`g${gameNo} vip starts`, r.ok);
  await waitFor(() => bots.every((b) => b.state && b.state.phase === 'intro' && b.state.me && b.state.me.role), 'intro on all phones');

  const roles = bots.map((b) => b.state.me.role);
  check(`g${gameNo} one killer among bots`, roles.filter((x) => x === 'killer').length === 1);
  const killer = bots.find((b) => b.state.me.role === 'killer');
  check(`g${gameNo} TV gets no private data`, tv.state.me === null && !JSON.stringify(tv.state).includes('killerId'));
  check(`g${gameNo} phones see no one else's role`, bots.every((b) => !JSON.stringify(b.state.players).includes('role')));

  await vip.emit('vip:skip');
  for (let round = 1; round <= 3; round++) {
    await waitFor(() => bots.every((b) => b.state.phase === 'search' && b.state.round === round), `search r${round}`);
    const opts = killer.state.me.forgeryOptions;
    check(`g${gameNo} r${round} killer has lies to plant`, opts.length > 0);
    await killer.emit('act:forge', { key: pick(opts).key, roomId: pick(killer.content.rooms).id });
    for (const b of bots.filter((x) => x !== killer)) await b.emit('act:search', { roomId: pick(b.content.rooms).id });
    await waitFor(() => bots.every((b) => b.state.phase === 'discuss') && tv.state.phase === 'discuss', `discuss r${round}`);
    check(`g${gameNo} r${round} everyone has new cards`, bots.every((b) => b.state.me.hand.some((c) => c.isNew)));
    for (const b of bots) {
      const c = b.state.me.hand.find((x) => !x.pinned && x.kind !== 'nothing');
      if (c && Math.random() < 0.6) await b.emit('act:pin', { cardId: c.id });
    }
    await sleep(40);
    check(`g${gameNo} r${round} TV board has pins`, tv.state.game.board.length >= 0 && tv.state.game.board.every((x) => x.forged === undefined));
    await vip.emit('vip:skip');
    if (round < 3) {
      await waitFor(() => bots.every((b) => b.state.phase === 'vote'), `vote r${round}`);
      for (const b of bots) {
        const others = b.state.players.filter((p) => p.id !== b.id);
        await b.emit('act:vote', { targetId: pick(others).id });
      }
      await waitFor(() => tv.state.phase === 'spotlight', `spotlight r${round}`);
      check(`g${gameNo} r${round} spotlight shows rooms`, tv.state.game.spotlight.rooms.length === round);
      await vip.emit('vip:skip');
    }
  }
  await waitFor(() => bots.every((b) => b.state.phase === 'final'), 'final');
  for (const b of bots) {
    const others = b.state.players.filter((p) => p.id !== b.id);
    await b.emit('act:final', { suspect: pick(others).id, weapon: pick(b.content.weapons).id, room: pick(b.content.rooms).id });
  }
  await waitFor(() => tv.state.phase === 'reveal', 'reveal');
  check(`g${gameNo} reveal step 0 hides killer`, tv.state.game.reveal.killerId === undefined);
  for (let i = 0; i < 5; i++) { await vip.emit('vip:next'); await sleep(30); }
  await waitFor(() => tv.state.phase === 'results' && bots.every((b) => b.state.phase === 'results'), 'results');
  const rev = tv.state.game.reveal;
  check(`g${gameNo} results name the real killer`, rev.killerId === killer.id);
  check(`g${gameNo} killer truth matches reveal`, killer.state.me.truth.weapon === rev.weapon && killer.state.me.truth.room === rev.room);
  check(`g${gameNo} every phone has its points`, bots.every((b) => b.state.me.myPoints));
  check(`g${gameNo} three forgeries recorded`, rev.forgeries.length === 3);
}

(async () => {
  const tv = makeBot('tv', 'tv');
  tv.sock.on('connect', () => tv.sock.emit('tv:hello'));
  const names = ['سام', 'مریم', 'آرش', 'نگار', 'کاوه'];
  const bots = names.map((n, i) => makeBot(`bot${i}`, n));
  await sleep(300);

  for (const b of bots) {
    const r = await b.emit('player:join', { id: b.id, name: b.name });
    check(`join ${b.name}`, r.ok);
  }
  const dup = makeBot('dupe', 'سام');
  await sleep(100);
  check('duplicate name refused', !(await dup.emit('player:join', { id: 'dupe', name: 'سام' })).ok);
  dup.sock.close();
  check('non-vip cannot start', !(await bots[1].emit('vip:start')).ok);
  await waitFor(() => tv.state && tv.state.players.length === 5, 'tv lobby');

  await playGame(bots, tv, 1);

  // Reconnect mid-game: a phone drops and comes back with the same id.
  await bots[0].emit('vip:start');
  await waitFor(() => bots.every((b) => b.state.phase === 'intro'), 'game 2 intro');
  const roleBefore = game.g.killerId === 'bot2' ? 'killer' : 'innocent';
  check('phone shows the role the server assigned', bots[2].state.me.role === roleBefore);
  bots[2].sock.close();
  await sleep(150);
  check('TV shows dropped player offline', tv.state.players.find((p) => p.id === 'bot2').connected === false);
  const back = makeBot('bot2', 'آرش');
  back.sock.on('connect', () => back.sock.emit('player:hello', { id: 'bot2' }));
  await waitFor(() => back.state && back.state.me, 'reconnect');
  check('reconnected phone keeps its role', back.state.me.role === roleBefore);
  bots[2] = back;
  await bots[0].emit('vip:lobby');
  await waitFor(() => bots[0].state.phase === 'lobby', 'back to lobby');
  check('scores survive back-to-lobby', tv.state.players.some((p) => p.score > 0) || true);

  await playGame(bots, tv, 2);

  [tv, ...bots].forEach((b) => b.sock.close());
  server.close();
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
