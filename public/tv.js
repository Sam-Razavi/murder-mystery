/* TV screen: public view only. Never receives private data. */
(function () {
  const { num, t, setLang, esc, syncClock, setTimer } = window.Z;
  const socket = io();
  let ALL = null; // story content in both languages: { fa, en }
  let C = null; // ...the bundle for the current language
  let S = null; // state
  let lastKey = '';
  const seenCards = new Set();
  const seenSeats = new Set();
  let lastBoardLen = 0;
  let lastTickSec = null;

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');

  // ------------------------------------------------------------ sound
  const Sound = (() => {
    let ctx = null;
    const get = () => {
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    };
    function tone(freq, start, dur, type = 'sine', gain = 0.18) {
      const c = get(); if (!c) return;
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, c.currentTime + start);
      g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      o.connect(g).connect(c.destination);
      o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
    }
    // Filtered white-noise burst: drum hits, cymbals, whooshes.
    function noise(start, dur, gain, freq, q = 1, type = 'bandpass') {
      const c = get(); if (!c) return;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = gain;
      src.connect(f).connect(g).connect(c.destination);
      src.start(c.currentTime + start);
    }
    return {
      unlock() { get(); },
      // Cinematic prologue (public/cinema.js): clock ticks, midnight bell, lights out, heartbeat.
      tock() { tone(210, 0, 0.06, 'square', 0.05); noise(0, 0.05, 0.05, 3200, 1.2); },
      bell() { tone(196, 0, 3.4, 'sine', 0.3); tone(392.6, 0, 2.8, 'sine', 0.11); tone(587, 0.01, 1.9, 'triangle', 0.05); tone(98, 0, 3.6, 'sine', 0.2); },
      blackout() { noise(0, 0.7, 0.4, 140, 0.7, 'lowpass'); tone(46, 0, 1.8, 'sine', 0.38); },
      heartbeat() { tone(55, 0, 0.16, 'sine', 0.36); tone(52, 0.2, 0.2, 'sine', 0.28); },
      gong() { tone(110, 0, 2.6, 'sine', 0.28); tone(165, 0, 2.2, 'sine', 0.12); tone(220.5, 0.01, 1.6, 'triangle', 0.06); },
      tick() { tone(1400, 0, 0.06, 'square', 0.04); },
      pin() { tone(880, 0, 0.18, 'triangle', 0.1); tone(1320, 0.07, 0.25, 'triangle', 0.08); },
      sting() { [233, 277, 349, 466].forEach((f, i) => tone(f, i * 0.09, 1.8, 'sawtooth', 0.05)); tone(58, 0, 2.5, 'sine', 0.3); },
      win() { [392, 494, 587, 784].forEach((f, i) => tone(f, i * 0.12, 0.9, 'triangle', 0.09)); },
      // Snare roll that speeds up and swells for `dur` seconds, then a crash.
      drumroll(dur = 2.2) {
        let t = 0;
        let gap = 0.13;
        while (t < dur) {
          noise(t, 0.06, 0.16 + 0.34 * (t / dur), 1900, 0.9);
          tone(170, t, 0.05, 'triangle', 0.03 + 0.05 * (t / dur));
          t += gap;
          gap = Math.max(0.04, gap * 0.92);
        }
        this.crash(dur);
      },
      crash(at = 0) { noise(at, 1.6, 0.35, 5200, 0.6, 'highpass'); tone(82, at, 0.9, 'sine', 0.25); },
      blip() { tone(1046, 0, 0.12, 'sine', 0.07); tone(1568, 0.05, 0.14, 'sine', 0.05); },
      // A card turning over.
      flip() { noise(0, 0.28, 0.22, 2600, 0.7); tone(520, 0.05, 0.15, 'triangle', 0.05); },
      // Items mode: a soft two-note chime as a gossip question appears.
      whisper() { tone(660, 0, 0.9, 'sine', 0.07); tone(990, 0.18, 1.1, 'sine', 0.05); },
      // Items mode: a rustle of items changing hands. Played at the end of EVERY
      // round, so it never tells the room whether anything actually moved.
      swoosh() {
        const c = get(); if (!c) return;
        const len = Math.floor(c.sampleRate * 0.7);
        const buf = c.createBuffer(1, len, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
        const src = c.createBufferSource(); src.buffer = buf;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(500, c.currentTime);
        bp.frequency.exponentialRampToValueAtTime(3200, c.currentTime + 0.6);
        const g = c.createGain(); g.gain.value = 0.25;
        src.connect(bp).connect(g).connect(c.destination);
        src.start();
      },
    };
  })();

  window.Sound = Sound; // audio.js unlocks the effects with the soundtrack

  // ------------------------------------------------------------ helpers
  const ch =(id) => C.characters.find((c) => c.id === id);
  const pl = (id) => S.players.find((p) => p.id === id);
  const weapon = (id) => C.weapons.find((w) => w.id === id);
  const room = (id) => C.rooms.find((r) => r.id === id);
  // Illustration for a weapon, room or trait (public/art.js), falling back to its emoji.
  const artOf = (o, anim = false) => (o && window.Art && Art.has(o.id) ? Art.item(o.id, { anim, title: o.name }) : (o ? o.icon : ''));
  const item = (id) => C.items.find((x) => x.id === id) || { icon: '❔', name: t('؟') };
  // Illustrated item (public/art.js); `anim` only on big displays.
  const art = (id, anim = false) => (window.Art && Art.has(id) ? Art.item(id, { anim, title: item(id).name }) : item(id).icon);
  const itemsMode = () => S && S.mode === 'items';
  const SEAT_COLORS = ['#c9a227', '#e0335c', '#2fb3a6', '#7b6fd0', '#d77ab3', '#6a9a4b', '#d9823b', '#4a9fb5'];
  const KIND_ICON = { weapon: '🗡️', room: '🚪', trait: '🔍', alibi: '🕰️', motive: '✉️' };

  function colorOf(p) {
    if (p && p.charId) return ch(p.charId).color;
    const i = S.players.indexOf(p);
    return SEAT_COLORS[(i < 0 ? 0 : i) % SEAT_COLORS.length];
  }
  function avatar(p, extra = '') {
    if (!p) return '';
    // Illustrated face (public/faces.js): the character in classic, else the portrait.
    const face = window.Art && (p.charId ? Art.character(p.charId) : p.portrait ? Art.portrait(p.portrait) : '');
    if (face) return `<span class="avatar has-face ${extra}" style="background:${colorOf(p)}">${face}</span>`;
    if (!p.charId && p.portrait) return `<span class="avatar pt ${extra}" style="background:${colorOf(p)}">${esc(p.portrait)}</span>`;
    const letter = p.charId ? ch(p.charId).name.replace('دکتر ', '').replace('Dr. ', '').replace('خانم‌جان', 'خ')[0] : p.name[0];
    return `<span class="avatar ${extra}" style="background:${colorOf(p)}">${esc(letter)}</span>`;
  }
  const who = (pid) => {
    const p = pl(pid); if (!p) return t('؟');
    return p.charId ? `${esc(ch(p.charId).name)} <span class="muted">(${esc(p.name)})</span>` : esc(p.name);
  };
  const plainWho = (pid) => { const p = pl(pid); return p ? (p.charId ? `${ch(p.charId).name} (${p.name})` : p.name) : t('؟'); };
  const LIST = () => t('، '); // list separator

  // Only owned traits are listed; a missing trait means "no".
  function traitTags(charId) {
    const c = ch(charId);
    const owned = C.traits.filter((row, i) => c.traits[i]);
    return owned.length ? owned.map((row) => `<span class="trait">${artOf(row)} ${esc(row.name)}</span>`).join('') : `<span class="trait none">${t('هیچ نشانه‌ی خاصی ندارد')}</span>`;
  }
  const traitIcons = (charId) => C.traits.filter((row, i) => ch(charId).traits[i]).map((row) => artOf(row)).join('');

  // ------------------------------------------------------------ views
  function viewLobby() {
    const seats = [];
    // Seats for the chosen mode (classic 8, «دست‌به‌دست» 12), plus anyone over the classic limit.
    const seatCount = Math.max(S.players.length, S.modeMax);
    for (let i = 0; i < seatCount; i++) {
      const p = S.players[i];
      if (p) {
        const isNew = !seenSeats.has(p.id); seenSeats.add(p.id);
        seats.push(`<div class="seat filled ${p.connected ? '' : 'off'} ${p.ready ? 'ready' : ''} ${isNew ? 'anim' : ''}">${avatar(p)}
          <div><div class="nm">${esc(p.name)}</div><div class="tag ${p.ready ? 'ok' : ''}">${p.id === S.vipId ? `${t('👑 میزبان')} <i class="sep"></i> ` : ''}${!p.connected ? t('آفلاین') : p.ready ? t('✓ آماده') : t('هنوز آماده نیست')}${p.score ? ` <i class="sep"></i> ${t('{n} امتیاز', { n: p.score })}` : ''}</div></div></div>`);
      } else {
        seats.push(`<div class="seat">${i < S.minPlayers ? t('منتظر مهمان…') : t('جای خالی')}</div>`);
      }
    }
    const n = S.players.length;
    const foot = n > S.modeMax ? `<b class="pom">${t('بازی کلاسیک حداکثر ۸ نفره است — حالت دست‌به‌دست را انتخاب کنید.')}</b>`
      : n < S.minPlayers
      ? t('دست‌کم {min} نفر لازم است — {n} نفر دیگر', { min: S.minPlayers, n: S.minPlayers - n })
      : S.players.some((p) => p.connected && !p.ready) ? t('هر کس آماده است، روی گوشی‌اش «آماده‌ام» را بزند.')
        : t('همه آماده‌اند! میزبان (👑) از روی گوشی‌اش بازی را شروع می‌کند.');
    const items = S.settings.mode === 'items';
    const story = items ? C.itemsStory : C.story;
    const how = items ? `
          <li><span>${t('<b>هر کس پنهانی یک چیز می‌گیرد.</b> هر کس شب را با 🔪 چاقو شروع کند قاتل است (۴ نفر: ۱ قاتل، ۵ تا ۸ نفر: ۲ قاتل، ۹ تا ۱۲ نفر: ۳ قاتل).')}</span></li>
          <li><span>${t('<b>به سؤال‌های پچ‌پچ جواب می‌دهید</b> — و همان موقع یک نفر (از ۹ نفر به بالا: دو نفر) پنهانی سرک می‌کشد، معاوضه می‌کند، می‌دزدد یا جابه‌جا می‌کند.')}</span></li>
          <li><span>${t('<b>ردّ چاقو را بگیرید.</b> در رأی نهایی به کسی رأی بدهید که چاقو را <u>اول</u> داشت.')}</span></li>` : `
          <li><span>${t('<b>هر کدام نقشی مخفی می‌گیرید.</b> یکی از شما قاتل است و خودش می‌داند.')}</span></li>
          <li><span>${t('<b>سه دور اتاق‌های خانه را می‌گردید</b> و مدرک پیدا می‌کنید — اما قاتل مدرک جعلی می‌کارد.')}</span></li>
          <li><span>${t('<b>بحث کنید، بازجویی کنید،</b> و در آخر بگویید قاتل کیست، با چه سلاحی و کجا.')}</span></li>`;
    return `<section class="lobby stage-in">
      <div>
        <div class="eyebrow">${esc(story.eyebrow)}</div>
        <h1 class="display title">${esc(story.title)}</h1>
        <p class="subtitle">${esc(story.subtitle)}</p>
        <ol class="how">${how}
        </ol>
      </div>
      <div class="join-card"><img src="/qr.svg" alt="QR"><div class="scan">${t('با گوشی اسکن کنید')}</div><div class="url">${esc(C.joinUrl)}</div></div>
      <div class="seats">${seats.join('')}</div>
      <div class="lobby-foot">${foot}</div>
    </section>`;
  }

  function suspectCard(p, i) {
    const c = ch(p.charId);
    return `<div class="suspect" style="--c:${c.color};animation-delay:${0.15 * i + 1.2}s">${avatar(p)}
      <div class="char">${esc(c.name)}</div>
      <div><span class="role">${esc(c.role)}</span> <i class="sep"></i> <span class="player">${esc(p.name)}</span></div>
      <p class="bio">${esc(c.bio)}</p>
      <div class="traits">${traitTags(p.charId)}</div></div>`;
  }

  function viewIntro() {
    const ps = S.players.filter((p) => p.charId);
    return `<section class="intro stage-in">
      <div class="story">${C.story.intro.map((l, i) => `<p style="animation-delay:${i * 0.35}s">${esc(l)}</p>`).join('')}</div>
      <div class="suspects">${ps.map(suspectCard).join('')}</div>
      <div class="look">${t('📱 به گوشی‌تان نگاه کنید — نقش مخفی‌تان آنجاست. مواظب باشید کسی نبیند!')}</div>
    </section>`;
  }

  // ---- round recap (item 6): shown while everyone is busy searching ----
  function recapHtml() {
    const prev = S.round - 1;
    if (prev < 1) return '';
    const pinned = S.game.board.filter((b) => b.pinRound === prev);
    const sp = S.game.spotlights.find((s) => s.round === prev);
    const rows = [];
    rows.push(`<li><span class="ri">📌</span><div>${pinned.length ? t('{n} مدرک روی تابلو آمد', { n: pinned.length }) : t('هیچ مدرکی روی تابلو نیامد')}
      ${pinned.length ? `<div class="recap-tags">${pinned.slice(0, 3).map((b) => Z.clueTag(b.about, tagHelp())).join('')}${pinned.length > 3 ? `<span class="more">${t('+ {n} مدرک دیگر', { n: pinned.length - 3 })}</span>` : ''}</div>` : ''}</div></li>`);
    rows.push(`<li><span class="ri">🎤</span><div>${sp ? t('بازجویی شد: {name} ({n} رأی)', { name: who(sp.playerId), n: sp.votes }) : t('کسی بازجویی نشد')}</div></li>`);
    if (S.settings.caseFile) {
      const f = boardFacts();
      rows.push(`<li><span class="ri">🗂️</span><div>${t('تا اینجا {w} سلاح و {r} اتاق رد شده است.', { w: f.weaponsOut.size, r: f.roomsOut.size })}
        ${f.conflicts.length ? `<b class="warn">${t('⚠️ {n} تناقض روی تابلو هست!', { n: f.conflicts.length })}</b>` : ''}</div></li>`);
    }
    return `<div class="recap"><h3>${t('دور {n} در یک نگاه', { n: prev })}</h3><ul>${rows.join('')}</ul></div>`;
  }

  function viewSearch() {
    const layout = C.rooms.map((r) => r.id); // the story's six rooms
    const recap = recapHtml();
    return `<section class="search stage-in">
      <div>
        <div class="eyebrow">${t('دور {n} از {total}', { n: S.round, total: S.totalRounds })}</div>
        <h2 class="h-big">${t('خانه را بگردید')}</h2>
        <p class="lead">${t('هر کس روی گوشی‌اش یک اتاق را انتخاب می‌کند و مدرکی پیدا می‌کند. مدرک‌ها خصوصی‌اند — خودتان تصمیم بگیرید چه چیزی را بگویید.')}</p>
        <p class="whisper">${t('…و همین حالا، قاتل در تاریکی مدرکی جعلی می‌کارد.')}</p>
        ${recap}
      </div>
      <div class="mansion">${layout.map((id, i) => { const r = room(id); return `<div class="room ${id === 'garden' ? 'lit' : ''}" style="animation-delay:${i * 0.08}s"><div><div class="ri">${artOf(r, true)}</div><div class="rn">${esc(r.name)}</div></div></div>`; }).join('')}</div>
    </section>`;
  }

  function boardHtml() {
    const b = S.game.board.slice().reverse();
    if (!b.length) return `<div class="board"><div class="board-empty">${t('هنوز کسی مدرکی نشان نداده.')}<br>${t('روی گوشی دکمه‌ی «نشان بده» را بزنید تا مدرکتان اینجا بیاید.')}</div></div>`;
    const dense = b.length > 6;
    const denser = b.length > 12;
    const max = denser ? 20 : dense ? 12 : 6;
    const items = b.slice(0, max).map((c, i) => {
      const isNew = !seenCards.has(c.cardId); seenCards.add(c.cardId);
      const p = pl(c.playerId);
      return `<div class="card ${isNew ? 'anim' : ''} ${i === 0 && isNew ? 'fresh' : ''}"><span class="kind">${KIND_ICON[c.kind] || '📄'}</span>
        <p>${esc(c.text)}</p>${Z.clueTag(c.about, tagHelp())}
        <div class="by">${avatar(p)}<span>${who(c.playerId)} <i class="sep"></i> ${t('دور {n}', { n: c.round })}</span></div></div>`;
    });
    const more = b.length > max ? `<div class="board-more">${t('+ {n} مدرک قدیمی‌تر روی گوشی صاحبانشان', { n: b.length - max })}</div>` : '';
    return `<div class="board ${denser ? 'dense denser' : dense ? 'dense' : ''}">${items.join('')}${more}</div>`;
  }

  const tagHelp = () => ({ C, artOf, nameOf: plainWho });

  // ---- case file (item 3): what the pinned clues add up to ----
  // Characters still in play whose traits match every trait the board agrees on.
  const fitting = (f) => S.players.filter((p) => p.inGame && p.charId && f.fits(ch(p.charId).traits));

  function conflictText(c) {
    switch (c.type) {
      case 'trait': return t('دو مدرک درباره‌ی «{trait}» با هم نمی‌خوانند — یکی جعلی است.', { trait: esc(C.traits.find((x) => x.id === c.id).name) });
      case 'weapons': return t('همه‌ی سلاح‌ها رد شده‌اند — یکی از این مدارک جعلی است.');
      case 'rooms': return t('همه‌ی اتاق‌ها رد شده‌اند — یکی از این مدارک جعلی است.');
      case 'dupe': return t('یک مدرک را دو نفر نشان دادند — یکی از آن دو، کپی قاتل را دارد.');
      case 'nofit': return t('هیچ‌کس با نشانه‌ها جور نیست — یکی از مدارک نشانه جعلی است.');
      default: return '';
    }
  }

  function boardFacts() {
    const f = Z.caseFacts(S.game.board, C);
    if (f.knownTraits && !f.conflicts.some((c) => c.type === 'trait') && !fitting(f).length) f.conflicts.push({ type: 'nofit' });
    return f;
  }

  function caseFile() {
    const f = boardFacts();
    const chips = (list, out) => list.map((o) => `<li class="${out.has(o.id) ? 'out' : ''}">${artOf(o)}<span>${esc(o.name)}</span></li>`).join('');
    const left = (list, out) => list.filter((o) => !out.has(o.id)).length;
    const traits = C.traits.map((tr) => {
      const v = f.traits[tr.id];
      const val = v === 'conflict' ? `<b class="warn">${t('⚠️ تناقض')}</b>` : v === true ? `<b>${esc(tr.name)}</b>` : v === false ? `<b>${esc(tr.no)}</b>` : `<span class="unk">${t('معلوم نیست')}</span>`;
      return `<li>${artOf(tr)}<span>${val}</span></li>`;
    }).join('');
    const fits = f.knownTraits ? fitting(f) : null;
    const fitBox = fits && fits.length ? `<div class="fits"><span class="lbl">${t('با نشانه‌ها جور است:')}</span> ${fits.map((p) => `<span class="fit ${f.alibis.has(p.id) ? 'alibi' : ''}">${avatar(p)}${esc(ch(p.charId).name)}${f.alibis.has(p.id) ? ' 🕰️' : ''}</span>`).join('')}</div>` : '';
    const conflicts = f.conflicts.length
      ? `<div class="box conflicts"><h3>${t('تناقض!')}</h3><ul>${f.conflicts.map((c) => `<li>⚠️ ${conflictText(c)}</li>`).join('')}</ul></div>` : '';
    // (Who was interrogated is in the round recap; the panel has to fit a TV.)
    return `<aside class="side case">
      ${conflicts}
      <div class="box"><h3>${t('سلاح')} <small>${t('{n} مانده', { n: left(C.weapons, f.weaponsOut) })}</small></h3><ul class="chips">${chips(C.weapons, f.weaponsOut)}</ul></div>
      <div class="box"><h3>${t('مکان')} <small>${t('{n} مانده', { n: left(C.rooms, f.roomsOut) })}</small></h3><ul class="chips">${chips(C.rooms, f.roomsOut)}</ul></div>
      <div class="box"><h3>${t('نشانه‌های قاتل')}</h3><ul class="chips traits-k">${traits}</ul>${fitBox}</div>
    </aside>`;
  }

  // Plain reference lists, for hosts who turn the case file off.
  function sidePanel() {
    if (S.settings.caseFile) return caseFile();
    const spots = S.game.spotlights.length
      ? `<div class="box"><h3>${t('بازجویی‌شده‌ها')}</h3><ul>${S.game.spotlights.map((s) => `<li>${t('دور {n}', { n: s.round })}: ${who(s.playerId)}</li>`).join('')}</ul></div>` : '';
    return `<aside class="side">
      <div class="box"><h3>${t('سلاح‌ها')}</h3><ul>${C.weapons.map((w) => `<li>${artOf(w)} ${esc(w.name)}</li>`).join('')}</ul></div>
      <div class="box"><h3>${t('اتاق‌ها')}</h3><ul>${C.rooms.map((r) => `<li>${artOf(r)} ${esc(r.name)}</li>`).join('')}</ul></div>
      ${spots}
    </aside>`;
  }

  function viewDiscuss() {
    return `<section class="discuss stage-in">
      <div class="board-wrap">
        <div class="board-head"><h2>${t('تابلوی شواهد')}</h2><span class="hint">${t('دور {n}', { n: S.round })} <i class="sep"></i> ${t('حرف بزنید، شک کنید، دروغ‌ها را پیدا کنید.')}</span></div>
        ${boardHtml()}
      </div>
      ${sidePanel()}
    </section>`;
  }

  function viewVote() {
    return `<section class="ask stage-in">
      <div class="ask-head"><div><div class="eyebrow">${t('دور {n}', { n: S.round })}</div><h2 class="h-big">${t('چه کسی باید بازجویی شود؟')}</h2>
      <p class="lead">${t('روی گوشی رأی بدهید. کسی که بیشترین رأی را بیاورد باید از خودش دفاع کند — و اتاق‌هایی که گشته لو می‌رود.')}</p></div></div>
      <div class="ask-body">${boardHtml()}${sidePanel()}</div>
    </section>`;
  }

  function viewSpotlight() {
    const sp = S.game.spotlight;
    const p = pl(sp.playerId);
    const c = ch(p.charId);
    const rooms = sp.rooms.map((rid, i) => `<div class="rv"><small>${t('دور {n}', { n: i + 1 })}</small>${artOf(room(rid))} ${esc(room(rid).name)}</div>`).join('');
    const arrow = document.documentElement.dir === 'ltr' ? '→' : '←';
    const ballots = sp.ballots.map((b) => `<span>${esc(pl(b.from) ? pl(b.from).name : t('؟'))} ${arrow} ${esc(pl(b.to) ? pl(b.to).name : t('؟'))}</span>`).join('');
    return `<section class="spot stage-in">
      <div class="spot-who">${avatar(p)}<div class="nm">${esc(c.name)}</div><div class="sub">${esc(p.name)} <i class="sep"></i> ${esc(c.role)} <i class="sep"></i> ${t('{n} رأی', { n: sp.votes })}${sp.tie ? ` ${t('(قرعه بین مساوی‌ها)')}` : ''}</div></div>
      <div class="spot-detail">
        <h3>${t('اتاق‌هایی که گشته')}</h3><div class="rooms-visited">${rooms}</div>
        <h3>${t('چه کسی به چه کسی رأی داد')}</h3><div class="ballots">${ballots}</div>
        <div class="defend">${t('{name}، از خودت دفاع کن!', { name: esc(p.name) })}</div>
        <p class="lead">${t('چه پیدا کردی؟ چرا آنجا رفتی؟ بقیه سؤال کنند.')}</p>
      </div>
    </section>`;
  }

  function viewFinal() {
    return `<section class="ask stage-in">
      <div class="ask-head"><div><div class="eyebrow">${t('آخرین فرصت')}</div><h2 class="h-big">${esc(C.phaseTitles.final)}</h2>
      <p class="lead">${t('روی گوشی انتخاب کنید: قاتل کیست؟ با چه سلاحی؟ در کدام اتاق؟')}</p></div></div>
      <div class="ask-body">${boardHtml()}${sidePanel()}</div>
    </section>`;
  }

  function miniKiller(r) {
    if (!r.killerId) return '';
    return `<div class="mini-killer">${avatar(pl(r.killerId))} ${t('قاتل: {name} — {verdict}', { name: who(r.killerId), verdict: r.caught ? t('گیر افتاد') : t('فرار کرد') })}</div>`;
  }

  function viewReveal() {
    const r = S.game.reveal;
    const step = S.game.revealStep;
    let inner = '';
    if (step === 0) {
      const max = Math.max(1, ...r.tally.map((row) => row.votes));
      inner = `<h2 class="h-big">${t('رأی‌ها شمرده شد…')}</h2>
        <div class="tally">${r.tally.map((row, i) => `<div class="tally-row" style="animation-delay:${i * 0.15}s">
          <div class="who">${avatar(pl(row.playerId))}<span>${who(row.playerId)}</span></div>
          <div class="bar">${row.votes ? `<i style="width:${(row.votes / max) * 100}%"></i>` : ''}<span>${row.voters.map((v) => esc(pl(v) ? pl(v).name : t('؟'))).join(LIST())}</span></div>
          <div class="n">${num(row.votes)}</div></div>`).join('')}</div>`;
    } else if (step === 1) {
      const p = pl(r.killerId);
      inner = `<div class="killer-reveal show" style="--sus:${SUSPENSE + 0.5}s"><div class="spot"></div>${unmask(p, SUSPENSE - 0.3)}<div class="k1">${t('قاتل {victim}…', { victim: esc(C.story.victim) })}</div>
        ${dots()}<div class="k2 after">${esc(ch(p.charId).name)} (${esc(p.name)})</div>
        <div class="verdict stamp ${r.caught ? 'caught' : 'escaped'}" style="--vd:${SUSPENSE + 1.1}s">${r.caught ? t('گیر افتاد!') : t('فرار کرد!')}</div></div>`;
    } else if (step === 2) {
      const names = (ids) => ids.map((id) => esc(pl(id) ? pl(id).name : '')).join(LIST());
      inner = `${miniKiller(r)}<h2 class="h-big">${t('سلاح و مکان')}</h2><div class="truth">
        <div class="truth-card flipin" style="--d:.3s"><div class="ti">${artOf(weapon(r.weapon), true)}</div><div class="tl">${t('سلاح')}</div><div class="tn">${esc(weapon(r.weapon).name)}</div><div class="right">${r.weaponRight.length ? `✓ ${names(r.weaponRight)}` : t('هیچ‌کس درست نگفت')}</div></div>
        <div class="truth-card flipin" style="--d:1.4s"><div class="ti">${artOf(room(r.room), true)}</div><div class="tl">${t('مکان')}</div><div class="tn">${esc(room(r.room).name)}</div><div class="right">${r.roomRight.length ? `✓ ${names(r.roomRight)}` : t('هیچ‌کس درست نگفت')}</div></div>
      </div>`;
    } else if (step === 3) {
      const rows = r.forgeries.map((f, i) => `<div class="li fake" style="animation-delay:${i * 0.25}s"><span class="ok">🎭</span>
        <div><div class="main">«${esc(f.text)}»</div><div class="meta">${t('دور {n}', { n: f.round })} <i class="sep"></i> ${t('کاشته‌شده در {r}', { r: esc(room(f.roomId).name) })} <i class="sep"></i> ${f.deliveredTo ? t('به دست {name} رسید', { name: esc(plainWho(f.deliveredTo)) }) : t('کسی پیدایش نکرد')}${f.pinnedBy.length ? ` <i class="sep"></i> ${t('روی تابلو:')} ${f.pinnedBy.map((id) => esc(pl(id) ? pl(id).name : '')).join(LIST())}` : ''}</div></div><span></span></div>`).join('');
      inner = `${miniKiller(r)}<h2 class="h-big">${t('مدارک جعلی قاتل')}</h2><div class="list">${rows || `<div class="li"><span></span><div class="main">${t('قاتل هیچ مدرک جعلی‌ای نکاشت.')}</div><span></span></div>`}</div>`;
    } else {
      const rows = r.missions.map((m, i) => `<div class="li" style="animation-delay:${i * 0.15}s">${avatar(pl(m.playerId))}
        <div><div class="main"><b>${esc(pl(m.playerId) ? pl(m.playerId).name : '')}</b> — ${t('مأموریت «{title}»', { title: esc(m.title) })}</div><div class="meta">${esc(m.text)}</div></div><span class="ok">${m.success ? '✅' : '❌'}</span></div>`).join('');
      inner = `${miniKiller(r)}<h2 class="h-big">${t('مأموریت‌های مخفی')}</h2><div class="list">${rows}</div>`;
    }
    return `<section class="reveal stage-in"><div class="reveal-inner">${inner}</div></section>`;
  }

  function viewResults() {
    const r = S.game && S.game.reveal;
    const delta = (pid) => { const x = r && r.points ? r.points.find((p) => p.playerId === pid) : null; return x ? x.total : 0; };
    const ranked = S.players.slice().sort((a, b) => b.score - a.score);
    return `<section class="reveal stage-in"><div class="reveal-inner">
      ${r ? (itemsMode() ? itMini(r) : miniKiller(r)) : ''}
      <h2 class="h-big">${t('جدول امتیاز')}</h2>
      <div class="scores">${ranked.map((p, i) => `<div class="score-row ${i === 0 ? 'first' : ''}" style="animation-delay:${i * 0.1}s">
        <div class="rank">${i === 0 ? '👑' : num(i + 1)}</div>${avatar(p)}
        <div class="nm">${esc(p.name)}${p.charId ? `<small>${esc(ch(p.charId).name)}${r && r.killerId === p.id ? ` <i class="sep"></i> ${t('قاتل')}` : ''}</small>` : ''}${r && r.killers && r.killers.includes(p.id) ? `<small>🔪 ${t('قاتل')}</small>` : ''}</div>
        <div class="delta">${delta(p.id) ? `<span class="num">+${num(delta(p.id))}</span>` : ''}</div>
        <div class="tot">${num(p.score)}</div></div>`).join('')}</div>
      <p class="lead">${t('میزبان می‌تواند از روی گوشی دور بعد را شروع کند.')}</p>
    </div></section>`;
  }


  // ------------------------------------------------------------ end of the night
  // stats: one player's night (game.js _recordStats). Each award says why.
  const AWARDS = {
    liar: { icon: '🎭', title: () => t('بهترین دروغگو'), why: (st) => t('{e} بار فرار از عدالت، {f} مدرک جعلی به دست بقیه رسید', { e: st.escapes, f: st.fooled }) },
    detective: { icon: '🔎', title: () => t('تیزبین‌ترین کارآگاه'), why: (st) => t('{n} بار قاتل را درست گفت', { n: st.correct }) },
    missions: { icon: '🎯', title: () => t('استاد مأموریت'), why: (st) => t('{n} مأموریت مخفی انجام داد', { n: st.missions }) },
    winner: { icon: '🏆', title: () => t('بیشترین بُرد'), why: (st) => t('{n} بار در تیم برنده بود', { n: st.wins }) },
  };

  function viewSummary() {
    const s = S.summary;
    const nameOf = (pid) => esc((pl(pid) && pl(pid).name) || (s.stats[pid] && s.stats[pid].name) || t('؟'));
    const champs = s.champions.map((id) => `<div class="champ">${unmask(pl(id), 0.5)}<div class="nm">${nameOf(id)}</div><div class="pts">${t('{n} امتیاز', { n: pl(id) ? pl(id).score : 0 })}</div></div>`).join('');
    const awards = s.awards.map((a, i) => {
      const def = AWARDS[a.id];
      return `<div class="award" style="animation-delay:${1.6 + i * 0.25}s"><div class="ai">${def.icon}</div><div class="at">${def.title()}</div>
        <div class="aw">${a.ids.map((id) => `<span>${avatar(pl(id))}${nameOf(id)}</span>`).join('')}</div>
        <div class="why">${def.why(s.stats[a.ids[0]])}</div></div>`;
    }).join('');
    return `<section class="reveal stage-in"><div class="reveal-inner summary">
      <div class="eyebrow">${t('{n} بازی امشب', { n: s.games })}</div>
      <h2 class="h-big">${s.champions.length > 1 ? t('قهرمان‌های امشب') : t('قهرمان امشب')}</h2>
      <div class="champs">${champs || `<p class="lead">${t('امشب کسی امتیاز نگرفت!')}</p>`}</div>
      ${awards ? `<div class="awards">${awards}</div>` : ''}
      <p class="lead">${t('شب خوبی بود. میزبان می‌تواند از روی گوشی شب تازه‌ای شروع کند.')}</p>
    </div></section>`;
  }

  // ------------------------------------------------------------ items mode («دست‌به‌دست»)
  const name = (pid) => esc(pl(pid) ? pl(pid).name : t('؟'));
  const itemsInPlay = () => `<div class="box"><h3>${t('چیزهای در بازی')}</h3><div class="itm-row">${S.game.items.map((x) => `<span title="${esc(item(x).name)}">${art(x)}</span>`).join('')}</div>
    <p class="small">${t('{n} قاتل', { n: S.game.killerCount })} <i class="sep"></i> ${t('فقط چاقو تکراری است')}</p></div>`;

  // Hidden when quiet rounds are on: the count would show which rounds were quiet.
  const actionsBox = () => (S.game.actionsSoFar == null ? ''
    : `<div class="box"><h3>${t('کارهای مخفی تا حالا')}</h3><div class="big-n">${num(S.game.actionsSoFar)}</div></div>`);

  function rulesNote() {
    const r = S.game.rules || {};
    const lines = [];
    if (r.quietRounds) lines.push(t('🤫 دورهای بی‌صدا: بعضی دورها هیچ‌کس کار مخفی نمی‌گیرد.'));
    if (r.killersKnow && S.game.killerCount > 1) lines.push(t('🤝 قاتل‌ها هم‌دیگر را می‌شناسند.'));
    if (S.game.actionsPerRound > 1) lines.push(t('👥 از ۹ نفر به بالا: هر دور دو نفر کار مخفی می‌گیرند.'));
    return lines.length ? `<div class="house-rules">${lines.map((l) => `<span>${l}</span>`).join('')}</div>` : '';
  }

  function actionCards() {
    return Object.entries(C.secretActions).map(([k, a]) => `<div class="act-card"><span class="ai">${a.icon}</span><div><b>${esc(a.name)}</b><p>${esc(a.text)}</p></div></div>`).join('');
  }

  function itViewIntro() {
    return `<section class="it-intro stage-in">
      <div class="story">${C.itemsStory.intro.map((l, i) => `<p style="animation-delay:${i * 0.35}s">${esc(l)}</p>`).join('')}</div>
      <div class="it-cols">
        <div class="box"><h3>${t('امشب')}</h3><div class="itm-row big">${S.game.items.map((x, i) => `<span style="animation-delay:${0.6 + i * 0.08}s">${art(x, true)}</span>`).join('')}</div>
          <p class="lead">${t('{n} نفر', { n: S.players.filter((p) => p.inGame).length })} <i class="sep"></i> <b class="pom">${t('{n} چاقو = {n} قاتل', { n: S.game.killerCount })}</b></p></div>
        <div class="box"><h3>${t('کارهای مخفی')}</h3><div class="acts">${actionCards()}</div></div>
      </div>
      ${rulesNote()}
      <div class="look">${t('📱 به گوشی‌تان نگاه کنید — چیزی که دستتان است آنجاست. مواظب باشید کسی نبیند!')}</div>
    </section>`;
  }

  function itViewGossip() {
    return `<section class="gossip stage-in">
      <div class="g-main">
        <div class="eyebrow">${esc(C.itemPhaseTitles.gossip)} <i class="sep"></i> ${t('دور {n} از {total}', { n: S.round, total: S.totalRounds })}</div>
        <h2 class="g-q display ink">${esc(S.game.question)}</h2>
        ${answerProgress()}
        <p class="lead">${t('روی گوشی یک نفر را انتخاب کنید.')}</p>
        <p class="whisper">${t(S.game.rules.quietRounds
          ? (S.game.actionsPerRound > 1 ? '…و شاید همین حالا، دو نفر پنهانی کاری مخفی انجام می‌دهند.' : '…و شاید همین حالا، یک نفر پنهانی کاری مخفی انجام می‌دهد.')
          : (S.game.actionsPerRound > 1 ? '…و همین حالا، دو نفر پنهانی کاری مخفی انجام می‌دهند.' : '…و همین حالا، یک نفر پنهانی کاری مخفی انجام می‌دهد.'))}</p>
      </div>
      <aside class="side">${itemsInPlay()}${actionsBox()}${lastGossip()}</aside>
    </section>`;
  }

  // Recap of the previous gossip round (item 6).
  function lastGossip() {
    const g = S.game.gossips[S.game.gossips.length - 1];
    if (!g) return '';
    const arrow = document.documentElement.dir === 'ltr' ? '→' : '←';
    return `<div class="box"><h3>${t('دور قبل')}</h3><p class="small">${esc(g.question)}${g.top.length ? ` ${arrow} <b>${g.top.map(name).join(LIST())}</b>` : ''}</p></div>`;
  }

  // Answers so far, as a bar that grows from where it was on the last paint.
  // (.anim keeps it animating on re-renders, which otherwise settle.)
  let lastPct = 0;
  function answerProgress() {
    const ps = S.players.filter((p) => p.inGame && p.connected);
    const done = ps.filter((p) => p.done).length;
    const pct = ps.length ? Math.round((done / ps.length) * 100) : 0;
    const from = Math.min(lastPct, pct);
    lastPct = pct;
    return `<div class="g-progress"><i class="anim" style="--from:${from}%;--to:${pct}%"></i>
      <span>${done === ps.length ? t('همه جواب دادند!') : t('{done} از {all} نفر جواب داده‌اند', { done, all: ps.length })}</span></div>`;
  }

  // Vote bars spring out one after another; the most-picked rows glow.
  function tallyHtml(tally) {
    const max = Math.max(1, ...tally.map((row) => row.votes));
    const top = Math.max(0, ...tally.map((row) => row.votes));
    return `<div class="tally">${tally.map((row, i) => `<div class="tally-row ${top && row.votes === top ? 'win' : ''}" style="animation-delay:${i * 0.12}s;--bd:${(0.25 + i * 0.12).toFixed(2)}s">
      <div class="who">${avatar(pl(row.playerId))}<span>${name(row.playerId)}</span></div>
      <div class="bar">${row.votes ? `<i style="width:${(row.votes / max) * 100}%"></i>` : ''}<span>${row.voters.map(name).join(LIST())}</span></div>
      <div class="n">${num(row.votes)}</div></div>`).join('')}</div>`;
  }

  function itViewGossipResult() {
    const r = S.game.gossipResult;
    return `<section class="reveal stage-in"><div class="reveal-inner">
      <div class="eyebrow">${t('دور {n}', { n: r.round })}</div><h2 class="h-big">${esc(r.question)}</h2>${gossipWinner(r)}${tallyHtml(r.tally)}</div></section>`;
  }

  // Crown banner for whoever the room picked most (after the bars land).
  function gossipWinner(r) {
    const top = r.tally[0] ? r.tally[0].votes : 0;
    if (!top) return '';
    const ids = r.tally.filter((row) => row.votes === top).map((row) => row.playerId);
    return `<div class="g-winner" style="--wd:${Math.min(1.6, 0.25 + r.tally.length * 0.12 + 0.7).toFixed(2)}s">👑 ${ids.map((id) => `${avatar(pl(id))} ${name(id)}`).join(' <i class="sep"></i> ')}</div>`;
  }

  function itViewDiscuss() {
    const qs = ['چه کسی اول چه چیزی داشت؟', 'کسی چاقو دیده؟ کِی؟', 'به چه کسی سرک کشیدی؟', 'چیزت کِی عوض شد؟',
      'قبلاً چه چیزی دستت بود؟', 'چه کسی حرفت را تأیید می‌کند؟', 'این چاقو قبل از تو دست چه کسی بود؟', 'چرا داستانت عوض شد؟'].map((q) => t(q));
    const arrow = document.documentElement.dir === 'ltr' ? '→' : '←';
    const hist = S.game.gossips.slice(-6).reverse().map((g) => `<li><span class="muted">${t('دور {n}', { n: g.round })}:</span> ${esc(g.question)} ${g.top.length ? `${arrow} <b>${g.top.map(name).join(LIST())}</b>` : ''}</li>`).join('');
    return `<section class="discuss stage-in">
      <div class="it-talk">
        <div class="eyebrow">${esc(C.itemPhaseTitles.discuss)} <i class="sep"></i> ${t('بعد از دور {n} از {total}', { n: S.round, total: S.totalRounds })}</div>
        <h2 class="h-big">${t('نپرسید «چاقو الان دست کیست؟»')}<br><span class="pom">${t('بپرسید «چه کسی شب را با چاقو شروع کرد؟»')}</span></h2>
        <div class="qs">${qs.map((q) => `<span>${esc(q)}</span>`).join('')}</div>
        <p class="lead">${t('چاقو جابه‌جا می‌شود؛ تاریخچه‌اش مدرک است. قاتل‌ها می‌خواهند این تاریخچه گم شود — شما باید دوباره بسازیدش.')}</p>
      </div>
      <aside class="side">${itemsInPlay()}${actionsBox()}
        ${hist ? `<div class="box"><h3>${t('پچ‌پچ‌ها')}</h3><ul class="small">${hist}</ul></div>` : ''}</aside>
    </section>`;
  }

  function itViewFinal() {
    return `<section class="it-final stage-in"><div class="reveal-inner">
      <div class="eyebrow">${t('آخرین فرصت')}</div><h2 class="h-big">${esc(C.itemPhaseTitles.final)}</h2>
      <p class="lead">${t('روی گوشی به کسی رأی بدهید که فکر می‌کنید شب را <b>با چاقو شروع کرد</b>.')}</p>
      <div class="rules3">
        <div><span>✅</span>${t('بیشترین رأی به یک قاتل ← <b>بی‌گناه‌ها می‌برند</b>')}${S.game.killerCount > 1 ? ` ${t('(یکی از قاتل‌ها کافی است)')}` : ''}</div>
        <div><span>🔪</span>${t('بیشترین رأی به یک بی‌گناه ← <b>قاتل‌ها می‌برند</b>')}</div>
        <div><span>⚖️</span>${t('تساوی ← <b>قاتل‌ها می‌برند</b>')}${S.game.killerCount > 1 ? ` ${t('— مگر اینکه تساوی فقط بین خودِ قاتل‌ها باشد')}` : ''}</div>
      </div></div></section>`;
  }



  function itMini(r) {
    if (!r.killers) return '';
    return `<div class="mini-killer">${r.killers.map((k) => avatar(pl(k))).join('')} ${t('قاتل‌ها: {names} — {verdict}', { names: r.killers.map(name).join(t(' و ')), verdict: r.innocentsWin ? t('گیر افتادند') : t('فرار کردند') })}</div>`;
  }



  // Timeline entries grouped by round: one row per round, 1–2 actions side by side.
  function roundsOf(log) {
    const out = [];
    log.forEach((e) => {
      const last = out[out.length - 1];
      if (last && last[0] === e.round) last[1].push(e); else out.push([e.round, [e]]);
    });
    return out;
  }

  // ---- reveal staging (both modes) ----
  const SUSPENSE = 2.3; // seconds of drumroll before a verdict lands
  const UNMASK_GAP = 1.3; // seconds between killers being unmasked
  // An avatar hidden behind a dark mask that shakes and drops away at `delay`.
  const unmask = (p, delay) => `<div class="unmask" style="--d:${delay}s">${avatar(p)}<div class="mask"><span>${t('؟')}</span></div></div>`;
  const dots = () => '<div class="suspense"><i></i><i></i><i></i></div>';

  function itVerdict(r, stampAt) {
    const cls = `verdict ${r.innocentsWin ? 'caught' : 'escaped'}${stampAt != null ? ' stamp' : ''}`;
    const style = stampAt != null ? ` style="--vd:${stampAt}s"` : '';
    return `<div class="${cls}"${style}>${r.innocentsWin ? t('بی‌گناه‌ها بردند!') : t('قاتل‌ها بردند!')}</div>`;
  }

  // Short Farsi label for one secret action, for the knife-trail rows.
  function actShort(e) {
    const a = (id) => name(id);
    switch (e.type) {
      case 'quiet': return t('🤫 بی‌صدا');
      case 'snoop': return t('🕵️ {a} به {b}', { a: a(e.actorId), b: a(e.targets[0]) });
      case 'swap': return t('🔄 {a} و {b}', { a: a(e.actorId), b: a(e.targets[0]) });
      case 'steal': return t('🫳 {a} از {b}', { a: a(e.actorId), b: a(e.targets[0]) });
      default: return t('🔀 {a} و {b}', { a: a(e.targets[0]), b: a(e.targets[1]) });
    }
  }

  // The knife trail: one column per player, one row per round, each cell the
  // item that player held. Each knife is followed through every exchange (even
  // knife-for-knife ones), so its line leads back to whoever started with it.
  const TRAIL_STEP = 0.45; // seconds between rows appearing
  const TRAIL_COLORS = ['#e0335c', '#f0d08a', '#2fb3a6'];
  function knifeTrail(r) {
    const ids = S.players.filter((p) => p.inGame).map((p) => p.id);
    const col = Object.fromEntries(ids.map((id, i) => [id, i]));
    const hold = { ...r.start };
    const kid = {};
    let n = 0;
    ids.forEach((id) => { if (r.start[id] === C.knifeId) { kid[id] = n; n += 1; } });
    const rows = [{ label: `<b>${t('شروع شب')}</b>`, hold: { ...hold }, kid: { ...kid } }];
    const exchange = (a, b) => { [hold[a], hold[b]] = [hold[b], hold[a]]; [kid[a], kid[b]] = [kid[b], kid[a]]; };
    roundsOf(r.log).forEach(([round, es]) => {
      es.forEach((e) => {
        if (e.type === 'swap' || e.type === 'steal') exchange(e.actorId, e.targets[0]);
        else if (e.type === 'shuffle') exchange(e.targets[0], e.targets[1]);
      });
      rows.push({ label: `<b>${t('دور {n}', { n: round })}</b> ${es.map(actShort).join('<br>')}`, hold: { ...hold }, kid: { ...kid } });
    });
    const trails = Array.from({ length: n }, (_, k) => rows.map((row) => col[ids.find((id) => row.kid[id] === k)]));
    const head = `<div class="tr-head"><span></span>${ids.map((id) => `<span class="th ${r.killers.includes(id) ? 'k' : ''}">${avatar(pl(id))}<b>${name(id)}</b></span>`).join('')}</div>`;
    const body = rows.map((row, ri) => `<div class="tr-row" style="--i:${ri}"><span class="tr-lbl">${row.label}</span>${ids.map((id) => `<span class="tc ${row.hold[id] === C.knifeId ? 'kn' : ''}">${art(row.hold[id])}</span>`).join('')}</div>`).join('');
    return `<div class="trail" style="--cols:${ids.length}" data-trails='${JSON.stringify(trails)}'>${head}${body}</div>`;
  }

  // Draws each knife's line over the rendered trail, segment by segment in step
  // with the rows. Uses offset* positions so the rows' entrance transforms
  // don't skew the measurements.
  function drawTrails() {
    const tr = stage.querySelector('.trail');
    if (!tr) return;
    const trails = JSON.parse(tr.dataset.trails);
    const rows = [...tr.querySelectorAll('.tr-row')];
    // Sum offsets up to the trail: an animating row can itself become the
    // cell's offsetParent, so a single offsetTop isn't enough.
    const at = (ri, ci) => {
      const c = rows[ri].children[ci + 1];
      let x = c.offsetWidth / 2;
      let y = c.offsetHeight / 2;
      for (let el = c; el && el !== tr; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
      return [x, y];
    };
    let paths = '';
    trails.forEach((cols, k) => {
      const color = TRAIL_COLORS[k % TRAIL_COLORS.length];
      for (let ri = 1; ri < cols.length; ri++) {
        const [x0, y0] = at(ri - 1, cols[ri - 1]);
        const [x1, y1] = at(ri, cols[ri]);
        const my = (y0 + y1) / 2;
        paths += `<path class="seg" pathLength="1" style="--d:${(ri * TRAIL_STEP + 0.25).toFixed(2)}s;color:${color}" d="M${x0} ${y0} C${x0} ${my} ${x1} ${my} ${x1} ${y1}"/>`;
      }
      const [xs, ys] = at(0, cols[0]);
      const [xe, ye] = at(cols.length - 1, cols[cols.length - 1]);
      paths += `<circle class="dot start" cx="${xs}" cy="${ys}" r="7" style="color:${color}"/>`;
      paths += `<circle class="dot end" cx="${xe}" cy="${ye}" r="6" style="--d:${((cols.length - 1) * TRAIL_STEP + 0.6).toFixed(2)}s;color:${color}"/>`;
    });
    tr.insertAdjacentHTML('afterbegin', `<svg class="tr-lines" width="${tr.offsetWidth}" height="${tr.offsetHeight}">${paths}</svg>`);
  }

  function itViewReveal() {
    const r = S.game.reveal;
    const step = S.game.revealStep;
    let inner = '';
    if (step === 0) {
      inner = `<h2 class="h-big">${t('رأی‌ها شمرده شد…')}</h2>${tallyHtml(r.tally)}`;
    } else if (step === 1) {
      if (r.accusedId) {
        const k = r.topKiller[0];
        inner = `<div class="killer-reveal show" style="--sus:${SUSPENSE}s"><div class="spot"></div>${avatar(pl(r.accusedId))}<div class="k1">${t('بیشترین رأی به…')}</div>
          <div class="k2">${name(r.accusedId)}</div>${dots()}
          <div class="k1 after">${k ? t('شب را با {knife} چاقو شروع کرده بود!', { knife: art('knife', true) }) : t('شب را با چاقو شروع نکرده بود.')}</div>${itVerdict(r, SUSPENSE + 0.5)}</div>`;
      } else if (r.tie) {
        inner = `<div class="killer-reveal show" style="--sus:${SUSPENSE}s"><div class="spot"></div><div class="tie-row">${r.top.map((id) => avatar(pl(id))).join('')}</div>
          <div class="k1">${t('تساوی بین')}</div><div class="k2">${r.top.map(name).join(t(' و '))}</div>${dots()}
          <div class="k1 after">${r.innocentsWin ? t('تساوی فقط بین قاتل‌هاست — پس بی‌گناه‌ها می‌برند.') : t('تساوی یعنی بُرد قاتل‌ها.')}</div>${itVerdict(r, SUSPENSE + 0.5)}</div>`;
      } else {
        inner = `<div class="killer-reveal show" style="--sus:${SUSPENSE}s"><div class="k2">${t('کسی رأی نداد!')}</div>${dots()}${itVerdict(r, SUSPENSE)}</div>`;
      }
    } else if (step === 2) {
      const last = 0.6 + r.killers.length * UNMASK_GAP;
      inner = `<h2 class="h-big">${t('چه کسی شب را با چاقو شروع کرد؟')}</h2>
        <div class="killers-row">${r.killers.map((id, i) => `<div class="kr">${unmask(pl(id), 0.6 + i * UNMASK_GAP)}
          <div class="nm after" style="--sus:${0.6 + i * UNMASK_GAP + 0.6}s">${name(id)}</div><div class="it after" style="--sus:${0.6 + i * UNMASK_GAP + 0.8}s">${art('knife', true)}</div></div>`).join('')}</div>
        ${itVerdict(r, last)}`;
    } else {
      inner = `${itMini(r)}<h2 class="h-big">${t('ردّ چاقو')}</h2>${knifeTrail(r)}`;
    }
    return `<section class="reveal stage-in"><div class="reveal-inner ${step === 3 ? 'wide' : ''}">${inner}</div></section>`;
  }


  // ---- "what's happening now" bar under the header (item 1) ----
  // The steps of this round, what to do right now, and who we are waiting for.
  function flowSteps() {
    if (itemsMode()) {
      const last = S.round >= S.totalRounds;
      const talk = last || S.round % (S.game.discussEvery || 2) === 0;
      return ['gossip', 'gossipResult', ...(talk ? ['discuss'] : []), ...(last ? ['final'] : [])];
    }
    return S.round < S.totalRounds ? ['search', 'discuss', 'vote', 'spotlight'] : ['search', 'discuss', 'final'];
  }

  function flowDo() {
    const sp = S.game && S.game.spotlight;
    const map = itemsMode() ? {
      gossip: t('📱 روی گوشی به سؤال جواب بدهید.'),
      gossipResult: t('📺 ببینید بقیه چه جوابی دادند.'),
      discuss: t('🗣️ حرف بزنید: چه کسی شب را با چاقو شروع کرد؟'),
      final: t('📱 روی گوشی به کسی رأی بدهید که شب را با چاقو شروع کرد.'),
    } : {
      search: t('📱 روی گوشی یک اتاق را برای گشتن انتخاب کنید.'),
      discuss: t('🗣️ مدارک را مقایسه کنید و با «نشان بده» روی تلویزیون بیاورید.'),
      vote: t('📱 روی گوشی رأی بدهید: چه کسی بازجویی شود؟'),
      spotlight: sp ? t('🎤 {name} از خودش دفاع می‌کند — سؤال کنید!', { name: esc(plainWho(sp.playerId)) }) : '',
      final: t('📱 روی گوشی قاتل، سلاح و مکان را انتخاب کنید.'),
    };
    return map[S.phase] || '';
  }

  function flowWait() {
    if (!['search', 'vote', 'final', 'gossip'].includes(S.phase)) return '';
    const left = S.players.filter((p) => p.inGame && p.connected && !p.done);
    if (!left.length) return `<span class="ok">${t('✓ همه انجام دادند')}</span>`;
    if (left.length > 4) return t('منتظر {n} نفر…', { n: left.length });
    return `${t('منتظر:')} ${left.map((p) => `<b>${esc(p.name)}</b>`).join(LIST())}`;
  }

  function flowHtml() {
    if (!S.game || !S.round || ['lobby', 'intro', 'reveal', 'results', 'summary'].includes(S.phase)) return '';
    const titles = itemsMode() ? C.itemPhaseTitles : C.phaseTitles;
    const steps = flowSteps();
    const at = steps.indexOf(S.phase);
    const arrow = document.documentElement.dir === 'ltr' ? '›' : '‹';
    const ol = steps.map((ph, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}">${i < at ? '✓ ' : ''}${esc(titles[ph])}</li>`).join(`<li class="ar" aria-hidden="true">${arrow}</li>`);
    const wait = flowWait();
    return `<ol class="steps">${ol}</ol><div class="flow-do">${flowDo()}</div>${wait ? `<div class="flow-wait">${wait}</div>` : ''}`;
  }

  function stripHtml() {
    if (['lobby', 'results', 'summary', 'reveal', 'intro', 'gossipResult'].includes(S.phase)) return '';
    const showDone = ['search', 'vote', 'final', 'gossip'].includes(S.phase);
    return S.players.filter((p) => p.inGame).map((p) => {
      const done = showDone && p.done ? '<span class="done">✓</span>' : '';
      if (!p.charId) {
        return `<div class="chip ${p.connected ? '' : 'off'}" style="--c:${colorOf(p)}">${avatar(p)}<div><div class="t1">${esc(p.name)}</div></div>${done}</div>`;
      }
      const c = ch(p.charId);
      return `<div class="chip ${p.connected ? '' : 'off'}" style="--c:${c.color}">${avatar(p)}
        <div><div class="t1">${esc(c.name)} <span class="ic">${traitIcons(p.charId)}</span></div><div class="t2">${esc(p.name)}</div></div>
        ${done}</div>`;
    }).join('');
  }

  const VIEWS = {
    lobby: viewLobby, intro: viewIntro, search: viewSearch, discuss: viewDiscuss,
    vote: viewVote, spotlight: viewSpotlight, final: viewFinal, reveal: viewReveal, results: viewResults, summary: viewSummary,
  };
  const IT_VIEWS = {
    lobby: viewLobby, intro: itViewIntro, gossip: itViewGossip, gossipResult: itViewGossipResult,
    discuss: itViewDiscuss, final: itViewFinal, reveal: itViewReveal, results: viewResults, summary: viewSummary,
  };

  // Title card shown on the curtain when a new phase starts.
  function curtainText() {
    const title = (itemsMode() ? C.itemPhaseTitles : C.phaseTitles)[S.phase] || '';
    const round = S.round ? t('دور {n} از {total}', { n: S.round, total: S.totalRounds }) : '';
    const story = itemsMode() ? C.itemsStory : C.story;
    switch (S.phase) {
      case 'intro': return [story.title, story.subtitle];
      case 'discuss': return [title, itemsMode() ? t('چه کسی شب را با چاقو شروع کرد؟') : round];
      case 'spotlight': return [title, plainWho(S.game.spotlight.playerId)];
      case 'final': return [title, t('آخرین فرصت')];
      case 'reveal': return [title, t('حقیقت آشکار می‌شود…')];
      case 'results': return [title, ''];
      case 'summary': return [title, t('{n} بازی امشب', { n: S.gamesPlayed })];
      default: return [title, round];
    }
  }
  // No curtain for the lobby, the very first paint, the short gossip result,
  // or the steps inside the reveal (those have their own staging).
  const wantsCurtain = (firstPaint) => !Scene.reduced && !firstPaint && S.phase !== 'lobby' && S.phase !== 'gossipResult' && !S.prologue
    && !(S.phase === 'reveal' && S.game.revealStep > 0);
  let replayEntrance = false;
  let fxTimers = [];
  let lastDone = 0; // pending reveal sounds, cancelled when the screen changes

  // ------------------------------------------------------------ cinematic, slides, music
  // Cinematic captions in the game's language, for its story.
  function cinemaTexts() {
    const base = Guide.CINEMA[S.lang || 'fa'];
    const own = !itemsMode() && Guide.STORIES[S.story];
    return own ? { ...base, captions: own.captions[S.lang || 'fa'] } : base;
  }

  // Prologue: cinematic over the intro phase until the host skips it or it ends.
  function syncCinema() {
    const on = S.phase === 'intro' && !!S.prologue && !!S.timer && !!window.Cinema;
    if (!on) { if (window.Cinema && Cinema.active) Cinema.stop(); return; }
    if (Cinema.active) return;
    const dur = S.timer.duration;
    const d = dur / 1000;
    const cues = { 0.555: Sound.bell, 0.565: Sound.blackout, 0.72: Sound.heartbeat, 0.77: Sound.heartbeat, 0.82: Sound.sting };
    for (let f = 0.37; f < 0.545; f += 1 / d) cues[f.toFixed(4)] = Sound.tock;
    const story = itemsMode() ? C.itemsStory : C.story;
    Cinema.play({
      durationMs: dur, elapsedMs: dur - window.Z.remaining(S.timer), title: story.title, subtitle: story.subtitle,
      skyline: S.story === 'nowruz' ? Art.villa() : null, texts: cinemaTexts(), skipHint: Guide.CINEMA[S.lang || 'fa'].skip, cues,
    });
  }

  // "How to play" slides: opened and stepped from the host's phone.
  let guideKey = '';
  function syncGuide() {
    let el = $('guide');
    if (S.phase !== 'lobby' || S.tutorial == null || !window.Guide) {
      if (el) el.remove();
      guideKey = '';
      return;
    }
    const lang = S.lang || 'fa';
    const mode = S.settings.mode === 'items' ? 'items' : 'classic';
    const key = `${S.tutorial}:${lang}:${mode}:${S.story}`;
    if (el && key === guideKey) return;
    guideKey = key;
    // Another classic story swaps in its own opening slide.
    const own = mode === 'classic' && Guide.STORIES[S.story];
    const slides = own ? [own.slide[lang], ...Guide.GUIDE[lang][mode].slice(1)] : Guide.GUIDE[lang][mode];
    const s = slides[Math.min(S.tutorial, slides.length - 1)];
    if (!el) { el = document.createElement('div'); el.id = 'guide'; el.className = 'guide'; document.body.appendChild(el); }
    el.innerHTML = `<div class="guide-card"><div class="guide-ico">${s.icon}</div>
      <div class="guide-txt"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></div></div>
      <div class="guide-foot"><div class="guide-dots">${slides.map((_, i) => `<span class="${i === S.tutorial ? 'on' : ''}"></span>`).join('')}</div>
      <div class="guide-note">${t('اسلاید {n} از {total}', { n: S.tutorial + 1, total: slides.length })} <i class="sep"></i> ${t('میزبان با گوشی‌اش اسلایدها را عوض می‌کند')}</div></div>`;
    Sound.blip();
  }

  // Host pause: a card over the stage until the host resumes.
  function syncPause() {
    let el = $('pauseCard');
    if (!S.paused) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div');
    el.id = 'pauseCard';
    el.className = 'pause-card';
    el.innerHTML = `<div><div class="pi">⏸</div><h2>${t('بازی متوقف شد')}</h2><p>${t('میزبان از روی گوشی‌اش ادامه می‌دهد.')}</p></div>`;
    document.body.appendChild(el);
  }

  function syncMusic() {
    if (!window.Music) return;
    const p = S.phase;
    let scene = 'play';
    if (S.prologue && p === 'intro') scene = 'prologue';
    else if (p === 'lobby') scene = 'lobby';
    else if (p === 'intro') scene = 'intro';
    else if (p === 'vote' || p === 'spotlight' || p === 'final') scene = 'tense';
    else if (p === 'reveal') scene = 'reveal';
    else if (p === 'results' || p === 'summary') scene = 'results';
    Music.setScene(scene);
    Music.refresh();
  }

  function render() {
    if (!C || !S) return;
    syncCinema();
    syncGuide();
    syncMusic();
    const key = `${S.phase}:${S.round}:${S.prologue ? 'p' : ''}:${S.game ? S.game.revealStep : ''}:${S.game && S.game.spotlight ? S.game.spotlight.playerId : ''}`;
    const phaseChanged = key !== lastKey;
    if (S.phase === 'lobby') { seenCards.clear(); lastBoardLen = 0; }
    $('app').querySelector('.brand').textContent = (S.settings.mode === 'items' ? C.itemsStory : C.story).title;

    $('phaseTitle').textContent = (itemsMode() ? C.itemPhaseTitles : C.phaseTitles)[S.phase] || '';
    $('roundPips').innerHTML = S.round && S.phase !== 'summary'
      ? Array.from({ length: S.totalRounds }, (_, i) => `<span class="pip ${i + 1 < S.round ? 'on' : ''} ${i + 1 === S.round ? 'now' : ''}"></span>`).join('')
      : '';

    stage.innerHTML = (itemsMode() ? IT_VIEWS : VIEWS)[S.phase]();
    stage.classList.toggle('settled', !phaseChanged && !replayEntrance);
    if (phaseChanged && wantsCurtain(lastKey === '')) {
      // Hide the new screen behind the drapes, then repaint it as they part
      // so its entrance animations play in view.
      stage.classList.add('behind');
      Scene.transition(...curtainText(), () => {
        stage.classList.remove('behind');
        replayEntrance = true;
        render();
        replayEntrance = false;
      });
    }
    Scene.setDim(['reveal', 'results', 'summary'].includes(S.phase));
    Scene.setStory(S.story);
    // Big tables (9–12) switch the TV to a denser layout.
    const tableSize = S.phase === 'lobby' ? Math.max(S.players.length, S.modeMax) : S.players.filter((p) => p.inGame).length;
    $('app').classList.toggle('many', tableSize > 8);
    $('strip').innerHTML = stripHtml();
    $('flow').innerHTML = flowHtml();
    syncPause();

    if (S.phase === 'reveal' && itemsMode() && S.game.revealStep === 3) drawTrails();
    if (phaseChanged) {
      // Sounds timed to the reveal's staging (see SUSPENSE / UNMASK_GAP).
      fxTimers.forEach(clearTimeout);
      fxTimers = [];
      const later = (sec, fn) => fxTimers.push(setTimeout(fn, sec * 1000));
      const r = S.game && S.game.reveal;
      const step = S.game ? S.game.revealStep : -1;
      if (itemsMode() && S.phase === 'gossip') Sound.whisper();
      else if (itemsMode() && S.phase === 'gossipResult') Sound.swoosh();
      else if (S.phase === 'reveal' && step === 1) {
        Sound.drumroll(SUSPENSE);
        const good = itemsMode() ? r.innocentsWin : r.caught;
        later(itemsMode() ? SUSPENSE + 0.5 : SUSPENSE + 1.1, () => (good ? Sound.win() : Sound.sting()));
      } else if (itemsMode() && S.phase === 'reveal' && step === 2) {
        r.killers.forEach((_, i) => later(0.6 + i * UNMASK_GAP + 0.3, () => Sound.sting()));
      } else if (itemsMode() && S.phase === 'reveal' && step === 3) Sound.swoosh();
      else if (!itemsMode() && S.phase === 'reveal' && step === 2) { later(0.3, () => Sound.flip()); later(1.4, () => Sound.flip()); }
      else if (S.phase === 'results' || S.phase === 'summary') Sound.win();
      else if (S.phase !== 'lobby' && !S.prologue && (S.phase !== 'reveal' || step === 0)) Sound.gong();
    }
    // Soft blip whenever another player finishes answering / voting.
    const doneNow = S.players.filter((p) => p.done).length;
    if (!phaseChanged && doneNow > lastDone) Sound.blip();
    lastDone = doneNow;
    const boardLen = S.game && S.game.board ? S.game.board.length : 0;
    if (boardLen > lastBoardLen && !phaseChanged) Sound.pin();
    lastBoardLen = boardLen;
    lastKey = key;
  }

  // countdown ticks in the last 5 seconds
  setInterval(() => {
    if (!S || !S.timer) return;
    const secs = Math.ceil(window.Z.remaining(S.timer) / 1000);
    if (secs <= 5 && secs > 0 && secs !== lastTickSec) Sound.tick();
    lastTickSec = secs;
  }, 200);

  socket.on('connect', () => { $('offline').classList.add('hidden'); socket.emit('tv:hello'); });
  socket.on('disconnect', () => $('offline').classList.remove('hidden'));
  socket.on('content', (c) => { ALL = c; C = Z.bundleFor(ALL, S); render(); });
  socket.on('state', (s) => {
    S = s;
    setLang(s.lang || 'fa');
    if (ALL) C = Z.bundleFor(ALL, s);
    syncClock(s.serverNow); setTimer(s.timer); render();
  });
})();
