/* TV atmosphere: a living night scene behind every screen (sky, moon,
   twinkling stars, falling snow over the Shiraz mansion, or drifting
   blossom over the Ramsar villa in the Nowruz story, with flickering
   windows) and the curtain transition between phases. window.Scene. */
(function () {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = document.createElement('div');
  scene.className = 'scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `<div class="sky"></div><div class="moon"></div><canvas class="sky-canvas"></canvas>
    <div class="skyline">${window.Art.mansion()}</div><div class="haze"></div>`;
  document.body.prepend(scene);

  const curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML = `<div class="drape l"></div><div class="drape r"></div>
    <div class="cur-card"><div class="orn"></div><div class="t"></div><div class="s"></div><div class="orn b"></div></div>`;
  document.body.append(curtain);

  // ------------------------------------------------------------ stars + snow
  const canvas = scene.querySelector('.sky-canvas');
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  let stars = [];
  let flakes = [];
  let weather = 'snow'; // 'snow' (Yalda) or 'petals' (Nowruz)

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = canvas.width = Math.round(window.innerWidth * dpr);
    H = canvas.height = Math.round(window.innerHeight * dpr);
    stars = Array.from({ length: 110 }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.62, r: (0.4 + Math.random() * 1.2) * dpr,
      p: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 1.6,
    }));
    flakes = Array.from({ length: weather === 'petals' ? 46 : 80 }, () => newFlake(true));
  }
  function newFlake(anywhere) {
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : -10,
      r: (0.8 + Math.random() * 2) * dpr, vy: (0.25 + Math.random() * 0.6) * dpr,
      sw: Math.random() * Math.PI * 2, a: 0.25 + Math.random() * 0.45,
      rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.04,
    };
  }

  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden || t - last < 33) return; // ~30fps is plenty for drifting snow
    last = t;
    ctx.clearRect(0, 0, W, H);
    const sec = t / 1000;
    stars.forEach((s) => {
      ctx.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(sec * s.s + s.p));
      ctx.fillStyle = '#f5e6c8';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    const petals = weather === 'petals';
    flakes.forEach((f, i) => {
      f.y += petals ? f.vy * 0.7 : f.vy;
      f.sw += 0.012;
      const x = f.x + Math.sin(f.sw) * (petals ? 26 : 14) * dpr;
      ctx.globalAlpha = f.a;
      ctx.beginPath();
      if (petals) {
        // orange-blossom and pink petals tumbling as they drift
        f.rot += f.spin;
        ctx.fillStyle = i % 3 ? '#f7d6e0' : '#fff4e4';
        ctx.ellipse(x, f.y, f.r * 1.9, f.r, f.rot, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
      if (f.y > H + 10) flakes[i] = newFlake(false);
    });
    ctx.globalAlpha = 1;
  }
  resize();
  window.addEventListener('resize', resize);
  if (!reduced) requestAnimationFrame(frame);
  else frame(1000); // draw one still frame

  // ------------------------------------------------------------ curtain
  const CURTAIN_MS = 1900; // close, hold the title card, open
  const REVEAL_AT = 1150; // when the drapes start opening
  let hideTimer = null;

  // Plays the curtain with a title card. Calls onOpen as the drapes part,
  // so the caller can reveal the new screen exactly then.
  function transition(title, sub, onOpen) {
    if (reduced) { if (onOpen) onOpen(); return; }
    curtain.querySelector('.t').textContent = title || '';
    curtain.querySelector('.s').textContent = sub || '';
    curtain.classList.remove('play');
    void curtain.offsetWidth; // restart the animation
    curtain.classList.add('play');
    clearTimeout(hideTimer);
    clearTimeout(transition._open);
    transition._open = setTimeout(() => { if (onOpen) onOpen(); }, REVEAL_AT);
    hideTimer = setTimeout(() => curtain.classList.remove('play'), CURTAIN_MS);
  }

  // Busy screens (reveal timeline, scoreboard) get a calmer backdrop.
  function setDim(on) { scene.classList.toggle('dim', !!on); }

  // Backdrop for the story being played: skyline and weather.
  let story = 'yalda';
  function setStory(id) {
    const next = id === 'nowruz' ? 'nowruz' : 'yalda';
    if (next === story) return;
    story = next;
    scene.querySelector('.skyline').innerHTML = story === 'nowruz' ? window.Art.villa() : window.Art.mansion();
    scene.classList.toggle('spring', story === 'nowruz');
    weather = story === 'nowruz' ? 'petals' : 'snow';
    resize();
    if (reduced) frame(1000);
  }

  window.Scene = { transition, setDim, setStory, reduced };
})();
