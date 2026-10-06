/* Shared client helpers for tv.js and play.js */
(function () {
  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const fa = (v) => String(v).replace(/\d/g, (d) => FA_DIGITS[d]);

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  // crypto.randomUUID needs a secure context; the game runs on plain http LAN.
  const makeId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  let clockOffset = 0;
  const syncClock = (serverNow) => { if (serverNow) clockOffset = serverNow - Date.now(); };
  const now = () => Date.now() + clockOffset;

  function remaining(timer) {
    if (!timer) return null;
    return Math.max(0, timer.endsAt - now());
  }

  // Elements with data-timer get their text + --p (0..1 progress) updated every frame.
  let currentTimer = null;
  const setTimer = (t) => { currentTimer = t; };
  function tick() {
    const els = document.querySelectorAll('[data-timer]');
    if (els.length) {
      const ms = remaining(currentTimer);
      els.forEach((el) => {
        if (ms == null) { el.style.visibility = 'hidden'; return; }
        el.style.visibility = '';
        const secs = Math.ceil(ms / 1000);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        const label = el.querySelector('[data-timer-label]') || el;
        label.textContent = m ? `${fa(m)}:${fa(String(s).padStart(2, '0'))}` : fa(s);
        el.style.setProperty('--p', currentTimer.duration ? (ms / currentTimer.duration).toFixed(4) : 0);
        el.classList.toggle('urgent', secs <= 10);
      });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.Z = { fa, esc, store, makeId, syncClock, now, remaining, setTimer };
})();
