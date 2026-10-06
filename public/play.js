/* Phone controller: each player's private screen. */
(function () {
  const { fa, esc, store, makeId, syncClock, setTimer } = window.Z;
  const socket = io();
  const $ = (id) => document.getElementById(id);

  let C = null;
  let S = null;
  let me = null;
  let myId = store.get('ziafat:id');
  if (!myId) { myId = makeId(); store.set('ziafat:id', myId); }

  // Local UI state (never sent to the server)
  const ui = {
    tab: 'hand',
    roleVisible: false,
    roleTimer: null,
    lieKey: null,
    lieRoom: null,
    final: { suspect: null, weapon: null, room: null },
    lastPhaseKey: '',
    vipConfirm: null,
  };

  const ch = (id) => C.characters.find((c) => c.id === id);
  const pl = (id) => S.players.find((p) => p.id === id);
  const room = (id) => C.rooms.find((r) => r.id === id);
  const weapon = (id) => C.weapons.find((w) => w.id === id);
  const SEAT_COLORS = ['#c9a227', '#e0335c', '#2fb3a6', '#7b6fd0', '#d77ab3', '#6a9a4b', '#d9823b', '#4a9fb5'];

  function avatar(p) {
    if (!p) return '';
    const color = p.charId ? ch(p.charId).color : SEAT_COLORS[Math.max(0, S.players.indexOf(p)) % 8];
    const letter = p.charId ? ch(p.charId).name.replace('دکتر ', '').replace('خانم‌جان', 'خ')[0] : (p.name || '؟')[0];
    return `<span class="avatar" style="background:${color}">${esc(letter)}</span>`;
  }
  const nameOf = (pid) => { const p = pl(pid); return p ? (p.charId ? `${ch(p.charId).name} (${p.name})` : p.name) : '؟'; };
  const traitIcons = (charId) => C.traits.filter((t, i) => ch(charId).traits[i]).map((t) => t.icon).join(' ');
  const traitTags = (charId) => C.traits.map((t, i) => ch(charId).traits[i]
    ? `<span class="trait">${t.icon} ${esc(t.name)}</span>` : `<span class="trait no">${esc(t.name)}</span>`).join('');

  // Only touch the DOM when a region's markup actually changed, so other
  // players' actions don't replace the button under someone's finger.
  function setHTML(el, html) {
    if (el._html === html) return;
    el._html = html;
    el.innerHTML = html;
  }
  const animated = new Set(); // clue ids that already played their entrance

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast._h); toast._h = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  function send(event, payload = {}) {
    socket.emit(event, payload, (res) => { if (res && !res.ok && res.error) toast(res.error); });
  }
  const buzz = (ms = 60) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* ignore */ } };

  // ------------------------------------------------------------ notebook
  const nbKey = () => `ziafat:nb:${S.game ? S.game.id : 'x'}`;
  const nbGet = () => store.get(nbKey(), {});
  function nbCycle(key) {
    const nb = nbGet();
    nb[key] = nb[key] === 'x' ? 'q' : nb[key] === 'q' ? '' : 'x';
    store.set(nbKey(), nb);
    render();
  }

  // ------------------------------------------------------------ action views
  const inGame = () => me && me.inGame && S.phase !== 'lobby';
  const isKiller = () => me && me.role === 'killer';

  function actionLobby() {
    const n = S.players.length;
    let html = `<h2 class="prompt">${me ? 'به مهمانی خوش آمدی!' : ''}</h2>
      <p class="sub">${n < S.minPlayers ? `منتظر بقیه‌ایم — دست‌کم ${fa(S.minPlayers)} نفر لازم است (الان ${fa(n)} نفر).` : `${fa(n)} نفر آماده‌اند. میزبان بازی را شروع می‌کند.`}</p>
      <div class="players-mini">${S.players.map((p) => `<span class="pm ${p.connected ? '' : 'off'}">${avatar(p)}${esc(p.name)}${p.id === S.vipId ? ' 👑' : ''}
        ${me && me.isVip && !p.connected && p.id !== me.id ? `<button data-act="kick" data-id="${esc(p.id)}">حذف</button>` : ''}</span>`).join('')}</div>`;
    if (me && me.isVip) {
      const d = S.settings.discussSeconds;
      html += `<div class="step-label">👑 تو میزبانی</div>
        <div class="sub">زمان گفت‌وگو در هر دور</div>
        <div class="seg">${[[90, '۱:۳۰'], [150, '۲:۳۰'], [240, '۴:۰۰']].map(([v, l]) => `<button data-act="setting" data-v="${v}" class="${d === v ? 'sel' : ''}">${l}</button>`).join('')}</div>
        <button class="btn primary big" data-act="start" ${n < S.minPlayers ? 'disabled' : ''}>شروع بازی</button>`;
    }
    html += `<div class="note">📺 صفحه‌ی تلویزیون را ببینید. وقتی بازی شروع شد، نقش مخفی‌ات اینجا روی گوشی می‌آید — نگذار کسی ببیند!</div>`;
    return html;
  }

  function roleCard() {
    const c = ch(me.charId);
    if (!ui.roleVisible) {
      return `<button class="veil" data-act="showRole"><span class="big-ic">🤫</span>برای دیدن نقش مخفی‌ات لمس کن<br><span class="muted" style="font-weight:500;font-size:.9rem">مطمئن شو کسی گوشی‌ات را نمی‌بیند</span></button>`;
    }
    let secret;
    if (isKiller()) {
      secret = `<div class="secret killer"><h4>🔪 تو قاتلی!</h4>
        <p>آقابزرگ را با <b>${esc(weapon(me.truth.weapon).name)}</b> در <b>${esc(room(me.truth.room).name)}</b> کشتی.</p>
        <p style="margin-top:.5rem">هر دور یک مدرک جعلی می‌کاری. وانمود کن بی‌گناهی، دروغ بگو و شک را به سمت دیگران ببر. اگر در رأی نهایی بیشترین رأی را نگیری، فرار کرده‌ای.</p></div>`;
    } else {
      secret = `<div class="secret innocent"><h4>🕊️ تو بی‌گناهی</h4>
        <p>قاتل، سلاح و مکان را پیدا کن. بعضی مدارک جعلی‌اند — همه را باور نکن.</p>
        <p style="margin-top:.6rem"><b>مأموریت مخفی: «${esc(me.mission.title)}»</b><br>${esc(me.mission.text)} <span class="muted">(<span class="num">+۲</span> امتیاز)</span></p></div>`;
    }
    return `<div class="role-card" style="--c:${c.color}">
      <div class="role-head">${avatar(pl(me.id))}<div><div class="cn">${esc(c.name)}</div><div class="cr">${esc(c.role)}</div></div></div>
      <div class="role-body"><p class="bio">${esc(c.bio)}</p><div class="traits">${traitTags(me.charId)}</div>${secret}
      <button class="btn ghost" data-act="hideRole">پنهان کن</button></div></div>`;
  }

  function actionIntro() {
    return `<h2 class="prompt">شب حادثه</h2><p class="sub">داستان را روی تلویزیون ببین. این شخصیت توست:</p>${roleCard()}`;
  }

  function roomGrid(selected, act) {
    return `<div class="grid2">${C.rooms.map((r) => `<button class="opt ${selected === r.id ? 'sel' : ''}" data-act="${act}" data-id="${r.id}"><span class="oi">${r.icon}</span><span class="on">${esc(r.name)}</span></button>`).join('')}</div>`;
  }

  function actionSearch() {
    if (isKiller()) {
      if (me.forgeryChoice && ui.lieKey == null) {
        const f = me.forgeryChoice;
        return `<h2 class="prompt">مدرک جعلی کاشته شد</h2>
          <div class="done-box"><b>✓ در ${esc(room(f.roomId).name)}</b>منتظر بقیه…</div>
          <div class="note warn">تو امشب در ${esc(room(f.roomId).name)} دیده شده‌ای. اگر بازجویی شوی، این اتاق لو می‌رود — داستانت را آماده کن.</div>
          <button class="btn ghost" data-act="reforge">تغییر انتخاب</button>`;
      }
      const opts = me.forgeryOptions.map((o) => `<button class="opt lie ${ui.lieKey === o.key ? 'sel' : ''}" data-act="lie" data-key="${esc(o.key)}"><p>«${esc(o.text)}»</p><span class="hint">🎭 ${esc(o.hint)}</span></button>`).join('');
      return `<h2 class="prompt">🔪 وقت جعل مدرک</h2>
        <p class="sub">بقیه دارند اتاق‌ها را می‌گردند. یک دروغ انتخاب کن و جایی بکار. اولین کسی که آن اتاق را بگردد، آن را به‌جای مدرک واقعی پیدا می‌کند.</p>
        <div class="step-label">۱. کدام دروغ؟</div>${opts}
        <div class="step-label">۲. کجا بکاری؟ (تو هم آنجا دیده می‌شوی)</div>${roomGrid(ui.lieRoom, 'lieRoom')}
        <button class="btn primary big" data-act="forge" ${ui.lieKey && ui.lieRoom ? '' : 'disabled'}>بکار</button>`;
    }
    const sel = me.searchChoice;
    return `<h2 class="prompt">کدام اتاق را می‌گردی؟</h2>
      <p class="sub">${sel ? `✓ ${esc(room(sel).name)} — تا وقت تمام نشده می‌توانی عوضش کنی.` : 'یک اتاق انتخاب کن. مدرکی که پیدا می‌کنی فقط برای خودت است.'}</p>
      ${roomGrid(sel, 'search')}`;
  }

  function actionDiscuss() {
    const fresh = me.hand.filter((c) => c.isNew).length;
    return `<h2 class="prompt">گفت‌وگو</h2>
      <p class="sub">${fresh ? `${fa(fresh)} مدرک تازه پیدا کردی — پایین ببین.` : 'مدارکت پایین است.'} حرف بزن، سؤال کن، و هر مدرکی را که خواستی با «نشان بده» روی تلویزیون بفرست.${isKiller() ? ' <b class="gold">مدارک تو جعلی‌اند؛ با احتیاط نشانشان بده.</b>' : ''}</p>`;
  }

  function playerList(selected, act) {
    return `<div class="grid2">${S.players.filter((p) => p.charId && p.id !== me.id).map((p) => `<button class="opt ${selected === p.id ? 'sel' : ''}" data-act="${act}" data-id="${esc(p.id)}">${avatar(p)}<span class="on">${esc(ch(p.charId).name)}<span class="os">${esc(p.name)} <i class="sep"></i> ${traitIcons(p.charId)}</span></span></button>`).join('')}</div>`;
  }

  function actionVote() {
    return `<h2 class="prompt">چه کسی بازجویی شود؟</h2>
      <p class="sub">${me.myVote ? `✓ رأی تو: ${esc(nameOf(me.myVote))} — می‌توانی عوضش کنی.` : 'مشکوک‌ترین نفر را انتخاب کن. اتاق‌هایی که گشته روی تلویزیون لو می‌رود.'}</p>
      ${playerList(me.myVote, 'vote')}`;
  }

  function actionSpotlight() {
    const sp = S.game.spotlight;
    if (sp.playerId === me.id) {
      return `<h2 class="prompt" style="color:var(--pom-bright)">تو زیر نور چراغی!</h2>
        <p class="sub">${fa(sp.votes)} نفر به تو رأی دادند. اتاق‌هایی که گشته‌ای روی تلویزیون است. از خودت دفاع کن!</p>`;
    }
    return `<h2 class="prompt">${esc(nameOf(sp.playerId))} بازجویی می‌شود</h2><p class="sub">به تلویزیون نگاه کن و سؤال‌پیچش کن.</p>`;
  }

  function actionFinal() {
    const f = ui.final;
    const submitted = me.myFinal;
    const head = submitted
      ? `<div class="done-box"><b>✓ اتهام ثبت شد</b>${esc(nameOf(submitted.suspect))} <i class="sep"></i> ${esc(weapon(submitted.weapon).name)} <i class="sep"></i> ${esc(room(submitted.room).name)}<br><span class="muted">تا وقت تمام نشده می‌توانی عوضش کنی.</span></div>` : '';
    return `<h2 class="prompt">اتهام نهایی</h2>
      <p class="sub">${isKiller() ? 'تو هم باید رأی بدهی — یک بی‌گناه را متهم کن.' : 'قاتل درست: <span class="num">+۳</span> <i class="sep"></i> سلاح درست: <span class="num">+۱</span> <i class="sep"></i> مکان درست: <span class="num">+۱</span>'}</p>
      ${head}
      <div class="step-label">قاتل کیست؟</div>${playerList(f.suspect, 'fSuspect')}
      <div class="step-label">با چه سلاحی؟</div>
      <div class="grid2">${C.weapons.map((w) => `<button class="opt ${f.weapon === w.id ? 'sel' : ''}" data-act="fWeapon" data-id="${w.id}"><span class="oi">${w.icon}</span><span class="on">${esc(w.name)}</span></button>`).join('')}</div>
      <div class="step-label">کجا؟</div>${roomGrid(f.room, 'fRoom')}
      <button class="btn primary big" data-act="final" ${f.suspect && f.weapon && f.room ? '' : 'disabled'}>${submitted ? 'به‌روزرسانی اتهام' : 'ثبت اتهام'}</button>`;
  }

  function actionReveal() {
    return `<div class="tv-look"><div class="big-ic">📺</div><h2 class="prompt">به تلویزیون نگاه کن!</h2><p class="sub">حقیقت دارد آشکار می‌شود…</p></div>`;
  }

  function actionResults() {
    const pts = me.myPoints;
    let html = '<h2 class="prompt">نتیجه‌ی تو</h2>';
    if (pts) {
      html += `<div class="points"><div class="total"><span class="num">+${fa(pts.total)}</span></div>${pts.breakdown.length
        ? pts.breakdown.map((b) => `<div class="row"><span>${esc(b.label)}</span><b class="num">+${fa(b.pts)}</b></div>`).join('')
        : '<div class="row"><span>این بار امتیازی نگرفتی.</span><b></b></div>'}</div>`;
    }
    if (me.isVip) {
      html += `<button class="btn primary big" data-act="start">بازی دوباره با همین جمع</button>
        <div class="grid2"><button class="btn" data-act="lobby">سالن انتظار</button><button class="btn" data-act="resetScores">صفر کردن امتیازها</button></div>
        <p class="sub">برای اضافه شدن نفر جدید، به سالن انتظار برگرد.</p>`;
    } else {
      html += '<p class="sub">میزبان دور بعد را شروع می‌کند.</p>';
    }
    return html;
  }

  // ------------------------------------------------------------ tabs
  function tabHand() {
    let html = '';
    if (isKiller() && me.plants && me.plants.length) {
      html += `<div class="sec-title">مدارکی که کاشتی</div>${me.plants.map((p) => `<div class="note warn">دور ${fa(p.round)} <i class="sep"></i> ${esc(room(p.roomId).name)} — ${p.delivered ? '<b>کسی برداشتش!</b>' : 'هنوز همان‌جاست'}</div>`).join('')}
        <div class="note">⚠️ کپی هر مدرک جعلی در دست توست. اگر تو و کسی که پیدایش کرده هر دو یک مدرک را نشان دهید، تکراری بودنش لوت می‌دهد.</div>`;
    }
    const hand = me.hand.slice().reverse();
    if (!hand.length) return `${html}<div class="empty">هنوز مدرکی نداری.<br>در مرحله‌ی بازرسی یک اتاق را بگرد.</div>`;
    const canPin = ['discuss', 'vote', 'spotlight', 'final'].includes(S.phase);
    html += '<div class="sec-title">مدارک من</div>';
    html += hand.map((c) => {
      const nothing = c.kind === 'nothing';
      const tag = c.forged ? '<span class="tag fake">جعلی — فقط تو می‌دانی</span>' : (c.isNew ? '<span class="tag">تازه</span>' : '');
      const btn = nothing ? '' : (c.pinned
        ? '<button class="pinbtn" disabled>✓ روی تلویزیون</button>'
        : `<button class="pinbtn" data-act="pin" data-id="${esc(c.id)}" ${canPin ? '' : 'disabled style="opacity:.4"'}>📺 نشان بده</button>`);
      const hall = c.hallway ? `<div class="hall">🚶 ${esc(C.hallwayNote)}</div>` : '';
      return `<div class="clue ${c.isNew && !nothing ? 'new' : ''} ${nothing ? 'nothing' : ''}" data-cid="${esc(c.id)}">${tag}${hall}<p>${esc(c.text)}</p>
        <div class="meta"><span>دور ${fa(c.round)} <i class="sep"></i> ${esc(room(c.foundIn) ? room(c.foundIn).name : '')}</span>${btn}</div></div>`;
    }).join('');
    return html;
  }

  function tabNotes() {
    const nb = nbGet();
    const mark = (k) => (nb[k] === 'x' ? '✕' : nb[k] === 'q' ? '؟' : '');
    const row = (k, inner) => `<button class="nb-row ${nb[k] || ''}" data-act="nb" data-k="${esc(k)}">${inner}<span class="mark">${mark(k)}</span></button>`;
    const suspects = S.players.filter((p) => p.charId).map((p) => row(`p:${p.id}`,
      `${avatar(p)}<span class="nm">${esc(ch(p.charId).name)}<small>${esc(p.name)}</small></span><span class="ti">${traitIcons(p.charId)}</span>`)).join('');
    const ws = C.weapons.map((w) => row(`w:${w.id}`, `<span class="oi">${w.icon}</span><span class="nm">${esc(w.name)}</span>`)).join('');
    const rs = C.rooms.map((r) => row(`r:${r.id}`, `<span class="oi">${r.icon}</span><span class="nm">${esc(r.name)}</span>`)).join('');
    const legend = C.traits.map((t) => `${t.icon} ${esc(t.name)}`).join(' <i class="sep"></i> ');
    return `<div class="nb-help">لمس کن: ✕ = رد شد <i class="sep"></i> ؟ = مشکوک <i class="sep"></i> دوباره = پاک</div>
      <div class="sec-title">مظنون‌ها</div><div class="nb">${suspects}</div><div class="nb-help">${legend}</div>
      <div class="sec-title">سلاح‌ها</div><div class="nb">${ws}</div>
      <div class="sec-title">اتاق‌ها</div><div class="nb">${rs}</div>`;
  }

  function tabRole() { return roleCard(); }

  // ------------------------------------------------------------ render
  const ACTIONS = {
    lobby: actionLobby, intro: actionIntro, search: actionSearch, discuss: actionDiscuss, vote: actionVote,
    spotlight: actionSpotlight, final: actionFinal, reveal: actionReveal, results: actionResults,
  };

  function vipBar() {
    const bar = $('vipBar');
    const labels = { intro: 'رد کردن مقدمه', search: 'پایان بازرسی', discuss: 'پایان گفت‌وگو', vote: 'پایان رأی‌گیری', spotlight: 'دور بعد', final: 'پایان اتهام', reveal: 'بعدی' };
    if (!me || !me.isVip || !labels[S.phase]) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const confirming = ui.vipConfirm === S.phase;
    setHTML(bar, `<span class="lbl">👑 میزبان</span><button class="btn ${confirming ? 'confirm' : ''}" data-act="vipSkip">${confirming ? 'مطمئنی؟ دوباره بزن' : `⏭ ${labels[S.phase]}`}</button>`);
  }

  function render() {
    if (!C || !S) return;
    const joined = !!me;
    $('join').classList.toggle('hidden', joined);
    $('game').classList.toggle('hidden', !joined);
    if (!joined) {
      $('joinError').textContent = S.phase !== 'lobby' ? 'بازی در جریان است. صبر کن تا دور بعد شروع شود.' : '';
      return;
    }

    const phaseKey = `${S.phase}:${S.round}`;
    if (phaseKey !== ui.lastPhaseKey) {
      // Reset per-phase UI and point the player at what matters now.
      if (S.phase === 'search') { ui.lieKey = null; ui.lieRoom = null; }
      if (S.phase === 'final') ui.final = { suspect: null, weapon: null, room: null };
      if (S.phase === 'discuss') ui.tab = 'hand';
      if (S.phase === 'intro') { ui.roleVisible = false; ui.tab = 'role'; }
      ui.vipConfirm = null;
      if (['search', 'vote', 'final'].includes(S.phase) || (S.phase === 'spotlight' && S.game.spotlight.playerId === me.id)) buzz(120);
      ui.lastPhaseKey = phaseKey;
      window.scrollTo(0, 0);
    }

    const meP = pl(me.id);
    const c = me.charId ? ch(me.charId) : null;
    setHTML($('meChip'), `${avatar(meP)}<div style="min-width:0"><div class="t1">${esc(me.name)}${me.isVip ? ' 👑' : ''}</div><div class="t2">${c ? esc(c.name) : `${fa(meP ? meP.score : 0)} امتیاز`}</div></div>`);
    $('phPhase').textContent = C.phaseTitles[S.phase] || '';
    $('phRound').textContent = S.round ? `دور ${fa(S.round)} از ${fa(S.totalRounds)}` : '';

    const playing = inGame();
    setHTML($('action'), (playing || S.phase === 'lobby') ? ACTIONS[S.phase]() : '<p class="sub">بازی در جریان است…</p>');

    if (playing && S.phase !== 'intro') {
      const fresh = me.hand.filter((x) => x.isNew).length;
      setHTML($('tabs'), [['hand', `مدارک${fresh ? `<span class="badge">${fa(fresh)}</span>` : ''}`], ['notes', 'دفترچه'], ['role', 'نقش من']]
        .map(([k, l]) => `<button data-act="tab" data-id="${k}" class="${ui.tab === k ? 'sel' : ''}">${l}</button>`).join(''));
      setHTML($('tabBody'), ui.tab === 'notes' ? tabNotes() : ui.tab === 'role' ? tabRole() : tabHand());
      // Entrance animation once per card, applied to the DOM so the markup
      // (and therefore the diff) stays stable.
      $('tabBody').querySelectorAll('.clue[data-cid]').forEach((el) => {
        if (animated.has(el.dataset.cid)) return;
        animated.add(el.dataset.cid);
        el.classList.add('enter');
      });
    } else {
      setHTML($('tabs'), '');
      setHTML($('tabBody'), '');
    }
    vipBar();
  }

  // ------------------------------------------------------------ events
  const handlers = {
    start: () => send('vip:start'),
    lobby: () => send('vip:lobby'),
    resetScores: () => send('vip:resetScores'),
    kick: (el) => send('vip:kick', { targetId: el.dataset.id }),
    setting: (el) => send('vip:setting', { key: 'discussSeconds', value: Number(el.dataset.v) }),
    vipSkip: () => {
      if (ui.vipConfirm === S.phase || S.phase === 'reveal') {
        ui.vipConfirm = null;
        send(S.phase === 'reveal' ? 'vip:next' : 'vip:skip');
      } else {
        ui.vipConfirm = S.phase;
        setTimeout(() => { if (ui.vipConfirm) { ui.vipConfirm = null; render(); } }, 3000);
      }
      render();
    },
    showRole: () => {
      ui.roleVisible = true;
      clearTimeout(ui.roleTimer);
      ui.roleTimer = setTimeout(() => { ui.roleVisible = false; render(); }, 15000);
      render();
    },
    hideRole: () => { ui.roleVisible = false; render(); },
    tab: (el) => { ui.tab = el.dataset.id; if (ui.tab !== 'role') ui.roleVisible = false; render(); },
    search: (el) => { buzz(30); send('act:search', { roomId: el.dataset.id }); },
    lie: (el) => { ui.lieKey = el.dataset.key; render(); },
    lieRoom: (el) => { ui.lieRoom = el.dataset.id; render(); },
    forge: () => {
      if (!ui.lieKey || !ui.lieRoom) return;
      send('act:forge', { key: ui.lieKey, roomId: ui.lieRoom });
      ui.lieKey = null; ui.lieRoom = null; buzz(30);
    },
    reforge: () => { ui.lieKey = me.forgeryChoice.key; ui.lieRoom = me.forgeryChoice.roomId; render(); },
    pin: (el) => { buzz(30); send('act:pin', { cardId: el.dataset.id }); },
    vote: (el) => { buzz(30); send('act:vote', { targetId: el.dataset.id }); },
    fSuspect: (el) => { ui.final.suspect = el.dataset.id; render(); },
    fWeapon: (el) => { ui.final.weapon = el.dataset.id; render(); },
    fRoom: (el) => { ui.final.room = el.dataset.id; render(); },
    final: () => { buzz(40); send('act:final', { ...ui.final }); },
    nb: (el) => nbCycle(el.dataset.k),
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = handlers[el.dataset.act];
    if (fn) fn(el);
  });

  $('nameInput').value = store.get('ziafat:name', '') || '';
  $('joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('nameInput').value.trim();
    if (!name) { $('joinError').textContent = 'اسمت را بنویس.'; return; }
    store.set('ziafat:name', name);
    socket.emit('player:join', { id: myId, name }, (res) => {
      if (!res || !res.ok) $('joinError').textContent = (res && res.error) || 'خطا';
    });
  });

  socket.on('connect', () => {
    $('offline').classList.add('hidden');
    socket.emit('player:hello', { id: myId }, () => {});
  });
  socket.on('disconnect', () => $('offline').classList.remove('hidden'));
  socket.on('content', (c) => { C = c; render(); });
  socket.on('state', (s) => {
    S = s; me = s.me;
    syncClock(s.serverNow); setTimer(s.timer);
    // When the final vote is already on the server, mirror it so "update" works.
    if (me && me.myFinal && S.phase === 'final' && !ui.final.suspect) ui.final = { ...me.myFinal };
    render();
  });
})();
