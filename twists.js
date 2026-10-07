// Twists for the classic game (host setting, on by default), mixed into Game:
//
//  - Lights out: once per game, between two rounds, the lights go out. The
//    killer may make one clue on the evidence board vanish; every innocent
//    may guard one. A guarded clue survives (and its guards learn someone
//    reached for it); otherwise it is gone for good, the owner's card too.
//    If the killer doesn't choose, the dark takes a random clue.
//  - Burned evidence: once per game, while forging, the killer may also burn
//    a room's next clue. They learn what it said; whoever searches that room
//    finds ashes.
//  - Kamali's hunch: at the start of the last discussion the detective pins
//    one true fact the board hasn't settled yet (a weapon or a room that was
//    not involved).
//
// «دست‌به‌دست» has its own lights out in items.js (two items swap in the dark).

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const byId = (list, id) => list.find((x) => x.id === id);

const methods = {
  _twSetup() {
    const { g } = this;
    g.twists = !!this.settings.twists;
    // Lights out falls before the search of one round from round 2 on.
    g.blackoutRound = g.twists ? 2 + Math.floor(Math.random() * (g.totalRounds - 1)) : null;
    g.blackout = null; // {round, douse, guards, result} once it happened
    g.vanished = []; // clues the dark took: {playerId, round, kind}
    g.darkNotes = {}; // pid -> [{type, ...}] what each phone learned in the dark
    g.burnUsed = false;
    g.burnChoice = null;
    g.burned = null; // {roomId, round, text, about} for the killer's eyes
    g.burnFailed = null;
    g.hunch = null;
  },

  // Between rounds: lights out once, else straight to the next search.
  _nextRound() {
    const { g } = this;
    if (g.twists && !g.blackout && this.round + 1 === g.blackoutRound) this._startBlackout();
    else this._startSearch();
  },

  // ---------------------------------------------------------------- lights out

  _startBlackout() {
    this.phase = 'blackout';
    this.g.blackout = { round: this.round + 1, douse: null, guards: {}, result: null };
    this._setTimer(this._dur('blackout'), () => this._endBlackout());
    this._changed();
  },

  // One tap for everyone, so a glance at a phone gives nothing away: the
  // killer's tap makes a clue vanish, an innocent's tap guards it.
  darkPick(pid, cardId) {
    const { g } = this;
    if (this.phase !== 'blackout' || this._items() || !this._inGame(pid)) return { ok: false, error: this._t('الان وقتش نیست.') };
    if (!g.board.some((b) => b.cardId === cardId && b.playerId)) return { ok: false, error: this._t('این مدرک روی تابلو نیست.') };
    if (pid === g.killerId) g.blackout.douse = cardId;
    else g.blackout.guards[pid] = cardId;
    this._checkAllDone();
    this._changed();
    return { ok: true };
  },

  _note(pid, note) { (this.g.darkNotes[pid] || (this.g.darkNotes[pid] = [])).push(note); },

  _endBlackout() {
    const { g } = this;
    const bo = g.blackout;
    const board = g.board.filter((b) => b.playerId); // players' clues only
    const target = bo.douse || (board.length ? pick(board).cardId : null);
    const entry = g.board.find((b) => b.cardId === target);
    if (!entry) {
      bo.result = { empty: true, round: bo.round };
    } else {
      const guards = Object.keys(bo.guards).filter((pid) => bo.guards[pid] === target);
      if (guards.length) {
        bo.result = { foiled: true, ownerId: entry.playerId, round: bo.round };
        guards.forEach((pid) => this._note(pid, { type: 'guarded', text: entry.text, round: bo.round }));
        if (bo.douse) this._note(g.killerId, { type: 'foiled', text: entry.text, round: bo.round });
      } else {
        g.board = g.board.filter((b) => b !== entry);
        const card = (g.hands[entry.playerId] || []).find((c) => c.id === entry.cardId);
        if (card) card.lost = true; // gone from the owner's hand too
        g.vanished.push({ playerId: entry.playerId, round: bo.round, kind: entry.kind });
        bo.result = { foiled: false, ownerId: entry.playerId, round: bo.round };
        this._note(entry.playerId, { type: 'lost', text: entry.text, round: bo.round });
        if (bo.douse) this._note(g.killerId, { type: 'doused', text: entry.text, ownerId: entry.playerId, round: bo.round });
      }
    }
    this._startSearch();
  },

  // ---------------------------------------------------------------- burned evidence

  // Killer, during a search, once per game: choose a room to burn (null = don't).
  burn(pid, roomId) {
    const { g } = this;
    if (this.phase !== 'search' || this._items() || pid !== (g && g.killerId)) return { ok: false, error: this._t('اجازه نداری.') };
    if (!g.twists || g.burnUsed) return { ok: false, error: this._t('فقط یک بار در هر بازی.') };
    if (roomId !== null && !byId(this.L.ROOMS, roomId)) return { ok: false, error: this._t('اتاق نامعتبر.') };
    g.burnChoice = roomId;
    this._changed();
    return { ok: true };
  },

  // Called by _endSearch after the killer has planted: the room's next true
  // clue goes up in smoke and ashes wait for whoever searches there.
  _twBurn() {
    const { g } = this;
    const roomId = g.burnChoice;
    g.burnChoice = null;
    if (!roomId) return;
    const deck = g.decks[roomId];
    if (!deck.length) { g.burnFailed = { roomId, round: this.round }; return; }
    const card = deck.shift();
    g.burnUsed = true;
    g.burned = { roomId, round: this.round, text: card.text, about: card.about || null };
    const ashes = this._card('ashes', this._t('🔥 کسی مدرکی را که این‌جا بود سوزانده؛ فقط خاکسترش مانده.'), { about: { type: 'ashes', id: roomId }, foundIn: roomId });
    g.planted[roomId].push(ashes);
  },

  // ---------------------------------------------------------------- Kamali's hunch

  // At the start of the last discussion: one true weapon or room that the
  // board hasn't ruled out yet, from the category with more left open.
  _twHunch() {
    const { g } = this;
    if (!g.twists || g.hunch || this.round !== g.totalRounds) return;
    const out = (type) => new Set(g.board.filter((b) => b.about && b.about.type === type).map((b) => b.about.id));
    const wOut = out('weapon');
    const rOut = out('room');
    const weapons = this.L.WEAPONS.filter((w) => w.id !== g.weapon && !wOut.has(w.id));
    const rooms = this.L.ROOMS.filter((r) => r.id !== g.room && !rOut.has(r.id));
    if (!weapons.length && !rooms.length) return;
    const useWeapon = weapons.length > rooms.length || (weapons.length === rooms.length && Math.random() < 0.5);
    const x = useWeapon ? pick(weapons) : pick(rooms);
    const text = useWeapon
      ? this._t('کارآگاه کمالی: «مطمئنم کار با {x} نبوده.»', { x: x.name })
      : this._t('کارآگاه کمالی: «مطمئنم قتل در {x} رخ نداده.»', { x: x.name });
    g.hunch = { kind: useWeapon ? 'weapon' : 'room', id: x.id };
    g.board.push({ cardId: 'hunch', playerId: null, detective: true, text, kind: g.hunch.kind, about: { type: g.hunch.kind, id: x.id }, round: this.round, pinRound: this.round, at: Date.now() });
  },

  // ---------------------------------------------------------------- views

  _twPublic() {
    const { g } = this;
    const bo = g.blackout;
    return {
      twists: !!g.twists,
      // During lights out: the round it falls before (who chose what stays private).
      blackout: this.phase === 'blackout' ? { round: bo.round } : null,
      blackoutResult: bo && bo.result ? bo.result : null,
      vanished: g.vanished.slice(),
    };
  },

  _twPrivate(pid, out) {
    const { g } = this;
    out.darkNotes = (g.darkNotes[pid] || []).slice();
    if (this.phase === 'blackout') out.darkChoice = pid === g.killerId ? g.blackout.douse : g.blackout.guards[pid] || null;
    if (pid === g.killerId) {
      out.canBurn = !!g.twists && !g.burnUsed;
      out.burnChoice = g.burnChoice;
      out.burned = g.burned;
      out.burnFailed = g.burnFailed;
    }
    return out;
  },
};

module.exports = { methods };
