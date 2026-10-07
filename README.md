# ضیافت آخر — Ziafat-e Akhar ("The Last Feast")

A Farsi (and English) murder-mystery party game for 4–12 players: up to 8 in the classic mode, up to 12 in «دست‌به‌دست». One shared TV screen, and everyone plays on their own phone.
It's a social-deduction game in the spirit of *Dead Man's Party*, but with its own story, characters and rules. Nothing comes from the Knives Out IP.

**Setting:** It's Yalda night at the Farahmand family's old mansion in Shiraz. Agha-bozorg (the grandfather) called everyone together to read his will at midnight. When the clock strikes twelve, he's dead. One of the guests is the killer.

Same architecture as `guess-the-music`: Node + Express + Socket.IO on the always-on PC, the TV shows `/tv`, and phones join by scanning a QR code.

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
- **End of the night:** from the results screen, the host taps «🌙 پایان شب» / "End the night". The TV crowns tonight's champion and hands out awards (best liar, sharpest detective, mission master, most wins), and each phone shows the player's own numbers. From there the host goes back to the lobby (scores stay) or starts a fresh night.
- **TV scaling:** the TV is sized in `rem`, which follows whichever is tighter: the width, or the height of a 16:9 screen. Ultrawide screens and browsers that aren't fullscreen shrink the layout instead of overflowing it.

## How a game plays (≈20–25 min)

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
- **Living backdrop (TV):** A night sky with a glowing moon, twinkling stars and falling snow. Along the bottom is the Farahmand mansion's skyline (domes, wind-catchers, cypresses), and its windows flicker like candlelight. It calms down on busy screens like the reveal and the scoreboard (`public/scene.js`).
- **Curtain transitions:** Each new phase opens with velvet drapes closing over a gold title card, then parting to show the new screen as it animates in. The steps inside a reveal and the short gossip result skip the curtain.
- **Illustrated items:** The classic mode's 6 weapons, 6 rooms and 4 suspect traits, and all 15 «دست‌به‌دست» items, are hand-drawn vector art (`public/art.js`) instead of emoji, with small idle animations on big displays: the knife glints, the candle flickers, the tea steams, the tasbih sways. On the phone, your item flips over like a card when you reveal it.
- **The reveal as a show:** A snare drumroll builds for two seconds before the verdict, then the verdict lands like a rubber stamp. Killers start behind dark masks that shake and drop away one at a time. In «دست‌به‌دست», the last step is the **knife trail**: a chart with a column per player and a row per round, each cell showing the item that player held. Each knife's coloured line draws itself row by row back to whoever started with it, following knife-for-knife swaps too, and this step stays up twice as long. In the classic game, the weapon and room cards turn over one after the other.
- **Gossip rounds:** The question inks itself in like a pen stroke. A progress bar and a soft blip track who has answered. The result bars spring out one after another, the most-picked players glow, and a gold 👑 banner stamps their name.
- **Illustrated faces:** Each of the 8 classic characters is a drawn bust (Bahram's moustache and suit, Khanom-jan's patterned headscarf, Dr. Sadri's white coat and stethoscope). The busts show the character's visible traits, so the four characters with glasses wear them. The 16 lobby portraits are drawn animals and objects. Faces blink on the big reveal screens (`public/faces.js`).
- Everything is inline SVG, CSS and canvas: no image files, no internet needed. All motion stops if the device asks for reduced motion.

## Edit the content
All Persian text lives in **`content.js`**: story, characters, traits, weapons, rooms, clue templates and missions. Each character needs a unique trait combination.

**Stories (classic mode):** the host picks the story in the lobby. *The Last Feast* (Yalda night in Shiraz) lives in `content.js`. *Turn of the Year* (Nowruz at the family villa in Ramsar, a year later) is in `content.nowruz.js` and `content.nowruz.en.js`. A story file lays its own `STORY`, `TRAITS`, `CHARACTERS`, `WEAPONS`, `ROOMS` and clue templates over the base content; the characters keep the same ids and traits, so their drawn faces carry over. Weapon and room ids that match a drawing in `public/art.js` reuse it, and the rest show their emoji. To add a story, add the two files, register them in `STORIES` in `game.js`, and give it an opening slide and cinematic captions in `public/guide.js` (`STORIES`). Hand to Hand always plays the Yalda story.

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
