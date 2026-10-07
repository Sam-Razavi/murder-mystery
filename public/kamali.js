/* Kāragāh Kamali (کارآگاه کمالی), the game's narrator on the TV: a Qajar-era
   gentleman detective with a tall felt kolah, a grand waxed moustache, a
   frock coat with a watch chain and a magnifying glass. He slides in from the
   corner, says a line in a speech bubble (typed out while his mouth moves),
   and slides away again. tv.js decides when he speaks; this file holds his
   portrait, his lines and the bubble. window.Kamali. */
(function () {
  // ------------------------------------------------------------ portrait
  // Moods are classes on the <svg>: m-neutral, m-sus (one brow up, eyes
  // narrowed), m-surprised (brows up, mouth round), m-pleased (eyes smiling).
  // Parts that move have their own class: brow, eye, mouth, mous, glint.
  function svg(mood = 'neutral') {
    const INK = '#2a1418';
    const S = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
    return `<svg class="kamali-art m-${mood}" viewBox="0 0 200 250" aria-hidden="true">
      <g class="k-body">
        <path d="M14 250 Q18 196 62 184 L84 172 L116 172 L138 184 Q182 196 186 250 Z" fill="#1d2440" ${S}/>
        <path d="M84 172 L100 214 L74 250 L50 250 Q52 210 70 190 Z" fill="#283257" ${S}/>
        <path d="M116 172 L100 214 L126 250 L150 250 Q148 210 130 190 Z" fill="#283257" ${S}/>
        <path d="M86 172 L114 172 L100 206 Z" fill="#f5e6c8" ${S}/>
        <path d="M93 176 L107 176 L100 188 Z" fill="#7a1f2e"/>
        ${[218, 232, 246].map((y) => `<circle cx="100" cy="${y}" r="3" fill="#d9a441" stroke="${INK}" stroke-width="1.2"/>`).join('')}
        <path d="M62 222 Q82 238 100 230" fill="none" stroke="#d9a441" stroke-width="2.4" stroke-dasharray="3 3"/>
        <circle cx="60" cy="222" r="5" fill="#d9a441" stroke="${INK}" stroke-width="1.4"/>
        <rect x="88" y="146" width="24" height="30" rx="8" fill="#d29f78" ${S}/>
        <ellipse cx="57" cy="118" rx="8" ry="12" fill="#e2ad86" ${S}/>
        <ellipse cx="143" cy="118" rx="8" ry="12" fill="#e2ad86" ${S}/>
        <ellipse cx="100" cy="114" rx="42" ry="50" fill="#e7b98f" ${S}/>
        <path d="M60 86 Q58 104 62 118 L66 118 Q64 100 68 88 Z M140 86 Q142 104 138 118 L134 118 Q136 100 132 88 Z" fill="#6b6470"/>
        <ellipse cx="74" cy="132" rx="9" ry="5" fill="#e0907a" opacity=".35"/>
        <ellipse cx="126" cy="132" rx="9" ry="5" fill="#e0907a" opacity=".35"/>
        <!-- the tall felt kolah -->
        <path d="M56 82 L63 10 Q100 0 137 10 L144 82 Q100 92 56 82 Z" fill="#17111c" ${S}/>
        <path d="M78 14 L74 80" stroke="#3d2f48" stroke-width="5" stroke-linecap="round" opacity=".8"/>
        <path d="M64 18 Q100 10 136 18" fill="none" stroke="#3d2f48" stroke-width="2"/>
        <!-- face -->
        <path class="brow brow-l" d="M66 99 Q78 89 93 96" fill="none" stroke="#2a1a14" stroke-width="6.5" stroke-linecap="round"/>
        <path class="brow brow-r" d="M107 96 Q122 89 134 99" fill="none" stroke="#2a1a14" stroke-width="6.5" stroke-linecap="round"/>
        <g class="eye eye-l"><ellipse cx="80" cy="109" rx="7" ry="5.5" fill="#fff"/><circle class="pupil" cx="81" cy="109.5" r="3.4" fill="#2a1a14"/></g>
        <g class="eye eye-r"><ellipse cx="120" cy="109" rx="7" ry="5.5" fill="#fff"/><circle class="pupil" cx="121" cy="109.5" r="3.4" fill="#2a1a14"/></g>
        <path d="M100 103 Q93 126 97 133 Q103 137 109 132 Q105 120 103 104" fill="#d9a47c" stroke="#a8714f" stroke-width="1.6" stroke-linejoin="round"/>
        <ellipse class="mouth" cx="100" cy="155" rx="7" ry="2.6" fill="#7a2e2a"/>
        <g class="mous">
          <path d="M100 140 Q86 131 72 139 Q60 146 51 133 Q52 150 66 152 Q84 155 100 146 Q116 155 134 152 Q148 150 149 133 Q140 146 128 139 Q114 131 100 140 Z" fill="#2b1a12" stroke="${INK}" stroke-width="1.6"/>
          <path d="M51 133 Q47 126 52 123" fill="none" stroke="#2b1a12" stroke-width="3" stroke-linecap="round"/>
          <path d="M149 133 Q153 126 148 123" fill="none" stroke="#2b1a12" stroke-width="3" stroke-linecap="round"/>
        </g>
      </g>
      <!-- the magnifying glass -->
      <g class="k-glass">
        <path d="M168 238 L150 206" stroke="#6b3a24" stroke-width="9" stroke-linecap="round"/>
        <circle cx="170" cy="240" r="11" fill="#e2ad86" ${S}/>
        <circle cx="140" cy="188" r="19" fill="#cfe8f5" fill-opacity=".35" stroke="#d9a441" stroke-width="6"/>
        <path class="glint" d="M128 182 Q132 173 141 172" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      </g>
    </svg>`;
  }

  // ------------------------------------------------------------ lines
  // One list per moment; a random line is picked. {victim}, {name} and {x}
  // are filled in by tv.js. Same keys in both languages.
  const LINES = {
    fa: {
      welcome: ['خانم‌ها، آقایان… کارآگاه کمالی، در خدمت شما. کد را اسکن کنید و بنشینید؛ امشب شب درازی است.', 'به به، مهمان‌های امشب! بنده کمالی هستم، کارآگاه. لطفاً با گوشی‌هایتان وارد شوید.'],
      intro: ['{victim} مُرده است. و قاتل… همین‌جا، در همین اتاق نشسته.', 'سی سال است جنایت می‌بینم، حضرات. امشب هم یکی از شما دستش به خون {victim} آلوده است.'],
      search1: ['بگردید، با دقت بگردید. اما یادتان باشد: یکی از این مدارک را یک دروغگو کاشته.', 'هر اتاقی رازی دارد. ببینیم امشب کدام راز نصیب شما می‌شود.'],
      search: ['دوباره سر کار! حقیقت در گوشه‌وکنار این خانه پنهان است.', 'قاتل هم دارد می‌گردد… دنبال جایی برای دروغ تازه‌اش.'],
      discuss: ['خب، چه پیدا کردید؟ هر مدرکی روی تابلو، ما را یک قدم نزدیک‌تر می‌کند.', 'حرف بزنید، حضرات. ساکت‌ترین آدم این جمع همیشه مشکوک‌ترین است.'],
      vote: ['چه کسی را بازجویی کنیم؟ با عقلتان انتخاب کنید، نه با دلتان.', 'یک نفر باید زیر نور چراغ برود. به چه کسی شک دارید؟'],
      spotlight: ['{name}، بفرمایید. توضیح بدهید… آرام و شمرده.', 'خب {name}… بنده سراپا گوشم. امشب کجا بودید؟'],
      final: ['لحظه‌ی حقیقت است. قاتل، سلاح، مکان. اشتباه کنید، قاتل قسر درمی‌رود.', 'آخرین فرصت، حضرات. یک چای دیگر بنوشید و درست انتخاب کنید.'],
      caught: ['همان‌طور که از اولین استکان چای حدس می‌زدم. آفرین، حضرات!', 'دیدید؟ هیچ دروغی تا صبح دوام نمی‌آورد.'],
      escaped: ['از چنگمان گریخت… امشب، قاتل برنده شد.', 'افسوس! این بار قاتل از ما زرنگ‌تر بود. دفعه‌ی بعد…'],
      conflict: ['آها! این دو مدرک نمی‌توانند هر دو راست باشند. کسی به ما دروغ گفته.', 'عجب… این‌ها با هم نمی‌خوانند. یکی از این کاغذها جعلی است.'],
      dupe: ['یک مدرک، دو بار؟ چه جالب… یکی از این دو نفر کپی قاتل را در دست دارد.'],
      nofit: ['هیچ‌کس با این نشانه‌ها جور نیست… پس یکی از نشانه‌ها دروغ است.'],
      oneWeapon: ['فقط {x} مانده. هوم… حالا داریم به جایی می‌رسیم.'],
      oneRoom: ['فقط {x} مانده. قتل همان‌جا اتفاق افتاده… مگر اینکه کسی دروغ گفته باشد.'],
      pause: ['مکث؟ بسیار خوب. کارآگاه هم گاهی به یک استکان چای احتیاج دارد.'],
      summary: ['چه شبی! این ماجرا را حتماً در خاطراتم می‌نویسم.'],
      itIntro: ['هر کس چیزی در دست دارد. یادتان باشد: مهم این است که چاقو اول دست چه کسی بود.'],
      gossip1: ['راستش را بگویید… یا نگویید. بنده چهره‌هایتان را می‌بینم.'],
      itDiscuss: ['چاقو دست‌به‌دست شده. ردّش را تا اول شب دنبال کنید.', 'چیز چه کسی عوض شده؟ چه کسی دروغ می‌گوید؟ بپرسید، حضرات.'],
      itFinal: ['با هم رأی بدهید. تساوی یعنی قاتل‌ها آزاد می‌شوند.'],
      itWin: ['ردّ چاقو را تا آخر گرفتید. آفرین!'],
      itLose: ['چاقو گم شد… و قاتل‌ها با آن. امشب حق با آن‌ها بود.'],
    },
    en: {
      welcome: ['Ladies and gentlemen… Kāragāh Kamali, at your service. Scan the code and take your seats; it will be a long night.', 'Ah, tonight’s guests! I am Kamali, detective. Please join with your phones.'],
      intro: ['{victim} is dead. And the killer… is sitting right here, in this very room.', 'Thirty years I have looked at crimes, my friends. Tonight, one of you has {victim}’s blood on their hands.'],
      search1: ['Search, search carefully. But remember: one of these clues was planted by a liar.', 'Every room has a secret. Let us see which one finds you tonight.'],
      search: ['Back to work! The truth hides in the corners of this house.', 'The killer is searching too… for a place to hide a fresh lie.'],
      discuss: ['Well, what did you find? Every clue on that board brings us one step closer.', 'Talk, my friends. The quietest person in the room is always the most suspicious.'],
      vote: ['Whom shall we question? Choose with your head, not your heart.', 'Someone must step into the light. Whom do you suspect?'],
      spotlight: ['{name}, please. Explain yourself… slowly, and clearly.', 'So, {name}… I am all ears. Where were you tonight?'],
      final: ['This is the moment of truth. The killer, the weapon, the room. Choose wrongly, and they walk free.', 'Last chance, my friends. Have one more glass of tea, and choose well.'],
      caught: ['Just as I suspected from the first glass of tea. Well done, my friends!', 'You see? No lie survives until morning.'],
      escaped: ['They slipped through our fingers… Tonight, the killer wins.', 'Alas! This time the killer was cleverer than us. Next time…'],
      conflict: ['Aha! These two clues cannot both be true. Someone has lied to us.', 'Curious… these do not agree. One of these papers is a forgery.'],
      dupe: ['The same clue, twice? How interesting… one of those two holds the killer’s copy.'],
      nofit: ['Nobody matches these traits… so one of the trait clues is a lie.'],
      oneWeapon: ['Only the {x} is left. Hmm… now we are getting somewhere.'],
      oneRoom: ['Only the {x} is left. That is where it happened… unless someone has lied.'],
      pause: ['A pause? Very good. Even a detective needs a glass of tea now and then.'],
      summary: ['What a night! I shall certainly write about it in my memoirs.'],
      itIntro: ['Everyone is holding something. Remember: what matters is who had the knife first.'],
      gossip1: ['Answer honestly… or don’t. I am watching your faces.'],
      itDiscuss: ['The knife has changed hands. Follow its trail back to the start of the night.', 'Whose item changed? Who is lying? Ask, my friends.'],
      itFinal: ['Vote together. A tie, and the killers go free.'],
      itWin: ['You followed the knife to the very end. Well done!'],
      itLose: ['The knife was lost… and the killers with it. Tonight, they win.'],
    },
  };

  // ------------------------------------------------------------ speech bubble
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let el = null;
  let queue = [];
  let busy = false;
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  function mount(name) {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'kamali';
    el.className = 'kamali';
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<div class="kam-portrait"></div><div class="kam-bubble"><div class="kam-name"></div><p class="kam-text"></p></div>`;
    el.querySelector('.kam-name').textContent = name;
    document.body.appendChild(el);
    return el;
  }

  function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
  }

  // One line at a time; a backlog of more than two is dropped (stale news).
  function say(lang, key, { vars, mood = 'neutral', name, onSpeak } = {}) {
    const list = (LINES[lang] || LINES.fa)[key];
    if (!list || !list.length) return;
    if (queue.length >= 2) queue.shift();
    queue.push({ text: fill(list[Math.floor(Math.random() * list.length)], vars), mood, name, onSpeak });
    if (!busy) next();
  }

  function next() {
    const line = queue.shift();
    if (!line) { busy = false; return; }
    busy = true;
    const box = mount(line.name);
    box.querySelector('.kam-name').textContent = line.name;
    box.querySelector('.kam-portrait').innerHTML = svg(line.mood);
    const textEl = box.querySelector('.kam-text');
    const chars = [...line.text];
    box.classList.add('on', 'talking');
    if (line.onSpeak) line.onSpeak();
    if (reduced) {
      textEl.textContent = line.text;
      box.classList.remove('talking');
    } else {
      // Typed out while his mouth moves.
      textEl.textContent = '';
      chars.forEach((c, i) => later(400 + i * 32, () => { textEl.textContent += c; }));
      later(400 + chars.length * 32, () => box.classList.remove('talking'));
    }
    const stay = Math.min(10000, 2600 + chars.length * 55);
    later(stay, () => {
      box.classList.remove('on');
      later(700, next);
    });
  }

  // Leave the screen at once (e.g. the cinematic starts or the game ends).
  function hush() {
    timers.forEach(clearTimeout);
    timers = [];
    queue = [];
    busy = false;
    if (el) el.classList.remove('on', 'talking');
  }

  window.Kamali = { svg, say, hush, LINES };
})();
