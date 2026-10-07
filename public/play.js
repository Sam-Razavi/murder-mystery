/* Phone controller: each player's private screen. */
(function () {
  const { num, t, setLang, esc, store, makeId, syncClock, setTimer } = window.Z;
  const socket = io();
  const $ = (id) => document.getElementById(id);

  let ALL = null; // story content in both languages: { fa, en }
  let C = null; // ...the bundle for the current language
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
    secret: [], // items mode: targets picked for the secret action
  };

  const ch = (id) => C.characters.find((c) => c.id === id);
  const pl = (id) => S.players.find((p) => p.id === id);
  const room = (id) => C.rooms.find((r) => r.id === id);
  const weapon = (id) => C.weapons.find((w) => w.id === id);
  const item = (id) => C.items.find((x) => x.id === id) || { icon: '❔', name: t('؟') };
  // Illustrated item (public/art.js); `anim` only on big displays.
  const art = (id, anim = false) => (window.Art && Art.has(id) ? Art.item(id, { anim, title: item(id).name }) : item(id).icon);
  const itemTag = (id) => `<b class="itm">${art(id)} ${esc(item(id).name)}</b>`;
  // Illustration for a weapon, room or trait (public/art.js), falling back to its emoji.
  const artOf = (o, anim = false) => (o && window.Art && Art.has(o.id) ? Art.item(o.id, { anim, title: o.name }) : (o ? o.icon : ''));
  const itemsMode = () => S && S.mode === 'items';
  const phaseTitles = () => (itemsMode() ? C.itemPhaseTitles : C.phaseTitles);
  const SEAT_COLORS = ['#c9a227', '#e0335c', '#2fb3a6', '#7b6fd0', '#d77ab3', '#6a9a4b', '#d9823b', '#4a9fb5'];

  function avatar(p) {
    if (!p) return '';
    const color = p.charId ? ch(p.charId).color : SEAT_COLORS[Math.max(0, S.players.indexOf(p)) % 8];
    // Illustrated face (public/faces.js): the character in classic, else the portrait.
    const face = window.Art && (p.charId ? Art.character(p.charId) : p.portrait ? Art.portrait(p.portrait) : '');
    if (face) return `<span class="avatar has-face" style="background:${color}">${face}</span>`;
    if (!p.charId && p.portrait) return `<span class="avatar pt" style="background:${color}">${esc(p.portrait)}</span>`;
    const letter = p.charId ? ch(p.charId).name.replace('دکتر ', '').replace('Dr. ', '').replace('خانم‌جان', 'خ')[0] : (p.name || t('؟'))[0];
    return `<span class="avatar" style="background:${color}">${esc(letter)}</span>`;
  }
  const nameOf = (pid) => { const p = pl(pid); return p ? (p.charId ? `${ch(p.charId).name} (${p.name})` : p.name) : t('؟'); };
  const traitIcons = (charId) => C.traits.filter((t, i) => ch(charId).traits[i]).map((t) => artOf(t)).join('');
  const traitTags = (charId) => C.traits.map((t, i) => ch(charId).traits[i]
    ? `<span class="trait">${artOf(t)} ${esc(t.name)}</span>` : `<span class="trait no">${esc(t.name)}</span>`).join('');

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

  // A row of host-setting buttons for one setting key.
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="setting" data-k="${key}" data-v="${v}" class="${S.settings[key] === v ? 'sel' : ''}">${l}</button>`).join('')}</div>`;

  function actionLobby() {
    const n = S.players.length;
    const online = S.players.filter((p) => p.connected);
    const waiting = online.filter((p) => !p.ready).length;
    const tooMany = n > S.modeMax; // classic takes at most 8
    const allReady = n >= S.minPlayers && waiting === 0 && !tooMany;
    const meReady = !!(pl(me.id) && pl(me.id).ready);
    let html = `<h2 class="prompt">${me ? t('به مهمانی خوش آمدی!') : ''}</h2>
      <p class="sub">${n < S.minPlayers ? t('منتظر بقیه‌ایم — دست‌کم {min} نفر لازم است (الان {n} نفر).', { min: S.minPlayers, n })
        : waiting ? t('{n} نفر هنوز «آماده‌ام» را نزده‌اند.', { n: waiting }) : t('همه آماده‌اند. میزبان بازی را شروع می‌کند.')}</p>
      ${meReady ? '' : `<div class="step-label">${t('چهره‌ات را انتخاب کن')}</div>
      <div class="portraits">${C.portraits.map((x) => {
        const mine = pl(me.id) && pl(me.id).portrait === x;
        const taken = !mine && S.players.some((p) => p.portrait === x);
        return `<button class="pt-opt ${mine ? 'sel' : ''}" data-act="portrait" data-v="${esc(x)}" ${taken ? 'disabled' : ''}>${(window.Art && Art.portrait(x)) || esc(x)}</button>`;
      }).join('')}</div>`}
      <button class="btn big ${meReady ? 'ready-on' : 'gold'}" data-act="ready" data-v="${meReady ? '0' : '1'}">${meReady ? t('✓ آماده‌ای — برای لغو لمس کن') : t('آماده‌ام!')}</button>
      <div class="players-mini">${S.players.map((p) => `<span class="pm ${p.connected ? '' : 'off'} ${p.ready ? 'rdy' : ''}">${avatar(p)}${esc(p.name)}${p.id === S.vipId ? ' 👑' : ''}${p.ready ? ' ✓' : ''}
        ${me && me.isVip && !p.connected && p.id !== me.id ? `<button data-act="kick" data-id="${esc(p.id)}">${t('حذف')}</button>` : ''}</span>`).join('')}</div>`;
    const mode = C.modes.find((m) => m.id === S.settings.mode) || C.modes[0];
    if (me && me.isVip) {
      const guideSteps = (window.Guide && Guide.steps) || 6;
      const guide = S.tutorial == null
        ? `<button class="btn big" data-act="tutorial" data-v="open">${t('📖 آموزش بازی روی تلویزیون')}</button>`
        : `<div class="note"><b>${t('اسلاید {n} از {total}', { n: S.tutorial + 1, total: guideSteps })}</b> — ${t('روی تلویزیون نمایش داده می‌شود.')}</div>
          <div class="seg">
            <button data-act="tutorial" data-v="prev" ${S.tutorial === 0 ? 'disabled' : ''}>${t('قبلی')}</button>
            <button data-act="tutorial" data-v="next" class="sel" ${S.tutorial >= guideSteps - 1 ? 'disabled' : ''}>${t('بعدی')}</button>
            <button data-act="tutorial" data-v="close">${t('بستن آموزش')}</button>
          </div>`;
      html += `<div class="step-label">${t('👑 تو میزبانی')}</div>
        ${guide}
        <div class="sub">${t('زبان بازی')}</div>${seg('lang', [['fa', 'فارسی'], ['en', 'English']])}
        <div class="sub">${t('کدام بازی؟')}</div>
        <div class="seg">${C.modes.map((m) => `<button data-act="setMode" data-v="${m.id}" class="${mode.id === m.id ? 'sel' : ''}">${esc(m.name)}</button>`).join('')}</div>
        <div class="note">${esc(mode.text)}</div>
        ${mode.id === 'items' ? `<div class="sub">${t('تعداد دورهای پچ‌پچ (هر ۲ دور یک گفت‌وگو)')}</div>${seg('itemRounds', [[4, t('{n} — کوتاه', { n: 4 })], [6, num(6)], [8, t('{n} — بلند', { n: 8 })]])}
        <div class="sub">${t('زمان جواب دادن در هر دور')}</div>${seg('gossipSeconds', [30, 40, 60].map((v) => [v, t('{n} ثانیه', { n: v })]))}
        <div class="sub">${t('دورهای بی‌صدا: گاهی هیچ‌کس کار مخفی نمی‌گیرد')}</div>${seg('quietRounds', [[false, t('خاموش')], [true, t('روشن')]])}
        <div class="sub">${t('قاتل‌ها هم‌دیگر را می‌شناسند (از ۵ نفر به بالا)')}</div>${seg('killersKnow', [[false, t('خاموش')], [true, t('روشن')]])}` : ''}
        <div class="sub">${t('زمان هر گفت‌وگو')}</div>${seg('discussSeconds', [[90, `${num(1)}:${num(30)}`], [150, `${num(2)}:${num(30)}`], [240, `${num(4)}:${num('00')}`]])}
        ${tooMany ? `<div class="note warn">${t('بازی کلاسیک حداکثر ۸ نفره است — حالت دست‌به‌دست را انتخاب کنید.')}</div>` : ''}
        <button class="btn primary big" data-act="start" ${allReady ? '' : 'disabled'}>${allReady ? t('شروع بازی') : tooMany ? t('برای بازی کلاسیک زیادیم') : t('منتظر آماده شدن همه…')}</button>`;
    }
    else html += `<div class="note"><b>${t('بازی: {name}', { name: esc(mode.name) })}</b> — ${esc(mode.text)}</div>`
      + (S.tutorial != null ? `<div class="note warn">${t('📺 به تلویزیون نگاه کن — میزبان دارد قوانین را توضیح می‌دهد.')}</div>` : '');
    html += `<div class="note">${t('📺 صفحه‌ی تلویزیون را ببینید. وقتی بازی شروع شد، نقش مخفی‌ات اینجا روی گوشی می‌آید — نگذار کسی ببیند!')}</div>`;
    return html;
  }

  function roleCard() {
    const c = ch(me.charId);
    if (!ui.roleVisible) {
      return `<button class="veil" data-act="showRole"><span class="big-ic">🤫</span>${t('برای دیدن نقش مخفی‌ات لمس کن')}<br><span class="muted" style="font-weight:500;font-size:.9rem">${t('مطمئن شو کسی گوشی‌ات را نمی‌بیند')}</span></button>`;
    }
    let secret;
    if (isKiller()) {
      secret = `<div class="secret killer"><h4>${t('🔪 تو قاتلی!')}</h4>
        <p>${t('آقابزرگ را با <b>{w}</b> در <b>{r}</b> کشتی.', { w: esc(weapon(me.truth.weapon).name), r: esc(room(me.truth.room).name) })}</p>
        <p style="margin-top:.5rem">${t('هر دور یک مدرک جعلی می‌کاری. وانمود کن بی‌گناهی، دروغ بگو و شک را به سمت دیگران ببر. اگر در رأی نهایی بیشترین رأی را نگیری، فرار کرده‌ای.')}</p></div>`;
    } else {
      secret = `<div class="secret innocent"><h4>${t('🕊️ تو بی‌گناهی')}</h4>
        <p>${t('قاتل، سلاح و مکان را پیدا کن. بعضی مدارک جعلی‌اند — همه را باور نکن.')}</p>
        <p style="margin-top:.6rem"><b>${t('مأموریت مخفی: «{title}»', { title: esc(me.mission.title) })}</b><br>${esc(me.mission.text)} <span class="muted">(${t('{p} امتیاز', { p: `<span class="num">+${num(2)}</span>` })})</span></p></div>`;
    }
    return `<div class="role-card" style="--c:${c.color}">
      <div class="role-head">${avatar(pl(me.id))}<div><div class="cn">${esc(c.name)}</div><div class="cr">${esc(c.role)}</div></div></div>
      <div class="role-body"><p class="bio">${esc(c.bio)}</p><div class="traits">${traitTags(me.charId)}</div>${secret}
      <button class="btn ghost" data-act="hideRole">${t('پنهان کن')}</button></div></div>`;
  }

  function actionIntro() {
    return `<h2 class="prompt">${esc(C.phaseTitles.intro)}</h2><p class="sub">${t('داستان را روی تلویزیون ببین. این شخصیت توست:')}</p>${roleCard()}`;
  }

  function roomGrid(selected, act) {
    return `<div class="grid2">${C.rooms.map((r) => `<button class="opt ${selected === r.id ? 'sel' : ''}" data-act="${act}" data-id="${r.id}"><span class="oi">${artOf(r)}</span><span class="on">${esc(r.name)}</span></button>`).join('')}</div>`;
  }

  function actionSearch() {
    if (isKiller()) {
      if (me.forgeryChoice && ui.lieKey == null) {
        const f = me.forgeryChoice;
        return `<h2 class="prompt">${t('مدرک جعلی کاشته شد')}</h2>
          <div class="done-box"><b>${t('✓ در {r}', { r: esc(room(f.roomId).name) })}</b>${t('منتظر بقیه…')}</div>
          <div class="note warn">${t('تو امشب در {r} دیده شده‌ای. اگر بازجویی شوی، این اتاق لو می‌رود — داستانت را آماده کن.', { r: esc(room(f.roomId).name) })}</div>
          <button class="btn ghost" data-act="reforge">${t('تغییر انتخاب')}</button>`;
      }
      const opts = me.forgeryOptions.map((o) => `<button class="opt lie ${ui.lieKey === o.key ? 'sel' : ''}" data-act="lie" data-key="${esc(o.key)}"><p>«${esc(o.text)}»</p><span class="hint">🎭 ${esc(o.hint)}</span></button>`).join('');
      return `<h2 class="prompt">${t('🔪 وقت جعل مدرک')}</h2>
        <p class="sub">${t('بقیه دارند اتاق‌ها را می‌گردند. یک دروغ انتخاب کن و جایی بکار. اولین کسی که آن اتاق را بگردد، آن را به‌جای مدرک واقعی پیدا می‌کند.')}</p>
        <div class="step-label">${t('۱. کدام دروغ؟')}</div>${opts}
        <div class="step-label">${t('۲. کجا بکاری؟ (تو هم آنجا دیده می‌شوی)')}</div>${roomGrid(ui.lieRoom, 'lieRoom')}
        <button class="btn primary big" data-act="forge" ${ui.lieKey && ui.lieRoom ? '' : 'disabled'}>${t('بکار')}</button>`;
    }
    const sel = me.searchChoice;
    return `<h2 class="prompt">${t('کدام اتاق را می‌گردی؟')}</h2>
      <p class="sub">${sel ? t('✓ {r} — تا وقت تمام نشده می‌توانی عوضش کنی.', { r: esc(room(sel).name) }) : t('یک اتاق انتخاب کن. مدرکی که پیدا می‌کنی فقط برای خودت است.')}</p>
      ${roomGrid(sel, 'search')}`;
  }

  function actionDiscuss() {
    const fresh = me.hand.filter((c) => c.isNew).length;
    return `<h2 class="prompt">${esc(C.phaseTitles.discuss)}</h2>
      <p class="sub">${fresh ? t('{n} مدرک تازه پیدا کردی — پایین ببین.', { n: fresh }) : t('مدارکت پایین است.')} ${t('حرف بزن، سؤال کن، و هر مدرکی را که خواستی با «نشان بده» روی تلویزیون بفرست.')}${isKiller() ? ` <b class="gold">${t('مدارک تو جعلی‌اند؛ با احتیاط نشانشان بده.')}</b>` : ''}</p>`;
  }

  function playerList(selected, act) {
    const sel = [].concat(selected || []);
    return `<div class="grid2">${S.players.filter((p) => p.inGame && p.id !== me.id).map((p) => `<button class="opt ${sel.includes(p.id) ? 'sel' : ''}" data-act="${act}" data-id="${esc(p.id)}">${avatar(p)}<span class="on">${p.charId
      ? `${esc(ch(p.charId).name)}<span class="os">${esc(p.name)} <i class="sep"></i> ${traitIcons(p.charId)}</span>`
      : esc(p.name)}</span></button>`).join('')}</div>`;
  }

  function actionVote() {
    return `<h2 class="prompt">${t('چه کسی بازجویی شود؟')}</h2>
      <p class="sub">${me.myVote ? t('✓ رأی تو: {name} — می‌توانی عوضش کنی.', { name: esc(nameOf(me.myVote)) }) : t('مشکوک‌ترین نفر را انتخاب کن. اتاق‌هایی که گشته روی تلویزیون لو می‌رود.')}</p>
      ${playerList(me.myVote, 'vote')}`;
  }

  function actionSpotlight() {
    const sp = S.game.spotlight;
    if (sp.playerId === me.id) {
      return `<h2 class="prompt" style="color:var(--pom-bright)">${t('تو زیر نور چراغی!')}</h2>
        <p class="sub">${t('{n} نفر به تو رأی دادند. اتاق‌هایی که گشته‌ای روی تلویزیون است. از خودت دفاع کن!', { n: sp.votes })}</p>`;
    }
    return `<h2 class="prompt">${t('{name} بازجویی می‌شود', { name: esc(nameOf(sp.playerId)) })}</h2><p class="sub">${t('به تلویزیون نگاه کن و سؤال‌پیچش کن.')}</p>`;
  }

  function actionFinal() {
    const f = ui.final;
    const submitted = me.myFinal;
    const head = submitted
      ? `<div class="done-box"><b>${t('✓ اتهام ثبت شد')}</b>${esc(nameOf(submitted.suspect))} <i class="sep"></i> ${esc(weapon(submitted.weapon).name)} <i class="sep"></i> ${esc(room(submitted.room).name)}<br><span class="muted">${t('تا وقت تمام نشده می‌توانی عوضش کنی.')}</span></div>` : '';
    const pts = (n) => `<span class="num">+${num(n)}</span>`;
    return `<h2 class="prompt">${esc(C.phaseTitles.final)}</h2>
      <p class="sub">${isKiller() ? t('تو هم باید رأی بدهی — یک بی‌گناه را متهم کن.') : `${t('قاتل درست:')} ${pts(3)} <i class="sep"></i> ${t('سلاح درست:')} ${pts(1)} <i class="sep"></i> ${t('مکان درست:')} ${pts(1)}`}</p>
      ${head}
      <div class="step-label">${t('قاتل کیست؟')}</div>${playerList(f.suspect, 'fSuspect')}
      <div class="step-label">${t('با چه سلاحی؟')}</div>
      <div class="grid2">${C.weapons.map((w) => `<button class="opt ${f.weapon === w.id ? 'sel' : ''}" data-act="fWeapon" data-id="${w.id}"><span class="oi">${artOf(w)}</span><span class="on">${esc(w.name)}</span></button>`).join('')}</div>
      <div class="step-label">${t('کجا؟')}</div>${roomGrid(f.room, 'fRoom')}
      <button class="btn primary big" data-act="final" ${f.suspect && f.weapon && f.room ? '' : 'disabled'}>${submitted ? t('به‌روزرسانی اتهام') : t('ثبت اتهام')}</button>`;
  }

  function actionReveal() {
    return `<div class="tv-look"><div class="big-ic">📺</div><h2 class="prompt">${t('به تلویزیون نگاه کن!')}</h2><p class="sub">${t('حقیقت دارد آشکار می‌شود…')}</p></div>`;
  }

  function actionResults() {
    const pts = me.myPoints;
    let html = `<h2 class="prompt">${t('نتیجه‌ی تو')}</h2>`;
    if (pts) {
      html += `<div class="points"><div class="total"><span class="num">+${num(pts.total)}</span></div>${pts.breakdown.length
        ? pts.breakdown.map((b) => `<div class="row"><span>${esc(b.label)}</span><b class="num">+${num(b.pts)}</b></div>`).join('')
        : `<div class="row"><span>${t('این بار امتیازی نگرفتی.')}</span><b></b></div>`}</div>`;
    }
    if (me.isVip) {
      html += `<button class="btn primary big" data-act="start">${t('بازی دوباره با همین جمع')}</button>
        <div class="grid2"><button class="btn" data-act="lobby">${t('سالن انتظار')}</button><button class="btn" data-act="resetScores">${t('صفر کردن امتیازها')}</button></div>
        <p class="sub">${t('برای اضافه شدن نفر جدید، به سالن انتظار برگرد.')}</p>`;
    } else {
      html += `<p class="sub">${t('میزبان دور بعد را شروع می‌کند.')}</p>`;
    }
    return html;
  }

  // ------------------------------------------------------------ tabs
  function tabHand() {
    let html = '';
    if (isKiller() && me.plants && me.plants.length) {
      html += `<div class="sec-title">${t('مدارکی که کاشتی')}</div>${me.plants.map((p) => `<div class="note warn">${t('دور {n}', { n: p.round })} <i class="sep"></i> ${esc(room(p.roomId).name)} — ${p.delivered ? `<b>${t('کسی برداشتش!')}</b>` : t('هنوز همان‌جاست')}</div>`).join('')}
        <div class="note">${t('⚠️ کپی هر مدرک جعلی در دست توست. اگر تو و کسی که پیدایش کرده هر دو یک مدرک را نشان دهید، تکراری بودنش لوت می‌دهد.')}</div>`;
    }
    const hand = me.hand.slice().reverse();
    if (!hand.length) return `${html}<div class="empty">${t('هنوز مدرکی نداری.')}<br>${t('در مرحله‌ی بازرسی یک اتاق را بگرد.')}</div>`;
    const canPin = ['discuss', 'vote', 'spotlight', 'final'].includes(S.phase);
    html += `<div class="sec-title">${t('مدارک من')}</div>`;
    html += hand.map((c) => {
      const nothing = c.kind === 'nothing';
      const tag = c.forged ? `<span class="tag fake">${t('جعلی — فقط تو می‌دانی')}</span>` : (c.isNew ? `<span class="tag">${t('تازه')}</span>` : '');
      const btn = nothing ? '' : (c.pinned
        ? `<button class="pinbtn" disabled>${t('✓ روی تلویزیون')}</button>`
        : `<button class="pinbtn" data-act="pin" data-id="${esc(c.id)}" ${canPin ? '' : 'disabled style="opacity:.4"'}>${t('📺 نشان بده')}</button>`);
      const hall = c.hallway ? `<div class="hall">🚶 ${esc(C.hallwayNote)}</div>` : '';
      return `<div class="clue ${c.isNew && !nothing ? 'new' : ''} ${nothing ? 'nothing' : ''}" data-cid="${esc(c.id)}">${tag}${hall}<p>${esc(c.text)}</p>
        <div class="meta"><span>${t('دور {n}', { n: c.round })} <i class="sep"></i> ${esc(room(c.foundIn) ? room(c.foundIn).name : '')}</span>${btn}</div></div>`;
    }).join('');
    return html;
  }

  function tabNotes() {
    const nb = nbGet();
    const mark = (k) => (nb[k] === 'x' ? '✕' : nb[k] === 'q' ? t('؟') : '');
    const row = (k, inner) => `<button class="nb-row ${nb[k] || ''}" data-act="nb" data-k="${esc(k)}">${inner}<span class="mark">${mark(k)}</span></button>`;
    const suspects = S.players.filter((p) => p.charId).map((p) => row(`p:${p.id}`,
      `${avatar(p)}<span class="nm">${esc(ch(p.charId).name)}<small>${esc(p.name)}</small></span><span class="ti">${traitIcons(p.charId)}</span>`)).join('');
    const ws = C.weapons.map((w) => row(`w:${w.id}`, `<span class="oi">${artOf(w)}</span><span class="nm">${esc(w.name)}</span>`)).join('');
    const rs = C.rooms.map((r) => row(`r:${r.id}`, `<span class="oi">${artOf(r)}</span><span class="nm">${esc(r.name)}</span>`)).join('');
    const legend = C.traits.map((t) => `${artOf(t)} ${esc(t.name)}`).join(' <i class="sep"></i> ');
    return `<div class="nb-help">${t('لمس کن: ✕ = رد شد')} <i class="sep"></i> ${t('؟ = مشکوک')} <i class="sep"></i> ${t('دوباره = پاک')}</div>
      <div class="sec-title">${t('مظنون‌ها')}</div><div class="nb">${suspects}</div><div class="nb-help">${legend}</div>
      <div class="sec-title">${t('سلاح‌ها')}</div><div class="nb">${ws}</div>
      <div class="sec-title">${t('اتاق‌ها')}</div><div class="nb">${rs}</div>`;
  }

  function tabRole() { return roleCard(); }


  // ------------------------------------------------------------ items mode («دست‌به‌دست»)
  const shortName = (pid) => esc(pl(pid) ? pl(pid).name : t('؟'));

  function itemCard() {
    if (!ui.roleVisible) {
      return `<button class="veil" data-act="showRole"><span class="big-ic">🤫</span>${t('برای دیدن چیزی که دستت است لمس کن')}<br><span class="muted" style="font-weight:500;font-size:.9rem">${t('مطمئن شو کسی گوشی‌ات را نمی‌بیند')}</span></button>`;
    }
    const killer = isKiller();
    const moved = me.item !== me.startItem;
    const secret = killer
      ? `<div class="secret killer"><h4>${t('🔪 تو قاتلی!')}</h4><p>${t('شب را با چاقو شروع کردی.')} ${me.partners && me.partners.length
        ? (me.partners.length > 1
          ? t('شریک‌های جرمت <b>{names}</b> هستند — آن‌ها هم تو را می‌شناسند.', { names: me.partners.map(shortName).join(t(' و ')) })
          : t('شریک جرمت <b>{name}</b> است — او هم تو را می‌شناسد.', { name: shortName(me.partners[0]) }))
        : S.game.killerCount > 1 ? t('{n} قاتل دیگر هم هست — اما نمی‌دانی کیست.', { n: S.game.killerCount - 1 }) : ''}
         ${t('کاری کن در رأی نهایی بیشترین رأی به تو نرسد. بگذار ردّ چاقو گم شود.')}</p></div>`
      : `<div class="secret innocent"><h4>${t('🕊️ تو بی‌گناهی')}</h4><p>${t('شب را با {item} شروع کردی.', { item: itemTag(me.startItem) })}
         ${t('بفهم چه کسی شب را با چاقو شروع کرد و در رأی نهایی همه با هم به او رأی بدهید.')}</p></div>`;
    return `<div class="role-card item-card">
      <div class="item-now"><div class="lbl">${t('الان دستت است')}</div><div class="big flip">${art(me.item, true)}</div><div class="nm">${esc(item(me.item).name)}</div>
        ${moved ? `<div class="was">${t('شروع شب:')} ${itemTag(me.startItem)}</div>` : ''}</div>
      <div class="role-body">${secret}
      <div class="note">${t('⚠️ نقشت را چیزِ <b>اولِ شب</b> تعیین می‌کند، نه چیزی که الان دستت است.')}</div>
      <button class="btn ghost" data-act="hideRole">${t('پنهان کن')}</button></div></div>`;
  }

  function noteText(n) {
    const auto = n.auto ? ` <span class="muted">${t('(وقت تمام شد؛ بازی خودش انتخاب کرد)')}</span>` : '';
    switch (n.type) {
      case 'start': return t('شب را با {item} شروع کردی.', { item: itemTag(n.item) });
      case 'snoop': return t('🕵️ سرک کشیدی: دستِ <b>{name}</b> {item} بود.', { name: shortName(n.targetId), item: itemTag(n.item) }) + auto;
      case 'swap': return t('🔄 با <b>{name}</b> معاوضه شدی: {gave} دادی و {got} گرفتی.', { name: shortName(n.targetId), gave: itemTag(n.gave), got: itemTag(n.got) }) + auto;
      case 'steal': return t('🫳 از <b>{name}</b> دزدیدی: {got} را برداشتی و {gave} را جایش گذاشتی.', { name: shortName(n.targetId), gave: itemTag(n.gave), got: itemTag(n.got) }) + auto;
      case 'shuffle': return t('🔀 چیزهای <b>{a}</b> و <b>{b}</b> را با هم جابه‌جا کردی.', { a: shortName(n.a), b: shortName(n.b) }) + auto;
      case 'changed': return t('❗ چیزت عوض شد! {from} رفت و {to} آمد. نمی‌دانی کار چه کسی بود.', { from: itemTag(n.from), to: itemTag(n.to) });
      default: return '';
    }
  }

  const journalKey = () => `ziafat:seen:${S.game ? S.game.id : 'x'}`;
  const unseenNotes = () => Math.max(0, (me.notes || []).length - store.get(journalKey(), 1));

  function tabJournal() {
    if (!ui.roleVisible) return itemCard();
    store.set(journalKey(), me.notes.length);
    return `<div class="sec-title">${t('دفترچه‌ی مخفی')}</div>
      <div class="nb-help">${t('فقط تو این‌ها را می‌بینی. می‌توانی راستش را بگویی، پنهانش کنی، یا دروغ بگویی.')}</div>
      ${me.notes.slice().reverse().map((n) => `<div class="jn ${n.type}"><span class="r">${n.round ? t('دور {n}', { n: n.round }) : t('شروع')}</span><p>${noteText(n)}</p></div>`).join('')}
      <button class="btn ghost" data-act="hideRole">${t('پنهان کن')}</button>`;
  }

  function tabTracker() {
    const nb = nbGet();
    const mark = (k) => (nb[k] === 'x' ? '✕' : nb[k] === 'q' ? '🔪' : '');
    const rows = S.players.filter((p) => p.inGame).map((p) => {
      const k = `p:${p.id}`;
      return `<button class="nb-row ${nb[k] || ''}" data-act="nb" data-k="${esc(k)}">${avatar(p)}<span class="nm">${esc(p.name)}${p.id === me.id ? `<small>${t('(خودت)')}</small>` : ''}</span><span class="mark">${mark(k)}</span></button>`;
    }).join('');
    return `<div class="nb-help">${t('لمس کن: 🔪 = فکر می‌کنم با چاقو شروع کرد')} <i class="sep"></i> ${t('✕ = بی‌گناه')} <i class="sep"></i> ${t('دوباره = پاک')}</div>
      <div class="sec-title">${t('چه کسی شب را با چاقو شروع کرد؟')}</div><div class="nb">${rows}</div>
      <div class="note">${t('در این بازی {n} قاتل هست. چیزهای در بازی:', { n: S.game.killerCount })} ${S.game.items.map((x) => art(x)).join(' ')}</div>`;
  }

  function secretBlock() {
    const tn = me.turn;
    const a = C.secretActions[tn.type];
    const head = `<div class="secret-box"><div class="sb-head"><span class="sb-ic">${a.icon}</span><div><div class="sb-t">${t('کار مخفی: {name}', { name: esc(a.name) })}</div><div class="sb-d">${esc(a.text)}</div></div></div>`;
    if (tn.done) {
      let body;
      if (tn.type === 'snoop' && tn.result) body = `<div class="done-box"><b>${t('دستِ {name}:', { name: shortName(tn.result.targetId) })}</b><span class="big-item flip">${art(tn.result.item, true)}</span> ${esc(item(tn.result.item).name)}</div>`;
      else body = `<div class="done-box"><b>${t('✓ انجام شد')}</b>${t('در پایان همین دور اعمال می‌شود. نتیجه در دفترچه‌ی مخفی‌ات می‌آید.')}</div>`;
      return `${head}${body}</div>`;
    }
    const need = tn.type === 'shuffle' ? 2 : tn.type === 'swap' ? 0 : 1;
    const ready = ui.secret.length === need;
    const label = t({ snoop: 'سرک بکش', swap: 'معاوضه کن', steal: 'بدزد', shuffle: 'جابه‌جا کن' }[tn.type]);
    const pickText = need === 2 ? t('دو نفر را انتخاب کن ({n} از ۲)', { n: ui.secret.length }) : need === 1 ? t('یک نفر را انتخاب کن') : t('طرف معاوضه را بازی تصادفی انتخاب می‌کند.');
    return `${head}<div class="sub">${pickText}</div>${need ? playerList(ui.secret, 'secretPick') : ''}
      <button class="btn gold big" data-act="secretGo" ${ready ? '' : 'disabled'}>${a.icon} ${label}</button>
      <div class="note warn">${t('🤫 پنهانی! بقیه نباید بفهمند این دور کار مخفی به تو رسیده. بعدش به سؤال پایین هم جواب بده.')}</div></div>`;
  }

  function itActionIntro() {
    return `<h2 class="prompt">${esc(C.itemPhaseTitles.intro)}</h2><p class="sub">${t('قوانین روی تلویزیون است. این چیزی است که شب را با آن شروع می‌کنی:')}</p>${itemCard()}`;
  }

  function itActionGossip() {
    let html = me.turn ? secretBlock() : '';
    html += `<h2 class="prompt">${esc(S.game.question)}</h2>
      <p class="sub">${me.gossipAnswer ? t('✓ جوابت: {name} — می‌توانی عوضش کنی.', { name: shortName(me.gossipAnswer) }) : t('یک نفر را انتخاب کن.')}</p>
      ${playerList(me.gossipAnswer, 'answer')}`;
    return html;
  }

  function itActionGossipResult() {
    const fresh = unseenNotes();
    return `<div class="tv-look"><div class="big-ic">📺</div><h2 class="prompt">${t('به تلویزیون نگاه کن!')}</h2>
      <p class="sub">${fresh ? `<b class="gold">${t('چیز تازه‌ای در دفترچه‌ی مخفی‌ات هست.')}</b>` : t('جواب‌ها روی تلویزیون است.')}</p></div>`;
  }

  function itActionDiscuss() {
    return `<h2 class="prompt">${esc(C.itemPhaseTitles.discuss)}</h2>
      <p class="sub">${t('بپرسید: «چه کسی اول چاقو داشت؟»، «کِی چیزت عوض شد؟»، «به چه کسی سرک کشیدی؟». دفترچه‌ی مخفی‌ات پایین است — راست بگو یا بلوف بزن.')}</p>`;
  }

  function itActionFinal() {
    return `<h2 class="prompt">${esc(C.itemPhaseTitles.final)}</h2>
      <p class="sub">${isKiller() ? t('تو هم رأی می‌دهی. رأی را از خودت دور کن.') : t('به کسی رأی بده که فکر می‌کنی شب را با چاقو <b>شروع</b> کرد. رأی‌ها را پخش نکنید — تساوی یعنی بُرد قاتل‌ها.')}</p>
      ${me.myFinal ? `<div class="done-box"><b>${t('✓ رأی تو: {name}', { name: shortName(me.myFinal) })}</b>${t('تا وقت تمام نشده می‌توانی عوضش کنی.')}</div>` : ''}
      ${playerList(me.myFinal, 'accuse')}`;
  }

  // ------------------------------------------------------------ render
  const ACTIONS = {
    lobby: actionLobby, intro: actionIntro, search: actionSearch, discuss: actionDiscuss, vote: actionVote,
    spotlight: actionSpotlight, final: actionFinal, reveal: actionReveal, results: actionResults,
  };
  const IT_ACTIONS = {
    lobby: actionLobby, intro: itActionIntro, gossip: itActionGossip, gossipResult: itActionGossipResult,
    discuss: itActionDiscuss, final: itActionFinal, reveal: actionReveal, results: actionResults,
  };

  function vipBar() {
    const bar = $('vipBar');
    const labels = itemsMode()
      ? { intro: t('رد کردن مقدمه'), gossip: t('پایان پچ‌پچ'), gossipResult: t('ادامه'), discuss: t('پایان گفت‌وگو'), final: t('پایان رأی‌گیری'), reveal: t('بعدی') }
      : { intro: t('رد کردن مقدمه'), search: t('پایان بازرسی'), discuss: t('پایان گفت‌وگو'), vote: t('پایان رأی‌گیری'), spotlight: t('دور بعد'), final: t('پایان اتهام'), reveal: t('بعدی') };
    if (!me || !me.isVip || !labels[S.phase]) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    if (S.phase === 'intro' && S.prologue) labels.intro = t('رد کردن سینمایی'); // first skip ends the cinematic only
    const confirming = ui.vipConfirm === S.phase;
    const toResults = S.phase === 'reveal' ? `<button class="btn" data-act="vipSkipReveal">${t('⏩ نتیجه')}</button>` : '';
    setHTML(bar, `<span class="lbl">${t('👑 میزبان')}</span><button class="btn ${confirming ? 'confirm' : ''}" data-act="vipSkip">${confirming ? t('مطمئنی؟ دوباره بزن') : `⏭ ${labels[S.phase]}`}</button>${toResults}`);
  }

  function render() {
    if (!C || !S) return;
    const joined = !!me;
    $('join').classList.toggle('hidden', joined);
    $('joinTitle').textContent = (S.settings.mode === 'items' ? C.itemsStory : C.story).title;
    $('game').classList.toggle('hidden', !joined);
    if (!joined) {
      $('joinError').textContent = S.phase !== 'lobby' ? t('بازی در جریان است. صبر کن تا دور بعد شروع شود.') : '';
      return;
    }

    const phaseKey = `${S.phase}:${S.round}${S.prologue ? ':prologue' : ''}`; // the cinematic -> story switch resets the skip confirm
    if (phaseKey !== ui.lastPhaseKey) {
      // Reset per-phase UI and point the player at what matters now.
      if (S.phase === 'search') { ui.lieKey = null; ui.lieRoom = null; }
      if (S.phase === 'gossip') ui.secret = [];
      if (S.phase === 'final') ui.final = { suspect: null, weapon: null, room: null };
      if (S.phase === 'discuss') ui.tab = itemsMode() ? 'journal' : 'hand';
      if (S.phase === 'intro') { ui.roleVisible = false; ui.tab = itemsMode() ? 'item' : 'role'; }
      ui.vipConfirm = null;
      // Every phone buzzes the same at gossip start, so the secret actor can't be heard.
      if (['search', 'vote', 'final', 'gossip'].includes(S.phase) || (S.phase === 'spotlight' && S.game.spotlight.playerId === me.id)) buzz(120);
      ui.lastPhaseKey = phaseKey;
      window.scrollTo(0, 0);
    }

    const meP = pl(me.id);
    const c = me.charId ? ch(me.charId) : null;
    setHTML($('meChip'), `${avatar(meP)}<div style="min-width:0"><div class="t1">${esc(me.name)}${me.isVip ? ' 👑' : ''}</div><div class="t2">${c ? esc(c.name) : t('{n} امتیاز', { n: meP ? meP.score : 0 })}</div></div>`);
    $('phPhase').textContent = phaseTitles()[S.phase] || '';
    $('phRound').textContent = S.round ? t('دور {n} از {total}', { n: S.round, total: S.totalRounds }) : '';

    const playing = inGame();
    setHTML($('action'), (playing || S.phase === 'lobby') ? (itemsMode() ? IT_ACTIONS : ACTIONS)[S.phase]() : `<p class="sub">${t('بازی در جریان است…')}</p>`);

    if (playing && S.phase !== 'intro' && itemsMode()) {
      if (!['item', 'journal', 'notes'].includes(ui.tab)) ui.tab = 'item';
      const body = ui.tab === 'notes' ? tabTracker() : ui.tab === 'journal' ? tabJournal() : itemCard();
      const fresh = unseenNotes();
      setHTML($('tabs'), [['item', t('چیزِ من')], ['journal', `${t('دفترچه‌ی مخفی')}${fresh ? `<span class="badge">${num(fresh)}</span>` : ''}`], ['notes', t('ردیابی')]]
        .map(([k, l]) => `<button data-act="tab" data-id="${k}" class="${ui.tab === k ? 'sel' : ''}">${l}</button>`).join(''));
      setHTML($('tabBody'), body);
    } else if (playing && S.phase !== 'intro') {
      if (!['hand', 'notes', 'role'].includes(ui.tab)) ui.tab = 'hand';
      const fresh = me.hand.filter((x) => x.isNew).length;
      setHTML($('tabs'), [['hand', `${t('مدارک')}${fresh ? `<span class="badge">${num(fresh)}</span>` : ''}`], ['notes', t('دفترچه')], ['role', t('نقش من')]]
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
    portrait: (el) => { buzz(20); send('player:portrait', { portrait: el.dataset.v }); },
    ready: (el) => { buzz(30); send('player:ready', { ready: el.dataset.v === '1' }); },
    lobby: () => send('vip:lobby'),
    resetScores: () => send('vip:resetScores'),
    kick: (el) => send('vip:kick', { targetId: el.dataset.id }),
    setting: (el) => send('vip:setting', { key: el.dataset.k, value: el.dataset.v }),
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
    vipSkipReveal: () => send('vip:skipReveal'),
    tutorial: (el) => send('vip:tutorial', { action: el.dataset.v }),
    showRole: () => {
      ui.roleVisible = true;
      clearTimeout(ui.roleTimer);
      ui.roleTimer = setTimeout(() => { ui.roleVisible = false; render(); }, 15000);
      render();
    },
    hideRole: () => { ui.roleVisible = false; render(); },
    tab: (el) => { ui.tab = el.dataset.id; if (!['role', 'item', 'journal'].includes(ui.tab)) ui.roleVisible = false; render(); },
    setMode: (el) => send('vip:setting', { key: 'mode', value: el.dataset.v }),
    answer: (el) => { buzz(30); send('act:answer', { targetId: el.dataset.id }); },
    accuse: (el) => { buzz(30); send('act:accuse', { targetId: el.dataset.id }); },
    secretPick: (el) => {
      const need = me.turn && me.turn.type === 'shuffle' ? 2 : 1;
      const id = el.dataset.id;
      if (ui.secret.includes(id)) ui.secret = ui.secret.filter((x) => x !== id);
      else ui.secret = need === 1 ? [id] : ui.secret.concat(id).slice(-2);
      render();
    },
    secretGo: () => { buzz(40); send('act:secret', { targets: ui.secret }); ui.secret = []; },
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

  if (window.Art) $('join').insertAdjacentHTML('beforeend', `<div class="join-skyline" aria-hidden="true">${window.Art.mansion()}</div>`);
  $('nameInput').value = store.get('ziafat:name', '') || '';
  $('joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('nameInput').value.trim();
    if (!name) { $('joinError').textContent = t('اسمت را بنویس.'); return; }
    store.set('ziafat:name', name);
    socket.emit('player:join', { id: myId, name }, (res) => {
      if (!res || !res.ok) $('joinError').textContent = (res && res.error) || t('خطا');
    });
  });

  socket.on('connect', () => {
    $('offline').classList.add('hidden');
    socket.emit('player:hello', { id: myId }, () => {});
  });
  socket.on('disconnect', () => $('offline').classList.remove('hidden'));
  socket.on('content', (c) => { ALL = c; C = ALL[(S && S.lang) || 'fa']; render(); });
  socket.on('state', (s) => {
    S = s; me = s.me;
    setLang(s.lang || 'fa');
    if (ALL) C = ALL[s.lang || 'fa'];
    syncClock(s.serverNow); setTimer(s.timer);
    // When the final vote is already on the server, mirror it so "update" works.
    if (me && me.myFinal && S.phase === 'final' && S.mode !== 'items' && !ui.final.suspect) ui.final = { ...me.myFinal };
    render();
  });
})();
