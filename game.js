// Game engine: pure state machine, no networking.
// The server calls the action methods and re-broadcasts on onChange().

const C = require('./content'); // Farsi bundle: language-independent data (ids, portraits, counts)
const LANGS = { fa: C, en: require('./content.en') };
// Stories for the classic mode, each laid over the base bundle (same keys).
// «دست‌به‌دست» always plays the Yalda story.
const STORIES = {
  yalda: LANGS,
  nowruz: { fa: { ...C, ...require('./content.nowruz') }, en: { ...LANGS.en, ...require('./content.nowruz.en') } },
};
const { tr } = require('./public/i18n');
const Items = require('./items');

const TOTAL_ROUNDS = 3;
const TUTORIAL_STEPS = 6; // slides in public/guide.js, same count for both modes

const DEFAULT_DURATIONS = {
  intro: 35,
  search: 40,
  vote: 35,
  spotlight: 35,
  final: 90,
  revealStep: 8,
  gossip: 40, // items mode: answer the gossip question (+ secret action)
  gossipResult: 8,
};

const MODES = ['classic', 'items'];
const MAX_PLAYERS = 12; // «دست‌به‌دست» takes up to 12
const CLASSIC_MAX = C.CHARACTERS.length; // classic needs one character per player (8)

// Host-adjustable settings and their allowed values. Everything except the
// discussion length is fixed once a game starts.
const SETTING_OPTIONS = {
  discussSeconds: [90, 150, 240],
  mode: MODES,
  lang: ['fa', 'en'], // everyone's language: host's choice
  itemRounds: [4, 6, 8], // items mode: gossip rounds per game
  gossipSeconds: [30, 40, 60], // items mode: time to answer (+ secret action)
  quietRounds: [false, true], // items mode: some rounds have no secret action
  killersKnow: [false, true], // items mode: killers see each other
  beginner: [true, false], // first game: slower action timers + rule tips on the phones
  caseFile: [true, false], // classic: TV sums up what the pinned clues prove
  story: Object.keys(STORIES), // classic: which mystery
  quick: [false, true], // classic: 2 rounds and shorter timers (~10 minutes)
};
const LIVE_SETTINGS = ['discussSeconds', 'caseFile'];
const BEGINNER_SLOWDOWN = 1.5; // action timers in beginner mode
const ACTION_KEYS = ['search', 'vote', 'spotlight', 'final', 'gossip']; // what beginner mode slows down
const QUICK_ROUNDS = 2; // classic quick game: 2 rounds instead of 3
const QUICK_SPEEDUP = 0.75; // ...with shorter timers
const QUICK_KEYS = ['intro', 'search', 'vote', 'spotlight', 'final', 'revealStep'];
const QUICK_DISCUSS_MAX = 90; // seconds

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
const isBot = (id) => typeof id === 'string' && id.startsWith('bot-');

class Game {
  constructor(opts = {}) {
    this.durations = { ...DEFAULT_DURATIONS, ...(opts.durations || {}) };
    this.timeScale = opts.timeScale || 1; // tests run the clock faster
    this.minPlayers = opts.minPlayers || 4;
    this.cinematic = opts.cinematic || 0; // seconds of TV prologue before the intro (0 = none)
    this.prologue = false;
    this.tutorial = null; // lobby "how to play" slide index, or null
    this.tutorialSeen = false; // the host has opened the slides at least once
    this.maxPlayers = MAX_PLAYERS;
    this.onChange = opts.onChange || (() => {});
    this.onGameEnd = opts.onGameEnd || (() => {}); // gets _outcome() after each game (balance log)
    this.players = []; // {id, name, score, connected, joinedAt}
    this.vipId = null;
    this.phase = 'lobby';
    this.round = 0;
    this.settings = {
      discussSeconds: 150, mode: 'classic', lang: 'fa', itemRounds: 6, gossipSeconds: 40, quietRounds: false, killersKnow: false,
      beginner: true, caseFile: true, story: 'yalda', quick: false,
    };
    this.g = null; // per-game state
    this.timer = null; // {endsAt, duration}
    this._timerHandle = null;
    this._timerFn = null; // what the running timer will do when it fires
    this.paused = null; // host pause: {left, duration, fn}
    this._phaseToken = 0;
    this._cardSeq = 0;
    this.gamesPlayed = 0;
    this.stats = {}; // per player, for the whole night (end-of-night summary)
    this.takeovers = []; // newcomers asking for an offline seat: {guestId, name, targetId}
  }

  // ---------------------------------------------------------------- helpers

  _changed() { this.onChange(); }

  player(id) { return this.players.find((p) => p.id === id); }

  _inGame(id) { return !!(this.g && this.g.ids.includes(id)); }

  _gamePlayers() { return this.g ? this.players.filter((p) => this._inGame(p.id)) : []; }

  // Language of everything shown: fixed for a running game, else the lobby setting.
  lang() { return (this.g && this.g.lang) || this.settings.lang || 'fa'; }

  // Story of the running game, else the lobby choice. Hand to Hand is always Yalda.
  story() {
    if (this.g) return this.g.story || 'yalda';
    return this.settings.mode === 'items' ? 'yalda' : this.settings.story;
  }

  // Story content in the current language (ids are the same in both).
  get L() { return STORIES[this.story()][this.lang()]; }

  // Interface text: written in Farsi, translated by public/i18n.js.
  _t(text, vars) { return tr(this.lang(), text, vars); }

  _items() { return !!(this.g && this.g.mode === 'items'); }

  _label(pid) {
    const p = this.player(pid);
    const ch = byId(this.L.CHARACTERS, this.g.chars[pid]);
    return `${ch.name} (${p ? p.name : this._t('؟')})`;
  }

  // Length of a timed phase. A quick game (classic) trims the story and the
  // action phases; beginner mode (fixed per game) then gives everyone more
  // time to read and decide.
  _dur(key) {
    let base = key === 'gossip' ? (this.settings.gossipSeconds || this.durations.gossip) : this.durations[key];
    if (this.g && this.g.quick && QUICK_KEYS.includes(key)) base *= QUICK_SPEEDUP;
    if (this.g && this.g.beginner && ACTION_KEYS.includes(key)) base *= BEGINNER_SLOWDOWN;
    return Math.round(base);
  }

  // Discussion length: the host's choice, at most 1:30 in a quick game.
  _discussSecs() {
    return this.g && this.g.quick ? Math.min(this.settings.discussSeconds, QUICK_DISCUSS_MAX) : this.settings.discussSeconds;
  }

  _card(kind, text, extra = {}) {
    this._cardSeq += 1;
    return { id: `c${this._cardSeq}`, kind, text, forged: false, ...extra };
  }

  _setTimer(seconds, fn) {
    const ms = (seconds * 1000) / this.timeScale;
    this._armTimer(ms, ms, fn);
  }

  // Run fn after `ms` (of a phase `duration` long), unless the phase moves on first.
  _armTimer(ms, duration, fn) {
    this._clearTimer();
    const token = ++this._phaseToken;
    this._timerFn = fn;
    this.timer = { endsAt: Date.now() + ms, duration };
    this._timerHandle = setTimeout(() => {
      if (token === this._phaseToken) fn();
    }, ms);
  }

  // Host pause: freezes the phase timer (players can still tap; nothing
  // advances until the host resumes). Not during the cinematic, which runs on
  // its own clock on the TV.
  togglePause(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    if (this.paused) {
      const { left, duration, fn } = this.paused;
      this._armTimer(left, duration, fn);
      this._changed();
      this._checkAllDone();
      return { ok: true };
    }
    if (!this.timer || !this._timerFn || this.prologue) return { ok: false, error: this._t('الان چیزی برای مکث نیست.') };
    const left = Math.max(0, this.timer.endsAt - Date.now());
    const { duration } = this.timer;
    const fn = this._timerFn;
    this._phaseToken += 1;
    this._clearTimer();
    this.paused = { left, duration, fn };
    this._changed();
    return { ok: true };
  }

  // Intro phase. With a cinematic configured, the TV first plays a prologue
  // (the host can skip it), then the usual story intro runs.
  _beginIntro(next) {
    this.phase = 'intro';
    this.round = 0;
    this._introNext = next;
    if (this.cinematic > 0) {
      this.prologue = true;
      this._setTimer(this.cinematic, () => this._endPrologue());
    } else {
      this.prologue = false;
      this._setTimer(this._dur('intro'), next);
    }
  }

  _endPrologue() {
    this.prologue = false;
    this._setTimer(this._dur('intro'), this._introNext);
    this._changed();
  }

  _clearTimer() {
    if (this._timerHandle) clearTimeout(this._timerHandle);
    this._timerHandle = null;
    this.timer = null;
    this._timerFn = null;
    this.paused = null; // any skip or phase change also ends a pause
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

  // Bots (scripts/bots.js, ids "bot-…") never host: if the host drops and no
  // other person is connected, the host stays with them until they reconnect.
  _ensureVip() {
    const vip = this.player(this.vipId);
    if (vip && vip.connected && !isBot(vip.id)) return;
    const people = this.players.filter((p) => !isBot(p.id));
    const next = people.filter((p) => p.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) this.vipId = next.id;
    else if (!vip || isBot(vip.id)) this.vipId = (people[0] || this.players[0] || {}).id || null;
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
    if (!name) return { ok: false, error: this._t('اسمت را بنویس.') };
    if (this.phase !== 'lobby') return { ok: false, error: this._t('بازی شروع شده. برای دور بعد صبر کن.') };
    if (this.players.length >= this.maxPlayers) return { ok: false, error: this._t('ظرفیت پر است (حداکثر {n} نفر).', { n: this.maxPlayers }) };
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: this._t('این اسم را کس دیگری برداشته.') };
    }
    const free = C.PORTRAITS.filter((x) => !this.players.some((p) => p.portrait === x));
    this.players.push({ id, name, score: 0, connected: true, ready: false, portrait: pick(free), joinedAt: Date.now() + this.players.length });
    if (!this.vipId) this.vipId = id;
    this._ensureVip();
    this._changed();
    return { ok: true };
  }

  // ---------------------------------------------------------------- seat takeover
  // A phone that arrives mid-game can ask to play an offline player's seat
  // (their character, clues and journal) under its own name; the host decides.

  requestTakeover(guestId, rawName, targetId) {
    const name = String(rawName || '').trim().replace(/\s+/g, ' ').slice(0, 14);
    if (typeof guestId !== 'string' || !guestId || guestId.length > 64 || this.player(guestId)) return { ok: false, error: this._t('شناسه نامعتبر.') };
    if (!name) return { ok: false, error: this._t('اسمت را بنویس.') };
    if (this.phase === 'lobby' || !this.g) return { ok: false, error: this._t('الان می‌توانی عادی وارد شوی.') };
    const target = this.player(targetId);
    if (!target || !this._inGame(targetId) || target.connected) return { ok: false, error: this._t('این جا دیگر خالی نیست.') };
    if (this.players.some((p) => p.id !== targetId && p.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: this._t('این اسم را کس دیگری برداشته.') };
    // One request per phone and per seat (the newest wins).
    this.takeovers = this.takeovers.filter((t) => t.guestId !== guestId && t.targetId !== targetId);
    this.takeovers.push({ guestId, name, targetId });
    this._changed();
    return { ok: true };
  }

  // Host: allow or deny. On allow the seat gets the newcomer's name and the
  // server hands that phone the seat's id (it then reconnects as that player).
  answerTakeover(byId_, guestId, allow) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    const t = this.takeovers.find((x) => x.guestId === guestId);
    if (!t) return { ok: false, error: this._t('این درخواست دیگر نیست.') };
    this.takeovers = this.takeovers.filter((x) => x !== t);
    const target = this.player(t.targetId);
    if (allow && (!target || target.connected || !this._inGame(t.targetId))) {
      this._changed();
      return { ok: false, error: this._t('صاحب این جا برگشته.') };
    }
    if (allow) target.name = t.name;
    this._changed();
    return allow ? { ok: true, adopt: t.targetId } : { ok: true };
  }

  setConnected(id, connected) {
    const p = this.player(id);
    if (!p) return;
    p.connected = connected;
    if (connected) this.takeovers = this.takeovers.filter((t) => t.targetId !== id); // the owner is back
    this._ensureVip();
    if (this.phase !== 'lobby') this._checkAllDone();
    this._changed();
  }

  setPortrait(id, portrait) {
    const p = this.player(id);
    if (!p) return { ok: false, error: this._t('اول وارد بازی شو.') };
    if (this.phase !== 'lobby') return { ok: false, error: this._t('فقط در سالن انتظار.') };
    if (!C.PORTRAITS.includes(portrait)) return { ok: false, error: this._t('چهره‌ی نامعتبر.') };
    if (this.players.some((x) => x.id !== id && x.portrait === portrait)) return { ok: false, error: this._t('این چهره را کس دیگری برداشته.') };
    p.portrait = portrait;
    this._changed();
    return { ok: true };
  }

  setReady(id, ready) {
    const p = this.player(id);
    if (!p) return { ok: false, error: this._t('اول وارد بازی شو.') };
    if (this.phase !== 'lobby') return { ok: false, error: this._t('فقط در سالن انتظار.') };
    p.ready = !!ready;
    this._changed();
    return { ok: true };
  }

  // Everyone who is online has pressed Ready (offline players can be kicked).
  _allReady() { return this.players.filter((p) => p.connected).every((p) => p.ready); }

  kick(byId_, targetId) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    if (this.phase !== 'lobby') return { ok: false, error: this._t('فقط در سالن انتظار.') };
    this.players = this.players.filter((p) => p.id !== targetId);
    this._ensureVip();
    this._changed();
    return { ok: true };
  }

  setSetting(byId_, key, value) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    const options = Object.prototype.hasOwnProperty.call(SETTING_OPTIONS, key) ? SETTING_OPTIONS[key] : null;
    const match = options && options.find((o) => String(o) === String(value));
    if (match === undefined || match === null) return { ok: false, error: this._t('تنظیم نامعتبر.') };
    if (!LIVE_SETTINGS.includes(key) && !['lobby', 'results'].includes(this.phase)) {
      return { ok: false, error: this._t('وسط بازی نمی‌شود این را عوض کرد.') };
    }
    this.settings[key] = match;
    this._changed();
    return { ok: true };
  }

  // ---------------------------------------------------------------- setup

  start(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند بازی را شروع کند.') };
    if (!['lobby', 'results'].includes(this.phase)) return { ok: false, error: this._t('بازی در جریان است.') };
    if (this.players.length < this.minPlayers) {
      return { ok: false, error: this._t('دست‌کم {n} نفر لازم است.', { n: this.minPlayers }) };
    }
    if (this.settings.mode !== 'items' && this.players.length > CLASSIC_MAX) {
      return { ok: false, error: this._t('بازی کلاسیک حداکثر ۸ نفره است — حالت دست‌به‌دست را انتخاب کنید.') };
    }
    // From the lobby everyone must press Ready first. "Play again" from the
    // results screen skips this: the same group just finished a game.
    if (this.phase === 'lobby' && !this._allReady()) return { ok: false, error: this._t('هنوز همه آماده نیستند.') };
    this.players.forEach((p) => { p.ready = false; });
    this.tutorial = null;
    this.takeovers = [];
    // Drop the previous game first, so setup reads the language from the
    // lobby setting rather than from the old game.
    this.g = null;
    if (this.settings.mode === 'items') {
      this._itStart();
      this._changed();
      return { ok: true };
    }
    this._setupGame();
    this._beginIntro(() => this._startSearch());
    this._changed();
    return { ok: true };
  }

  _setupGame() {
    const ids = this.players.map((p) => p.id);
    const chars = {};
    shuffle(this.L.CHARACTERS).slice(0, ids.length).forEach((ch, i) => { chars[ids[i]] = ch.id; });

    const killerId = pick(ids);
    const weapon = pick(this.L.WEAPONS).id;
    const room = pick(this.L.ROOMS).id;
    const innocents = ids.filter((id) => id !== killerId);

    const missions = {};
    // Stubborn needs two interrogations: not in a quick game.
    const missionPool = shuffle(this.L.MISSIONS.filter((m) => !(this.settings.quick && m.id === 'stubborn')));
    innocents.forEach((pid, i) => {
      const m = missionPool[i % missionPool.length];
      const targetId = m.needsTarget ? pick(ids.filter((x) => x !== pid)) : null;
      missions[pid] = { id: m.id, targetId };
    });

    this.g = {
      mode: 'classic',
      lang: this.settings.lang,
      story: this.settings.story,
      quick: !!this.settings.quick,
      totalRounds: this.settings.quick ? QUICK_ROUNDS : TOTAL_ROUNDS,
      beginner: !!this.settings.beginner,
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      ids,
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
    this.L.ROOMS.forEach((r) => { this.g.decks[r.id] = []; this.g.planted[r.id] = []; });
    this._buildDecks();
  }

  _killerTraits() {
    return byId(this.L.CHARACTERS, this.g.chars[this.g.killerId]).traits;
  }

  _buildDecks() {
    const { g } = this;
    const pool = [];

    // Every card also says in data what it proves (`about`), so the screens can
    // tag it and the TV can add up the evidence.
    this.L.WEAPONS.filter((w) => w.id !== g.weapon).forEach((w) => pool.push(this._card('weapon', w.clear, { about: { type: 'weapon', id: w.id } })));
    this.L.ROOMS.filter((r) => r.id !== g.room).forEach((r) => pool.push(this._card('room', r.clear, { about: { type: 'room', id: r.id } })));

    // Trait clues: 3 of 4, preferring ones that actually separate the killer
    // from at least one innocent.
    const kt = this._killerTraits();
    const innocentTraits = g.innocents.map((pid) => byId(this.L.CHARACTERS, g.chars[pid]).traits);
    const traitIdx = shuffle([0, 1, 2, 3]).sort((a, b) => {
      const inf = (i) => innocentTraits.some((t) => t[i] !== kt[i]) ? 0 : 1;
      return inf(a) - inf(b);
    }).slice(0, 3);
    traitIdx.forEach((i) => {
      const t = this.L.TRAITS[i];
      pool.push(this._card('trait', kt[i] ? t.yesClue : t.noClue, { about: { type: 'trait', id: t.id, has: !!kt[i] } }));
    });

    const alibiCount = this.players.length <= 5 ? 1 : 2;
    const alibiTemplates = shuffle(this.L.ALIBI_TEMPLATES);
    shuffle(g.innocents).slice(0, alibiCount).forEach((pid, i) => {
      pool.push(this._card('alibi', alibiTemplates[i].replace(/\{X\}/g, this._label(pid)), { about: { type: 'alibi', playerId: pid } }));
    });

    const motiveTemplates = shuffle(this.L.MOTIVE_TEMPLATES);
    shuffle(Object.keys(g.chars)).slice(0, 2).forEach((pid, i) => {
      pool.push(this._card('motive', motiveTemplates[i].replace(/\{X\}/g, this._label(pid)), { about: { type: 'motive', playerId: pid } }));
    });

    const roomIds = shuffle(this.L.ROOMS.map((r) => r.id));
    shuffle(pool).forEach((card, i) => g.decks[roomIds[i % roomIds.length]].push(card));
  }

  // All lies the killer could plant this game (same templates as real clues).
  _allForgeries() {
    const { g } = this;
    const list = [];
    const w = byId(this.L.WEAPONS, g.weapon);
    const r = byId(this.L.ROOMS, g.room);
    list.push({ key: 'weapon', kind: 'weapon', text: w.clear, about: { type: 'weapon', id: w.id }, hint: this._t('{w} را بی‌گناه جلوه بده', { w: w.name }) });
    list.push({ key: 'room', kind: 'room', text: r.clear, about: { type: 'room', id: r.id }, hint: this._t('{r} را پاک جلوه بده', { r: r.name }) });
    const kt = this._killerTraits();
    const innocentTraits = g.innocents.map((pid) => byId(this.L.CHARACTERS, g.chars[pid]).traits);
    this.L.TRAITS.forEach((t, i) => {
      if (!innocentTraits.some((it) => it[i] !== kt[i])) return; // no one to frame
      const framed = g.innocents
        .filter((pid) => byId(this.L.CHARACTERS, g.chars[pid]).traits[i] !== kt[i])
        .map((pid) => byId(this.L.CHARACTERS, g.chars[pid]).name);
      list.push({
        key: `trait:${t.id}`, kind: 'trait', text: kt[i] ? t.noClue : t.yesClue, about: { type: 'trait', id: t.id, has: !kt[i] },
        hint: this._t('شک را به {names} بینداز', { names: framed.join(this._t('، ')) }),
      });
    });
    const tpl = pick(this.L.ALIBI_TEMPLATES);
    list.push({ key: 'alibi', kind: 'alibi', text: tpl.replace(/\{X\}/g, this._label(g.killerId)), about: { type: 'alibi', playerId: g.killerId }, hint: this._t('برای خودت شاهد دروغین بساز') });
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
    this._setTimer(this._dur('search'), () => this._endSearch());
    this._changed();
  }

  search(pid, roomId) {
    if (this.phase !== 'search' || this._items() || !this._inGame(pid)) return { ok: false, error: this._t('الان وقت بازرسی نیست.') };
    if (pid === this.g.killerId) return { ok: false, error: this._t('تو باید مدرک جعل کنی.') };
    if (!byId(this.L.ROOMS, roomId)) return { ok: false, error: this._t('اتاق نامعتبر.') };
    this.g.searchChoice[pid] = roomId;
    this._checkAllDone();
    this._changed();
    return { ok: true };
  }

  forge(pid, key, roomId) {
    const { g } = this;
    if (this.phase !== 'search' || this._items() || pid !== (g && g.killerId)) return { ok: false, error: this._t('اجازه نداری.') };
    if (!g.forgeryOptions.some((f) => f.key === key)) return { ok: false, error: this._t('گزینه‌ی نامعتبر.') };
    if (!byId(this.L.ROOMS, roomId)) return { ok: false, error: this._t('اتاق نامعتبر.') };
    g.forgeryChoice = { key, roomId };
    this._checkAllDone();
    this._changed();
    return { ok: true };
  }

  _drawFrom(roomId) {
    const { g } = this;
    if (g.decks[roomId].length) return g.decks[roomId].shift();
    const other = shuffle(this.L.ROOMS.map((r) => r.id)).find((rid) => g.decks[rid].length);
    if (!other) return null;
    const card = g.decks[other].shift();
    card.hallway = true; // the phone says it was found in the hallway
    return card;
  }

  _endSearch() {
    const { g } = this;
    const rid = () => pick(this.L.ROOMS).id;

    // Killer plants first, so an innocent searching the same room this round
    // picks the fake up.
    let choice = g.forgeryChoice;
    if (!choice && g.forgeryOptions.length) choice = { key: pick(g.forgeryOptions).key, roomId: rid(), auto: true };
    if (choice) {
      const f = g.forgeryOptions.find((x) => x.key === choice.key);
      g.usedForgeries.add(f.key);
      const planted = this._card(f.kind, f.text, { forged: true, round: this.round, foundIn: choice.roomId, about: f.about });
      const copy = this._card(f.kind, f.text, { forged: true, round: this.round, foundIn: choice.roomId, copyOf: planted.id, about: f.about });
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
      if (!found.length) found.push(this._card('nothing', this.L.NOTHING_FOUND));
      found.forEach((card) => {
        card.round = this.round;
        card.foundIn = card.foundIn || roomId;
        g.hands[pid].push(card);
        g.newCards[pid].push(card.id);
      });
    });

    this.phase = 'discuss';
    this._setTimer(this._discussSecs(), () => this._endDiscuss());
    this._changed();
  }

  // ---------------------------------------------------------------- discuss

  pin(pid, cardId) {
    const { g } = this;
    if (!['discuss', 'vote', 'spotlight', 'final'].includes(this.phase) || this._items() || !this._inGame(pid)) {
      return { ok: false, error: this._t('الان نمی‌شود مدرک نشان داد.') };
    }
    const card = g.hands[pid].find((c) => c.id === cardId);
    if (!card) return { ok: false, error: this._t('این کارت را نداری.') };
    if (card.pinned) return { ok: false, error: this._t('قبلاً نشانش داده‌ای.') };
    if (card.kind === 'nothing') return { ok: false, error: this._t('این کارت چیزی برای نشان دادن ندارد.') };
    card.pinned = true;
    g.pins[pid] += 1;
    g.board.push({ cardId, playerId: pid, text: card.text, kind: card.kind, about: card.about || null, round: card.round, pinRound: this.round, at: Date.now() });
    this._changed();
    return { ok: true };
  }

  _endDiscuss() {
    if (this.round < this.g.totalRounds) {
      this.phase = 'vote';
      this.g.votes[this.round] = {};
      this._setTimer(this._dur('vote'), () => this._endVote());
    } else {
      this.phase = 'final';
      this._setTimer(this._dur('final'), () => this._endFinal());
    }
    this._changed();
  }

  // ---------------------------------------------------------------- interrogation

  vote(pid, targetId) {
    if (this.phase !== 'vote' || this._items() || !this._inGame(pid)) return { ok: false, error: this._t('الان وقت رأی نیست.') };
    if (pid === targetId || !this._inGame(targetId)) return { ok: false, error: this._t('رأی نامعتبر.') };
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
    this._setTimer(this._dur('spotlight'), () => this._startSearch());
    this._changed();
  }

  // ---------------------------------------------------------------- final

  final(pid, { suspect, weapon, room } = {}) {
    if (this.phase !== 'final' || this._items() || !this._inGame(pid)) return { ok: false, error: this._t('الان وقت اتهام نیست.') };
    if (!this._inGame(suspect) || suspect === pid) return { ok: false, error: this._t('یک مظنون انتخاب کن.') };
    if (!byId(this.L.WEAPONS, weapon) || !byId(this.L.ROOMS, room)) return { ok: false, error: this._t('سلاح و مکان را انتخاب کن.') };
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
    this._recordStats();
    try { this.onGameEnd(this._outcome()); } catch (err) { console.error('balance log:', err.message); }
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
      const def = byId(this.L.MISSIONS, m.id);
      const v = g.visits[pid];
      let success = false;
      switch (m.id) {
        case 'suspicious': success = (counts[pid] || 0) >= 2; break;
        case 'guardian': success = (counts[m.targetId] || 0) === 0; break;
        case 'silent': success = g.pins[pid] === 0; break;
        case 'herald': success = g.pins[pid] >= 3; break;
        case 'shadow': success = v.length === g.totalRounds && v.every((r) => r === v[0]); break;
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
        if (!caught) breakdown.push({ label: this._t('فرار از عدالت'), pts: 5 });
        const fooled = g.plants.filter((p) => p.deliveredTo).length;
        if (fooled) breakdown.push({ label: this._t('{n} مدرک جعلی به دست بقیه رسید', { n: fooled }), pts: fooled });
      } else {
        const v = fv[pid];
        if (v && v.suspect === g.killerId) breakdown.push({ label: this._t('قاتل را درست حدس زد'), pts: 3 });
        if (v && v.weapon === g.weapon) breakdown.push({ label: this._t('سلاح درست'), pts: 1 });
        if (v && v.room === g.room) breakdown.push({ label: this._t('مکان درست'), pts: 1 });
        const mr = missionResults.find((m) => m.playerId === pid);
        if (mr && mr.success) breakdown.push({ label: this._t('مأموریت «{title}»', { title: mr.title }), pts: 2 });
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

  // ---------------------------------------------------------------- the night

  // After every game: who played the killer, escaped, fooled others with a
  // fake, named the killer, finished their mission, and who won.
  _recordStats() {
    const { g } = this;
    const r = g.results;
    const items = this._items();
    const killers = items ? r.killers : [r.killerId];
    const killersWin = items ? !r.innocentsWin : !r.caught;
    g.ids.forEach((pid) => {
      const p = this.player(pid);
      const st = this.stats[pid] || (this.stats[pid] = { games: 0, killerGames: 0, escapes: 0, fooled: 0, correct: 0, missions: 0, wins: 0 });
      st.name = p ? p.name : st.name;
      st.games += 1;
      const isKiller = killers.includes(pid);
      if (isKiller) {
        st.killerGames += 1;
        if (killersWin) st.escapes += 1;
        if (!items) st.fooled += r.forgeries.filter((f) => f.deliveredTo).length;
      } else {
        const voted = items ? g.finalVotes[pid] : g.finalVotes[pid] && g.finalVotes[pid].suspect;
        if (voted && killers.includes(voted)) st.correct += 1;
        if (!items && r.missions.some((m) => m.playerId === pid && m.success)) st.missions += 1;
      }
      if (isKiller === killersWin) st.wins += 1;
    });
  }

  // One finished game in numbers, for the balance log (no names, no ids).
  // Bot games are marked so the stats can leave them out.
  _outcome() {
    const { g } = this;
    const r = g.results;
    const base = {
      t: new Date().toISOString(), mode: g.mode, lang: g.lang, beginner: !!g.beginner,
      players: g.ids.length, bots: g.ids.filter(isBot).length,
    };
    if (g.mode === 'items') {
      return {
        ...base, story: 'yalda', rounds: g.totalRounds, killers: r.killers.length, rules: g.rules,
        innocentsWin: r.innocentsWin, tie: r.tie,
        votesOnKillers: Object.values(g.finalVotes).filter((v) => r.killers.includes(v)).length,
        votes: Object.keys(g.finalVotes).length,
        actions: r.log.filter((e) => e.type !== 'quiet').length,
      };
    }
    const innocentsVoted = Object.entries(g.finalVotes).filter(([pid]) => pid !== r.killerId);
    return {
      ...base, story: g.story || 'yalda',
      caught: r.caught,
      killerVotes: (r.tally.find((x) => x.playerId === r.killerId) || {}).votes || 0,
      innocentsRight: innocentsVoted.filter(([, v]) => v.suspect === r.killerId).length,
      innocentsVoted: innocentsVoted.length,
      weaponRight: r.weaponRight.length, roomRight: r.roomRight.length,
      forgeries: r.forgeries.length,
      forgeriesDelivered: r.forgeries.filter((f) => f.deliveredTo).length,
      forgeriesPinned: r.forgeries.filter((f) => f.pinnedBy.length).length,
      cluesPinned: g.board.length,
      killerInterrogated: g.spotlights.some((s) => s.playerId === r.killerId),
      missionsDone: r.missions.filter((m) => m.success).length,
    };
  }

  // Awards for the end-of-night screen: each goes to everyone tied on the top
  // value, and only when someone actually earned it.
  _summary() {
    const award = (id, value) => {
      const scored = Object.entries(this.stats).map(([pid, st]) => ({ pid, v: value(st) })).filter((x) => x.v > 0);
      const max = Math.max(0, ...scored.map((x) => x.v));
      return max ? { id, ids: scored.filter((x) => x.v === max).map((x) => x.pid), value: max } : null;
    };
    const top = Math.max(0, ...this.players.map((p) => p.score));
    return {
      games: this.gamesPlayed,
      champions: top ? this.players.filter((p) => p.score === top).map((p) => p.id) : [],
      awards: [
        award('liar', (st) => st.escapes * 2 + st.fooled),
        award('detective', (st) => st.correct),
        award('missions', (st) => st.missions),
        award('winner', (st) => st.wins),
      ].filter(Boolean),
      stats: this.stats,
    };
  }

  endNight(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    if (this.phase !== 'results') return { ok: false, error: this._t('اول این بازی را تمام کنید.') };
    this._clearTimer();
    this.phase = 'summary';
    this._changed();
    return { ok: true };
  }

  // A fresh night: scores and stats back to zero, everyone to the lobby.
  newNight(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    this.players.forEach((p) => { p.score = 0; });
    this.gamesPlayed = 0;
    this.stats = {};
    return this.backToLobby(byId_);
  }

  // ---------------------------------------------------------------- reveal

  _scheduleReveal() {
    // The knife trail (last «دست‌به‌دست» step) animates row by row: give it longer.
    const long = this._items() && this.g.revealStep === Items.ITEM_REVEAL_LAST;
    this._setTimer(this._dur('revealStep') * (long ? 2 : 1), () => this._advanceReveal());
  }

  _advanceReveal() {
    const LAST = this._items() ? Items.ITEM_REVEAL_LAST : 4;
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
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    if (this.phase === 'reveal') { this._advanceReveal(); return { ok: true }; }
    return this.skip(byId_);
  }

  // "How to play" slides on the TV, driven by the host's phone (lobby only).
  // `tutorial` is null (closed) or the current slide index.
  tutorialAction(byId_, action) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    if (this.phase !== 'lobby') return { ok: false, error: this._t('آموزش فقط در سالن انتظار است.') };
    const last = TUTORIAL_STEPS - 1;
    if (action === 'open') this.tutorial = 0;
    else if (action === 'close') this.tutorial = null;
    else if (this.tutorial === null) return { ok: false, error: this._t('آموزش باز نیست.') };
    else if (action === 'next') this.tutorial = Math.min(last, this.tutorial + 1);
    else if (action === 'prev') this.tutorial = Math.max(0, this.tutorial - 1);
    else return { ok: false, error: this._t('کار نامعتبر.') };
    if (this.tutorial !== null) this.tutorialSeen = true;
    this._changed();
    return { ok: true };
  }

  skip(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    const enders = this._items() ? {
      intro: () => this._itStartGossip(),
      gossip: () => this._itEndGossip(),
      gossipResult: () => this._itAfterGossipResult(),
      discuss: () => this._itEndDiscuss(),
      final: () => this._itEndFinal(),
      reveal: () => this._advanceReveal(),
    } : {
      intro: () => this._startSearch(),
      search: () => this._endSearch(),
      discuss: () => this._endDiscuss(),
      vote: () => this._endVote(),
      spotlight: () => this._startSearch(),
      final: () => this._endFinal(),
      reveal: () => this._advanceReveal(),
    };
    if (this.phase === 'intro' && this.prologue) {
      this._endPrologue(); // first skip: cinematic -> story
      return { ok: true };
    }
    const fn = enders[this.phase];
    if (!fn) return { ok: false, error: this._t('چیزی برای رد کردن نیست.') };
    this._phaseToken += 1;
    this._clearTimer();
    fn();
    return { ok: true };
  }

  // Host shortcut: jump past the remaining reveal steps to the scoreboard.
  skipReveal(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    if (this.phase !== 'reveal') return { ok: false, error: this._t('الان افشاگری نیست.') };
    this._phaseToken += 1;
    this._clearTimer();
    this.phase = 'results';
    this._changed();
    return { ok: true };
  }

  backToLobby(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    this._clearTimer();
    this._phaseToken += 1;
    this.phase = 'lobby';
    this.round = 0;
    this.prologue = false;
    this.g = null;
    this.takeovers = [];
    this.players = this.players.filter((p) => p.connected);
    this._ensureVip();
    this._changed();
    return { ok: true };
  }

  resetScores(byId_) {
    if (!this._isVip(byId_)) return { ok: false, error: this._t('فقط میزبان می‌تواند.') };
    this.players.forEach((p) => { p.score = 0; });
    this.gamesPlayed = 0;
    this.stats = {};
    this._changed();
    return { ok: true };
  }

  // ---------------------------------------------------------------- progress

  _hasActed(pid) {
    const { g } = this;
    if (!g) return false;
    if (this._items()) return this._itHasActed(pid);
    switch (this.phase) {
      case 'search': return pid === g.killerId ? !!g.forgeryChoice : !!g.searchChoice[pid];
      case 'vote': return !!(g.votes[this.round] && g.votes[this.round][pid]);
      case 'final': return !!g.finalVotes[pid];
      default: return false;
    }
  }

  _checkAllDone() {
    if (this.paused) return; // resuming checks again
    const items = this._items();
    if (!(items ? ['gossip', 'final'] : ['search', 'vote', 'final']).includes(this.phase)) return;
    const active = this._gamePlayers().filter((p) => p.connected);
    if (!active.length || !active.every((p) => this._hasActed(p.id))) return;
    const enders = items
      ? { gossip: () => this._itEndGossip(), final: () => this._itEndFinal() }
      : { search: () => this._endSearch(), vote: () => this._endVote(), final: () => this._endFinal() };
    const phase = this.phase;
    this._advanceSoon(() => { if (this.phase === phase) enders[phase](); });
  }

  // ---------------------------------------------------------------- views

  _missionText(pid) {
    const m = this.g.missions[pid];
    if (!m) return null;
    const def = byId(this.L.MISSIONS, m.id);
    return m.targetId ? def.text.replace(/\{T\}/g, this._label(m.targetId)) : def.text;
  }

  publicState() {
    const { g } = this;
    const state = {
      phase: this.phase,
      mode: g ? g.mode : this.settings.mode,
      lang: this.lang(),
      story: this.story(),
      round: this.round,
      totalRounds: g ? g.totalRounds : TOTAL_ROUNDS,
      // A paused timer carries the time left instead of an end time.
      timer: this.paused ? { paused: true, left: this.paused.left, duration: this.paused.duration } : this.timer,
      paused: !!this.paused,
      prologue: this.phase === 'intro' && this.prologue,
      tutorial: this.phase === 'lobby' ? this.tutorial : null,
      tutorialSeen: this.tutorialSeen,
      // Beginner mode of the running game (else the lobby setting).
      beginner: g ? !!g.beginner : !!this.settings.beginner,
      serverNow: Date.now(),
      settings: this.settings,
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      // Seats the chosen mode can take (classic 8, items 12).
      modeMax: (g ? g.mode : this.settings.mode) === 'items' ? MAX_PLAYERS : CLASSIC_MAX,
      gamesPlayed: this.gamesPlayed,
      summary: this.phase === 'summary' ? this._summary() : null,
      // Pending seat requests (the asking phone finds its own by guestId).
      takeovers: this.phase === 'lobby' ? [] : this.takeovers.map(({ guestId, name, targetId }) => ({ guestId, name, targetId })),
      vipId: this.vipId,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, score: p.score, connected: p.connected, ready: !!p.ready, portrait: p.portrait,
        charId: g && g.chars ? g.chars[p.id] || null : null,
        inGame: this._inGame(p.id),
        done: this._hasActed(p.id),
      })),
      game: null,
    };
    if (!g) return state;
    if (g.mode === 'items') {
      state.game = this._itPublicGame();
      return state;
    }

    state.game = {
      id: g.id,
      board: g.board.map(({ cardId, playerId, text, kind, about, round, pinRound }) => ({ cardId, playerId, text, kind, about, round, pinRound })),
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
    if (!g || !this._inGame(pid)) return out;
    if (g.mode === 'items') return this._itPrivate(pid, out);

    const isKiller = pid === g.killerId;
    out.charId = g.chars[pid];
    out.role = isKiller ? 'killer' : 'innocent';
    out.hand = g.hands[pid].map((c) => ({
      id: c.id, kind: c.kind, text: c.text, about: c.about || null, round: c.round, foundIn: c.foundIn, hallway: !!c.hallway,
      pinned: !!c.pinned, isNew: g.newCards[pid].includes(c.id),
      ...(isKiller ? { forged: true } : {}),
    }));
    out.visits = g.visits[pid].slice();
    out.acted = this._hasActed(pid);

    if (isKiller) {
      out.truth = { weapon: g.weapon, room: g.room };
      out.forgeryOptions = this.phase === 'search' ? g.forgeryOptions.map(({ key, text, about, hint }) => ({ key, text, about, hint })) : [];
      out.forgeryChoice = g.forgeryChoice;
      out.plants = g.plants.map((x) => ({ text: x.text, round: x.round, roomId: x.roomId, delivered: !!x.deliveredTo }));
    } else {
      const m = g.missions[pid];
      out.mission = { id: m.id, title: byId(this.L.MISSIONS, m.id).title, text: this._missionText(pid) };
      out.searchChoice = g.searchChoice[pid] || null;
    }
    if (this.phase === 'vote') out.myVote = (g.votes[this.round] || {})[pid] || null;
    if (this.phase === 'final' || g.finalVotes[pid]) out.myFinal = g.finalVotes[pid] || null;
    if (g.results && this.phase === 'results') {
      out.myPoints = g.results.points.find((x) => x.playerId === pid) || null;
    }
    return out;
  }

  // ---------------------------------------------------------------- save / restore

  // What survives a server restart: who is here, the scores, the night's
  // stats and the host's settings. A game in progress is not saved; after a
  // restart everyone is back in the lobby with their scores.
  snapshot() {
    return {
      v: 1,
      savedAt: Date.now(),
      vipId: this.vipId,
      gamesPlayed: this.gamesPlayed,
      settings: this.settings,
      stats: this.stats,
      players: this.players.map(({ id, name, score, portrait, joinedAt }) => ({ id, name, score, portrait, joinedAt })),
    };
  }

  // Restores a snapshot into the lobby: everyone offline until their phone
  // reconnects (phones remember their id). Unknown settings are dropped.
  restore(data) {
    if (!data || data.v !== 1 || !Array.isArray(data.players)) return false;
    this.players = data.players
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      .slice(0, this.maxPlayers)
      .map((p) => ({ id: p.id, name: p.name, score: Number(p.score) || 0, portrait: p.portrait, joinedAt: p.joinedAt || 0, connected: false, ready: false }));
    Object.entries(data.settings || {}).forEach(([k, v]) => {
      const options = SETTING_OPTIONS[k];
      const match = options && options.find((o) => String(o) === String(v));
      if (match !== undefined) this.settings[k] = match;
    });
    this.stats = data.stats && typeof data.stats === 'object' ? data.stats : {};
    this.gamesPlayed = Number(data.gamesPlayed) || 0;
    this.vipId = this.players.some((p) => p.id === data.vipId) ? data.vipId : null;
    this._ensureVip();
    this.phase = 'lobby';
    return true;
  }

  dispose() { this._clearTimer(); this._phaseToken += 1; }
}

Object.assign(Game.prototype, Items.methods);

module.exports = { Game, STORIES, TOTAL_ROUNDS, DEFAULT_DURATIONS, SETTING_OPTIONS, MAX_PLAYERS, CLASSIC_MAX };
