/* Cinematic prologue on the TV, shown while the server is in the intro
   phase with `prologue: true` (the host can skip it from their phone).
   Layers are animated by CSS keyframes over --dur (the whole prologue);
   captions and sound cues are timed here as fractions of that length.
   Reconnecting mid-prologue resumes at the right moment (--off). window.Cinema. */
(function () {
  const { esc } = window.Z;
  let root = null;
  let timers = [];

  const clockSvg = `<svg viewBox="-100 -100 200 200" aria-hidden="true">
    <circle r="94" class="face"/><circle r="94" class="rim"/>
    ${Array.from({ length: 12 }, (_, i) => `<line class="tick ${i % 3 === 0 ? 'big' : ''}" x1="0" y1="-84" x2="0" y2="${i % 3 === 0 ? -68 : -76}" transform="rotate(${i * 30})"/>`).join('')}
    <path class="orn-d" d="M0-52 L6-44 L0-36 L-6-44Z"/>
    <g class="hm"><line x1="0" y1="6" x2="0" y2="-46"/></g>
    <g class="mm"><line x1="0" y1="10" x2="0" y2="-72"/></g>
    <circle r="5" class="hub"/></svg>`;

  function stop(fast) {
    timers.forEach(clearTimeout);
    timers = [];
    if (!root) return;
    const el = root;
    root = null;
    if (fast) { el.remove(); return; }
    el.classList.add('out');
    setTimeout(() => el.remove(), 900);
  }

  /* opts: { lang, durationMs, elapsedMs, title, subtitle, texts, cues, skipHint }
     texts: window.Guide.CINEMA[lang]; cues: { fraction: fn } for sound effects. */
  function play(opts) {
    stop(true);
    const dur = Math.max(4000, opts.durationMs);
    const elapsed = Math.min(dur, Math.max(0, opts.elapsedMs || 0));
    root = document.createElement('div');
    root.className = 'cinema';
    root.setAttribute('aria-hidden', 'true');
    root.style.setProperty('--dur', `${dur}ms`);
    root.style.setProperty('--off', `${elapsed}ms`);
    const art = window.Art;
    root.innerHTML = `
      <div class="cin-sky"></div><div class="cin-stars"></div>
      <div class="cin-world"><div class="cin-moon"></div><div class="cin-mansion">${art ? art.mansion() : ''}</div></div>
      <div class="cin-fog f1"></div><div class="cin-fog f2"></div>
      <div class="cin-clock">${clockSvg}</div>
      <div class="cin-candle"><div class="cin-glow"></div>${art && art.has('candle') ? art.item('candle', { anim: true, title: '' }) : ''}</div>
      <div class="cin-dark"></div><div class="cin-flash"></div>
      <div class="cin-vig"></div><div class="cin-grain"></div>
      <div class="cin-bar t"><i></i></div><div class="cin-bar b"><i></i></div>
      <div class="cin-cap"><div class="k"></div><div class="l"></div></div>
      <div class="cin-title"><div class="orn"></div><div class="tt display">${esc(opts.title || '')}</div><div class="ss">${esc(opts.subtitle || '')}</div><div class="orn b"></div></div>
      <div class="cin-fade"></div>
      <div class="cin-skip">${esc(opts.skipHint || '')}</div>`;
    document.body.appendChild(root);

    const cap = root.querySelector('.cin-cap');
    const k = cap.querySelector('.k');
    const l = cap.querySelector('.l');
    const at = (frac, fn) => {
      const ms = frac * dur - elapsed;
      if (ms < -50) return; // already past when we joined
      timers.push(setTimeout(fn, Math.max(0, ms)));
    };
    const caps = (opts.texts && opts.texts.captions) || [];
    caps.forEach(([from, to, kicker, line], i) => {
      const last = i === caps.length - 1;
      at(from, () => { k.textContent = kicker; l.textContent = line; cap.classList.toggle('kill', last); cap.classList.add('on'); });
      at(to, () => cap.classList.remove('on'));
    });
    Object.entries(opts.cues || {}).forEach(([frac, fn]) => at(Number(frac), fn));
  }

  window.Cinema = { play, stop, get active() { return !!root; } };
})();
