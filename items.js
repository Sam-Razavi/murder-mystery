// Mode «دست‌به‌دست»: hidden starting items that move between players.
// Whoever STARTS with a knife is a killer. Each gossip round one random
// player gets a secret action (snoop / swap / steal / shuffle) that reveals
// or moves items. The final vote must land on someone who started with a knife.
//
// These methods are mixed into Game (game.js) and only run while
// settings.mode === 'items'. No networking here either.

const C = require('./content');

const ITEM_ROUNDS = 6; // gossip rounds per game
const ROUNDS_PER_DISCUSS = 2; // a discussion after every 2 gossip rounds
const ACTION_TYPES = ['snoop', 'swap', 'steal', 'shuffle'];
const ITEM_REVEAL_LAST = 3;

const killersFor = (n) => (n <= 4 ? 1 : 2);

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const methods = {
  // ---------------------------------------------------------------- setup

  _itSetup() {
    const ids = this.players.map((p) => p.id);
    const k = killersFor(ids.length);
    const others = shuffle(C.ITEMS).slice(0, ids.length - k).map((i) => i.id);
    const pool = shuffle([...Array(k).fill(C.KNIFE.id), ...others]);
    const start = {};
    ids.forEach((id, i) => { start[id] = pool[i]; });

    this.g = {
      mode: 'items',
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      ids,
      killers: ids.filter((id) => start[id] === C.KNIFE.id),
      start,
      hold: { ...start },
      // Public: which items are in play (not who holds them). Knives first.
      items: pool.slice().sort((a, b) => (b === C.KNIFE.id) - (a === C.KNIFE.id)),
      totalRounds: ITEM_ROUNDS,
      log: [], // one entry per secret action, for the final reveal
      notes: Object.fromEntries(ids.map((id) => [id, [{ round: 0, type: 'start', item: start[id] }]])),
      actorQueue: [],
      turn: null,
      gossip: null,
      gossips: [],
      usedQuestions: new Set(),
      finalVotes: {},
      results: null,
      revealStep: 0,
    };
  },

  _itStart() {
    this._itSetup();
    this.phase = 'intro';
    this.round = 0;
    this._setTimer(this.durations.intro, () => this._itStartGossip());
  },

  // ---------------------------------------------------------------- gossip + secret action

  // Everyone gets a secret action once before anyone gets a second one.
  // Connected players are preferred so the action isn't wasted on an empty phone.
  _itNextActor() {
    const { g } = this;
    if (!g.actorQueue.length) g.actorQueue = shuffle(g.ids);
    const idx = g.actorQueue.findIndex((id) => { const p = this.player(id); return p && p.connected; });
    return g.actorQueue.splice(idx < 0 ? 0 : idx, 1)[0];
  },

  _itStartGossip() {
    this.round += 1;
    this.phase = 'gossip';
    const { g } = this;
    let pool = C.GOSSIP_QUESTIONS.filter((q) => !g.usedQuestions.has(q));
    if (!pool.length) { g.usedQuestions.clear(); pool = C.GOSSIP_QUESTIONS; }
    const question = pick(pool);
    g.usedQuestions.add(question);
    g.gossip = { round: this.round, question, answers: {} };
    g.turn = { round: this.round, actorId: this._itNextActor(), type: pick(ACTION_TYPES), done: false, targets: null, result: null, auto: false };
    this._setTimer(this.durations.gossip, () => this._itEndGossip());
    this._changed();
  },

  itAnswer(pid, targetId) {
    if (this.phase !== 'gossip' || !this._items() || !this._inGame(pid)) return { ok: false, error: 'الان وقت جواب دادن نیست.' };
    if (pid === targetId || !this._inGame(targetId)) return { ok: false, error: 'جواب نامعتبر.' };
    this.g.gossip.answers[pid] = targetId;
    this._checkAllDone();
    this._changed();
    return { ok: true };
  },

  _itOthers(pid) { return this.g.ids.filter((id) => id !== pid); },

  itAct(pid, { targets } = {}) {
    const { g } = this;
    const t = g && g.turn;
    if (this.phase !== 'gossip' || !this._items() || !t || t.actorId !== pid) return { ok: false, error: 'این دور کار مخفی‌ای نداری.' };
    if (t.done) return { ok: false, error: 'قبلاً انجامش داده‌ای.' };
    const list = Array.isArray(targets) ? targets : [];
    const valid = (id) => id !== pid && this._inGame(id);
    if (t.type === 'snoop' || t.type === 'steal') {
      if (list.length !== 1 || !valid(list[0])) return { ok: false, error: 'یک نفر را انتخاب کن.' };
      t.targets = [list[0]];
    } else if (t.type === 'shuffle') {
      if (list.length !== 2 || list[0] === list[1] || !list.every(valid)) return { ok: false, error: 'دو نفرِ دیگر را انتخاب کن.' };
      t.targets = [list[0], list[1]];
    } else {
      t.targets = [pick(this._itOthers(pid))]; // swap: the partner is random
    }
    t.done = true;
    // Snooping sees the item right now. Everything else takes effect when the round ends.
    if (t.type === 'snoop') this._itSnoop(t);
    this._checkAllDone();
    this._changed();
    return { ok: true };
  },

  _itSnoop(t) {
    const item = this.g.hold[t.targets[0]];
    t.result = { targetId: t.targets[0], item };
    this.g.notes[t.actorId].push({ round: t.round, type: 'snoop', targetId: t.targets[0], item, auto: t.auto });
  },

  _itExchange(a, b) {
    const { hold } = this.g;
    [hold[a], hold[b]] = [hold[b], hold[a]];
  },

  _itResolveTurn() {
    const { g } = this;
    const t = g.turn;
    if (!t) return;
    if (!t.done) {
      // Actor ran out of time: the game picks for them so items still move
      // and nobody can tell who froze.
      t.auto = true;
      t.done = true;
      const others = shuffle(this._itOthers(t.actorId));
      t.targets = t.type === 'shuffle' ? others.slice(0, 2) : others.slice(0, 1);
      if (t.type === 'snoop') this._itSnoop(t);
    }
    const before = { ...g.hold };
    if (t.type === 'swap' || t.type === 'steal') this._itExchange(t.actorId, t.targets[0]);
    if (t.type === 'shuffle') this._itExchange(t.targets[0], t.targets[1]);
    const moves = g.ids.filter((id) => before[id] !== g.hold[id]).map((id) => ({ playerId: id, from: before[id], to: g.hold[id] }));

    if (t.type === 'swap' || t.type === 'steal') {
      g.notes[t.actorId].push({ round: t.round, type: t.type, targetId: t.targets[0], gave: before[t.actorId], got: g.hold[t.actorId], auto: t.auto });
    } else if (t.type === 'shuffle') {
      g.notes[t.actorId].push({ round: t.round, type: 'shuffle', a: t.targets[0], b: t.targets[1], auto: t.auto });
    }
    // Victims only notice that their item changed — not who did it.
    // Two knives look identical, so a knife-for-knife exchange goes unnoticed.
    moves.filter((m) => m.playerId !== t.actorId).forEach((m) => {
      g.notes[m.playerId].push({ round: t.round, type: 'changed', from: m.from, to: m.to });
    });

    g.log.push({
      round: t.round, actorId: t.actorId, type: t.type, targets: t.targets.slice(), auto: t.auto,
      seen: t.type === 'snoop' ? t.result.item : null, moves,
      holdAfter: { ...g.hold },
    });
  },

  _itEndGossip() {
    const { g } = this;
    this._itResolveTurn();
    const counts = this._tally(g.gossip.answers);
    g.gossips.push({
      round: g.gossip.round,
      question: g.gossip.question,
      tally: g.ids.map((id) => ({
        playerId: id,
        votes: counts[id] || 0,
        voters: Object.keys(g.gossip.answers).filter((v) => g.gossip.answers[v] === id),
      })).sort((a, b) => b.votes - a.votes),
    });
    this.phase = 'gossipResult';
    this._setTimer(this.durations.gossipResult, () => this._itAfterGossipResult());
    this._changed();
  },

  _itAfterGossipResult() {
    if (this.round % ROUNDS_PER_DISCUSS === 0 || this.round >= this.g.totalRounds) {
      this.phase = 'discuss';
      this._setTimer(this.settings.discussSeconds, () => this._itEndDiscuss());
      this._changed();
    } else {
      this._itStartGossip();
    }
  },

  _itEndDiscuss() {
    if (this.round >= this.g.totalRounds) {
      this.phase = 'final';
      this._setTimer(this.durations.final, () => this._itEndFinal());
      this._changed();
    } else {
      this._itStartGossip();
    }
  },

  // ---------------------------------------------------------------- final vote

  itFinal(pid, targetId) {
    if (this.phase !== 'final' || !this._items() || !this._inGame(pid)) return { ok: false, error: 'الان وقت رأی نیست.' };
    if (pid === targetId || !this._inGame(targetId)) return { ok: false, error: 'یک نفر را انتخاب کن.' };
    this.g.finalVotes[pid] = targetId;
    this._checkAllDone();
    this._changed();
    return { ok: true };
  },

  _itEndFinal() {
    this.g.results = this._itComputeResults();
    this.players.forEach((p) => {
      const pts = this.g.results.points.find((x) => x.playerId === p.id);
      if (pts) p.score += pts.total;
    });
    this.gamesPlayed += 1;
    this.phase = 'reveal';
    this.g.revealStep = 0;
    this._scheduleReveal();
    this._changed();
  },

  // Verdict rules:
  //  - one player has the most votes → innocents win if that player started with a knife
  //  - a tie for most votes → killers win, unless every tied player is a killer
  //  - nobody voted → killers win
  _itVerdict(votes, killers) {
    const counts = this._tally(votes);
    const max = Math.max(0, ...Object.values(counts));
    const top = max ? Object.keys(counts).filter((id) => counts[id] === max) : [];
    if (!top.length) return { counts, top, accusedId: null, tie: false, innocentsWin: false };
    if (top.length === 1) return { counts, top, accusedId: top[0], tie: false, innocentsWin: killers.includes(top[0]) };
    return { counts, top, accusedId: null, tie: true, innocentsWin: top.every((id) => killers.includes(id)) };
  },

  _itComputeResults() {
    const { g } = this;
    const v = this._itVerdict(g.finalVotes, g.killers);
    const tally = g.ids.map((id) => ({
      playerId: id,
      votes: v.counts[id] || 0,
      voters: Object.keys(g.finalVotes).filter((x) => g.finalVotes[x] === id),
    })).sort((a, b) => b.votes - a.votes);

    const points = g.ids.map((pid) => {
      const breakdown = [];
      const isKiller = g.killers.includes(pid);
      if (isKiller && !v.innocentsWin) breakdown.push({ label: 'قاتل‌ها قسر در رفتند', pts: 3 });
      if (!isKiller && v.innocentsWin) breakdown.push({ label: 'بی‌گناه‌ها قاتل را گرفتند', pts: 2 });
      if (!isKiller && g.killers.includes(g.finalVotes[pid])) breakdown.push({ label: 'به یک قاتل رأی دادی', pts: 1 });
      return { playerId: pid, total: breakdown.reduce((s, b) => s + b.pts, 0), breakdown };
    });

    return {
      tally,
      top: v.top,
      accusedId: v.accusedId,
      tie: v.tie,
      innocentsWin: v.innocentsWin,
      killers: g.killers.slice(),
      start: { ...g.start },
      finalHold: { ...g.hold },
      log: g.log.map(({ round, actorId, type, targets, auto, seen, moves }) => ({ round, actorId, type, targets, auto, seen, moves })),
      points,
    };
  },

  // ---------------------------------------------------------------- progress / views

  _itHasActed(pid) {
    const { g } = this;
    switch (this.phase) {
      case 'gossip':
        return !!g.gossip.answers[pid] && (g.turn.actorId !== pid || g.turn.done);
      case 'final': return !!g.finalVotes[pid];
      default: return false;
    }
  },

  _itPublicGame() {
    const { g } = this;
    const out = {
      id: g.id,
      mode: 'items',
      killerCount: g.killers.length,
      items: g.items,
      actionsSoFar: g.log.length,
      question: ['gossip', 'gossipResult'].includes(this.phase) ? g.gossip.question : null,
      gossipResult: this.phase === 'gossipResult' ? g.gossips[g.gossips.length - 1] : null,
      gossips: g.gossips.map(({ round, question, tally }) => ({ round, question, top: tally.filter((t) => t.votes && t.votes === tally[0].votes).map((t) => t.playerId) })),
      revealStep: this.phase === 'reveal' ? g.revealStep : (this.phase === 'results' ? 99 : -1),
      reveal: null,
    };
    if (g.results && ['reveal', 'results'].includes(this.phase)) {
      const step = this.phase === 'results' ? 99 : g.revealStep;
      const r = g.results;
      const rv = { tally: r.tally };
      if (step >= 1) {
        Object.assign(rv, {
          accusedId: r.accusedId, tie: r.tie, top: r.top, innocentsWin: r.innocentsWin,
          // Whether each top vote-getter started with a knife (that's the verdict).
          topKiller: r.top.map((id) => r.killers.includes(id)),
        });
      }
      if (step >= 2) Object.assign(rv, { killers: r.killers, start: r.start });
      if (step >= 3) Object.assign(rv, { log: r.log, finalHold: r.finalHold });
      if (step >= 99) rv.points = r.points;
      out.reveal = rv;
    }
    return out;
  },

  _itPrivate(pid, out) {
    const { g } = this;
    out.mode = 'items';
    out.role = g.killers.includes(pid) ? 'killer' : 'innocent';
    out.startItem = g.start[pid];
    out.item = g.hold[pid];
    out.notes = g.notes[pid].slice();
    out.acted = this._itHasActed(pid);
    if (this.phase === 'gossip') {
      out.gossipAnswer = g.gossip.answers[pid] || null;
      if (g.turn.actorId === pid) {
        const t = g.turn;
        out.turn = {
          type: t.type, done: t.done, result: t.result,
          targets: t.type === 'swap' ? null : t.targets, // swap partner is revealed when the round ends
        };
      }
    }
    if (this.phase === 'final' || g.finalVotes[pid]) out.myFinal = g.finalVotes[pid] || null;
    if (g.results && this.phase === 'results') out.myPoints = g.results.points.find((x) => x.playerId === pid) || null;
    return out;
  },
};

module.exports = { methods, ITEM_ROUNDS, ROUNDS_PER_DISCUSS, ACTION_TYPES, ITEM_REVEAL_LAST, killersFor };
