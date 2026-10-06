/* Hand-drawn vector art for the game: item illustrations and the mansion
   skyline. Everything is inline SVG so it stays sharp on any TV, works
   offline and costs a few KB. Shared by tv.js and play.js as window.Art. */
(function () {
  // Palette (matches shared.css)
  const INK = '#2a1418';
  const GOLD = '#d9a441';
  const GOLD_SOFT = '#f0d08a';
  const POM = '#a3123a';
  const POM_BRIGHT = '#e0335c';
  const PARCH = '#f5e6c8';
  const TURQ = '#2fb3a6';

  const S = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;

  // Each drawing gets an id prefix `u` for its gradients/clips. It is fixed per
  // item, so the markup is identical on every render (the phone only redraws
  // regions whose markup changed); copies of one item share identical defs.
  const DRAW = {
    knife(u) {
      return `<defs>
          <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f6"/><stop offset=".55" stop-color="#c3ccd6"/><stop offset="1" stop-color="#8794a3"/></linearGradient>
          <clipPath id="${u}c"><path d="M17 27 L50 27 Q58 27 61 23 Q58 35 46 37 L17 37 Z"/></clipPath>
        </defs>
        <g transform="rotate(-38 32 32)">
          <path d="M17 27 L50 27 Q58 27 61 23 Q58 35 46 37 L17 37 Z" fill="url(#${u}s)" ${S}/>
          <g clip-path="url(#${u}c)"><rect class="a-glint" x="0" y="18" width="5" height="26" fill="#fff" opacity=".85" transform="skewX(-25)"/></g>
          <path d="M20 31 L48 31" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>
          <rect x="13" y="25" width="5" height="14" rx="1.5" fill="${GOLD}" ${S}/>
          <rect x="1" y="27" width="13" height="10" rx="3.5" fill="#6b3a24" ${S}/>
          <circle cx="5" cy="32" r="1.3" fill="${GOLD_SOFT}"/><circle cx="10" cy="32" r="1.3" fill="${GOLD_SOFT}"/>
        </g>`;
    },
    glasses() {
      return `<path d="M7.5 31 L3 21 M56.5 31 L61 21" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="19" cy="35" r="12" fill="#d6f0f8" fill-opacity=".55" stroke="${GOLD}" stroke-width="3.4"/>
        <circle cx="45" cy="35" r="12" fill="#d6f0f8" fill-opacity=".55" stroke="${GOLD}" stroke-width="3.4"/>
        <circle cx="19" cy="35" r="13.6" fill="none" stroke="${INK}" stroke-width="1.2"/>
        <circle cx="45" cy="35" r="13.6" fill="none" stroke="${INK}" stroke-width="1.2"/>
        <path d="M30 32 Q32 28 34 32" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>
        <path class="a-shine" d="M12 31 Q14 27 19 26.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
        <path class="a-shine" d="M38 31 Q40 27 45 26.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
    },
    tea(u) {
      return `<defs><linearGradient id="${u}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4582a"/><stop offset="1" stop-color="#8a2a12"/></linearGradient></defs>
        <path class="a-steam" d="M27 18 Q24 13 27 9 Q30 5 27 1" fill="none" stroke="${PARCH}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
        <path class="a-steam d2" d="M36 18 Q33 13 36 9 Q39 5 36 1" fill="none" stroke="${PARCH}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
        <ellipse cx="32" cy="54" rx="22" ry="6" fill="${GOLD}" ${S}/>
        <path d="M20 20 L44 20 Q43 29 37.5 34 Q43 39 42 46 Q40 52 32 52 Q24 52 22 46 Q21 39 26.5 34 Q21 29 20 20 Z" fill="#f6e9d0" fill-opacity=".35" ${S}/>
        <path d="M21.5 25 L42.5 25 Q41 30 37.5 34 Q43 39 42 46 Q40 52 32 52 Q24 52 22 46 Q21 39 26.5 34 Q23 30 21.5 25 Z" fill="url(#${u}t)"/>
        <path d="M20 20 L44 20 Q43 29 37.5 34 Q43 39 42 46 Q40 52 32 52 Q24 52 22 46 Q21 39 26.5 34 Q21 29 20 20 Z" fill="none" ${S}/>
        <path d="M19 20 L45 20" stroke="${GOLD}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M25 27 Q26.5 31 29 33.5 M25.5 40 Q25 45 27 48" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.8" stroke-linecap="round"/>`;
    },
    hafez() {
      return `<path d="M32 16 Q20 10 5 13 L5 51 Q20 48 32 54 Q44 48 59 51 L59 13 Q44 10 32 16 Z" fill="${POM}" ${S}/>
        <path d="M32 18 Q21 13 9 15 L9 47 Q21 45 32 50 Z" fill="${PARCH}" ${S}/>
        <path d="M32 18 Q43 13 55 15 L55 47 Q43 45 32 50 Z" fill="${PARCH}" ${S}/>
        <path d="M14 23 L27 24 M14 29 L27 30 M14 35 L27 36 M14 41 L24 42 M37 24 L50 23 M37 30 L50 29 M37 36 L50 35 M40 42 L50 41" stroke="#a8875a" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="32" cy="57" r="2.2" fill="${GOLD}"/>`;
    },
    candle(u) {
      return `<defs><radialGradient id="${u}g"><stop offset="0" stop-color="${GOLD_SOFT}" stop-opacity=".75"/><stop offset="1" stop-color="${GOLD_SOFT}" stop-opacity="0"/></radialGradient></defs>
        <circle class="a-glow" cx="32" cy="16" r="15" fill="url(#${u}g)"/>
        <path class="a-flame" d="M32 4 Q39 14 35 20 Q32 23 29 20 Q25 14 32 4 Z" fill="#ffb238" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
        <path class="a-flame" d="M32 11 Q35 16 33 19 Q32 20 31 19 Q29 16 32 11 Z" fill="#fff4c2"/>
        <path d="M32 21 L32 25" stroke="${INK}" stroke-width="2"/>
        <path d="M23 25 L41 25 L41 54 L23 54 Z" fill="${PARCH}" ${S}/>
        <path d="M37 25 Q37 31 39 33 Q41 35 41 30" fill="#fff" fill-opacity=".7"/>
        <ellipse cx="32" cy="56" rx="16" ry="5" fill="${GOLD}" ${S}/>`;
    },
    key() {
      return `<g transform="rotate(-35 32 32)">
          <circle cx="15" cy="32" r="10" fill="${GOLD}" ${S}/>
          <circle cx="15" cy="32" r="4" fill="${INK}"/>
          <path d="M25 29 L58 29 L58 35 L25 35 Z" fill="${GOLD}" ${S}/>
          <path d="M46 35 L46 43 L51 43 L51 35 M53 35 L53 41 L57 41 L57 35" fill="${GOLD}" ${S}/>
          <path class="a-shine" d="M28 31 L54 31" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>
        </g>`;
    },
    watermelon() {
      return `<path d="M4 24 Q32 70 60 24 Z" fill="#3f8f3a" ${S}/>
        <path d="M9 25 Q32 61 55 25 Z" fill="#f4f1dc"/>
        <path d="M12 25 Q32 56 52 25 Z" fill="${POM_BRIGHT}"/>
        <path d="M4 24 L60 24" ${S}/>
        <g fill="${INK}"><ellipse cx="22" cy="31" rx="1.6" ry="2.4"/><ellipse cx="32" cy="35" rx="1.6" ry="2.4"/><ellipse cx="42" cy="31" rx="1.6" ry="2.4"/><ellipse cx="27" cy="41" rx="1.6" ry="2.4"/><ellipse cx="37" cy="41" rx="1.6" ry="2.4"/></g>`;
    },
    tasbih() {
      const beads = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        beads.push(`<circle cx="${(32 + Math.cos(a) * 17).toFixed(1)}" cy="${(26 + Math.sin(a) * 15).toFixed(1)}" r="3.6" fill="${TURQ}" stroke="${INK}" stroke-width="1.6"/>`);
      }
      return `<g class="a-sway">${beads.join('')}
        <circle cx="32" cy="44" r="4.4" fill="${GOLD}" stroke="${INK}" stroke-width="1.8"/>
        <path d="M32 48 L32 54 M29 54 L35 54 L36 62 L28 62 Z" fill="${POM}" ${S}/></g>`;
    },
    shawl() {
      return `<path d="M6 16 L58 16 L54 50 L10 50 Z" fill="${POM}" ${S}/>
        <path d="M8 22 L57 22 M10 44 L55 44" stroke="${GOLD}" stroke-width="2.4"/>
        <path d="M24 38 Q15 37 17 29 Q19 23 26 25 Q31 27 28 32 Q26 35 23 33" fill="${GOLD_SOFT}" stroke="${INK}" stroke-width="1.6"/>
        <path d="M44 38 Q35 37 37 29 Q39 23 46 25 Q51 27 48 32 Q46 35 43 33" fill="${TURQ}" stroke="${INK}" stroke-width="1.6"/>
        <path class="a-sway" d="M13 50 L12 58 M20 50 L19 58 M27 50 L27 58 M34 50 L34 58 M41 50 L42 58 M48 50 L49 58" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round"/>`;
    },
    nuts() {
      return `<ellipse cx="22" cy="26" rx="6" ry="4.4" fill="#b07a45" ${S}/>
        <ellipse cx="34" cy="22" rx="6" ry="4.4" fill="#9cc25a" ${S}/>
        <ellipse cx="44" cy="28" rx="6" ry="4.4" fill="#c99a62" ${S}/>
        <ellipse cx="30" cy="31" rx="6" ry="4.4" fill="#e9d0a0" ${S}/>
        <path d="M6 32 L58 32 Q56 54 32 56 Q8 54 6 32 Z" fill="${GOLD}" ${S}/>
        <path d="M14 39 Q32 46 50 39" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="1.6"/>`;
    },
    phone() {
      return `<rect x="17" y="4" width="30" height="56" rx="6" fill="#241a24" ${S}/>
        <rect x="20" y="11" width="24" height="40" rx="2" fill="${TURQ}"/>
        <path d="M23 18 L41 18 M23 24 L37 24 M23 30 L39 30" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>
        <circle class="a-blink" cx="40" cy="44" r="3.4" fill="${POM_BRIGHT}"/>
        <circle cx="32" cy="55.5" r="2" fill="${GOLD}"/>`;
    },
    nazar() {
      return `<circle cx="32" cy="32" r="27" fill="#1f5fbf" ${S}/>
        <circle cx="32" cy="32" r="19" fill="#fff"/>
        <circle cx="32" cy="32" r="13" fill="#7cc7f0"/>
        <circle cx="32" cy="32" r="7" fill="${INK}"/>
        <circle class="a-shine" cx="24" cy="22" r="3.6" fill="#fff" opacity=".85"/>`;
    },
    mirror(u) {
      return `<defs>
          <linearGradient id="${u}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f3f7"/><stop offset="1" stop-color="#9bb8c4"/></linearGradient>
          <clipPath id="${u}c"><ellipse cx="32" cy="24" rx="14" ry="17"/></clipPath>
        </defs>
        <path d="M28 42 L36 42 L37 60 L27 60 Z" fill="${GOLD}" ${S}/>
        <ellipse cx="32" cy="24" rx="19" ry="22" fill="${GOLD}" ${S}/>
        <ellipse cx="32" cy="24" rx="14" ry="17" fill="url(#${u}m)" ${S}/>
        <g clip-path="url(#${u}c)"><rect class="a-glint" x="0" y="0" width="6" height="50" fill="#fff" opacity=".8" transform="skewX(-25)"/></g>
        <circle cx="32" cy="3.5" r="2.4" fill="${POM_BRIGHT}"/>`;
    },
    grapes() {
      const pts = [[24, 24], [34, 24], [44, 24], [29, 33], [39, 33], [24, 42], [34, 42], [29, 51], [44, 33]];
      return `<path d="M34 14 Q35 8 40 5" fill="none" ${S}/>
        <path d="M36 10 Q47 4 54 12 Q46 18 36 10 Z" fill="#5d9b3c" ${S}/>
        ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.4" fill="#7b3f9e" ${S}/><circle cx="${x - 2}" cy="${y - 2}" r="1.6" fill="#fff" opacity=".55"/>`).join('')}`;
    },
    gift() {
      return `<rect x="8" y="26" width="48" height="32" rx="3" fill="${POM}" ${S}/>
        <rect x="5" y="18" width="54" height="10" rx="2.5" fill="${POM_BRIGHT}" ${S}/>
        <path d="M32 18 L32 58" stroke="${GOLD}" stroke-width="6"/>
        <path d="M32 18 L32 58" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".4"/>
        <g class="a-sway"><path d="M32 18 Q20 4 15 10 Q12 17 32 18 Q52 17 49 10 Q44 4 32 18 Z" fill="${GOLD}" ${S}/></g>`;
    },
  };

  // Item illustration. `anim` turns on the idle animation (big displays only;
  // small chips stay still so a full timeline doesn't shimmer).
  function item(id, { anim = false, title = '' } = {}) {
    const draw = DRAW[id];
    if (!draw) return '';
    const u = `art-${id}-`;
    return `<svg class="art art-${id}${anim ? ' anim' : ''}" viewBox="0 0 64 64" role="img"${title ? ` aria-label="${title}"` : ' aria-hidden="true"'}>${draw(u)}</svg>`;
  }

  // Night skyline of a Shirazi mansion: domes, a central iwan, two wind-catchers
  // and cypress trees. Windows carry .win for the flicker animation.
  function mansion() {
    const win = (x, y, w = 16, h = 26, d = 0) => `<path class="win" style="animation-delay:${d}s" d="M${x} ${y + h} L${x} ${y + w / 2} Q${x + w / 2} ${y - 4} ${x + w} ${y + w / 2} L${x + w} ${y + h} Z"/>`;
    const cypress = (x, h) => `<path d="M${x} 360 Q${x - 18} ${360 - h * 0.45} ${x} ${360 - h} Q${x + 18} ${360 - h * 0.45} ${x} 360 Z"/>`;
    const wings = [];
    [[180, 0.3], [235, 1.7], [290, 0.9], [1270, 2.4], [1325, 1.1], [1380, 0.4]].forEach(([x, d]) => wings.push(win(x, 248, 22, 34, d)));
    [[560, 2.0], [610, 0.6], [960, 1.4], [1010, 2.8]].forEach(([x, d]) => wings.push(win(x, 214, 22, 36, d)));
    return `<svg class="manor" viewBox="0 0 1600 360" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g class="body">
        ${cypress(70, 230)}${cypress(120, 180)}${cypress(1480, 220)}${cypress(1535, 170)}
        <path d="M150 360 L150 236 L470 236 L470 360 Z"/>
        <path d="M1130 360 L1130 236 L1450 236 L1450 360 Z"/>
        <rect x="150" y="226" width="320" height="12"/><rect x="1130" y="226" width="320" height="12"/>
        <path d="M470 360 L470 196 L1130 196 L1130 360 Z"/>
        <rect x="462" y="186" width="676" height="14"/>
        <rect x="500" y="96" width="44" height="100"/><rect x="1056" y="96" width="44" height="100"/>
        <path d="M494 96 L550 96 L550 86 L494 86 Z M1050 96 L1106 96 L1106 86 L1050 86 Z"/>
        <path d="M640 196 Q640 116 720 100 Q706 70 720 52 Q734 70 720 100 Q800 116 800 196 Z"/>
        <path d="M800 196 Q800 120 880 104 Q866 74 880 56 Q894 74 880 104 Q960 120 960 196 Z"/>
        <path d="M730 360 L730 250 Q730 196 800 170 Q870 196 870 250 L870 360 Z" class="iwan"/>
        <rect x="0" y="352" width="1600" height="8"/>
      </g>
      <g class="lit">${wings.join('')}
        <path class="win door" style="animation-delay:1.2s" d="M760 360 L760 266 Q760 222 800 206 Q840 222 840 266 L840 360 Z"/>
      </g>
      <g class="slits"><rect x="510" y="110" width="6" height="40"/><rect x="528" y="110" width="6" height="40"/><rect x="1066" y="110" width="6" height="40"/><rect x="1084" y="110" width="6" height="40"/></g>
    </svg>`;
  }

  window.Art = { item, mansion, has: (id) => !!DRAW[id] };
})();
