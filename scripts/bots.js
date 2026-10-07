// Bot guests for small groups (e.g. two people + two bots).
// Start the server first, then: npm run bots   (or: node scripts/bots.js 3)
// Bots wait until a real player has joined, so a person is always the host.
// They search, forge (if killer), pin clues, vote and accuse at random,
// after a short random delay, and stay for every following game.
const { io } = require('socket.io-client');

const COUNT = Math.max(1, Math.min(8, Number(process.argv[2]) || 2));
const URL = process.env.BOT_URL || `http://localhost:${process.env.PORT || 3100}`;
const NAMES = ['Bot Sam', 'Bot Mina', 'Bot Arash', 'Bot Leila', 'Bot Babak', 'Bot Shiva', 'Bot Reza', 'Bot Yasaman'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const think = () => sleep(2000 + Math.random() * 6000); // looks less mechanical on the TV
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

function makeBot(i) {
  const b = { id: `bot-${i}`, name: NAMES[i], state: null, all: null, joined: false };
  b.sock = io(URL, { transports: ['websocket'], forceNew: true });
  b.emit = (ev, p = {}) => new Promise((res) => b.sock.emit(ev, p, res));
  b.sock.on('content', (c) => { b.all = c; });
  b.sock.on('state', (s) => { b.state = s; });
  // hello: reattaches a bot the server already knows, else subscribes to the lobby state
  b.sock.on('connect', () => {
    b.joined = false;
    b.sock.emit('player:hello', { id: b.id }, (r) => { b.joined = !!(r && r.known); log(`${b.name} connected${b.joined ? ' (rejoined)' : ''}`); });
  });
  Object.defineProperty(b, 'content', { get: () => b.all && b.all[(b.state && b.state.lang) || 'fa'] });
  return b;
}

const humansIn = (s) => s && s.players.some((p) => !p.id.startsWith('bot-') && p.connected);

async function act(b, s) {
  const me = s.me;
  if (!me || !b.content) return;
  const others = s.players.filter((p) => p.id !== b.id && p.inGame !== false);
  await think();
  if (!b.state || `${b.state.phase}:${b.state.round}` !== `${s.phase}:${s.round}`) return; // phase moved on
  try {
    if (s.phase === 'search') {
      if (me.role === 'killer' && me.forgeryOptions && me.forgeryOptions.length) {
        await b.emit('act:forge', { key: pick(me.forgeryOptions).key, roomId: pick(b.content.rooms).id });
      } else await b.emit('act:search', { roomId: pick(b.content.rooms).id });
    } else if (s.phase === 'discuss' && me.hand) {
      const fresh = me.hand.filter((c) => !c.pinned && c.kind !== 'nothing');
      if (fresh.length) await b.emit('act:pin', { cardId: pick(fresh).id });
    } else if (s.phase === 'vote') {
      await b.emit('act:vote', { targetId: pick(others).id });
    } else if (s.phase === 'final') {
      if (s.mode === 'items') await b.emit('act:accuse', { targetId: pick(others).id });
      else await b.emit('act:final', { suspect: pick(others).id, weapon: pick(b.content.weapons).id, room: pick(b.content.rooms).id });
    } else if (s.phase === 'gossip') {
      if (me.turn) {
        const ids = others.map((p) => p.id);
        const t = me.turn.type;
        await b.emit('act:secret', { targets: t === 'shuffle' ? ids.slice(0, 2) : t === 'swap' ? [] : [pick(ids)] });
      }
      await b.emit('act:answer', { targetId: pick(others).id });
    }
  } catch (e) { log(`${b.name} error:`, e.message); }
}

(async () => {
  const bots = Array.from({ length: COUNT }, (_, i) => makeBot(i));
  log(`${COUNT} bot(s) → ${URL}. Waiting for a real player to join first…`);
  const last = {};
  setInterval(async () => {
    for (const b of bots) {
      const s = b.state;
      if (!s) continue;
      if (!b.joined) {
        if (!humansIn(s) || b.joining) continue; // a person must be the host
        b.joining = true;
        const r = await b.emit('player:join', { id: b.id, name: b.name });
        b.joining = false;
        b.joined = !!(r && r.ok);
        log(`${b.name} join: ${b.joined ? 'ok' : (r && r.error) || 'failed'}`);
        continue;
      }
      if (s.phase === 'lobby' && s.me && !s.players.find((p) => p.id === b.id)?.ready) {
        b.emit('player:ready', { ready: true });
      }
      const key = `${s.phase}:${s.round}:${s.game ? s.game.id || '' : ''}`;
      if (last[b.id] === key) continue;
      last[b.id] = key;
      if (b === bots[0]) log('phase', s.phase, s.round || '');
      act(b, s);
    }
  }, 600);
})();
