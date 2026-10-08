# ضیافت آخر — Ziafat-e Akhar ("The Last Feast")

A Farsi (and English) murder-mystery party game for 4–12 players: up to 8 in the classic mode, up to 12 in «دست‌به‌دست». One shared TV screen, and everyone plays on their own phone.
It's a social-deduction game in the spirit of *Dead Man's Party*, but with its own story, characters and rules. Nothing comes from the Knives Out IP.

> 🎲 **A fun hobby project.** This is a game made for family and friends to play together on Yalda night and Nowruz, not a commercial product.
>
> 🤖 **Vibecoded with Claude.** Almost all of the code, art, story text and tests were written by [Claude](https://claude.ai) (Anthropic's AI) through Claude Code, steered by conversation: describing what the game should feel like, playing it, and asking for changes. The illustrations, including Kāragāh Kamali, are hand-written SVG that Claude drew in code.

**Setting:** It's Yalda night at the Farahmand family's old mansion in Shiraz. Agha-bozorg (the grandfather) called everyone together to read his will at midnight. When the clock strikes twelve, he's dead. One of the guests is the killer.

Same architecture as `guess-the-music`: Node + Express + Socket.IO on the always-on PC, the TV shows `/tv`, and phones join by scanning a QR code.

## Screenshots

All screenshots are from real games played against the bots, captured at TV size (16:9) and phone size. They're shown in English; every screen also comes in Farsi, right to left.

### The TV

| | |
|---|---|
| ![Lobby: players join by scanning the QR code](docs/screenshots/tv-lobby.jpg) | ![The cinematic prologue: the clock about to strike twelve over the mansion](docs/screenshots/tv-cinematic-clock.jpg) |
| **Lobby.** Everyone scans the QR code and picks a portrait; the host runs the game from their phone. | **Cinematic prologue.** The clock creeps toward midnight… and the lights go out. |
| ![The suspects: each player gets a character with visible traits](docs/screenshots/tv-intro-suspects.jpg) | ![How to play, shown on the TV and stepped from the host's phone](docs/screenshots/tv-tutorial.jpg) |
| **The suspects.** Each player becomes a family member with visible traits (glasses, left-handed, smoker, rose perfume). | **How to play.** Six slides on the TV, stepped from the host's phone. |
| ![Searching the house, with the "what's happening now" bar](docs/screenshots/tv-search.jpg) | ![The evidence board with clue tags, the case file and Kāragāh Kamali](docs/screenshots/tv-evidence-board.jpg) |
| **Search.** The bar at the top shows the round's steps, what to do now and who we're waiting for. | **Evidence board.** Every clue says what it proves; the case file adds them up, and Kāragāh Kamali comments. |
| ![Interrogation: the suspect's searched rooms and the votes are exposed](docs/screenshots/tv-spotlight-kamali.jpg) | ![Lights out: the killer reaches for a clue in the dark](docs/screenshots/tv-lights-out.jpg) |
| **In the spotlight.** The most-voted player's rooms and the ballots come out; Kamali asks for an explanation. | **Lights out.** A twist: in the dark, the killer may make a clue vanish while everyone else guards one. |
| ![Kamali's gold-edged hunch and a contradiction on the board](docs/screenshots/tv-hunch-contradiction.jpg) | ![The scoreboard after the reveal](docs/screenshots/tv-scoreboard.jpg) |
| **Kamali's hunch.** In the last round the detective pins one true fact; the case file flags a duplicated clue. | **Scoreboard.** Points add up across the night. |

### Kāragāh Kamali

Our narrator: a Qajar-era Persian detective in a tall felt kolah, with a waxed moustache, a watch chain and a magnifying glass. He's drawn in SVG and animated (he blinks, breathes and talks), and slides in to react to the game. You can see him in the spotlight and evidence-board shots above.

### Hand to Hand («دست‌به‌دست»)

| | |
|---|---|
| ![A gossip question on the TV, with answer progress and the items in play](docs/screenshots/tv-gossip.jpg) | ![The gossip results with the most-picked player crowned](docs/screenshots/tv-gossip-result.jpg) |
| **Gossip.** Everyone answers a question while one player secretly snoops, swaps, steals or shuffles. | **Gossip results.** Bars spring out and the most-picked player gets the crown. |
| ![Discussion: who STARTED with the knife?](docs/screenshots/tv-items-discuss.jpg) | ![The final vote and how it's decided](docs/screenshots/tv-items-final.jpg) |
| **Discussion.** The question isn't who has the knife now, but who had it first. | **Final vote.** One vote, three outcomes. |
| ![The verdict lands like a stamp](docs/screenshots/tv-verdict.jpg) | ![The killers are unmasked](docs/screenshots/tv-killers-unmasked.jpg) |
| **The verdict.** A drumroll, then the result lands like a stamp. | **Unmasked.** Who started the night with a knife. |
| ![The knife trail: every knife traced back to its first owner](docs/screenshots/tv-knife-trail.jpg) | ![End of the night: the champion and the awards](docs/screenshots/tv-end-of-night.jpg) |
| **The knife trail.** Each knife's path drawn round by round, through every swap, including one in the dark. | **End of the night.** Tonight's champion and the awards (best liar, sharpest detective, …). |

### The second story: Turn of the Year (Nowruz)

| | |
|---|---|
| ![The Nowruz story's lobby with the Ramsar villa by the sea](docs/screenshots/tv-nowruz-lobby.jpg) | ![The cinematic's title card](docs/screenshots/tv-cinematic-title.jpg) |
| **Nowruz in Ramsar.** A year later, at the family's villa by the Caspian, with blossom drifting instead of snow. | **Title card.** The end of the cinematic prologue. |

### The phones

| | | | |
|---|---|---|---|
| ![Joining the game](docs/screenshots/phone-join.jpg) | ![The host's settings](docs/screenshots/phone-host-settings.jpg) | ![The killer forges a clue and may burn one](docs/screenshots/phone-killer-forge.jpg) | ![The killer's clues: what they burned and planted](docs/screenshots/phone-killer-clues.jpg) |
| **Join** with a name, no app needed. | **Host settings:** language, mode, story, length, beginner mode, twists. | **The killer forges** a lie, picks a room, and may burn a clue. | **The killer's notes:** the burned clue, planted fakes, forged copies. |
| ![Lights out on the killer's phone](docs/screenshots/phone-lights-out.jpg) | ![The final accusation](docs/screenshots/phone-final-accusation.jpg) | ![Hand to Hand: the item you're holding](docs/screenshots/phone-item.jpg) | ![The secret journal: what you know for sure](docs/screenshots/phone-journal.jpg) |
| **Lights out:** the same list on every phone, so nobody can tell who's doing what. | **Final accusation:** killer, weapon and room. | **Hand to Hand:** your item, and the reminder that only your *starting* item counts. | **Secret journal:** the hard facts at the top. |
| ![Your night: personal stats at the end](docs/screenshots/phone-your-night.jpg) | | | |
| **Your night:** your stats and awards at the end. | | | |

## Run it

```bash
npm install
npm start
```

- TV: `http://localhost:3100/tv` (kiosk/fullscreen)
- Phones: scan the QR code on the TV. The URL is also printed in the console.

Requires Node 18+. The phones and the PC have to be on the same Wi-Fi/LAN. The game uses no internet at runtime, because the fonts are bundled.

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3100` | Server port (guess-the-music uses 3000) |
| `PUBLIC_HOST` | auto | LAN IP for the QR code, if auto-detection picks the wrong adapter |
| `MIN_PLAYERS` | `4` | Lower it for testing |
| `TIME_SCALE` | `1` | >1 runs every timer faster (testing) |
| `CINEMATIC_SECONDS` | `26` | Length of the TV cinematic before the story intro; `0` turns it off |
| `SAVE_FILE` | `data/night.json` | Where the night is saved; `off` turns saving off |
| `SAVE_MAX_HOURS` | `12` | An older save counts as a new night and is ignored |
| `GAME_LOG` | `data/games.jsonl` | Balance log, one line per finished game; `off` turns it off |

**The night survives a restart.** The server saves the players, scores, the night's stats and the host's settings to `data/night.json` whenever they change. If the PC restarts or the server crashes, start it again: everyone is back in the lobby with their scores, and phones reconnect by themselves (they remember who they are). A game in progress is lost, but not the night. A save older than 12 hours is ignored, and «شب تازه» / "New night" resets it.

**Is it balanced?** Every finished game adds one line of numbers to `data/games.jsonl`: who won, how many forgeries reached someone or made it to the board, how many clues were pinned, how many players named the killer, the table size, and so on. It contains no names. `npm run stats` turns it into a report for each mode and story, with a hint when one side wins too often (games with bots are left out unless you add `-- --bots`).

## Playing with fewer than 4 people (bots)

With 2–3 people, fill the empty seats with bots. Start the server, then in a second terminal:

```bash
npm run bots        # 2 bots (two people + two bots)
npm run bots -- 1   # or any number, e.g. 1 bot for three people
```

Bots wait until a real person has joined, so a person is always the host (bots never take over hosting, even if the host's phone drops). They mark themselves ready and stay for every following game. They play a simple honest game after a short delay. In the classic mode, innocent bots pin their clues and vote and accuse among the suspects, weapons and rooms the evidence still allows (the same logic as the TV's case file), while a killer bot frames someone the evidence points at and only now and then shows its own fakes. In «دست‌به‌دست», bots accuse whoever they know had a knife, and never someone they know started innocent. They can't talk, so judge them by their clues and votes. Bots show up as "Bot Sam", "Bot Mina", … Stop them with Ctrl+C.

## Tutorial, cinematic and soundtrack

- **How to play (tutorial):** in the lobby the host taps «📖 آموزش بازی روی تلویزیون» / "How to play (on the TV)". Six slides appear full-screen on the TV (a different set for each game mode, in the game's language) and the host steps through them with Back / Next / Close on their phone. Slides live in `public/guide.js`.
- **Cinematic intro:** when a game starts, the TV plays a ~26 second animated prologue (Yalda night, the mansion, the clock striking twelve, the lights going out, a candle, the title card) before the story intro. The host can skip it from their phone: the first tap of the skip button ends only the cinematic, the next one skips the story intro as usual. Captions are in the game's language. Reconnecting the TV mid-cinematic resumes at the right moment. `CINEMATIC_SECONDS=0` disables it.
- **Soundtrack (TV only, never on phones):** put your music in `public/audio/` as `theme.mp3` (loops through the lobby and game, getting quieter or louder with each phase) and optionally `intro.mp3` (plays once during the cinematic). With no files the game stays silent apart from its built-in effects. See `public/audio/README.txt`. Browsers block sound until the page is interacted with: click the TV page once, or launch Chrome with `--autoplay-policy=no-user-gesture-required`. Press **M** on the TV to mute.

## Kāragāh Kamali, the detective

The TV has a narrator: **Kāragāh Kamali (کارآگاه کمالی)**, a Qajar-era gentleman detective with a tall felt kolah, a grand waxed moustache, a frock coat with a watch chain and a magnifying glass. He is hand-drawn and animated: he breathes, blinks, twitches his moustache and talks as his words type out. His face changes with his mood (suspicious, surprised, pleased).

He slides in from the corner with a short sound and a speech bubble to react to the game: each phase, the person in the spotlight, a contradiction or duplicate clue appearing on the board (when the case file is on), the last weapon or room left, a pause, and the verdict. His lines are in `public/kamali.js`, in both languages.

## Twists (host setting, on by default)

- **Lights out** (once per game, between two rounds): the TV goes dark around a flickering candle. Every phone shows the clues on the evidence board, so a glance gives nothing away. The killer taps one to make it vanish, and everyone else taps one to guard it. A guarded clue survives: the TV says someone reached for it, and its guards learn it on their phones. Otherwise it is gone for good, from the board and from its owner's hand, and an empty pin shows whose clue it was. If the killer doesn't choose, the dark takes one at random. In «دست‌به‌دست», two random players' items swap in the dark instead; the two only learn that their item changed, and the knife trail shows it.
- **Burned evidence** (killer, once per game): while forging, the killer may also burn a room. Its next true clue goes up in smoke, and the killer learns what it said. Whoever searches there finds ashes, which they can pin.
- **Kamali's hunch** (at the start of the last discussion): the detective pins one true fact the board hasn't settled yet, a weapon or room that wasn't involved, on a gold-edged card.

## Easier to follow

- **"What's happening now" bar (TV):** under the header during play. It shows this round's steps with the current one highlighted, one line on what to do right now, and who the game is still waiting for.
- **Clue tags:** every classic clue card says in one line what it proves ("Not the weapon: Samovar", "Killer: Left-handed", "Has an alibi: Shirin"). The tag appears on the phone and on the TV evidence board. The engine stores this as `about` on each card.
- **Case file (TV, classic, host setting, on by default):** next to the evidence board, it shows which weapons and rooms the pinned clues rule out, what they say about the killer's traits, and which suspects still match. It flags contradictions, each of which means a forgery is on the board: two trait clues that disagree, every weapon or room ruled out, the same clue shown by two players, or nobody matching the traits. The host can switch it off mid-game for a harder table.
- **Notebook suggestions (phone, classic):** your own clues pre-mark what they rule out with a dashed ✕. Tap to confirm it. The killer, whose cards are all lies, gets no suggestions.
- **Beginner mode / "first game" (host setting, on by default):** action timers are 1.5× longer, each phone screen shows a one-line rule tip, and before the first game the start button offers "Rules first, then start", which opens the tutorial on the TV.
- **Round recap (TV):** while everyone searches, the TV recaps the last round: the clues pinned, who was interrogated, and what is ruled out so far. In Hand to Hand, the gossip screen shows the previous question and its answer.
- **"What you know for sure" (phone, Hand to Hand):** a box at the top of the journal lists hard facts. These are your starting item, anyone whose starting item you saw in round 1 (which tells you if they are a killer), every knife sighting, later snoops, and the rounds your item changed.

## Host tools and the rest of the night

- **Pause (⏸ in the host bar):** freezes the phase timer, for example when someone gets up for tea. Players can still tap, but nothing advances until the host taps ▶. The TV shows a pause card and every phone shows a banner. Pausing isn't available during the cinematic.
- **Latecomers watch:** a phone that scans the QR code mid-game gets a watch-only view (phase, timer, what's happening, the evidence board or the gossip question, and the players) instead of an error. The join form comes back when the host returns to the lobby.
- **Take over a dropped seat:** if a player's phone drops mid-game, a latecomer's watch screen offers that seat. They type their name and tap the seat, and the host gets an Allow / No prompt on their phone. On Allow, the latecomer's phone becomes that player: same character, role, clues and journal, under the newcomer's name. If the original phone reconnects first, the request is dropped.
- **End of the night:** from the results screen, the host taps «🌙 پایان شب» / "End the night". The TV crowns tonight's champion and hands out awards (best liar, sharpest detective, mission master, most wins), and each phone shows the player's own numbers. From there the host goes back to the lobby (scores stay) or starts a fresh night.
- **TV scaling:** the TV is sized in `rem`, which follows whichever is tighter: the width, or the height of a 16:9 screen. Ultrawide screens and browsers that aren't fullscreen shrink the layout instead of overflowing it.

## How a game plays (≈20–25 min, or ≈10 in a quick game)

**Quick game (host setting, classic):** 2 rounds instead of 3, timers about 25% shorter and discussions capped at 1:30. That makes a game about 10 minutes, so there's time for "one more". The *Stubborn* mission needs two interrogations, so it isn't dealt in a quick game.

1. **Lobby:** Players join on their phones and pick an emoji portrait. The first person to join is the host 👑 and controls start/skip from their phone. Everyone presses «آماده‌ام» (Ready), and the host can start once every online player is ready.
2. **Intro:** Everyone is secretly assigned a character (e.g. the bankrupt eldest son or the family lawyer). Each character has visible **traits** (👓 glasses, ✋ left-handed, 🚬 smoker, 🌹 rose perfume). One player is told they are the **killer** and learns the weapon and the room. Every innocent player gets a **secret mission** worth bonus points.
3. **Three rounds, each with these phases:**
   - **Search:** Innocents each pick one of 6 rooms and privately receive a clue. Clues can rule out weapons or rooms, reveal one of the killer's traits, give someone an alibi, or expose a motive. At the same time, the killer **forges a lie** and plants it in a room. The next person to search that room picks up the fake instead of a real clue.
   - **Discussion:** Players talk. Anyone can press "نشان بده" to pin a clue to the TV evidence board.
   - **Interrogation (rounds 1–2):** Everyone votes. The player with the most votes is put in the spotlight. The TV shows **every room they have searched** and who voted for whom, and they must defend themselves.
4. **Final accusation:** Everyone names a killer, a weapon and a room.
5. **Reveal** (the host can tap ⏩ on their phone to jump straight to the scores): The TV shows the vote tally, then the killer, then the weapon and room, then every forged clue (where it was planted and who was fooled by it), then the mission results, then the scoreboard.

**Deduction hooks:** True clues never contradict each other. Forged clues do. The killer is "seen" in whichever room they plant in, and interrogation exposes those rooms. The killer also holds a copy of each forgery. If both copies end up on the board, the duplicate gives away who planted it.

## Second mode: «دست‌به‌دست» (Hand to Hand)

The host chooses the mode in the lobby on their phone. This mode follows the item-passing social-deduction rules (in the spirit of *Dead Man's Party*). It uses the same Yalda-night setting and has no characters, clues or rooms.

- **Starting items:** Everyone secretly gets one item. **Whoever starts with 🔪 is a killer.** With 4 players there is 1 knife, with 5–8 players there are 2, and with 9–12 players there are 3. The knife is the only item that can be duplicated. Everyone can see which items are in play, but not who holds them.
- **Gossip rounds (4, 6 or 8; the host picks in the lobby, along with 30/40/60 seconds to answer):** The TV asks a gossip question ("Who has the most suspicious laugh?") and everyone answers on their phone. At the same time, one random player also gets a **secret action** on their phone. From 9 players up, **two** different players get one each round, so everyone gets a turn without a longer game. Everyone gets an action once before anyone gets a second one. The actions are:
  - 🕵️ **Snoop:** see another player's current item.
  - 🔄 **Swap:** exchange items with a *random* player. You find out who it was.
  - 🫳 **Steal:** take a chosen player's item and give them yours.
  - 🔀 **Shuffle:** exchange the items of two other players. Your own item stays put.

  Moves take effect when the round ends (snoops see the item as the round started). A victim is told only that their item changed, not who changed it or how many actions touched it. A knife-for-knife exchange looks like no change at all. If the actor runs out of time, the game picks for them, so a frozen player doesn't give themselves away.
- **House rules (optional, off by default, set in the lobby):**
  - *Quiet rounds:* each round has a 1-in-4 chance of no secret action, but there are never two quiet rounds in a row. The TV then stops showing the action count, since that would reveal which rounds were quiet.
  - *Killers know each other:* with two or three killers, each killer's phone names the others.
- **Discussion** after every 2 rounds. Each phone keeps a private journal of everything its owner saw or did, plus a tracker for marking suspects.
- **Final vote:** If one player has the most votes and that player **started** with a knife, the innocents win. If an innocent gets the most votes, the killers win. A tie also goes to the killers, unless everyone in the tie is a killer.
- **Sound:** The TV plays a soft chime when each gossip question appears, and a rustle of items at the end of *every* round, so the sound never gives away whether anything moved. Phones stay silent for the same reason.
- **Reveal:** The TV shows the tally, then the verdict, then who started with the knives, then the full item timeline (every action and every move, one row per round).
- **Big tables:** The lobby takes up to 12 phones. The classic mode still needs one character per player, so with more than 8 people the host's start button explains that and stays disabled. With 9+ players the TV switches to a denser layout.
- **Scoring:** If the killers win, each killer gets **+3**. If the innocents win, each innocent gets **+2**. Every innocent who voted for a killer gets **+1** either way.

### Scoring — classic mode (accumulates across games)
- Innocent: correct killer **+3**, correct weapon **+1**, correct room **+1**, secret mission completed **+2**
- Killer: escapes, i.e. does not get the most votes in the final accusation (a tie for most still counts as caught) **+5**; plus **+1** for each forged clue that reached another player

### Phone features
The phone screen stays awake during the game (no dimming in a long discussion). It uses [NoSleep.js](https://github.com/richtr/NoSleep.js) (MIT): the Wake Lock API where the browser allows it, otherwise a tiny muted looping video, which also works on plain http on the LAN. Browsers only allow it after a tap, so it switches on with the first tap on the phone.

Private role card (tap to reveal, hides itself after 15 seconds), clue hand with pin-to-TV, a deduction notebook (tap to mark ✕ or ؟, saved per game), reconnect-safe identity (the phone remembers who it is), and vibration when it's your turn to act.

## Languages: فارسی and English
The host picks the language in the lobby, and it applies to the TV and every phone. It can't be changed mid-game; a change from the lobby applies to the next game.

- **Farsi** is right-to-left with Persian digits. **English** is left-to-right with Latin digits.
- The English version tells the same story: Yalda night in Shiraz, the Farahmand family, the same characters and items.
- **Where the text lives:**
  - Story content: `content.js` (Farsi) and `content.en.js` (English), with the same keys and ids.
  - Interface text: written in Farsi in the code, with the English in one dictionary, `public/i18n.js`, shared by the server and both screens.
- **To add or change interface text:** write it in Farsi wrapped in `t('…')` (screens) or `this._t('…')` (engine), then add its English to `public/i18n.js`.
- **Checks:** half of the simulated games run in English, and `test/e2e.js` plays a 10-player English game. Both fail if any Persian character reaches a screen in English.

## Look & feel
- **Living backdrop (TV):** A night sky with a glowing moon, twinkling stars and falling snow. Along the bottom is the Farahmand mansion's skyline (domes, wind-catchers, cypresses), and its windows flicker like candlelight. It calms down on busy screens like the reveal and the scoreboard (`public/scene.js`). In the Nowruz story it becomes the Ramsar villa by the Caspian at night, with blossom drifting instead of snow.
- **Curtain transitions:** Each new phase opens with velvet drapes closing over a gold title card, then parting to show the new screen as it animates in. The steps inside a reveal and the short gossip result skip the curtain.
- **Illustrated items:** The classic mode's weapons, rooms and 4 suspect traits (both stories), and all 15 «دست‌به‌دست» items, are hand-drawn vector art (`public/art.js`) instead of emoji, with small idle animations on big displays: the knife glints, the candle flickers, the tea steams, the tasbih sways. On the phone, your item flips over like a card when you reveal it.
- **The reveal as a show:** A snare drumroll builds for two seconds before the verdict, then the verdict lands like a rubber stamp. Killers start behind dark masks that shake and drop away one at a time. In «دست‌به‌دست», the last step is the **knife trail**: a chart with a column per player and a row per round, each cell showing the item that player held. Each knife's coloured line draws itself row by row back to whoever started with it, following knife-for-knife swaps too, and this step stays up twice as long. In the classic game, the weapon and room cards turn over one after the other.
- **Gossip rounds:** The question inks itself in like a pen stroke. A progress bar and a soft blip track who has answered. The result bars spring out one after another, the most-picked players glow, and a gold 👑 banner stamps their name.
- **Illustrated faces:** Each of the 8 classic characters is a drawn bust (Bahram's moustache and suit, Khanom-jan's patterned headscarf, Dr. Sadri's white coat and stethoscope). The busts show the character's visible traits, so the four characters with glasses wear them. The 16 lobby portraits are drawn animals and objects. Faces blink on the big reveal screens (`public/faces.js`).
- Everything is inline SVG, CSS and canvas: no image files, no internet needed. All motion stops if the device asks for reduced motion.

## Edit the content
All Persian text lives in **`content.js`**: story, characters, traits, weapons, rooms, clue templates and missions. Each character needs a unique trait combination.

**Stories (classic mode):** the host picks the story in the lobby. *The Last Feast* (Yalda night in Shiraz) lives in `content.js`. *Turn of the Year* (Nowruz at the family villa in Ramsar, a year later) is in `content.nowruz.js` and `content.nowruz.en.js`. A story file lays its own `STORY`, `TRAITS`, `CHARACTERS`, `WEAPONS`, `ROOMS` and clue templates over the base content; the characters keep the same ids and traits, so their drawn faces carry over. Weapon and room ids that match a drawing in `public/art.js` reuse it; a new id needs its own drawing there (or it shows its emoji). To add a story, add the two files, register them in `STORIES` in `game.js`, and give it an opening slide and cinematic captions in `public/guide.js` (`STORIES`). Hand to Hand always plays the Yalda story.

## Tests
```bash
npm test
```
- `test/items.js` plays 225 random «دست‌به‌دست» games (4–12 players), replaying every round's log against the real holdings. It checks that killers are exactly the starting knives, that items are conserved, that each action's exchange is correct, that victim notices are accurate, that the TV never sees holdings, and every tie/verdict rule.
- `test/engine.js` plays 200 random games (4–8 players) directly against the engine. It checks that every genuine clue is true, every forged clue is a lie, the TV never sees private data, scoring adds up, and the lobby edge cases behave.
- `test/screens.js` renders the real TV and phone screens (jsdom), fed by the real engine, through every phase of both modes, both languages and both stories, with five phones and a latecomer. It fails on any script error, an empty screen, a missing translation, or Persian on an English screen.
- `test/e2e.js` boots the real server and plays two classic games and two «دست‌به‌دست» games (5 and 10 players) with socket bots, including a phone that drops and reconnects mid-game.

## Project layout
```
server.js        Express + Socket.IO, QR code, per-player private state
game.js          Game engine / state machine (no networking)
items.js         «دست‌به‌دست» mode, mixed into the engine
content.js       All Persian game text
public/tv.*      TV screen (public info only)
public/play.*    Phone controller (/)
public/shared.*  Fonts, colours, helpers
public/fonts/    Vazirmatn + Lalezar (SIL OFL, licences included)
test/            Engine simulation + end-to-end socket test
```
