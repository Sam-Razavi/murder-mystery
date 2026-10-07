// Bot guests for small groups (e.g. two people + two bots).
// Start the server first, then: npm run bots   (or: node scripts/bots.js 3)
// Bots wait until a real player has joined, so a person is always the host.
// They play a simple honest game after a short random delay, and stay for
// every following game:
//  - classic: innocents pin their clues and vote/accuse among the suspects the
//    evidence still allows (the same case-file logic as the TV); the killer
//    frames someone the evidence points at, and rarely shows its own fakes.
//  - «دست‌به‌دست»: accuse whoever they know had a knife, never someone they
//    know started innocent. Killers steer the vote onto an innocent.
const { io } = require('socket.io-client');

// The screens' case-file helper (public/shared.js) needs a minimal browser.
global.window = { I18N: require('../public/i18n') };
global.document = { querySelectorAll: () => [], documentElement: {} };
global.requestAnimationFrame = () => {};
require('../public/shared.js');
const { caseFacts } = global.window.Z;

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

// ---- classic: what the evidence still allows ----
// Innocents add their own clues to the board; the killer only trusts the board
// (its own cards are lies). Returns suspects, weapons and rooms still possible.
function classicOptions(b, s, others) {
  const C = b.content;
  const killer = s.me.role === 'killer';
  const cards = (s.game.board || []).concat(killer ? [] : s.me.hand);
  const f = caseFacts(cards, C);
  const ch = (p) => C.characters.find((c) => c.id === p.charId);
  const suspects = others.filter((p) => p.charId && !f.alibis.has(p.id) && f.fits(ch(p).traits));
  return {
    suspects: suspects.length ? suspects : others,
    weapons: C.weapons.filter((w) => !f.weaponsOut.has(w.id)),
    rooms: C.rooms.filter((r) => !f.roomsOut.has(r.id)),
  };
}
const pickOr = (list, fallback) => pick(list.length ? list : fallback);

// ---- «دست‌به‌دست»: hard facts from the journal ----
function itemsTarget(b, s, others) {
  const me = s.me;
  const K = b.content.knifeId;
  if (me.role === 'killer') return pickOr(others.filter((p) => !(me.partners || []).includes(p.id)), others);
  const innocent = new Set();
  const knife = [];
  me.notes.forEach((n) => {
    if (n.type === 'snoop') {
      if (n.item === K) knife.push(n.targetId);
      else if (n.round === 1) innocent.add(n.targetId); // round 1 sees starting items
    } else if ((n.type === 'swap' || n.type === 'steal') && n.got === K) knife.push(n.targetId);
  });
  const sure = knife.filter((id) => !innocent.has(id) && id !== b.id);
  if (sure.length) return others.find((p) => p.id === sure[0]) || pick(others);
  return pickOr(others.filter((p) => !innocent.has(p.id)), others);
}

async function act(b, s) {
  const me = s.me;
  if (!me || !b.content) return;
  const others = s.players.filter((p) => p.id !== b.id && p.inGame !== false);
  await think();
  if (!b.state || `${b.state.phase}:${b.state.round}` !== `${s.phase}:${s.round}`) return; // phase moved on
  s = b.state; // act on the freshest board and journal
  try {
    if (s.phase === 'search') {
      if (me.role === 'killer' && me.forgeryOptions && me.forgeryOptions.length) {
        await b.emit('act:forge', { key: pick(me.forgeryOptions).key, roomId: pick(b.content.rooms).id });
      } else await b.emit('act:search', { roomId: pick(b.content.rooms).id });
    } else if (s.phase === 'discuss' && s.me.hand) {
      const fresh = s.me.hand.filter((c) => !c.pinned && c.kind !== 'nothing');
      // Innocents share what they found; the killer shows a fake only now and then.
      if (fresh.length && (me.role !== 'killer' || Math.random() < 0.35)) await b.emit('act:pin', { cardId: pick(fresh).id });
    } else if (s.phase === 'vote') {
      await b.emit('act:vote', { targetId: pick(classicOptions(b, s, others).suspects).id });
    } else if (s.phase === 'final') {
      if (s.mode === 'items') await b.emit('act:accuse', { targetId: itemsTarget(b, s, others).id });
      else {
        const o = classicOptions(b, s, others);
        await b.emit('act:final', { suspect: pick(o.suspects).id, weapon: pickOr(o.weapons, b.content.weapons).id, room: pickOr(o.rooms, b.content.rooms).id });
      }
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
