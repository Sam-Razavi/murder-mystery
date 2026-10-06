const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Game } = require('./game');
const C = require('./content');

const PORT = Number(process.env.PORT) || 3100;
const TIME_SCALE = Number(process.env.TIME_SCALE) || 1; // >1 = faster clock (testing)
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS) || 4;

function lanIp() {
  if (process.env.PUBLIC_HOST) return process.env.PUBLIC_HOST;
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const [name, list] of Object.entries(nets)) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) candidates.push({ name, address: n.address });
    }
  }
  // Prefer typical home-LAN ranges over VPN/virtual adapters.
  const pref = candidates.find((c) => /^192\.168\./.test(c.address))
    || candidates.find((c) => /^10\./.test(c.address))
    || candidates[0];
  return pref ? pref.address : 'localhost';
}

const JOIN_URL = `http://${lanIp()}:${PORT}/`;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000 });

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));
app.get('/qr.svg', async (req, res) => {
  const svg = await QRCode.toString(JOIN_URL, { type: 'svg', margin: 1, color: { dark: '#1a0f14', light: '#f5e6c8' } });
  res.type('image/svg+xml').send(svg);
});
app.get('/healthz', (req, res) => res.json({ ok: true }));

// playerId -> Set(socketId)
const playerSockets = new Map();

const game = new Game({ timeScale: TIME_SCALE, minPlayers: MIN_PLAYERS, onChange: broadcast });

const CONTENT = {
  story: C.STORY, traits: C.TRAITS, characters: C.CHARACTERS,
  weapons: C.WEAPONS, rooms: C.ROOMS, phaseTitles: C.PHASE_TITLES, hallwayNote: C.HALLWAY_NOTE, joinUrl: JOIN_URL,
  modes: C.MODES, itemsStory: C.ITEMS_STORY, items: [C.KNIFE, ...C.ITEMS], knifeId: C.KNIFE.id,
  secretActions: C.SECRET_ACTIONS, itemPhaseTitles: C.ITEM_PHASE_TITLES, portraits: C.PORTRAITS,
};

let broadcastQueued = false;
function broadcast() {
  // Coalesce bursts of changes into one emit per tick.
  if (broadcastQueued) return;
  broadcastQueued = true;
  setImmediate(() => {
    broadcastQueued = false;
    const pub = game.publicState();
    io.to('tv').to('guests').emit('state', { ...pub, me: null });
    for (const [pid, sockets] of playerSockets) {
      const me = game.privateState(pid);
      for (const sid of sockets) io.to(sid).emit('state', { ...pub, me });
    }
  });
}

function reply(cb, result) {
  if (typeof cb === 'function') cb(result || { ok: true });
}

io.on('connection', (socket) => {
  socket.emit('content', CONTENT);
  let playerId = null;

  socket.on('tv:hello', () => {
    socket.join('tv');
    socket.emit('state', { ...game.publicState(), me: null });
  });

  socket.on('player:hello', ({ id } = {}, cb) => {
    if (!id || typeof id !== 'string') return reply(cb, { ok: false });
    const known = !!game.player(id);
    if (known) {
      playerId = id;
      if (!playerSockets.has(id)) playerSockets.set(id, new Set());
      playerSockets.get(id).add(socket.id);
      game.setConnected(id, true);
    } else {
      socket.join('guests'); // not joined yet: keep the join screen up to date
      socket.emit('state', { ...game.publicState(), me: null });
    }
    reply(cb, { ok: true, known });
  });

  socket.on('player:join', ({ id, name } = {}, cb) => {
    if (!id || typeof id !== 'string' || id.length > 64) return reply(cb, { ok: false, error: 'شناسه نامعتبر.' });
    const result = game.join(id, name);
    if (result.ok) {
      socket.leave('guests');
      playerId = id;
      if (!playerSockets.has(id)) playerSockets.set(id, new Set());
      playerSockets.get(id).add(socket.id);
      broadcast();
    }
    reply(cb, result);
  });

  const guarded = (fn) => (payload, cb) => {
    if (!playerId) return reply(cb, { ok: false, error: 'اول وارد بازی شو.' });
    try {
      reply(cb, fn(payload || {}));
    } catch (err) {
      console.error(err);
      reply(cb, { ok: false, error: 'خطای سرور.' });
    }
  };

  socket.on('player:portrait', guarded(({ portrait }) => game.setPortrait(playerId, portrait)));
  socket.on('player:ready', guarded(({ ready }) => game.setReady(playerId, ready)));
  socket.on('vip:start', guarded(() => game.start(playerId)));
  socket.on('vip:skip', guarded(() => game.skip(playerId)));
  socket.on('vip:next', guarded(() => game.next(playerId)));
  socket.on('vip:lobby', guarded(() => game.backToLobby(playerId)));
  socket.on('vip:resetScores', guarded(() => game.resetScores(playerId)));
  socket.on('vip:kick', guarded(({ targetId }) => game.kick(playerId, targetId)));
  socket.on('vip:setting', guarded(({ key, value }) => game.setSetting(playerId, key, value)));
  socket.on('act:search', guarded(({ roomId }) => game.search(playerId, roomId)));
  socket.on('act:forge', guarded(({ key, roomId }) => game.forge(playerId, key, roomId)));
  socket.on('act:pin', guarded(({ cardId }) => game.pin(playerId, cardId)));
  socket.on('act:vote', guarded(({ targetId }) => game.vote(playerId, targetId)));
  socket.on('act:final', guarded((p) => game.final(playerId, p)));
  // items mode
  socket.on('act:answer', guarded(({ targetId }) => game.itAnswer(playerId, targetId)));
  socket.on('act:secret', guarded(({ targets }) => game.itAct(playerId, { targets })));
  socket.on('act:accuse', guarded(({ targetId }) => game.itFinal(playerId, targetId)));

  socket.on('disconnect', () => {
    if (!playerId) return;
    const set = playerSockets.get(playerId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        playerSockets.delete(playerId);
        game.setConnected(playerId, false);
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ضیافت آخر — Ziafat-e Akhar');
  console.log(`  TV screen : http://localhost:${PORT}/tv`);
  console.log(`  Phones    : ${JOIN_URL}`);
  console.log('');
});

module.exports = { server, game };
