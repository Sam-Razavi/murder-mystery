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
    return {
      gong() { tone(110, 0, 2.6, 'sine', 0.28); tone(165, 0, 2.2, 'sine', 0.12); tone(220.5, 0.01, 1.6, 'triangle', 0.06); },
      tick() { tone(1400, 0, 0.06, 'square', 0.04); },
      pin() { tone(880, 0, 0.18, 'triangle', 0.1); tone(1320, 0.07, 0.25, 'triangle', 0.08); },
      sting() { [233, 277, 349, 466].forEach((f, i) => tone(f, i * 0.09, 1.8, 'sawtooth', 0.05)); tone(58, 0, 2.5, 'sine', 0.3); },
      win() { [392, 494, 587, 784].forEach((f, i) => tone(f, i * 0.12, 0.9, 'triangle', 0.09)); },
    };
  })();

  // ------------------------------------------------------------ helpers
  const ch = (id) => C.characters.find((c) => c.id === id);
  const pl = (id) => S.players.find((p) => p.id === id);
  const weapon = (id) => C.weapons.find((w) => w.id === id);
  const room = (id) => C.rooms.find((r) => r.id === id);
  const item = (id) => C.items.find((x) => x.id === id) || { icon: '❔', name: '؟' };
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
    return owned.length ? owned.map((t) => `<span class="trait">${t.icon} ${esc(t.name)}</span>`).join('') : '<span class="trait none">هیچ نشانه‌ی خاصی ندارد</span>';
  }
  const traitIcons = (charId) => C.traits.filter((t, i) => ch(charId).traits[i]).map((t) => t.icon).join(' ');

  // ------------------------------------------------------------ views
  function viewLobby() {
    const seats = [];
    for (let i = 0; i < S.maxPlayers; i++) {
      const p = S.players[i];
      if (p) {
        const isNew = !seenSeats.has(p.id); seenSeats.add(p.id);
        seats.push(`<div class="seat filled ${p.connected ? '' : 'off'} ${isNew ? 'anim' : ''}">${avatar(p)}
          <div><div class="nm">${esc(p.name)}</div><div class="tag">${p.id === S.vipId ? '👑 میزبان' : (p.connected ? 'آماده' : 'آفلاین')}${p.score ? ` <i class="sep"></i> ${fa(p.score)} امتیاز` : ''}</div></div></div>`);
      } else {
        seats.push(`<div class="seat">${i < S.minPlayers ? 'منتظر مهمان…' : 'جای خالی'}</div>`);
      }
    }
    const n = S.players.length;
    const foot = n < S.minPlayers
      ? `دست‌کم ${fa(S.minPlayers)} نفر لازم است — ${fa(S.minPlayers - n)} نفر دیگر`
      : 'همه آماده‌اند؟ میزبان (👑) از روی گوشی‌اش بازی را شروع می‌کند.';
    const items = S.settings.mode === 'items';
    const story = items ? C.itemsStory : C.story;
    const how = items ? `
          <li><span><b>هر کس پنهانی یک چیز می‌گیرد.</b> هر کس شب را با 🔪 چاقو شروع کند قاتل است (۴ نفر: ۱ قاتل، ۵ تا ۸ نفر: ۲ قاتل).</span></li>
          <li><span><b>به سؤال‌های پچ‌پچ جواب می‌دهید</b> — و همان موقع یک نفر پنهانی سرک می‌کشد، معاوضه می‌کند، می‌دزدد یا جابه‌جا می‌کند.</span></li>
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
      <div class="mansion">${layout.map((id, i) => { const r = room(id); return `<div class="room ${id === 'garden' ? 'lit' : ''}" style="animation-delay:${i * 0.08}s"><div><div class="ri">${r.icon}</div><div class="rn">${esc(r.name)}</div></div></div>`; }).join('')}</div>
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
      <div class="box"><h3>سلاح‌ها</h3><ul>${C.weapons.map((w) => `<li>${w.icon} ${esc(w.name)}</li>`).join('')}</ul></div>
      <div class="box"><h3>اتاق‌ها</h3><ul>${C.rooms.map((r) => `<li>${r.icon} ${esc(r.name)}</li>`).join('')}</ul></div>
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
    const rooms = sp.rooms.map((rid, i) => `<div class="rv"><small>دور ${fa(i + 1)}</small>${room(rid).icon} ${esc(room(rid).name)}</div>`).join('');
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
      inner = `<div class="killer-reveal">${avatar(p)}<div class="k1">قاتل آقابزرگ…</div>
        <div class="k2">${esc(ch(p.charId).name)} (${esc(p.name)})</div>
        <div class="verdict ${r.caught ? 'caught' : 'escaped'}">${r.caught ? 'گیر افتاد!' : 'فرار کرد!'}</div></div>`;
    } else if (step === 2) {
      const names = (ids) => ids.map((id) => esc(pl(id) ? pl(id).name : '')).join('، ');
      inner = `${miniKiller(r)}<h2 class="h-big">سلاح و مکان</h2><div class="truth">
        <div class="truth-card"><div class="ti">${weapon(r.weapon).icon}</div><div class="tl">سلاح</div><div class="tn">${esc(weapon(r.weapon).name)}</div><div class="right">${r.weaponRight.length ? `✓ ${names(r.weaponRight)}` : 'هیچ‌کس درست نگفت'}</div></div>
        <div class="truth-card"><div class="ti">${room(r.room).icon}</div><div class="tl">مکان</div><div class="tn">${esc(room(r.room).name)}</div><div class="right">${r.roomRight.length ? `✓ ${names(r.roomRight)}` : 'هیچ‌کس درست نگفت'}</div></div>
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
  const itemChip = (id) => `<span class="itm-chip">${item(id).icon} ${esc(item(id).name)}</span>`;
  const itemsInPlay = () => `<div class="box"><h3>چیزهای در بازی</h3><div class="itm-row">${S.game.items.map((x) => `<span title="${esc(item(x).name)}">${item(x).icon}</span>`).join('')}</div>
    <p class="small">${fa(S.game.killerCount)} قاتل <i class="sep"></i> فقط چاقو تکراری است</p></div>`;

  function actionCards() {
    return Object.entries(C.secretActions).map(([k, a]) => `<div class="act-card"><span class="ai">${a.icon}</span><div><b>${esc(a.name)}</b><p>${esc(a.text)}</p></div></div>`).join('');
  }

  function itViewIntro() {
    return `<section class="it-intro stage-in">
      <div class="story">${C.itemsStory.intro.map((l, i) => `<p style="animation-delay:${i * 0.35}s">${esc(l)}</p>`).join('')}</div>
      <div class="it-cols">
        <div class="box"><h3>امشب</h3><div class="itm-row big">${S.game.items.map((x) => `<span>${item(x).icon}</span>`).join('')}</div>
          <p class="lead">${fa(S.players.filter((p) => p.inGame).length)} نفر <i class="sep"></i> <b class="pom">${fa(S.game.killerCount)} چاقو = ${fa(S.game.killerCount)} قاتل</b></p></div>
        <div class="box"><h3>کارهای مخفی</h3><div class="acts">${actionCards()}</div></div>
      </div>
      <div class="look">📱 به گوشی‌تان نگاه کنید — چیزی که دستتان است آنجاست. مواظب باشید کسی نبیند!</div>
    </section>`;
  }

  function itViewGossip() {
    return `<section class="gossip stage-in">
      <div class="g-main">
        <div class="eyebrow">پچ‌پچ <i class="sep"></i> دور ${fa(S.round)} از ${fa(S.totalRounds)}</div>
        <h2 class="g-q display">${esc(S.game.question)}</h2>
        <p class="lead">روی گوشی یک نفر را انتخاب کنید.</p>
        <p class="whisper">…و همین حالا، یک نفر پنهانی کاری مخفی انجام می‌دهد.</p>
      </div>
      <aside class="side">${itemsInPlay()}<div class="box"><h3>کارهای مخفی تا حالا</h3><div class="big-n">${fa(S.game.actionsSoFar)}</div></div></aside>
    </section>`;
  }

  function tallyHtml(tally) {
    const max = Math.max(1, ...tally.map((t) => t.votes));
    return `<div class="tally">${tally.map((t, i) => `<div class="tally-row" style="animation-delay:${i * 0.12}s">
      <div class="who">${avatar(pl(t.playerId))}<span>${name(t.playerId)}</span></div>
      <div class="bar">${t.votes ? `<i style="width:${(t.votes / max) * 100}%"></i>` : ''}<span>${t.voters.map(name).join('، ')}</span></div>
      <div class="n">${fa(t.votes)}</div></div>`).join('')}</div>`;
  }

  function itViewGossipResult() {
    const r = S.game.gossipResult;
    return `<section class="reveal stage-in"><div class="reveal-inner">
      <div class="eyebrow">دور ${fa(r.round)}</div><h2 class="h-big">${esc(r.question)}</h2>${tallyHtml(r.tally)}</div></section>`;
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
      <aside class="side">${itemsInPlay()}<div class="box"><h3>کارهای مخفی تا حالا</h3><div class="big-n">${fa(S.game.actionsSoFar)}</div></div>
        ${hist ? `<div class="box"><h3>پچ‌پچ‌ها</h3><ul class="small">${hist}</ul></div>` : ''}</aside>
    </section>`;
  }

  function itViewFinal() {
    return `<section class="it-final stage-in"><div class="reveal-inner">
      <div class="eyebrow">آخرین فرصت</div><h2 class="h-big">رأی نهایی</h2>
      <p class="lead">روی گوشی به کسی رأی بدهید که فکر می‌کنید شب را <b>با چاقو شروع کرد</b>.</p>
      <div class="rules3">
        <div><span>✅</span>بیشترین رأی به یک قاتل ← <b>بی‌گناه‌ها می‌برند</b>${S.game.killerCount > 1 ? ' (یکی از دو قاتل کافی است)' : ''}</div>
        <div><span>🔪</span>بیشترین رأی به یک بی‌گناه ← <b>قاتل‌ها می‌برند</b></div>
        <div><span>⚖️</span>تساوی ← <b>قاتل‌ها می‌برند</b>${S.game.killerCount > 1 ? ' — مگر اینکه تساوی فقط بین خودِ دو قاتل باشد' : ''}</div>
      </div></div></section>`;
  }

  function itVerdict(r) {
    if (r.innocentsWin) return '<div class="verdict caught">بی‌گناه‌ها بردند!</div>';
    return '<div class="verdict escaped">قاتل‌ها بردند!</div>';
  }

  function itMini(r) {
    if (!r.killers) return '';
    return `<div class="mini-killer">${r.killers.map((k) => avatar(pl(k))).join('')} قاتل‌ها: ${r.killers.map(name).join(' و ')} — ${r.innocentsWin ? 'گیر افتادند' : 'فرار کردند'}</div>`;
  }

  function logLine(e) {
    const a = C.secretActions[e.type];
    let what;
    if (e.type === 'snoop') what = `به <b>${name(e.targets[0])}</b> سرک کشید و ${itemChip(e.seen)} دید`;
    else if (e.type === 'swap') what = `با <b>${name(e.targets[0])}</b> معاوضه شد`;
    else if (e.type === 'steal') what = `از <b>${name(e.targets[0])}</b> دزدید`;
    else what = `چیزهای <b>${name(e.targets[0])}</b> و <b>${name(e.targets[1])}</b> را جابه‌جا کرد`;
    const moves = e.moves.map((m) => `<span class="mv">${name(m.playerId)}: ${item(m.from).icon} ← ${item(m.to).icon}</span>`).join('');
    return `<div class="li tl ${e.moves.some((m) => m.from === C.knifeId || m.to === C.knifeId) ? 'fake' : ''}">
      <span class="ok">${a.icon}</span>
      <div><div class="main"><span class="muted">دور ${fa(e.round)}:</span> <b>${name(e.actorId)}</b> ${what}${e.auto ? ' <span class="muted">(خودکار)</span>' : ''}</div>
      <div class="meta">${moves || (e.type === 'snoop' ? 'چیزی جابه‌جا نشد' : 'هر دو یک‌جور چیز داشتند — ظاهراً چیزی عوض نشد')}</div></div><span></span></div>`;
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
        inner = `<div class="killer-reveal">${avatar(pl(r.accusedId))}<div class="k1">بیشترین رأی به…</div>
          <div class="k2">${name(r.accusedId)}</div>
          <div class="k1">${k ? 'شب را با 🔪 چاقو شروع کرده بود!' : 'شب را با چاقو شروع نکرده بود.'}</div>${itVerdict(r)}</div>`;
      } else if (r.tie) {
        inner = `<div class="killer-reveal"><div class="tie-row">${r.top.map((id) => avatar(pl(id))).join('')}</div>
          <div class="k1">تساوی بین</div><div class="k2">${r.top.map(name).join(' و ')}</div>
          <div class="k1">${r.innocentsWin ? 'تساوی فقط بین قاتل‌هاست — پس بی‌گناه‌ها می‌برند.' : 'تساوی یعنی بُرد قاتل‌ها.'}</div>${itVerdict(r)}</div>`;
      } else {
        inner = `<div class="killer-reveal"><div class="k2">کسی رأی نداد!</div>${itVerdict(r)}</div>`;
      }
    } else if (step === 2) {
      inner = `<h2 class="h-big">چه کسی شب را با چاقو شروع کرد؟</h2>
        <div class="killers-row">${r.killers.map((id, i) => `<div class="kr" style="animation-delay:${i * 0.5}s">${avatar(pl(id))}<div class="nm">${name(id)}</div><div class="it">🔪</div></div>`).join('')}</div>
        ${itVerdict(r)}`;
    } else {
      const ids = S.players.filter((p) => p.inGame).map((p) => p.id);
      const startRow = ids.map((id) => `<span class="st ${r.start[id] === C.knifeId ? 'k' : ''}">${name(id)} ${item(r.start[id]).icon}</span>`).join('');
      const endRow = ids.map((id) => `<span class="st ${r.finalHold[id] === C.knifeId ? 'k' : ''}">${name(id)} ${item(r.finalHold[id]).icon}</span>`).join('');
      inner = `${itMini(r)}<h2 class="h-big">ردّ چاقو</h2>
        <div class="timeline"><div class="tl-row"><b>شروع شب</b>${startRow}</div>
        <div class="list">${r.log.map(logLine).join('')}</div>
        <div class="tl-row"><b>آخر شب</b>${endRow}</div></div>`;
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
    stage.classList.toggle('settled', !phaseChanged);
    $('strip').innerHTML = stripHtml();

    if (phaseChanged) {
      if (S.phase === 'reveal' && S.game.revealStep === 1) Sound.sting();
      else if (S.phase === 'results') Sound.win();
      else if (S.phase !== 'lobby') Sound.gong();
    }
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
