# ضیافت آخر — Ziafat-e Akhar ("The Last Feast")

A Farsi murder-mystery party game for 4–12 players: up to 8 in the classic mode, up to 12 in «دست‌به‌دست». One shared TV screen, and everyone plays on their own phone.
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

## Look & feel
- **Living backdrop (TV):** A night sky with a glowing moon, twinkling stars and falling snow. Along the bottom is the Farahmand mansion's skyline (domes, wind-catchers, cypresses), and its windows flicker like candlelight. It calms down on busy screens like the reveal and the scoreboard (`public/scene.js`).
- **Curtain transitions:** Each new phase opens with velvet drapes closing over a gold title card, then parting to show the new screen as it animates in. The steps inside a reveal and the short gossip result skip the curtain.
- **Illustrated items:** The classic mode's 6 weapons, 6 rooms and 4 suspect traits, and all 15 «دست‌به‌دست» items, are hand-drawn vector art (`public/art.js`) instead of emoji, with small idle animations on big displays: the knife glints, the candle flickers, the tea steams, the tasbih sways. On the phone, your item flips over like a card when you reveal it.
- **The reveal as a show:** A snare drumroll builds for two seconds before the verdict, then the verdict lands like a rubber stamp. Killers start behind dark masks that shake and drop away one at a time. In «دست‌به‌دست», the last step is the **knife trail**: a chart with a column per player and a row per round, each cell showing the item that player held. Each knife's coloured line draws itself row by row back to whoever started with it, following knife-for-knife swaps too, and this step stays up twice as long. In the classic game, the weapon and room cards turn over one after the other.
- **Gossip rounds:** The question inks itself in like a pen stroke. A progress bar and a soft blip track who has answered. The result bars spring out one after another, the most-picked players glow, and a gold 👑 banner stamps their name.
- Everything is inline SVG, CSS and canvas: no image files, no internet needed. All motion stops if the device asks for reduced motion.

## Edit the content
All Persian text lives in **`content.js`**: story, characters, traits, weapons, rooms, clue templates and missions. Each character needs a unique trait combination.

## Tests
```bash
npm test
```
- `test/items.js` plays 225 random «دست‌به‌دست» games (4–12 players), replaying every round's log against the real holdings. It checks that killers are exactly the starting knives, that items are conserved, that each action's exchange is correct, that victim notices are accurate, that the TV never sees holdings, and every tie/verdict rule.
- `test/engine.js` plays 200 random games (4–8 players) directly against the engine. It checks that every genuine clue is true, every forged clue is a lie, the TV never sees private data, scoring adds up, and the lobby edge cases behave.
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
