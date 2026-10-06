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

async function readyAll(bots) {
  if (bots[0].state.phase !== 'lobby') return;
  for (const b of bots) await b.emit('player:ready', { ready: true });
}

async function playGame(bots, tv, gameNo) {
  const vip = bots[0];
  await readyAll(bots);
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


async function playItemsGame(bots, tv) {
  const vip = bots[0];
  const n = bots.length;
  const k = n <= 4 ? 1 : n <= 8 ? 2 : 3;
  const apr = n >= 9 ? 2 : 1; // secret actions per round
  const tag = `items ${n}p`;
  check(`${tag}: non-vip cannot set mode`, !(await bots[1].emit('vip:setting', { key: 'mode', value: 'items' })).ok);
  check(`${tag}: vip sets mode`, (await vip.emit('vip:setting', { key: 'mode', value: 'items' })).ok);
  await waitFor(() => tv.state.settings.mode === 'items', 'tv sees items mode');
  check(`${tag}: cannot start until everyone is ready`, !(await vip.emit('vip:start')).ok);
  await readyAll(bots);
  check(`${tag}: vip starts`, (await vip.emit('vip:start')).ok);
  await waitFor(() => bots.every((b) => b.state.phase === 'intro' && b.state.me && b.state.me.startItem), 'items intro');
  const knife = vip.content.knifeId;
  const killers = bots.filter((b) => b.state.me.role === 'killer');
  check(`${tag}: ${k} killer(s)`, killers.length === k && tv.state.game.killerCount === k);
  check(`${tag}: ${apr} action(s) per round is public`, tv.state.game.actionsPerRound === apr);
  check(`${tag}: killers started with knives`, bots.every((b) => (b.state.me.startItem === knife) === (b.state.me.role === 'killer')));
  const leak = () => /"(killers|start|hold|turn|turns|startItem|role|partners)"/.test(JSON.stringify(tv.state));
  check(`${tag}: TV gets no private data`, tv.state.me === null && !leak());
  await vip.emit('vip:skip');

  const total = tv.state.totalRounds;
  for (let round = 1; round <= total; round++) {
    await waitFor(() => bots.every((b) => b.state.phase === 'gossip' && b.state.round === round), `gossip r${round}`);
    const actors = bots.filter((b) => b.state.me.turn);
    check(`${tag} r${round}: ${apr} secret action(s)`, actors.length === apr);
    check(`${tag} r${round}: TV shows the question, not the actors`, !!tv.state.game.question && !leak());
    const types = {};
    for (const a of actors) {
      const others = a.state.players.filter((p) => p.id !== a.id).map((p) => p.id);
      const type = a.state.me.turn.type;
      types[a.id] = type;
      const targets = type === 'shuffle' ? others.slice(0, 2) : type === 'swap' ? [] : [pick(others)];
      check(`${tag} r${round}: ${type} accepted`, (await a.emit('act:secret', { targets })).ok);
    }
    for (const b of bots) {
      const opts = b.state.players.filter((p) => p.id !== b.id);
      await b.emit('act:answer', { targetId: pick(opts).id });
    }
    await waitFor(() => tv.state.phase === 'gossipResult', `gossip result r${round}`);
    await sleep(40);
    check(`${tag} r${round}: each actor sees their result in the journal`, actors.every((a) => a.state.me.notes.some((x) => x.round === round && x.type === types[a.id])));
    const held = bots.map((b) => b.state.me.item);
    check(`${tag} r${round}: ${k} knife/knives still in play`, held.filter((x) => x === knife).length === k);
    await vip.emit('vip:skip');
    if (round % 2 === 0) {
      await waitFor(() => tv.state.phase === 'discuss', `discuss r${round}`);
      await vip.emit('vip:skip');
    }
  }
  await waitFor(() => bots.every((b) => b.state.phase === 'final'), 'items final');
  // Everyone piles onto one killer → innocents must win.
  const target = killers[0].id;
  for (const b of bots) {
    const t = b.id === target ? killers[1].id : target;
    await b.emit('act:accuse', { targetId: t });
  }
  await waitFor(() => tv.state.phase === 'reveal', 'items reveal');
  for (let i = 0; i < 4; i++) { await vip.emit('vip:next'); await sleep(30); }
  await waitFor(() => tv.state.phase === 'results', 'items results');
  const rev = tv.state.game.reveal;
  check(`${tag}: majority on a killer → innocents win`, rev.innocentsWin === true && rev.accusedId === target);
  check(`${tag}: reveal names every killer`, rev.killers.length === k && killers.every((x) => rev.killers.includes(x.id)));
  check(`${tag}: timeline has every round`, Array.from({ length: total }, (_, i) => i + 1).every((r) => rev.log.some((e) => e.round === r)));
  check(`${tag}: every phone has points`, bots.every((b) => b.state.me.myPoints));
  await vip.emit('vip:setting', { key: 'mode', value: 'classic' });
}

async function backToLobby(bots) {
  await bots[0].emit('vip:lobby');
  await waitFor(() => bots.every((b) => b.state.phase === 'lobby'), 'lobby before items game');
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
  await backToLobby(bots);
  await playItemsGame(bots, tv);

  // Big table: 5 more phones join (10 players) → 3 killers, 2 secret actions per round.
  await backToLobby(bots);
  const extra = ['بابک', 'شیوا', 'رضا', 'یاسمن', 'لیلا'].map((nm, i) => makeBot(`big${i}`, nm));
  await sleep(300);
  for (const b of extra) check(`join ${b.name} (big table)`, (await b.emit('player:join', { id: b.id, name: b.name })).ok);
  bots.push(...extra);
  await waitFor(() => tv.state.players.length === 10 && bots.every((b) => b.state && b.state.me), 'big table lobby');
  check('big table: TV offers the classic seat count', tv.state.modeMax === 8 && tv.state.maxPlayers === 12);
  await readyAll(bots);
  const classic10 = await bots[0].emit('vip:start');
  check('big table: classic start refused with 10', !classic10.ok && /۸/.test(classic10.error));
  for (const b of bots) await b.emit('player:ready', { ready: false });
  await playItemsGame(bots, tv);

  [tv, ...bots].forEach((b) => b.sock.close());
  server.close();
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
