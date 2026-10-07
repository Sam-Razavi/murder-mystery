/* TV soundtrack. Plays the song(s) found in public/audio/ (see the README
   there): "intro" for the cinematic prologue and "theme" for everything else.
   Either is optional; with no files the game is silent apart from the
   synthesized effects in tv.js. Phones never play sound. window.Music. */
(function () {
  const { t, store } = window.Z;
  // Volume per scene (0..1 of the master volume).
  const LEVELS = { lobby: 0.35, prologue: 1, intro: 0.5, play: 0.22, tense: 0.3, reveal: 0.16, results: 0.45 };
  const MASTER = 0.9;

  let tracks = { theme: null, intro: null };
  let scene = 'lobby';
  let level = 0;
  let muted = !!store.get('muted', false);
  let locked = false;
  let ready = false;
  let hint = null;
  let fade = null;
  let activeKey = null; // which track is audible

  function mk(src, loop) {
    if (!src) return null;
    const el = new Audio(src);
    el.loop = loop;
    el.preload = 'auto';
    el.volume = 0;
    return el;
  }

  function showHint() {
    if (!hint) {
      hint = document.createElement('button');
      hint.className = 'sound-hint';
      hint.type = 'button';
      document.body.appendChild(hint);
      hint.addEventListener('click', unlock);
    }
    hint.textContent = muted ? t('🔇 صدا بی‌صدا است — برای روشن کردن کلید M را بزنید') : t('🔊 برای فعال شدن صدا کلیک کنید یا یک کلید بزنید');
    hint.classList.toggle('hidden', !(ready && (locked || muted)));
  }

  let outgoing = null; // track fading out after a switch: { el, timer }

  function apply() {
    const target = muted ? 0 : MASTER * level;
    Object.entries(tracks).forEach(([k, el]) => {
      if (!el || (outgoing && outgoing.el === el)) return; // the fade-out owns its volume
      const want = k === activeKey ? target : 0;
      el.volume = Math.max(0, Math.min(1, want));
    });
  }

  // Switch the audible track: the old one fades out on its own while the new
  // one rises from silence (a crossfade, not a cut).
  function switchTo(key, sec) {
    const old = tracks[activeKey];
    if (outgoing) { clearInterval(outgoing.timer); outgoing.el.pause(); outgoing = null; }
    activeKey = key;
    if (old && old !== tracks[key] && !old.paused) {
      const v0 = old.volume;
      const t0 = performance.now();
      outgoing = { el: old, timer: setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
        old.volume = v0 * (1 - k);
        if (k >= 1) { clearInterval(outgoing.timer); old.pause(); outgoing = null; }
      }, 50) };
    }
    level = 0;
    apply();
  }

  // Smooth volume change over `sec` seconds.
  function ramp(to, sec) {
    clearInterval(fade);
    const from = level;
    const t0 = performance.now();
    if (sec <= 0) { level = to; apply(); return; }
    fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
      level = from + (to - from) * k;
      apply();
      if (k >= 1) clearInterval(fade);
    }, 50);
  }

  function tryPlay(el) {
    if (!el) return;
    const p = el.play();
    if (p && p.catch) p.then(() => { locked = false; showHint(); }).catch(() => { locked = true; showHint(); });
  }

  function unlock() {
    if (!ready) return;
    locked = false;
    Object.values(tracks).forEach((el) => el && el.paused && activeKey && el === tracks[activeKey] && tryPlay(el));
    if (window.Sound && window.Sound.unlock) window.Sound.unlock();
    showHint();
  }

  // scene: lobby | prologue | intro | play | tense | reveal | results
  function setScene(next) {
    if (!ready || next === scene) return;
    const prev = scene;
    scene = next;
    if (next === 'prologue') {
      // Cinematic: its own track if provided (the theme fades out under it),
      // else restart the theme from the top.
      const key = tracks.intro ? 'intro' : 'theme';
      if (key === 'intro') switchTo('intro', 1.2);
      else activeKey = key;
      const el = tracks[key];
      if (el) { try { el.currentTime = 0; } catch { /* not seekable yet */ } tryPlay(el); }
      ramp(LEVELS.prologue, key === 'intro' ? 0.6 : 1.5);
      return;
    }
    if (prev === 'prologue' && tracks.intro && tracks.theme) {
      // Hand over from the cinematic track to the theme: crossfade.
      switchTo('theme', 3);
      tryPlay(tracks.theme);
      ramp(LEVELS[next] === undefined ? 0.3 : LEVELS[next], 3);
      return;
    }
    if (!activeKey || !tracks[activeKey]) activeKey = tracks.theme ? 'theme' : 'intro';
    const el = tracks[activeKey];
    if (el && el.paused) tryPlay(el);
    ramp(LEVELS[next] === undefined ? 0.3 : LEVELS[next], next === 'results' ? 3 : 1.5);
  }

  function setMuted(m) {
    muted = m;
    store.set('muted', m);
    apply();
    showHint();
  }

  async function init() {
    try {
      const m = await fetch('/audio/manifest.json').then((r) => r.json());
      tracks = { theme: mk(m.theme, true), intro: mk(m.intro, false) };
    } catch { return; }
    if (!tracks.theme && !tracks.intro) return; // no songs: stay silent
    ready = true;
    activeKey = tracks.theme ? 'theme' : 'intro';
    if (activeKey === 'intro') tracks.intro.loop = true;
    tryPlay(tracks[activeKey]);
    level = LEVELS.lobby;
    apply();
    ['click', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { if (locked) unlock(); }, { passive: true }));
    window.addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') setMuted(!muted); });
  }

  init();
  const status = () => Object.fromEntries(Object.entries(tracks).filter(([, el]) => el).map(([k, el]) => [k, {
    playing: !el.paused, volume: +el.volume.toFixed(2), time: +el.currentTime.toFixed(1), active: k === activeKey,
  }]));
  window.Music = { setScene, setMuted, refresh: showHint, status, get scene() { return scene; }, get available() { return ready; }, get locked() { return locked; } };
})();
