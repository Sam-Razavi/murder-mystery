/* Illustrated faces: the 8 classic characters as busts (their visible
   traits — like glasses — are drawn on, so the art matches the clues) and
   the 16 lobby portraits. Extends window.Art from art.js. Faces fill a
   64×64 box and sit inside the round .avatar. Eyes carry .a-eye so they
   can blink on big screens. */
(function () {
  const INK = '#2a1418';
  const W = 'stroke="#2a1418" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';

  // ---------------------------------------------------------------- busts
  // A bust from parts: skin, hair style/colour, clothes and extras.
  function bust(o) {
    const skin = o.skin || '#e8b98a';
    const parts = [];
    // shoulders and clothes
    parts.push(`<path d="M6 66 Q8 46 32 45 Q56 46 58 66 Z" fill="${o.cloth}" ${W}/>`);
    if (o.collar) parts.push(o.collar);
    // neck
    parts.push(`<path d="M27 40 L27 47 Q32 50 37 47 L37 40 Z" fill="${skin}" ${W}/>`);
    // hair behind the head
    if (o.hairBack) parts.push(o.hairBack);
    // head
    parts.push(`<ellipse cx="32" cy="29" rx="12.5" ry="14" fill="${skin}" ${W}/>`);
    // ears
    if (!o.noEars) parts.push(`<ellipse cx="19.5" cy="30" rx="2.4" ry="3.4" fill="${skin}" ${W}/><ellipse cx="44.5" cy="30" rx="2.4" ry="3.4" fill="${skin}" ${W}/>`);
    // hair on top
    if (o.hair) parts.push(o.hair);
    // eyes, brows, nose, mouth
    const eyeY = 30;
    parts.push(`<g class="a-eye"><ellipse cx="27" cy="${eyeY}" rx="1.6" ry="2" fill="${INK}"/><ellipse cx="37" cy="${eyeY}" rx="1.6" ry="2" fill="${INK}"/></g>`);
    parts.push(`<path d="M24 ${eyeY - 4.5} Q27 ${eyeY - 6} 30 ${eyeY - 4.5} M34 ${eyeY - 4.5} Q37 ${eyeY - 6} 40 ${eyeY - 4.5}" fill="none" stroke="${o.brow || INK}" stroke-width="1.8" stroke-linecap="round"/>`);
    parts.push(`<path d="M32 31 Q30.5 35 32.5 35.5" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`);
    if (o.blush) parts.push(`<ellipse cx="24.5" cy="35" rx="2.6" ry="1.5" fill="#e0335c" opacity=".25"/><ellipse cx="39.5" cy="35" rx="2.6" ry="1.5" fill="#e0335c" opacity=".25"/>`);
    parts.push(o.mouth || `<path d="M29 38.5 Q32 40.5 35 38.5" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`);
    if (o.face) parts.push(o.face);
    if (o.glasses) {
      parts.push(`<g fill="#d6f0f8" fill-opacity=".3" stroke="${o.glasses}" stroke-width="1.8"><circle cx="27" cy="${eyeY}" r="4.4"/><circle cx="37" cy="${eyeY}" r="4.4"/></g>
        <path d="M31.4 ${eyeY - .5} L32.6 ${eyeY - .5} M22.6 ${eyeY - 1} L19.8 ${eyeY - 2} M41.4 ${eyeY - 1} L44.2 ${eyeY - 2}" stroke="${o.glasses}" stroke-width="1.6" stroke-linecap="round"/>`);
    }
    if (o.top) parts.push(o.top);
    return parts.join('');
  }

  const CHARACTERS = {
    // Bahram — eldest son, bankrupt textile owner. Greying hair, moustache, glasses, brown suit.
    bahram: () => bust({
      cloth: '#6b3a24', skin: '#d9a477', glasses: '#2a1418', brow: '#5a4a44',
      collar: `<path d="M26 46 L32 56 L38 46" fill="#f5e6c8" ${W}/><path d="M31 50 L32 60 L33 50 Z" fill="#a3123a"/>`,
      hair: `<path d="M19.5 26 Q19 13 32 13 Q45 13 44.5 26 Q42 19 32 19 Q22 19 19.5 26 Z" fill="#8c8580" ${W}/>`,
      face: `<path d="M26.5 36.5 Q32 34 37.5 36.5 Q35 38.5 32 37.4 Q29 38.5 26.5 36.5 Z" fill="#5a4a44"/>`,
      mouth: '<path d="M29.5 39.6 Q32 40.6 34.5 39.6" fill="none" stroke="#2a1418" stroke-width="1.4" stroke-linecap="round"/>',
    }),
    // Mahin — the daughter-in-law. Burgundy roosari, gold earrings, a rose.
    mahin: () => bust({
      cloth: '#2f6fbf', skin: '#ecbf96', blush: true, noEars: true,
      hairBack: `<path d="M17 30 Q16 12 32 11 Q48 12 47 30 L49 48 Q32 54 15 48 Z" fill="#7a0f2c" ${W}/>`,
      hair: `<path d="M20 27 Q21 16 32 16 Q43 16 44 27 Q40 21 32 21.5 Q24 21 20 27 Z" fill="#2a1418"/>
        <path d="M18.5 30 Q18 12 32 11.5 Q46 12 45.5 30 Q44 18 32 17 Q20 18 18.5 30 Z" fill="#a3123a" ${W}/>`,
      top: `<circle cx="20" cy="42" r="2" fill="#d9a441"/><circle cx="44" cy="42" r="2" fill="#d9a441"/>
        <circle cx="45" cy="18" r="4" fill="#e0335c" ${W}/><path d="M43 18 Q45 16 47 18" fill="none" stroke="#a3123a" stroke-width="1.2"/>`,
    }),
    // Shirin — the actress granddaughter. Long wavy hair, red lips, beauty mark.
    shirin: () => bust({
      cloth: '#d77ab3', skin: '#f0c7a0', blush: true,
      hairBack: `<path d="M18 26 Q14 46 12 58 Q22 52 22 44 L42 44 Q42 52 52 58 Q50 46 46 26 Z" fill="#3a1f18" ${W}/>`,
      hair: `<path d="M19 30 Q17 12 33 12 Q47 13 45 30 Q44 21 38 18 Q30 23 21 22 Q19 25 19 30 Z" fill="#3a1f18" ${W}/>`,
      mouth: '<path d="M29 38.2 Q32 37 35 38.2 Q32 41.5 29 38.2 Z" fill="#c4163f"/>',
      face: '<circle cx="38.5" cy="36" r=".9" fill="#2a1418"/>',
      collar: '<path d="M24 49 Q32 54 40 49" fill="none" stroke="#f0d08a" stroke-width="1.6"/><circle cx="32" cy="53" r="1.6" fill="#f0d08a"/>',
    }),
    // Dr. Sadri — family doctor. Balding, grey sides, glasses, white coat, stethoscope.
    sadri: () => bust({
      cloth: '#f4f4f0', skin: '#e3ae84', glasses: '#4a9fb5', brow: '#8c8580',
      collar: `<path d="M26 46 L32 54 L38 46" fill="#4a9fb5" ${W}/>
        <path d="M23 47 Q20 58 28 60 M41 47 Q44 58 36 60" fill="none" stroke="#2a1418" stroke-width="2"/><circle cx="32" cy="60" r="2.6" fill="#8c8580" ${W}/>`,
      hair: `<path d="M19.5 30 Q19 21 22 19 Q21 26 21.5 30 Z M44.5 30 Q45 21 42 19 Q43 26 42.5 30 Z" fill="#c9c4bf" ${W}/>`,
    }),
    // Rahim — the old gardener. Flat cap, white stubble, green work shirt.
    rahim: () => bust({
      cloth: '#5d7a3a', skin: '#c98f62', brow: '#e8e2da',
      face: `<path d="M21 34 Q22 44 32 45 Q42 44 43 34 Q40 41 32 41.5 Q24 41 21 34 Z" fill="#e8e2da" opacity=".9"/>
        <path d="M27 24 L29 25 M35 25 L37 24" stroke="#2a1418" stroke-width="1" opacity=".4"/>`,
      top: `<path d="M18.5 22 Q19 12 32 12 Q45 12 45.5 22 Z" fill="#6b5a44" ${W}/><path d="M17 22 L50 22 Q50 25 46 25 L18 25 Q16 24 17 22 Z" fill="#584836" ${W}/>`,
      collar: `<path d="M26 46 L32 52 L38 46" fill="#3f5a25" ${W}/>`,
    }),
    // Khanom-jan — the old cook. White patterned headscarf, glasses, apron.
    khanomjan: () => bust({
      cloth: '#d9823b', skin: '#dba27a', glasses: '#7a3a1a', blush: true, noEars: true, brow: '#9c958f',
      hairBack: `<path d="M17 30 Q16 12 32 11 Q48 12 47 30 L50 50 Q32 55 14 50 Z" fill="#f5efe4" ${W}/>`,
      hair: `<path d="M18.5 30 Q18 12 32 11.5 Q46 12 45.5 30 Q44 18 32 17 Q20 18 18.5 30 Z" fill="#f5efe4" ${W}/>
        <g fill="#2fb3a6"><circle cx="24" cy="15" r="1.2"/><circle cx="32" cy="13" r="1.2"/><circle cx="40" cy="15" r="1.2"/><circle cx="18" cy="40" r="1.2"/><circle cx="46" cy="40" r="1.2"/></g>`,
      collar: `<path d="M22 52 L42 52 L44 66 L20 66 Z" fill="#f5e6c8" ${W}/>`,
      mouth: '<path d="M28.5 38.5 Q32 41.5 35.5 38.5" fill="none" stroke="#2a1418" stroke-width="1.6" stroke-linecap="round"/>',
    }),
    // Farzad — the family lawyer. Slicked black hair, glasses, dark suit and tie.
    farzad: () => bust({
      cloth: '#2c2a3a', skin: '#e2ad85', glasses: '#d9a441',
      collar: `<path d="M26 46 L32 56 L38 46" fill="#fff" ${W}/><path d="M30.5 48 L32 62 L33.5 48 Z" fill="#7b6fd0" ${W}/>`,
      hair: `<path d="M19.5 27 Q18 12 33 12 Q46 13 44.5 27 Q43 18 35 17 Q28 21 21 21 Q20 23 19.5 27 Z" fill="#141018" ${W}/>
        <path d="M27 15 Q34 13 41 17" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>`,
    }),
    // Sima — the new nurse. Nurse cap, ponytail, light blue uniform.
    sima: () => bust({
      cloth: '#7cc7d8', skin: '#efc29b', blush: true,
      hairBack: `<path d="M42 20 Q54 24 50 42 Q47 34 44 30 Z" fill="#6b3a24" ${W}/>`,
      hair: `<path d="M19.5 29 Q18 13 32 13 Q46 13 44.5 29 Q42 20 32 20 Q23 20 19.5 29 Z" fill="#6b3a24" ${W}/>`,
      top: `<path d="M22 16 L42 16 L40 9 L24 9 Z" fill="#fff" ${W}/><path d="M30 12.5 L34 12.5 M32 10.5 L32 14.5" stroke="#e0335c" stroke-width="1.8" stroke-linecap="round"/>`,
      collar: `<path d="M27 46 L32 51 L37 46" fill="#fff" ${W}/>`,
    }),
  };

  // ---------------------------------------------------------------- lobby portraits
  const eyes = (lx, rx, y, r = 2.2) => `<g class="a-eye"><circle cx="${lx}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${rx}" cy="${y}" r="${r}" fill="${INK}"/>
    <circle cx="${lx + r * .35}" cy="${y - r * .35}" r="${r * .3}" fill="#fff"/><circle cx="${rx + r * .35}" cy="${y - r * .35}" r="${r * .3}" fill="#fff"/></g>`;
  const smile = (y, w = 4) => `<path d="M${32 - w} ${y} Q32 ${y + 3} ${32 + w} ${y}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;

  const PORTRAITS = {
    '🦊': () => `<path d="M14 14 L24 22 L40 22 L50 14 L48 34 Q46 48 32 52 Q18 48 16 34 Z" fill="#e8742a" ${W}/>
      <path d="M17 18 L22 23 M47 18 L42 23" stroke="#f5e6c8" stroke-width="3" stroke-linecap="round"/>
      <path d="M17 34 Q24 34 32 44 Q40 34 47 34 Q45 48 32 52 Q19 48 17 34 Z" fill="#fff6e6" ${W}/>
      ${eyes(25, 39, 32)}<ellipse cx="32" cy="45" rx="3" ry="2.2" fill="${INK}"/>`,
    '🦉': () => `<path d="M14 14 L22 20 Q32 14 42 20 L50 14 L50 40 Q48 54 32 56 Q16 54 14 40 Z" fill="#8a5a2b" ${W}/>
      <path d="M22 44 Q32 52 42 44 L40 52 Q32 56 24 52 Z" fill="#c99a62"/>
      <circle cx="24" cy="31" r="8" fill="#f5e6c8" ${W}/><circle cx="40" cy="31" r="8" fill="#f5e6c8" ${W}/>
      <g class="a-eye"><circle cx="24" cy="31" r="4" fill="#e8a52a"/><circle cx="40" cy="31" r="4" fill="#e8a52a"/><circle cx="24" cy="31" r="2" fill="${INK}"/><circle cx="40" cy="31" r="2" fill="${INK}"/></g>
      <path d="M30 37 L34 37 L32 42 Z" fill="#d9a441" ${W}/>`,
    '🐈': () => `<path d="M14 12 L24 22 L40 22 L50 12 L50 36 Q50 52 32 52 Q14 52 14 36 Z" fill="#4a4048" ${W}/>
      <path d="M18 17 L22 22 M46 17 L42 22" stroke="#e0335c" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>
      <g class="a-eye"><ellipse cx="25" cy="33" rx="3.4" ry="3.8" fill="#9ccf4a"/><ellipse cx="39" cy="33" rx="3.4" ry="3.8" fill="#9ccf4a"/><ellipse cx="25" cy="33" rx="1" ry="3" fill="${INK}"/><ellipse cx="39" cy="33" rx="1" ry="3" fill="${INK}"/></g>
      <path d="M30 40 L34 40 L32 42.5 Z" fill="#e0335c"/><path d="M32 42.5 Q29 46 27 44 M32 42.5 Q35 46 37 44" fill="none" stroke="#f5e6c8" stroke-width="1.2"/>
      <path d="M8 38 L22 40 M8 44 L22 42 M56 38 L42 40 M56 44 L42 42" stroke="#f5e6c8" stroke-width="1.2" stroke-linecap="round"/>`,
    '🦚': () => `${[-40, -20, 0, 20, 40].map((a) => `<g transform="rotate(${a} 32 40)"><path d="M32 38 L32 15" stroke="#2f6fbf" stroke-width="1.6"/><ellipse cx="32" cy="14" rx="3.6" ry="4.6" fill="#2fb3a6" ${W}/><circle cx="32" cy="14.5" r="1.6" fill="#1f3fbf"/></g>`).join('')}
      <path d="M22 54 Q20 34 32 30 Q44 34 42 54 Z" fill="#2f6fbf" ${W}/>
      <path d="M26 38 Q32 33 38 38" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7"/>
      ${eyes(28, 36, 41, 1.8)}<path d="M30 46 L34 46 L32 50 Z" fill="#d9a441" ${W}/>`,
    '🐢': () => `<path d="M6 58 Q8 36 32 36 Q56 36 58 58 Z" fill="#6b8a3a" ${W}/>
      <path d="M18 58 L24 44 L40 44 L46 58 M32 36 L32 44 M24 44 L14 50 M40 44 L50 50" fill="none" stroke="#3f5a25" stroke-width="2"/>
      <ellipse cx="32" cy="24" rx="13" ry="12" fill="#9ccf4a" ${W}/>${eyes(26, 38, 22)}${smile(28, 5)}`,
    '🦁': () => `${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${(32 + Math.cos(a) * 18).toFixed(1)}" cy="${(33 + Math.sin(a) * 18).toFixed(1)}" r="8" fill="#b8682e" stroke="${INK}" stroke-width="1.6"/>`; }).join('')}
      <circle cx="32" cy="33" r="16" fill="#e8b04a" ${W}/>
      <circle cx="19" cy="20" r="4" fill="#e8b04a" ${W}/><circle cx="45" cy="20" r="4" fill="#e8b04a" ${W}/>
      ${eyes(26, 38, 30)}<path d="M29 37 L35 37 L32 40 Z" fill="${INK}"/>
      <path d="M32 40 Q29 44 26 42 M32 40 Q35 44 38 42" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
    '🐺': () => `<path d="M14 10 L24 22 L40 22 L50 10 L50 34 Q48 46 32 54 Q16 46 14 34 Z" fill="#8c8a98" ${W}/>
      <path d="M17 15 L22 21 M47 15 L42 21" stroke="#f5e6c8" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
      <path d="M24 38 Q32 34 40 38 L36 52 Q32 55 28 52 Z" fill="#e8e6ee" ${W}/>
      <g class="a-eye"><path d="M21 30 L29 31 L25 34 Z M43 30 L35 31 L39 34 Z" fill="#e8a52a" stroke="${INK}" stroke-width="1.4"/></g>
      <ellipse cx="32" cy="42" rx="3.4" ry="2.4" fill="${INK}"/>`,
    '🦋': () => `<g class="a-sway-w"><path d="M32 30 Q20 6 8 16 Q4 28 20 32 Q6 38 12 50 Q22 56 32 38 Z" fill="#7b6fd0" ${W}/>
      <path d="M32 30 Q44 6 56 16 Q60 28 44 32 Q58 38 52 50 Q42 56 32 38 Z" fill="#7b6fd0" ${W}/>
      <circle cx="17" cy="20" r="3.6" fill="#f0d08a"/><circle cx="47" cy="20" r="3.6" fill="#f0d08a"/><circle cx="18" cy="44" r="2.6" fill="#e0335c"/><circle cx="46" cy="44" r="2.6" fill="#e0335c"/></g>
      <ellipse cx="32" cy="34" rx="3" ry="13" fill="${INK}"/><path d="M31 22 Q27 14 24 13 M33 22 Q37 14 40 13" fill="none" stroke="${INK}" stroke-width="1.4"/>`,
    '🌙': () => `<path d="M40 8 Q14 10 14 34 Q14 56 40 58 Q22 50 22 33 Q22 16 40 8 Z" fill="#fff3cf" ${W}/>
      <g class="a-eye"><path d="M24 28 Q27 30 30 28" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/></g>
      <path d="M24 38 Q27 41 30 38" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
      <ellipse cx="22" cy="34" rx="2.4" ry="1.4" fill="#e0335c" opacity=".3"/>
      <path d="M48 18 L49 21 L52 22 L49 23 L48 26 L47 23 L44 22 L47 21 Z M52 40 L53 42 L55 43 L53 44 L52 46 L51 44 L49 43 L51 42 Z" fill="#fff8e6"/>`,
    '⭐': () => `<path d="M32 6 L39 23 L57 24 L43 36 L48 54 L32 44 L16 54 L21 36 L7 24 L25 23 Z" fill="#f5c542" ${W}/>
      ${eyes(27, 37, 30, 2)}${smile(36, 4)}<ellipse cx="23" cy="35" rx="2.2" ry="1.3" fill="#e0335c" opacity=".35"/><ellipse cx="41" cy="35" rx="2.2" ry="1.3" fill="#e0335c" opacity=".35"/>`,
    '🎩': () => `<ellipse cx="32" cy="48" rx="24" ry="6" fill="#1d1a24" ${W}/>
      <path d="M18 47 L20 14 Q32 10 44 14 L46 47 Q32 51 18 47 Z" fill="#2c2a3a" ${W}/>
      <path d="M19.4 38 Q32 42 44.6 38 L45 45 Q32 49 19 45 Z" fill="#a3123a"/>
      <path d="M24 16 Q26 30 25 42" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2.4" stroke-linecap="round"/>`,
    '🎭': () => `<g transform="rotate(-12 24 30)"><path d="M10 14 Q24 10 38 14 Q40 36 24 48 Q8 36 10 14 Z" fill="#f5e6c8" ${W}/>
        <path d="M16 24 Q19 21 22 24 M26 24 Q29 21 32 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
        <path d="M17 32 Q24 40 31 32 Z" fill="${INK}"/></g>
      <g transform="rotate(14 42 34)"><path d="M28 18 Q42 14 56 18 Q58 40 42 52 Q26 40 28 18 Z" fill="#a3123a" ${W}/>
        <path d="M34 30 Q37 27 40 30 M44 30 Q47 27 50 30" fill="none" stroke="#f5e6c8" stroke-width="2" stroke-linecap="round" transform="rotate(180 42 29)"/>
        <path d="M35 42 Q42 34 49 42" fill="none" stroke="#f5e6c8" stroke-width="2.2" stroke-linecap="round"/></g>`,
    '🌹': () => window.Art.item('rose'),
    '🍄': () => `<path d="M24 36 L22 54 Q32 58 42 54 L40 36 Z" fill="#f5e6c8" ${W}/>
      <path d="M6 36 Q8 10 32 9 Q56 10 58 36 Q32 42 6 36 Z" fill="#e0335c" ${W}/>
      <circle cx="20" cy="24" r="4" fill="#fff"/><circle cx="34" cy="17" r="3.4" fill="#fff"/><circle cx="46" cy="27" r="4.4" fill="#fff"/><circle cx="30" cy="31" r="2.4" fill="#fff"/>
      ${eyes(28, 36, 45, 1.8)}${smile(49, 3)}`,
    '🐝': () => `<g class="a-sway-w"><ellipse cx="22" cy="22" rx="7.5" ry="10" fill="#d6f0f8" fill-opacity=".85" ${W} transform="rotate(-25 22 22)"/>
      <ellipse cx="42" cy="22" rx="7.5" ry="10" fill="#d6f0f8" fill-opacity=".85" ${W} transform="rotate(25 42 22)"/></g>
      <ellipse cx="32" cy="38" rx="18" ry="16" fill="#f5c542" ${W}/>
      <path d="M16 34 Q32 30 48 34 M15 42 Q32 38 49 42" fill="none" stroke="${INK}" stroke-width="4"/>
      ${eyes(27, 37, 30, 2)}`,
    '🦜': () => `<path d="M16 58 Q12 30 32 14 Q52 16 52 36 Q50 50 40 58 Z" fill="#3fae5a" ${W}/>
      <path d="M30 14 Q34 4 42 6 Q38 10 36 15" fill="#e0335c" ${W}/>
      <path d="M44 30 Q58 30 56 44 Q52 38 44 40 Z" fill="#f0d08a" ${W}/>
      <circle cx="36" cy="28" r="5" fill="#fff" ${W}/><g class="a-eye"><circle cx="37" cy="28" r="2.4" fill="${INK}"/></g>
      <path d="M20 46 Q26 40 34 44" fill="none" stroke="#2f6fbf" stroke-width="3" stroke-linecap="round"/>`,
  };

  const svg = (cls, inner) => `<svg class="art face ${cls}" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;

  // Face for an in-game character (classic) or a lobby portrait.
  window.Art.character = (id) => (CHARACTERS[id] ? svg('bust', CHARACTERS[id]()) : '');
  window.Art.portrait = (key) => {
    if (!PORTRAITS[key]) return '';
    const inner = PORTRAITS[key]();
    return inner.startsWith('<svg') ? inner.replace('class="art ', 'class="art face pt-art ') : svg('pt-art', inner);
  };
})();
