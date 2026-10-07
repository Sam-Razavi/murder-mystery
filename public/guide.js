/* "How to play" slides and the cinematic prologue captions, in both
   languages. Slides: GUIDE[lang][mode] = 6 × {icon, title, text}; the count
   must match TUTORIAL_STEPS in game.js. Shown on the TV (public/tv.js),
   stepped by the host's phone. */
(function () {
  const GUIDE = {
    fa: {
      classic: [
        { icon: '🕯️', title: 'شب یلدا، عمارت فرهمند', text: 'آقابزرگ درست نیمه‌شب مُرد. یکی از مهمان‌ها قاتل است — و همین‌جا بین شما نشسته. بقیه باید پیش از طلوع آفتاب او را پیدا کنند.' },
        { icon: '🎭', title: 'نقش مخفی تو', text: 'روی گوشی‌ات یک شخصیت و یک نقش مخفی می‌گیری. بی‌گناه‌ها یک مأموریت مخفی هم دارند (امتیاز اضافه). فقط قاتل می‌داند با چه سلاحی و کجا. گوشی‌ات را به کسی نشان نده!' },
        { icon: '🔎', title: 'جست‌وجوی عمارت', text: 'هر دور هر کس یک اتاق را انتخاب می‌کند و پنهانی یک مدرک پیدا می‌کند. مدرک‌های واقعی هیچ‌وقت با هم تناقض ندارند.' },
        { icon: '🗡️', title: 'مدرک جعلی', text: 'قاتل هر دور یک مدرک دروغ در یکی از اتاق‌ها می‌کارد. نفر بعدی که آن اتاق را بگردد، دروغ را پیدا می‌کند. اگر دو مدرک تناقض داشتند، یکی‌شان جعلی است!' },
        { icon: '💬', title: 'بحث و بازجویی', text: 'با «نشان بده» مدرکت را روی تلویزیون بگذار. بعد همه رأی می‌دهند چه کسی بازجویی شود: اتاق‌هایی که گشته روی تلویزیون لو می‌رود و باید از خودش دفاع کند.' },
        { icon: '⚖️', title: 'اتهام نهایی', text: 'بعد از سه دور هر کس قاتل، سلاح و مکان را حدس می‌زند. جواب درست امتیاز دارد. اگر بیشترین رأی به قاتل نرسد، قاتل فرار می‌کند و امتیاز می‌گیرد. آماده‌اید؟' },
      ],
      items: [
        { icon: '🕯️', title: 'شب یلدا، عمارت فرهمند', text: 'آقابزرگ مُرد. وقتی چراغ‌ها برگشت، هر کس چیزی در دست داشت. هر که شب را با چاقو شروع کرده قاتل است — اما چاقوها از همان لحظه دست‌به‌دست شده‌اند.' },
        { icon: '🔪', title: 'چاقو و چیزهای دیگر', text: 'هر کس پنهانی یک چیز می‌گیرد. فقط چاقو می‌تواند تکرار شود (۴ نفر: ۱ قاتل، ۵ تا ۸ نفر: ۲ قاتل، ۹ تا ۱۲ نفر: ۳ قاتل). مهم نیست الان چاقو دست کیست؛ مهم این است که اول دست که بود.' },
        { icon: '🗣️', title: 'پچ‌پچ', text: 'هر دور یک سؤال روی تلویزیون می‌آید و همه روی گوشی جواب می‌دهند. همان موقع یک نفر (از ۹ نفر به بالا دو نفر) پنهانی یک کار مخفی می‌کند — کسی نمی‌فهمد چه کسی.' },
        { icon: '🫳', title: 'کارهای مخفی', text: 'سرک: ببین کسی چه در دست دارد. معاوضه: با یک نفر تصادفی عوض کن. دزدی: چیز یک نفر را بردار و مال خودت را بگذار. جابه‌جایی: چیز دو نفر دیگر را عوض کن. نتیجه فقط در دفترچه‌ی مخفی خودت می‌آید.' },
        { icon: '📓', title: 'دفترچه و گفت‌وگو', text: 'یادداشت‌هایت را بخوان و گفت‌وگو کن. بپرس «چه کسی اول چاقو داشت؟» — نه «الان چاقو دست کیست؟». راست بگو یا بلوف بزن!' },
        { icon: '⚖️', title: 'رأی نهایی', text: 'همه با هم به کسی رأی می‌دهند که فکر می‌کنند شب را با چاقو شروع کرده. رأی‌ها را پخش نکنید: تساوی یعنی بُرد قاتل‌ها.' },
      ],
    },
    en: {
      classic: [
        { icon: '🕯️', title: 'Yalda night, Farahmand mansion', text: 'Agha-bozorg died at the stroke of midnight. One of the guests is the killer — sitting right here among you. The rest must find them before sunrise.' },
        { icon: '🎭', title: 'Your secret role', text: 'Your phone gives you a character and a secret role. Innocents also get a secret mission (bonus points). Only the killer knows the weapon and the room. Never show your phone!' },
        { icon: '🔎', title: 'Search the mansion', text: 'Each round everyone picks a room on their phone and privately finds a clue. True clues never contradict each other.' },
        { icon: '🗡️', title: 'Forged clues', text: 'Every round the killer plants one fake clue in a room. The next person to search that room finds the lie. If two clues contradict each other, one of them is forged!' },
        { icon: '💬', title: 'Discuss and interrogate', text: 'Press “Show” to put a clue on the TV. Then everyone votes on who to interrogate: the rooms they searched are exposed on the TV and they must defend themselves.' },
        { icon: '⚖️', title: 'Final accusation', text: 'After three rounds everyone names the killer, the weapon and the room. Right answers score points. If the killer does not get the most votes, they escape and score. Ready?' },
      ],
      items: [
        { icon: '🕯️', title: 'Yalda night, Farahmand mansion', text: 'Agha-bozorg is dead. When the lights came back, everyone was holding something. Whoever started the night with the knife is a killer — but the knives have been changing hands ever since.' },
        { icon: '🔪', title: 'The knife and other items', text: 'Everyone secretly gets one item. Only the knife can be duplicated (4 players: 1 killer, 5–8: 2 killers, 9–12: 3 killers). It does not matter who holds the knife now; what matters is who had it first.' },
        { icon: '🗣️', title: 'Gossip', text: 'Each round a question appears on the TV and everyone answers on their phone. At the same moment one player (two from 9 players up) secretly takes an action — nobody knows who.' },
        { icon: '🫳', title: 'Secret actions', text: 'Snoop: see what someone holds. Swap: trade with a random player. Steal: take someone’s item and leave yours. Shuffle: swap two other players’ items. The result only appears in your own secret journal.' },
        { icon: '📓', title: 'Journal and discussion', text: 'Read your notes and talk. Ask “Who had the knife first?” — not “Who holds the knife now?”. Tell the truth or bluff!' },
        { icon: '⚖️', title: 'The final vote', text: 'Everyone votes together for whoever they think started the night with the knife. Don’t split your votes: a tie means the killers win.' },
      ],
    },
  };

  /* Cinematic prologue captions: [from, to, kicker, line], from/to as fractions
     of the prologue length (0..1), so they scale if the length changes. */
  const CINEMA = {
    fa: {
      skip: 'میزبان می‌تواند از روی گوشی‌اش این بخش را رد کند',
      captions: [
        [0.02, 0.15, 'شب یلدا · شیراز', 'بلندترین شب سال…'],
        [0.17, 0.33, 'عمارت فرهمند', 'آقابزرگ همه را دعوت کرده بود تا نیمه‌شب وصیت‌نامه‌اش را بخواند.'],
        [0.35, 0.50, '', 'ساعت به دوازده نزدیک می‌شد…'],
        [0.57, 0.66, '', '…و چراغ‌ها خاموش شد.'],
        [0.70, 0.80, '', 'وقتی نور برگشت، آقابزرگ دیگر نفس نمی‌کشید.'],
        [0.81, 0.88, '', 'یکی از شما قاتل است.'],
      ],
    },
    en: {
      skip: 'The host can skip this from their phone',
      captions: [
        [0.02, 0.15, 'Yalda night · Shiraz', 'The longest night of the year…'],
        [0.17, 0.33, 'The Farahmand mansion', 'Agha-bozorg gathered everyone to read his will at midnight.'],
        [0.35, 0.50, '', 'The clock crept toward twelve…'],
        [0.57, 0.66, '', '…and the lights went out.'],
        [0.70, 0.80, '', 'When the light returned, Agha-bozorg was no longer breathing.'],
        [0.81, 0.88, '', 'One of you is the killer.'],
      ],
    },
  };

  window.Guide = { GUIDE, CINEMA, steps: GUIDE.fa.classic.length };
})();
