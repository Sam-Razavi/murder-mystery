/* TV screen: public view only. Never receives private data. */
(function () {
  const { fa, esc, syncClock, setTimer } = window.Z;
  const socket = io();
  let C = null; // content
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

  // ------------------------------------------------------------ helpers
  const ch = (id) => C.characters.find((c) => c.id === id);
  const pl = (id) => S.players.find((p) => p.id === id);
  const weapon = (id) => C.weapons.find((w) => w.id === id);
  const room = (id) => C.rooms.find((r) => r.id === id);
  // Illustration for a weapon, room or trait (public/art.js), falling back to its emoji.
  const artOf = (o, anim = false) => (o && window.Art && Art.has(o.id) ? Art.item(o.id, { anim, title: o.name }) : (o ? o.icon : ''));
  const item = (id) => C.items.find((x) => x.id === id) || { icon: '❔', name: '؟' };
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
    const letter = p.charId ? ch(p.charId).name.replace('دکتر ', '').replace('خانم‌جان', 'خ')[0] : p.name[0];
    return `<span class="avatar ${extra}" style="background:${colorOf(p)}">${esc(letter)}</span>`;
  }
  const who = (pid) => {
    const p = pl(pid); if (!p) return '؟';
    return p.charId ? `${esc(ch(p.charId).name)} <span class="muted">(${esc(p.name)})</span>` : esc(p.name);
  };
  const plainWho = (pid) => { const p = pl(pid); return p ? (p.charId ? `${ch(p.charId).name} (${p.name})` : p.name) : '؟'; };

  // Only owned traits are listed; a missing trait means "no".
  function traitTags(charId) {
    const c = ch(charId);
    const owned = C.traits.filter((t, i) => c.traits[i]);
    return owned.length ? owned.map((t) => `<span class="trait">${artOf(t)} ${esc(t.name)}</span>`).join('') : '<span class="trait none">هیچ نشانه‌ی خاصی ندارد</span>';
  }
  const traitIcons = (charId) => C.traits.filter((t, i) => ch(charId).traits[i]).map((t) => artOf(t)).join('');

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
          <div><div class="nm">${esc(p.name)}</div><div class="tag ${p.ready ? 'ok' : ''}">${p.id === S.vipId ? '👑 میزبان <i class="sep"></i> ' : ''}${!p.connected ? 'آفلاین' : p.ready ? '✓ آماده' : 'هنوز آماده نیست'}${p.score ? ` <i class="sep"></i> ${fa(p.score)} امتیاز` : ''}</div></div></div>`);
      } else {
        seats.push(`<div class="seat">${i < S.minPlayers ? 'منتظر مهمان…' : 'جای خالی'}</div>`);
      }
    }
    const n = S.players.length;
    const foot = n > S.modeMax ? '<b class="pom">بازی کلاسیک حداکثر ۸ نفره است — حالت دست‌به‌دست را انتخاب کنید.</b>'
      : n < S.minPlayers
      ? `دست‌کم ${fa(S.minPlayers)} نفر لازم است — ${fa(S.minPlayers - n)} نفر دیگر`
      : S.players.some((p) => p.connected && !p.ready) ? 'هر کس آماده است، روی گوشی‌اش «آماده‌ام» را بزند.'
        : 'همه آماده‌اند! میزبان (👑) از روی گوشی‌اش بازی را شروع می‌کند.';
    const items = S.settings.mode === 'items';
    const story = items ? C.itemsStory : C.story;
    const how = items ? `
          <li><span><b>هر کس پنهانی یک چیز می‌گیرد.</b> هر کس شب را با 🔪 چاقو شروع کند قاتل است (۴ نفر: ۱ قاتل، ۵ تا ۸ نفر: ۲ قاتل، ۹ تا ۱۲ نفر: ۳ قاتل).</span></li>
          <li><span><b>به سؤال‌های پچ‌پچ جواب می‌دهید</b> — و همان موقع یک نفر (از ۹ نفر به بالا: دو نفر) پنهانی سرک می‌کشد، معاوضه می‌کند، می‌دزدد یا جابه‌جا می‌کند.</span></li>
          <li><span><b>ردّ چاقو را بگیرید.</b> در رأی نهایی به کسی رأی بدهید که چاقو را <u>اول</u> داشت.</span></li>` : `
          <li><span><b>هر کدام نقشی مخفی می‌گیرید.</b> یکی از شما قاتل است و خودش می‌داند.</span></li>
          <li><span><b>سه دور اتاق‌های عمارت را می‌گردید</b> و مدرک پیدا می‌کنید — اما قاتل مدرک جعلی می‌کارد.</span></li>
          <li><span><b>بحث کنید، بازجویی کنید،</b> و در آخر بگویید قاتل کیست، با چه سلاحی و کجا.</span></li>`;
    return `<section class="lobby stage-in">
      <div>
        <div class="eyebrow">شب یلدا <i class="sep"></i> شیراز <i class="sep"></i> عمارت فرهمند</div>
        <h1 class="display title">${esc(story.title)}</h1>
        <p class="subtitle">${esc(story.subtitle)}</p>
        <ol class="how">${how}
        </ol>
      </div>
      <div class="join-card"><img src="/qr.svg" alt="QR"><div class="scan">با گوشی اسکن کنید</div><div class="url">${esc(C.joinUrl)}</div></div>
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
      <div class="look">📱 به گوشی‌تان نگاه کنید — نقش مخفی‌تان آنجاست. مواظب باشید کسی نبیند!</div>
    </section>`;
  }

  function viewSearch() {
    const layout = ['library', 'shahneshin', 'kitchen', 'sardab', 'garden', 'howz'];
    return `<section class="search stage-in">
      <div>
        <div class="eyebrow">دور ${fa(S.round)} از ${fa(S.totalRounds)}</div>
        <h2 class="h-big">عمارت را بگردید</h2>
        <p class="lead">هر کس روی گوشی‌اش یک اتاق را انتخاب می‌کند و مدرکی پیدا می‌کند.
        مدرک‌ها خصوصی‌اند — خودتان تصمیم بگیرید چه چیزی را بگویید.</p>
        <p class="whisper">…و همین حالا، قاتل در تاریکی مدرکی جعلی می‌کارد.</p>
      </div>
      <div class="mansion">${layout.map((id, i) => { const r = room(id); return `<div class="room ${id === 'garden' ? 'lit' : ''}" style="animation-delay:${i * 0.08}s"><div><div class="ri">${artOf(r, true)}</div><div class="rn">${esc(r.name)}</div></div></div>`; }).join('')}</div>
    </section>`;
  }

  function boardHtml() {
    const b = S.game.board.slice().reverse();
    if (!b.length) return '<div class="board"><div class="board-empty">هنوز کسی مدرکی نشان نداده.<br>روی گوشی دکمه‌ی «نشان بده» را بزنید تا مدرکتان اینجا بیاید.</div></div>';
    const dense = b.length > 6;
    const denser = b.length > 12;
    const max = denser ? 20 : dense ? 12 : 6;
    const items = b.slice(0, max).map((c, i) => {
      const isNew = !seenCards.has(c.cardId); seenCards.add(c.cardId);
      const p = pl(c.playerId);
      return `<div class="card ${isNew ? 'anim' : ''} ${i === 0 && isNew ? 'fresh' : ''}"><span class="kind">${KIND_ICON[c.kind] || '📄'}</span>
        <p>${esc(c.text)}</p>
        <div class="by">${avatar(p)}<span>${who(c.playerId)} <i class="sep"></i> دور ${fa(c.round)}</span></div></div>`;
    });
    const more = b.length > max ? `<div class="board-more">+ ${fa(b.length - max)} مدرک قدیمی‌تر روی گوشی صاحبانشان</div>` : '';
    return `<div class="board ${denser ? 'dense denser' : dense ? 'dense' : ''}">${items.join('')}${more}</div>`;
  }

  function sidePanel() {
    const spots = S.game.spotlights.length
      ? `<div class="box"><h3>بازجویی‌شده‌ها</h3><ul>${S.game.spotlights.map((s) => `<li>دور ${fa(s.round)}: ${who(s.playerId)}</li>`).join('')}</ul></div>` : '';
    return `<aside class="side">
      <div class="box"><h3>سلاح‌ها</h3><ul>${C.weapons.map((w) => `<li>${artOf(w)} ${esc(w.name)}</li>`).join('')}</ul></div>
      <div class="box"><h3>اتاق‌ها</h3><ul>${C.rooms.map((r) => `<li>${artOf(r)} ${esc(r.name)}</li>`).join('')}</ul></div>
      ${spots}
    </aside>`;
  }

  function viewDiscuss() {
    return `<section class="discuss stage-in">
      <div class="board-wrap">
        <div class="board-head"><h2>تابلوی شواهد</h2><span class="hint">دور ${fa(S.round)} <i class="sep"></i> حرف بزنید، شک کنید، دروغ‌ها را پیدا کنید.</span></div>
        ${boardHtml()}
      </div>
      ${sidePanel()}
    </section>`;
  }

  function viewVote() {
    return `<section class="ask stage-in">
      <div class="ask-head"><div><div class="eyebrow">دور ${fa(S.round)}</div><h2 class="h-big">چه کسی باید بازجویی شود؟</h2>
      <p class="lead">روی گوشی رأی بدهید. کسی که بیشترین رأی را بیاورد باید از خودش دفاع کند — و اتاق‌هایی که گشته لو می‌رود.</p></div></div>
      ${boardHtml()}
    </section>`;
  }

  function viewSpotlight() {
    const sp = S.game.spotlight;
    const p = pl(sp.playerId);
    const c = ch(p.charId);
    const rooms = sp.rooms.map((rid, i) => `<div class="rv"><small>دور ${fa(i + 1)}</small>${artOf(room(rid))} ${esc(room(rid).name)}</div>`).join('');
    const ballots = sp.ballots.map((b) => `<span>${esc(pl(b.from) ? pl(b.from).name : '؟')} ← ${esc(pl(b.to) ? pl(b.to).name : '؟')}</span>`).join('');
    return `<section class="spot stage-in">
      <div class="spot-who">${avatar(p)}<div class="nm">${esc(c.name)}</div><div class="sub">${esc(p.name)} <i class="sep"></i> ${esc(c.role)} <i class="sep"></i> ${fa(sp.votes)} رأی${sp.tie ? ' (قرعه بین مساوی‌ها)' : ''}</div></div>
      <div class="spot-detail">
        <h3>اتاق‌هایی که گشته</h3><div class="rooms-visited">${rooms}</div>
        <h3>چه کسی به چه کسی رأی داد</h3><div class="ballots">${ballots}</div>
        <div class="defend">${esc(p.name)}، از خودت دفاع کن!</div>
        <p class="lead">چه پیدا کردی؟ چرا آنجا رفتی؟ بقیه سؤال کنند.</p>
      </div>
    </section>`;
  }

  function viewFinal() {
    return `<section class="ask stage-in">
      <div class="ask-head"><div><div class="eyebrow">آخرین فرصت</div><h2 class="h-big">اتهام نهایی</h2>
      <p class="lead">روی گوشی انتخاب کنید: قاتل کیست؟ با چه سلاحی؟ در کدام اتاق؟</p></div></div>
      ${boardHtml()}
    </section>`;
  }

  function miniKiller(r) {
    if (!r.killerId) return '';
    return `<div class="mini-killer">${avatar(pl(r.killerId))} قاتل: ${who(r.killerId)} — ${r.caught ? 'گیر افتاد' : 'فرار کرد'}</div>`;
  }

  function viewReveal() {
    const r = S.game.reveal;
    const step = S.game.revealStep;
    let inner = '';
    if (step === 0) {
      const max = Math.max(1, ...r.tally.map((t) => t.votes));
      inner = `<h2 class="h-big">رأی‌ها شمرده شد…</h2>
        <div class="tally">${r.tally.map((t, i) => `<div class="tally-row" style="animation-delay:${i * 0.15}s">
          <div class="who">${avatar(pl(t.playerId))}<span>${who(t.playerId)}</span></div>
          <div class="bar">${t.votes ? `<i style="width:${(t.votes / max) * 100}%"></i>` : ''}<span>${t.voters.map((v) => esc(pl(v) ? pl(v).name : '؟')).join('، ')}</span></div>
          <div class="n">${fa(t.votes)}</div></div>`).join('')}</div>`;
    } else if (step === 1) {
      const p = pl(r.killerId);
      inner = `<div class="killer-reveal show" style="--sus:${SUSPENSE + 0.5}s"><div class="spot"></div>${unmask(p, SUSPENSE - 0.3)}<div class="k1">قاتل آقابزرگ…</div>
        ${dots()}<div class="k2 after">${esc(ch(p.charId).name)} (${esc(p.name)})</div>
        <div class="verdict stamp ${r.caught ? 'caught' : 'escaped'}" style="--vd:${SUSPENSE + 1.1}s">${r.caught ? 'گیر افتاد!' : 'فرار کرد!'}</div></div>`;
    } else if (step === 2) {
      const names = (ids) => ids.map((id) => esc(pl(id) ? pl(id).name : '')).join('، ');
      inner = `${miniKiller(r)}<h2 class="h-big">سلاح و مکان</h2><div class="truth">
        <div class="truth-card flipin" style="--d:.3s"><div class="ti">${artOf(weapon(r.weapon), true)}</div><div class="tl">سلاح</div><div class="tn">${esc(weapon(r.weapon).name)}</div><div class="right">${r.weaponRight.length ? `✓ ${names(r.weaponRight)}` : 'هیچ‌کس درست نگفت'}</div></div>
        <div class="truth-card flipin" style="--d:1.4s"><div class="ti">${artOf(room(r.room), true)}</div><div class="tl">مکان</div><div class="tn">${esc(room(r.room).name)}</div><div class="right">${r.roomRight.length ? `✓ ${names(r.roomRight)}` : 'هیچ‌کس درست نگفت'}</div></div>
      </div>`;
    } else if (step === 3) {
      const rows = r.forgeries.map((f, i) => `<div class="li fake" style="animation-delay:${i * 0.25}s"><span class="ok">🎭</span>
        <div><div class="main">«${esc(f.text)}»</div><div class="meta">دور ${fa(f.round)} <i class="sep"></i> کاشته‌شده در ${esc(room(f.roomId).name)} <i class="sep"></i> ${f.deliveredTo ? `به دست ${esc(plainWho(f.deliveredTo))} رسید` : 'کسی پیدایش نکرد'}${f.pinnedBy.length ? ` <i class="sep"></i> روی تابلو: ${f.pinnedBy.map((id) => esc(pl(id) ? pl(id).name : '')).join('، ')}` : ''}</div></div><span></span></div>`).join('');
      inner = `${miniKiller(r)}<h2 class="h-big">مدارک جعلی قاتل</h2><div class="list">${rows || '<div class="li"><span></span><div class="main">قاتل هیچ مدرک جعلی‌ای نکاشت.</div><span></span></div>'}</div>`;
    } else {
      const rows = r.missions.map((m, i) => `<div class="li" style="animation-delay:${i * 0.15}s">${avatar(pl(m.playerId))}
        <div><div class="main"><b>${esc(pl(m.playerId) ? pl(m.playerId).name : '')}</b> — مأموریت «${esc(m.title)}»</div><div class="meta">${esc(m.text)}</div></div><span class="ok">${m.success ? '✅' : '❌'}</span></div>`).join('');
      inner = `${miniKiller(r)}<h2 class="h-big">مأموریت‌های مخفی</h2><div class="list">${rows}</div>`;
    }
    return `<section class="reveal stage-in"><div class="reveal-inner">${inner}</div></section>`;
  }

  function viewResults() {
    const r = S.game && S.game.reveal;
    const delta = (pid) => { const x = r && r.points ? r.points.find((p) => p.playerId === pid) : null; return x ? x.total : 0; };
    const ranked = S.players.slice().sort((a, b) => b.score - a.score);
    return `<section class="reveal stage-in"><div class="reveal-inner">
      ${r ? (itemsMode() ? itMini(r) : miniKiller(r)) : ''}
      <h2 class="h-big">جدول امتیاز</h2>
      <div class="scores">${ranked.map((p, i) => `<div class="score-row ${i === 0 ? 'first' : ''}" style="animation-delay:${i * 0.1}s">
        <div class="rank">${i === 0 ? '👑' : fa(i + 1)}</div>${avatar(p)}
        <div class="nm">${esc(p.name)}${p.charId ? `<small>${esc(ch(p.charId).name)}${r && r.killerId === p.id ? ' <i class="sep"></i> قاتل' : ''}</small>` : ''}${r && r.killers && r.killers.includes(p.id) ? '<small>🔪 قاتل</small>' : ''}</div>
        <div class="delta">${delta(p.id) ? `<span class="num">+${fa(delta(p.id))}</span>` : ''}</div>
        <div class="tot">${fa(p.score)}</div></div>`).join('')}</div>
      <p class="lead">میزبان می‌تواند از روی گوشی دور بعد را شروع کند.</p>
    </div></section>`;
  }


  // ------------------------------------------------------------ items mode («دست‌به‌دست»)
  const name = (pid) => esc(pl(pid) ? pl(pid).name : '؟');
  const itemsInPlay = () => `<div class="box"><h3>چیزهای در بازی</h3><div class="itm-row">${S.game.items.map((x) => `<span title="${esc(item(x).name)}">${art(x)}</span>`).join('')}</div>
    <p class="small">${fa(S.game.killerCount)} قاتل <i class="sep"></i> فقط چاقو تکراری است</p></div>`;

  // Hidden when quiet rounds are on: the count would show which rounds were quiet.
  const actionsBox = () => (S.game.actionsSoFar == null ? ''
    : `<div class="box"><h3>کارهای مخفی تا حالا</h3><div class="big-n">${fa(S.game.actionsSoFar)}</div></div>`);

  function rulesNote() {
    const r = S.game.rules || {};
    const lines = [];
    if (r.quietRounds) lines.push('🤫 دورهای بی‌صدا: بعضی دورها هیچ‌کس کار مخفی نمی‌گیرد.');
    if (r.killersKnow && S.game.killerCount > 1) lines.push('🤝 قاتل‌ها هم‌دیگر را می‌شناسند.');
    if (S.game.actionsPerRound > 1) lines.push('👥 از ۹ نفر به بالا: هر دور دو نفر کار مخفی می‌گیرند.');
    return lines.length ? `<div class="house-rules">${lines.map((l) => `<span>${l}</span>`).join('')}</div>` : '';
  }

  function actionCards() {
    return Object.entries(C.secretActions).map(([k, a]) => `<div class="act-card"><span class="ai">${a.icon}</span><div><b>${esc(a.name)}</b><p>${esc(a.text)}</p></div></div>`).join('');
  }

  function itViewIntro() {
    return `<section class="it-intro stage-in">
      <div class="story">${C.itemsStory.intro.map((l, i) => `<p style="animation-delay:${i * 0.35}s">${esc(l)}</p>`).join('')}</div>
      <div class="it-cols">
        <div class="box"><h3>امشب</h3><div class="itm-row big">${S.game.items.map((x, i) => `<span style="animation-delay:${0.6 + i * 0.08}s">${art(x, true)}</span>`).join('')}</div>
          <p class="lead">${fa(S.players.filter((p) => p.inGame).length)} نفر <i class="sep"></i> <b class="pom">${fa(S.game.killerCount)} چاقو = ${fa(S.game.killerCount)} قاتل</b></p></div>
        <div class="box"><h3>کارهای مخفی</h3><div class="acts">${actionCards()}</div></div>
      </div>
      ${rulesNote()}
      <div class="look">📱 به گوشی‌تان نگاه کنید — چیزی که دستتان است آنجاست. مواظب باشید کسی نبیند!</div>
    </section>`;
  }

  function itViewGossip() {
    return `<section class="gossip stage-in">
      <div class="g-main">
        <div class="eyebrow">پچ‌پچ <i class="sep"></i> دور ${fa(S.round)} از ${fa(S.totalRounds)}</div>
        <h2 class="g-q display ink">${esc(S.game.question)}</h2>
        ${answerProgress()}
        <p class="lead">روی گوشی یک نفر را انتخاب کنید.</p>
        <p class="whisper">…و ${S.game.rules.quietRounds ? 'شاید ' : ''}همین حالا، ${S.game.actionsPerRound > 1 ? 'دو نفر' : 'یک نفر'} پنهانی کاری مخفی انجام می‌دهد.</p>
      </div>
      <aside class="side">${itemsInPlay()}${actionsBox()}</aside>
    </section>`;
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
      <span>${done === ps.length ? 'همه جواب دادند!' : `${fa(done)} از ${fa(ps.length)} نفر جواب داده‌اند`}</span></div>`;
  }

  // Vote bars spring out one after another; the most-picked rows glow.
  function tallyHtml(tally) {
    const max = Math.max(1, ...tally.map((t) => t.votes));
    const top = Math.max(0, ...tally.map((t) => t.votes));
    return `<div class="tally">${tally.map((t, i) => `<div class="tally-row ${top && t.votes === top ? 'win' : ''}" style="animation-delay:${i * 0.12}s;--bd:${(0.25 + i * 0.12).toFixed(2)}s">
      <div class="who">${avatar(pl(t.playerId))}<span>${name(t.playerId)}</span></div>
      <div class="bar">${t.votes ? `<i style="width:${(t.votes / max) * 100}%"></i>` : ''}<span>${t.voters.map(name).join('، ')}</span></div>
      <div class="n">${fa(t.votes)}</div></div>`).join('')}</div>`;
  }

  function itViewGossipResult() {
    const r = S.game.gossipResult;
    return `<section class="reveal stage-in"><div class="reveal-inner">
      <div class="eyebrow">دور ${fa(r.round)}</div><h2 class="h-big">${esc(r.question)}</h2>${gossipWinner(r)}${tallyHtml(r.tally)}</div></section>`;
  }

  // Crown banner for whoever the room picked most (after the bars land).
  function gossipWinner(r) {
    const top = r.tally[0] ? r.tally[0].votes : 0;
    if (!top) return '';
    const ids = r.tally.filter((t) => t.votes === top).map((t) => t.playerId);
    return `<div class="g-winner" style="--wd:${Math.min(1.6, 0.25 + r.tally.length * 0.12 + 0.7).toFixed(2)}s">👑 ${ids.map((id) => `${avatar(pl(id))} ${name(id)}`).join(' <i class="sep"></i> ')}</div>`;
  }

  function itViewDiscuss() {
    const qs = ['چه کسی اول چه چیزی داشت؟', 'کسی چاقو دیده؟ کِی؟', 'به چه کسی سرک کشیدی؟', 'چیزت کِی عوض شد؟',
      'قبلاً چه چیزی دستت بود؟', 'چه کسی حرفت را تأیید می‌کند؟', 'این چاقو قبل از تو دست چه کسی بود؟', 'چرا داستانت عوض شد؟'];
    const hist = S.game.gossips.slice(-6).reverse().map((g) => `<li><span class="muted">دور ${fa(g.round)}:</span> ${esc(g.question)} ${g.top.length ? `← <b>${g.top.map(name).join('، ')}</b>` : ''}</li>`).join('');
    return `<section class="discuss stage-in">
      <div class="it-talk">
        <div class="eyebrow">گفت‌وگو <i class="sep"></i> بعد از دور ${fa(S.round)} از ${fa(S.totalRounds)}</div>
        <h2 class="h-big">نپرسید «چاقو الان دست کیست؟»<br><span class="pom">بپرسید «چه کسی شب را با چاقو شروع کرد؟»</span></h2>
        <div class="qs">${qs.map((q) => `<span>${esc(q)}</span>`).join('')}</div>
        <p class="lead">چاقو جابه‌جا می‌شود؛ تاریخچه‌اش مدرک است. قاتل‌ها می‌خواهند این تاریخچه گم شود — شما باید دوباره بسازیدش.</p>
      </div>
      <aside class="side">${itemsInPlay()}${actionsBox()}
        ${hist ? `<div class="box"><h3>پچ‌پچ‌ها</h3><ul class="small">${hist}</ul></div>` : ''}</aside>
    </section>`;
  }

  function itViewFinal() {
    return `<section class="it-final stage-in"><div class="reveal-inner">
      <div class="eyebrow">آخرین فرصت</div><h2 class="h-big">رأی نهایی</h2>
      <p class="lead">روی گوشی به کسی رأی بدهید که فکر می‌کنید شب را <b>با چاقو شروع کرد</b>.</p>
      <div class="rules3">
        <div><span>✅</span>بیشترین رأی به یک قاتل ← <b>بی‌گناه‌ها می‌برند</b>${S.game.killerCount > 1 ? ' (یکی از قاتل‌ها کافی است)' : ''}</div>
        <div><span>🔪</span>بیشترین رأی به یک بی‌گناه ← <b>قاتل‌ها می‌برند</b></div>
        <div><span>⚖️</span>تساوی ← <b>قاتل‌ها می‌برند</b>${S.game.killerCount > 1 ? ' — مگر اینکه تساوی فقط بین خودِ قاتل‌ها باشد' : ''}</div>
      </div></div></section>`;
  }



  function itMini(r) {
    if (!r.killers) return '';
    return `<div class="mini-killer">${r.killers.map((k) => avatar(pl(k))).join('')} قاتل‌ها: ${r.killers.map(name).join(' و ')} — ${r.innocentsWin ? 'گیر افتادند' : 'فرار کردند'}</div>`;
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
  const unmask = (p, delay) => `<div class="unmask" style="--d:${delay}s">${avatar(p)}<div class="mask"><span>؟</span></div></div>`;
  const dots = () => '<div class="suspense"><i></i><i></i><i></i></div>';

  function itVerdict(r, stampAt) {
    const cls = `verdict ${r.innocentsWin ? 'caught' : 'escaped'}${stampAt != null ? ' stamp' : ''}`;
    const style = stampAt != null ? ` style="--vd:${stampAt}s"` : '';
    return `<div class="${cls}"${style}>${r.innocentsWin ? 'بی‌گناه‌ها بردند!' : 'قاتل‌ها بردند!'}</div>`;
  }

  // Short Farsi label for one secret action, for the knife-trail rows.
  function actShort(e) {
    const a = (id) => name(id);
    switch (e.type) {
      case 'quiet': return '🤫 بی‌صدا';
      case 'snoop': return `🕵️ ${a(e.actorId)} به ${a(e.targets[0])}`;
      case 'swap': return `🔄 ${a(e.actorId)} و ${a(e.targets[0])}`;
      case 'steal': return `🫳 ${a(e.actorId)} از ${a(e.targets[0])}`;
      default: return `🔀 ${a(e.targets[0])} و ${a(e.targets[1])}`;
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
    const rows = [{ label: '<b>شروع شب</b>', hold: { ...hold }, kid: { ...kid } }];
    const exchange = (a, b) => { [hold[a], hold[b]] = [hold[b], hold[a]]; [kid[a], kid[b]] = [kid[b], kid[a]]; };
    roundsOf(r.log).forEach(([round, es]) => {
      es.forEach((e) => {
        if (e.type === 'swap' || e.type === 'steal') exchange(e.actorId, e.targets[0]);
        else if (e.type === 'shuffle') exchange(e.targets[0], e.targets[1]);
      });
      rows.push({ label: `<b>دور ${fa(round)}</b> ${es.map(actShort).join('<br>')}`, hold: { ...hold }, kid: { ...kid } });
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
      inner = `<h2 class="h-big">رأی‌ها شمرده شد…</h2>${tallyHtml(r.tally)}`;
    } else if (step === 1) {
      if (r.accusedId) {
        const k = r.topKiller[0];
        inner = `<div class="killer-reveal show" style="--sus:${SUSPENSE}s"><div class="spot"></div>${avatar(pl(r.accusedId))}<div class="k1">بیشترین رأی به…</div>
          <div class="k2">${name(r.accusedId)}</div>${dots()}
          <div class="k1 after">${k ? `شب را با ${art('knife', true)} چاقو شروع کرده بود!` : 'شب را با چاقو شروع نکرده بود.'}</div>${itVerdict(r, SUSPENSE + 0.5)}</div>`;
      } else if (r.tie) {
        inner = `<div class="killer-reveal show" style="--sus:${SUSPENSE}s"><div class="spot"></div><div class="tie-row">${r.top.map((id) => avatar(pl(id))).join('')}</div>
          <div class="k1">تساوی بین</div><div class="k2">${r.top.map(name).join(' و ')}</div>${dots()}
          <div class="k1 after">${r.innocentsWin ? 'تساوی فقط بین قاتل‌هاست — پس بی‌گناه‌ها می‌برند.' : 'تساوی یعنی بُرد قاتل‌ها.'}</div>${itVerdict(r, SUSPENSE + 0.5)}</div>`;
      } else {
        inner = `<div class="killer-reveal show" style="--sus:${SUSPENSE}s"><div class="k2">کسی رأی نداد!</div>${dots()}${itVerdict(r, SUSPENSE)}</div>`;
      }
    } else if (step === 2) {
      const last = 0.6 + r.killers.length * UNMASK_GAP;
      inner = `<h2 class="h-big">چه کسی شب را با چاقو شروع کرد؟</h2>
        <div class="killers-row">${r.killers.map((id, i) => `<div class="kr">${unmask(pl(id), 0.6 + i * UNMASK_GAP)}
          <div class="nm after" style="--sus:${0.6 + i * UNMASK_GAP + 0.6}s">${name(id)}</div><div class="it after" style="--sus:${0.6 + i * UNMASK_GAP + 0.8}s">${art('knife', true)}</div></div>`).join('')}</div>
        ${itVerdict(r, last)}`;
    } else {
      inner = `${itMini(r)}<h2 class="h-big">ردّ چاقو</h2>${knifeTrail(r)}`;
    }
    return `<section class="reveal stage-in"><div class="reveal-inner ${step === 3 ? 'wide' : ''}">${inner}</div></section>`;
  }


  function stripHtml() {
    if (['lobby', 'results', 'reveal', 'intro', 'gossipResult'].includes(S.phase)) return '';
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
    vote: viewVote, spotlight: viewSpotlight, final: viewFinal, reveal: viewReveal, results: viewResults,
  };
  const IT_VIEWS = {
    lobby: viewLobby, intro: itViewIntro, gossip: itViewGossip, gossipResult: itViewGossipResult,
    discuss: itViewDiscuss, final: itViewFinal, reveal: itViewReveal, results: viewResults,
  };

  // Title card shown on the curtain when a new phase starts.
  function curtainText() {
    const title = (itemsMode() ? C.itemPhaseTitles : C.phaseTitles)[S.phase] || '';
    const round = S.round ? `دور ${fa(S.round)} از ${fa(S.totalRounds)}` : '';
    const story = itemsMode() ? C.itemsStory : C.story;
    switch (S.phase) {
      case 'intro': return [story.title, story.subtitle];
      case 'discuss': return [title, itemsMode() ? 'چه کسی شب را با چاقو شروع کرد؟' : round];
      case 'spotlight': return [title, plainWho(S.game.spotlight.playerId)];
      case 'final': return [title, 'آخرین فرصت'];
      case 'reveal': return [title, 'حقیقت آشکار می‌شود…'];
      case 'results': return [title, ''];
      default: return [title, round];
    }
  }
  // No curtain for the lobby, the very first paint, the short gossip result,
  // or the steps inside the reveal (those have their own staging).
  const wantsCurtain = (firstPaint) => !Scene.reduced && !firstPaint && S.phase !== 'lobby' && S.phase !== 'gossipResult'
    && !(S.phase === 'reveal' && S.game.revealStep > 0);
  let replayEntrance = false;
  let fxTimers = [];
  let lastDone = 0; // pending reveal sounds, cancelled when the screen changes

  function render() {
    if (!C || !S) return;
    const key = `${S.phase}:${S.round}:${S.game ? S.game.revealStep : ''}:${S.game && S.game.spotlight ? S.game.spotlight.playerId : ''}`;
    const phaseChanged = key !== lastKey;
    if (S.phase === 'lobby') { seenCards.clear(); lastBoardLen = 0; }
    $('app').querySelector('.brand').textContent = (S.settings.mode === 'items' ? C.itemsStory : C.story).title;

    $('phaseTitle').textContent = (itemsMode() ? C.itemPhaseTitles : C.phaseTitles)[S.phase] || '';
    $('roundPips').innerHTML = S.round
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
    Scene.setDim(S.phase === 'reveal' || S.phase === 'results');
    // Big tables (9–12) switch the TV to a denser layout.
    const tableSize = S.phase === 'lobby' ? Math.max(S.players.length, S.modeMax) : S.players.filter((p) => p.inGame).length;
    $('app').classList.toggle('many', tableSize > 8);
    $('strip').innerHTML = stripHtml();

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
      else if (S.phase === 'results') Sound.win();
      else if (S.phase !== 'lobby' && (S.phase !== 'reveal' || step === 0)) Sound.gong();
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
  socket.on('content', (c) => { C = c; render(); });
  socket.on('state', (s) => { S = s; syncClock(s.serverNow); setTimer(s.timer); render(); });
})();
