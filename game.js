// Game engine: pure state machine, no networking.
// The server calls the action methods and re-broadcasts on onChange().

const C = require('./content');

const TOTAL_ROUNDS = 3;

const DEFAULT_DURATIONS = {
  intro: 35,
  search: 40,
  vote: 35,
  spotlight: 35,
  final: 90,
  revealStep: 8,
};

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const byId = (list, id) => list.find((x) => x.id === id);

class Game {
  constructor(opts = {}) {
    this.durations = { ...DEFAULT_DURATIONS, ...(opts.durations || {}) };
    this.timeScale = opts.timeScale || 1; // tests run the clock faster
    this.minPlayers = opts.minPlayers || 4;
    this.maxPlayers = 8;
    this.onChange = opts.onChange || (() => {});
    this.players = []; // {id, name, score, connected, joinedAt}
    this.vipId = null;
    this.phase = 'lobby';
    this.round = 0;
    this.settings = { discussSeconds: 150 };
    this.g = null; // per-game state
    this.timer = null; // {endsAt, duration}
    this._timerHandle = null;
    this._phaseToken = 0;
    this._cardSeq = 0;
    this.gamesPlayed = 0;
  }

  // ---------------------------------------------------------------- helpers

  _changed() { this.onChange(); }

  player(id) { return this.players.find((p) => p.id === id); }

  _inGame(id) { return !!(this.g && this.g.chars[id]); }

  _gamePlayers() { return this.g ? this.players.filter((p) => this.g.chars[p.id]) : []; }

  _label(pid) {
    const p = this.player(pid);
    const ch = byId(C.CHARACTERS, this.g.chars[pid]);
    return `${ch.name} (${p ? p.name : '؟'})`;
  }

  _card(kind, text, extra = {}) {
    this._cardSeq += 1;
    return { id: `c${this._cardSeq}`, kind, text, forged: false, ...extra };
  }

  _setTimer(seconds, fn) {
    this._clearTimer();
    const token = ++this._phaseToken;
    const ms = (seconds * 1000) / this.timeScale;
    this.timer = { endsAt: Date.now() + ms, duration: ms };
    this._timerHandle = setTimeout(() => {
      if (token === this._phaseToken) fn();
    }, ms);
  }

  _clearTimer() {
    if (this._timerHandle) clearTimeout(this._timerHandle);
    this._timerHandle = null;
    this.timer = null;
  }

  // Short pause before advancing once everyone has submitted, so the last
  // checkmark is visible on the TV.
  _advanceSoon(fn) {
    const token = ++this._phaseToken;
    if (this._timerHandle) clearTimeout(this._timerHandle);
    this._timerHandle = setTimeout(() => {
      if (token === this._phaseToken) fn();
    }, 900 / this.timeScale);
  }

  _ensureVip() {
    const vip = this.player(this.vipId);
    if (vip && vip.connected) return;
    const next = this.players.filter((p) => p.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) this.vipId = next.id;
    else if (!vip) this.vipId = this.players[0] ? this.players[0].id : null;
  }

  _isVip(id) { return id && id === this.vipId; }

  // ---------------------------------------------------------------- lobby

  join(id, rawName) {
    const name = String(rawName || '').trim().replace(/\s+/g, ' ').slice(0, 14);
    const existing = this.player(id);
    if (existing) {
      existing.connected = true;
      if (name && this.phase === 'lobby') existing.name = name;
      this._ensureVip();
      this._changed();
      return { ok: true };
    }
    if (!name) return { ok: false, error: 'اسمت را بنویس.' };
    if (this.phase !== 'lobby') return { ok: false, error: 'بازی شروع شده. برای دور بعد صبر کن.' };
    if (this.players.length >= this.maxPlayers) return { ok: false, error: 'ظرفیت پر است (حداکثر ۸ نفر).' };
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: 'این اسم را کس دیگری برداشته.' };
    }
    this.players.push({ id, name, score: 0, connected: true, joinedAt: Date.now() + this.players.length });
    if (!this.vipId) this.vipId = id;
    this._ensureVip();
    this._changed();
    return { ok: true };
  }

  setConnected(id, connected) {
    const p = this.player(id);
    if (!p) return;
    p.connected = connected;
    this._ensureVip();
    if (this.phase !== 'lobby') this._checkAllDone();
    this._changed();
  }

  kick(byId_, targetId) {
    if (!this._isVip(byId_)) return { ok: false, error: 'فقط میزبان می‌تواند.' };
    if (this.phase !== 'lobby') return { ok: false, error: 'فقط در سالن انتظار.' };
    this.players = this.players.filter((p) => p.id !== targetId);
    this._ensureVip();
    this._changed();
    return { ok: true };
  }

  setSetting(byId_, key, value) {
    if (!this._isVip(byId_)) return { ok: false, error: 'فقط میزبان می‌تواند.' };
    if (key === 'discussSeconds' && [90, 150, 240].includes(Number(value))) {
      this.settings.discussSeconds = Number(value);
      this._changed();
      return { ok: true };
    }
    return { ok: false, error: 'تنظیم نامعتبر.' };
  }

  // ---------------------------------------------------------------- setup

  start(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: 'فقط میزبان می‌تواند بازی را شروع کند.' };
    if (!['lobby', 'results'].includes(this.phase)) return { ok: false, error: 'بازی در جریان است.' };
    if (this.players.length < this.minPlayers) {
      return { ok: false, error: `دست‌کم ${this.minPlayers.toLocaleString('fa-IR')} نفر لازم است.` };
    }
    this._setupGame();
    this.phase = 'intro';
    this.round = 0;
    this._setTimer(this.durations.intro, () => this._startSearch());
    this._changed();
    return { ok: true };
  }

  _setupGame() {
    const ids = this.players.map((p) => p.id);
    const chars = {};
    shuffle(C.CHARACTERS).slice(0, ids.length).forEach((ch, i) => { chars[ids[i]] = ch.id; });

    const killerId = pick(ids);
    const weapon = pick(C.WEAPONS).id;
    const room = pick(C.ROOMS).id;
    const innocents = ids.filter((id) => id !== killerId);

    const missions = {};
    const missionPool = shuffle(C.MISSIONS);
    innocents.forEach((pid, i) => {
      const m = missionPool[i % missionPool.length];
      const targetId = m.needsTarget ? pick(ids.filter((x) => x !== pid)) : null;
      missions[pid] = { id: m.id, targetId };
    });

    this.g = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      killerId, weapon, room, chars, missions, innocents,
      decks: {}, planted: {}, hands: {}, visits: {}, newCards: {},
      board: [], pins: {}, searchChoice: {}, forgeryChoice: null,
      forgeryOptions: [], usedForgeries: new Set(), plants: [],
      votes: {}, spotlights: [], finalVotes: {}, results: null, revealStep: 0,
      cardsPerSearch: ids.length <= 4 ? 2 : 1,
    };
    ids.forEach((id) => {
      this.g.hands[id] = [];
      this.g.visits[id] = [];
      this.g.pins[id] = 0;
      this.g.newCards[id] = [];
    });
    C.ROOMS.forEach((r) => { this.g.decks[r.id] = []; this.g.planted[r.id] = []; });
    this._buildDecks();
  }

  _killerTraits() {
    return byId(C.CHARACTERS, this.g.chars[this.g.killerId]).traits;
  }

  _buildDecks() {
    const { g } = this;
    const pool = [];

    C.WEAPONS.filter((w) => w.id !== g.weapon).forEach((w) => pool.push(this._card('weapon', w.clear)));
    C.ROOMS.filter((r) => r.id !== g.room).forEach((r) => pool.push(this._card('room', r.clear)));

    // Trait clues: 3 of 4, preferring ones that actually separate the killer
    // from at least one innocent.
    const kt = this._killerTraits();
    const innocentTraits = g.innocents.map((pid) => byId(C.CHARACTERS, g.chars[pid]).traits);
    const traitIdx = shuffle([0, 1, 2, 3]).sort((a, b) => {
      const inf = (i) => innocentTraits.some((t) => t[i] !== kt[i]) ? 0 : 1;
      return inf(a) - inf(b);
    }).slice(0, 3);
    traitIdx.forEach((i) => {
      const t = C.TRAITS[i];
      pool.push(this._card('trait', kt[i] ? t.yesClue : t.noClue));
    });

    const alibiCount = this.players.length <= 5 ? 1 : 2;
    const alibiTemplates = shuffle(C.ALIBI_TEMPLATES);
    shuffle(g.innocents).slice(0, alibiCount).forEach((pid, i) => {
      pool.push(this._card('alibi', alibiTemplates[i].replace(/\{X\}/g, this._label(pid))));
    });

    const motiveTemplates = shuffle(C.MOTIVE_TEMPLATES);
    shuffle(Object.keys(g.chars)).slice(0, 2).forEach((pid, i) => {
      pool.push(this._card('motive', motiveTemplates[i].replace(/\{X\}/g, this._label(pid))));
    });

    const roomIds = shuffle(C.ROOMS.map((r) => r.id));
    shuffle(pool).forEach((card, i) => g.decks[roomIds[i % roomIds.length]].push(card));
  }

  // All lies the killer could plant this game (same templates as real clues).
  _allForgeries() {
    const { g } = this;
    const list = [];
    const w = byId(C.WEAPONS, g.weapon);
    const r = byId(C.ROOMS, g.room);
    list.push({ key: 'weapon', kind: 'weapon', text: w.clear, hint: `${w.name} را بی‌گناه جلوه بده` });
    list.push({ key: 'room', kind: 'room', text: r.clear, hint: `${r.name} را پاک جلوه بده` });
    const kt = this._killerTraits();
    const innocentTraits = g.innocents.map((pid) => byId(C.CHARACTERS, g.chars[pid]).traits);
    C.TRAITS.forEach((t, i) => {
      if (!innocentTraits.some((it) => it[i] !== kt[i])) return; // no one to frame
      const framed = g.innocents
        .filter((pid) => byId(C.CHARACTERS, g.chars[pid]).traits[i] !== kt[i])
        .map((pid) => byId(C.CHARACTERS, g.chars[pid]).name);
      list.push({
        key: `trait:${t.id}`, kind: 'trait', text: kt[i] ? t.noClue : t.yesClue,
        hint: `شک را به ${framed.join('، ')} بینداز`,
      });
    });
    const tpl = pick(C.ALIBI_TEMPLATES);
    list.push({ key: 'alibi', kind: 'alibi', text: tpl.replace(/\{X\}/g, this._label(g.killerId)), hint: 'برای خودت شاهد دروغین بساز' });
    return list;
  }

  _rollForgeryOptions() {
    const { g } = this;
    const available = this._allForgeries().filter((f) => !g.usedForgeries.has(f.key));
    g.forgeryOptions = shuffle(available).slice(0, 3);
    g.forgeryChoice = null;
  }

  // ---------------------------------------------------------------- search

  _startSearch() {
    this.round += 1;
    this.phase = 'search';
    const { g } = this;
    g.searchChoice = {};
    g.forgeryChoice = null;
    Object.keys(g.newCards).forEach((id) => { g.newCards[id] = []; });
    this._rollForgeryOptions();
    this._setTimer(this.durations.search, () => this._endSearch());
    this._changed();
  }

  search(pid, roomId) {
    if (this.phase !== 'search' || !this._inGame(pid)) return { ok: false, error: 'الان وقت بازرسی نیست.' };
    if (pid === this.g.killerId) return { ok: false, error: 'تو باید مدرک جعل کنی.' };
    if (!byId(C.ROOMS, roomId)) return { ok: false, error: 'اتاق نامعتبر.' };
    this.g.searchChoice[pid] = roomId;
    this._checkAllDone();
    this._changed();
    return { ok: true };
  }

  forge(pid, key, roomId) {
    const { g } = this;
    if (this.phase !== 'search' || pid !== (g && g.killerId)) return { ok: false, error: 'اجازه نداری.' };
    if (!g.forgeryOptions.some((f) => f.key === key)) return { ok: false, error: 'گزینه‌ی نامعتبر.' };
    if (!byId(C.ROOMS, roomId)) return { ok: false, error: 'اتاق نامعتبر.' };
    g.forgeryChoice = { key, roomId };
    this._checkAllDone();
    this._changed();
    return { ok: true };
  }

  _drawFrom(roomId) {
    const { g } = this;
    if (g.decks[roomId].length) return g.decks[roomId].shift();
    const other = shuffle(C.ROOMS.map((r) => r.id)).find((rid) => g.decks[rid].length);
    if (!other) return null;
    const card = g.decks[other].shift();
    card.hallway = true; // the phone says it was found in the hallway
    return card;
  }

  _endSearch() {
    const { g } = this;
    const rid = () => pick(C.ROOMS).id;

    // Killer plants first, so an innocent searching the same room this round
    // picks the fake up.
    let choice = g.forgeryChoice;
    if (!choice && g.forgeryOptions.length) choice = { key: pick(g.forgeryOptions).key, roomId: rid(), auto: true };
    if (choice) {
      const f = g.forgeryOptions.find((x) => x.key === choice.key);
      g.usedForgeries.add(f.key);
      const planted = this._card(f.kind, f.text, { forged: true, round: this.round, foundIn: choice.roomId });
      const copy = this._card(f.kind, f.text, { forged: true, round: this.round, foundIn: choice.roomId, copyOf: planted.id });
      g.planted[choice.roomId].push(planted);
      g.plants.push({ cardId: planted.id, copyId: copy.id, text: f.text, round: this.round, roomId: choice.roomId, deliveredTo: null });
      g.hands[g.killerId].push(copy);
      g.newCards[g.killerId].push(copy.id);
      g.visits[g.killerId].push(choice.roomId);
    } else {
      g.visits[g.killerId].push(rid());
    }

    shuffle(g.innocents).forEach((pid) => {
      const roomId = g.searchChoice[pid] || rid();
      g.searchChoice[pid] = roomId;
      g.visits[pid].push(roomId);
      const found = [];
      if (g.planted[roomId].length) {
        const card = g.planted[roomId].shift();
        const plant = g.plants.find((p) => p.cardId === card.id);
        if (plant) plant.deliveredTo = pid;
        found.push(card);
      }
      while (found.length < g.cardsPerSearch) {
        const card = this._drawFrom(roomId);
        if (!card) break;
        found.push(card);
      }
      if (!found.length) found.push(this._card('nothing', C.NOTHING_FOUND));
      found.forEach((card) => {
        card.round = this.round;
        card.foundIn = card.foundIn || roomId;
        g.hands[pid].push(card);
        g.newCards[pid].push(card.id);
      });
    });

    this.phase = 'discuss';
    this._setTimer(this.settings.discussSeconds, () => this._endDiscuss());
    this._changed();
  }

  // ---------------------------------------------------------------- discuss

  pin(pid, cardId) {
    const { g } = this;
    if (!['discuss', 'vote', 'spotlight', 'final'].includes(this.phase) || !this._inGame(pid)) {
      return { ok: false, error: 'الان نمی‌شود مدرک نشان داد.' };
    }
    const card = g.hands[pid].find((c) => c.id === cardId);
    if (!card) return { ok: false, error: 'این کارت را نداری.' };
    if (card.pinned) return { ok: false, error: 'قبلاً نشانش داده‌ای.' };
    if (card.kind === 'nothing') return { ok: false, error: 'این کارت چیزی برای نشان دادن ندارد.' };
    card.pinned = true;
    g.pins[pid] += 1;
    g.board.push({ cardId, playerId: pid, text: card.text, kind: card.kind, round: card.round, at: Date.now() });
    this._changed();
    return { ok: true };
  }

  _endDiscuss() {
    if (this.round < TOTAL_ROUNDS) {
      this.phase = 'vote';
      this.g.votes[this.round] = {};
      this._setTimer(this.durations.vote, () => this._endVote());
    } else {
      this.phase = 'final';
      this._setTimer(this.durations.final, () => this._endFinal());
    }
    this._changed();
  }

  // ---------------------------------------------------------------- interrogation

  vote(pid, targetId) {
    if (this.phase !== 'vote' || !this._inGame(pid)) return { ok: false, error: 'الان وقت رأی نیست.' };
    if (pid === targetId || !this._inGame(targetId)) return { ok: false, error: 'رأی نامعتبر.' };
    this.g.votes[this.round][pid] = targetId;
    this._checkAllDone();
    this._changed();
    return { ok: true };
  }

  _tally(votes) {
    const counts = {};
    Object.values(votes).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
    return counts;
  }

  _endVote() {
    const { g } = this;
    const votes = g.votes[this.round];
    const counts = this._tally(votes);
    const max = Math.max(0, ...Object.values(counts));
    if (max === 0) {
      this._startSearch();
      return;
    }
    const top = Object.keys(counts).filter((id) => counts[id] === max);
    const playerId = pick(top);
    g.spotlights.push({
      round: this.round, playerId, votes: max, tie: top.length > 1,
      rooms: g.visits[playerId].slice(),
      ballots: Object.entries(votes).map(([from, to]) => ({ from, to })),
    });
    this.phase = 'spotlight';
    this._setTimer(this.durations.spotlight, () => this._startSearch());
    this._changed();
  }

  // ---------------------------------------------------------------- final

  final(pid, { suspect, weapon, room } = {}) {
    if (this.phase !== 'final' || !this._inGame(pid)) return { ok: false, error: 'الان وقت اتهام نیست.' };
    if (!this._inGame(suspect) || suspect === pid) return { ok: false, error: 'یک مظنون انتخاب کن.' };
    if (!byId(C.WEAPONS, weapon) || !byId(C.ROOMS, room)) return { ok: false, error: 'سلاح و مکان را انتخاب کن.' };
    this.g.finalVotes[pid] = { suspect, weapon, room };
    this._checkAllDone();
    this._changed();
    return { ok: true };
  }

  _endFinal() {
    this.g.results = this._computeResults();
    this.players.forEach((p) => {
      const pts = this.g.results.points.find((x) => x.playerId === p.id);
      if (pts) p.score += pts.total;
    });
    this.gamesPlayed += 1;
    this.phase = 'reveal';
    this.g.revealStep = 0;
    this._scheduleReveal();
    this._changed();
  }

  _computeResults() {
    const { g } = this;
    const ids = Object.keys(g.chars);
    const fv = g.finalVotes;
    const counts = this._tally(Object.fromEntries(Object.entries(fv).map(([k, v]) => [k, v.suspect])));
    const tally = ids.map((id) => ({
      playerId: id,
      votes: counts[id] || 0,
      voters: Object.keys(fv).filter((v) => fv[v].suspect === id),
    })).sort((a, b) => b.votes - a.votes);

    const killerVotes = counts[g.killerId] || 0;
    const othersMax = Math.max(0, ...ids.filter((id) => id !== g.killerId).map((id) => counts[id] || 0));
    const caught = killerVotes > 0 && killerVotes >= othersMax;

    const spotlit = g.spotlights.map((s) => s.playerId);
    const missionResults = g.innocents.map((pid) => {
      const m = g.missions[pid];
      const def = byId(C.MISSIONS, m.id);
      const v = g.visits[pid];
      let success = false;
      switch (m.id) {
        case 'suspicious': success = (counts[pid] || 0) >= 2; break;
        case 'guardian': success = (counts[m.targetId] || 0) === 0; break;
        case 'silent': success = g.pins[pid] === 0; break;
        case 'herald': success = g.pins[pid] >= 3; break;
        case 'shadow': success = v.length === TOTAL_ROUNDS && v.every((r) => r === v[0]); break;
        case 'unseen': success = !spotlit.includes(pid); break;
        case 'stubborn': {
          const picks = [g.votes[1] && g.votes[1][pid], g.votes[2] && g.votes[2][pid], fv[pid] && fv[pid].suspect];
          success = picks.every((x) => x && x === picks[0]);
          break;
        }
        case 'pointer': success = spotlit.includes(m.targetId); break;
        default: break;
      }
      return { playerId: pid, missionId: m.id, title: def.title, text: this._missionText(pid), success };
    });

    const forgeries = g.plants.map((p) => {
      const holders = [g.killerId, p.deliveredTo].filter(Boolean);
      return {
        text: p.text, round: p.round, roomId: p.roomId, deliveredTo: p.deliveredTo,
        pinnedBy: g.board.filter((b) => b.text === p.text && holders.includes(b.playerId)).map((b) => b.playerId),
      };
    });

    const points = ids.map((pid) => {
      const breakdown = [];
      if (pid === g.killerId) {
        if (!caught) breakdown.push({ label: 'فرار از عدالت', pts: 5 });
        const fooled = g.plants.filter((p) => p.deliveredTo).length;
        if (fooled) breakdown.push({ label: `${fooled.toLocaleString('fa-IR')} مدرک جعلی به دست بقیه رسید`, pts: fooled });
      } else {
        const v = fv[pid];
        if (v && v.suspect === g.killerId) breakdown.push({ label: 'قاتل را درست حدس زد', pts: 3 });
        if (v && v.weapon === g.weapon) breakdown.push({ label: 'سلاح درست', pts: 1 });
        if (v && v.room === g.room) breakdown.push({ label: 'مکان درست', pts: 1 });
        const mr = missionResults.find((m) => m.playerId === pid);
        if (mr && mr.success) breakdown.push({ label: `مأموریت «${mr.title}»`, pts: 2 });
      }
      return { playerId: pid, total: breakdown.reduce((s, b) => s + b.pts, 0), breakdown };
    });

    return {
      killerId: g.killerId, weapon: g.weapon, room: g.room, caught, tally,
      weaponRight: Object.keys(fv).filter((id) => id !== g.killerId && fv[id].weapon === g.weapon),
      roomRight: Object.keys(fv).filter((id) => id !== g.killerId && fv[id].room === g.room),
      forgeries, missions: missionResults, points,
    };
  }

  // ---------------------------------------------------------------- reveal

  _scheduleReveal() {
    this._setTimer(this.durations.revealStep, () => this._advanceReveal());
  }

  _advanceReveal() {
    const LAST = 4;
    if (this.g.revealStep < LAST) {
      this.g.revealStep += 1;
      this._scheduleReveal();
    } else {
      this.phase = 'results';
      this._clearTimer();
    }
    this._changed();
  }

  next(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: 'فقط میزبان می‌تواند.' };
    if (this.phase === 'reveal') { this._advanceReveal(); return { ok: true }; }
    return this.skip(byId_);
  }

  skip(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: 'فقط میزبان می‌تواند.' };
    const enders = {
      intro: () => this._startSearch(),
      search: () => this._endSearch(),
      discuss: () => this._endDiscuss(),
      vote: () => this._endVote(),
      spotlight: () => this._startSearch(),
      final: () => this._endFinal(),
      reveal: () => this._advanceReveal(),
    };
    const fn = enders[this.phase];
    if (!fn) return { ok: false, error: 'چیزی برای رد کردن نیست.' };
    this._phaseToken += 1;
    this._clearTimer();
    fn();
    return { ok: true };
  }

  backToLobby(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: 'فقط میزبان می‌تواند.' };
    this._clearTimer();
    this._phaseToken += 1;
    this.phase = 'lobby';
    this.round = 0;
    this.g = null;
    this.players = this.players.filter((p) => p.connected);
    this._ensureVip();
    this._changed();
    return { ok: true };
  }

  resetScores(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: 'فقط میزبان می‌تواند.' };
    this.players.forEach((p) => { p.score = 0; });
    this.gamesPlayed = 0;
    this._changed();
    return { ok: true };
  }

  // ---------------------------------------------------------------- progress

  _hasActed(pid) {
    const { g } = this;
    if (!g) return false;
    switch (this.phase) {
      case 'search': return pid === g.killerId ? !!g.forgeryChoice : !!g.searchChoice[pid];
      case 'vote': return !!(g.votes[this.round] && g.votes[this.round][pid]);
      case 'final': return !!g.finalVotes[pid];
      default: return false;
    }
  }

  _checkAllDone() {
    if (!['search', 'vote', 'final'].includes(this.phase)) return;
    const active = this._gamePlayers().filter((p) => p.connected);
    if (!active.length || !active.every((p) => this._hasActed(p.id))) return;
    const enders = { search: () => this._endSearch(), vote: () => this._endVote(), final: () => this._endFinal() };
    const phase = this.phase;
    this._advanceSoon(() => { if (this.phase === phase) enders[phase](); });
  }

  // ---------------------------------------------------------------- views

  _missionText(pid) {
    const m = this.g.missions[pid];
    if (!m) return null;
    const def = byId(C.MISSIONS, m.id);
    return m.targetId ? def.text.replace(/\{T\}/g, this._label(m.targetId)) : def.text;
  }

  publicState() {
    const { g } = this;
    const state = {
      phase: this.phase,
      round: this.round,
      totalRounds: TOTAL_ROUNDS,
      timer: this.timer,
      serverNow: Date.now(),
      settings: this.settings,
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      gamesPlayed: this.gamesPlayed,
      vipId: this.vipId,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, score: p.score, connected: p.connected,
        charId: g ? g.chars[p.id] || null : null,
        done: this._hasActed(p.id),
      })),
      game: null,
    };
    if (!g) return state;

    state.game = {
      id: g.id,
      board: g.board.map(({ cardId, playerId, text, kind, round }) => ({ cardId, playerId, text, kind, round })),
      spotlight: this.phase === 'spotlight' ? g.spotlights[g.spotlights.length - 1] : null,
      spotlights: g.spotlights.map(({ round, playerId, votes }) => ({ round, playerId, votes })),
      revealStep: this.phase === 'reveal' ? g.revealStep : (this.phase === 'results' ? 99 : -1),
      reveal: null,
    };

    if (g.results && ['reveal', 'results'].includes(this.phase)) {
      const step = this.phase === 'results' ? 99 : g.revealStep;
      const r = g.results;
      const out = { tally: r.tally };
      if (step >= 1) Object.assign(out, { killerId: r.killerId, caught: r.caught });
      if (step >= 2) Object.assign(out, { weapon: r.weapon, room: r.room, weaponRight: r.weaponRight, roomRight: r.roomRight });
      if (step >= 3) out.forgeries = r.forgeries;
      if (step >= 4) out.missions = r.missions;
      if (step >= 99) out.points = r.points;
      state.game.reveal = out;
    }
    return state;
  }

  privateState(pid) {
    const p = this.player(pid);
    if (!p) return null;
    const out = { id: pid, name: p.name, isVip: this._isVip(pid), inGame: this._inGame(pid) };
    const { g } = this;
    if (!g || !g.chars[pid]) return out;

    const isKiller = pid === g.killerId;
    out.charId = g.chars[pid];
    out.role = isKiller ? 'killer' : 'innocent';
    out.hand = g.hands[pid].map((c) => ({
      id: c.id, kind: c.kind, text: c.text, round: c.round, foundIn: c.foundIn, hallway: !!c.hallway,
      pinned: !!c.pinned, isNew: g.newCards[pid].includes(c.id),
      ...(isKiller ? { forged: true } : {}),
    }));
    out.visits = g.visits[pid].slice();
    out.acted = this._hasActed(pid);

    if (isKiller) {
      out.truth = { weapon: g.weapon, room: g.room };
      out.forgeryOptions = this.phase === 'search' ? g.forgeryOptions.map(({ key, text, hint }) => ({ key, text, hint })) : [];
      out.forgeryChoice = g.forgeryChoice;
      out.plants = g.plants.map((x) => ({ text: x.text, round: x.round, roomId: x.roomId, delivered: !!x.deliveredTo }));
    } else {
      const m = g.missions[pid];
      out.mission = { id: m.id, title: byId(C.MISSIONS, m.id).title, text: this._missionText(pid) };
      out.searchChoice = g.searchChoice[pid] || null;
    }
    if (this.phase === 'vote') out.myVote = (g.votes[this.round] || {})[pid] || null;
    if (this.phase === 'final' || g.finalVotes[pid]) out.myFinal = g.finalVotes[pid] || null;
    if (g.results && this.phase === 'results') {
      out.myPoints = g.results.points.find((x) => x.playerId === pid) || null;
    }
    return out;
  }

  dispose() { this._clearTimer(); this._phaseToken += 1; }
}

module.exports = { Game, TOTAL_ROUNDS, DEFAULT_DURATIONS };
