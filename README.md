# ضیافت آخر — Ziafat-e Akhar ("The Last Feast")

A Farsi murder-mystery party game for 4–8 players. One shared TV screen, and everyone plays on their own phone.
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

1. **Lobby:** Players join on their phones. The first person to join is the host 👑 and controls start/skip from their phone.
2. **Intro:** Everyone is secretly assigned a character (e.g. the bankrupt eldest son or the family lawyer). Each character has visible **traits** (👓 glasses, ✋ left-handed, 🚬 smoker, 🌹 rose perfume). One player is told they are the **killer** and learns the weapon and the room. Every innocent player gets a **secret mission** worth bonus points.
3. **Three rounds, each with these phases:**
   - **Search:** Innocents each pick one of 6 rooms and privately receive a clue. Clues can rule out weapons or rooms, reveal one of the killer's traits, give someone an alibi, or expose a motive. At the same time, the killer **forges a lie** and plants it in a room. The next person to search that room picks up the fake instead of a real clue.
   - **Discussion:** Players talk. Anyone can press "نشان بده" to pin a clue to the TV evidence board.
   - **Interrogation (rounds 1–2):** Everyone votes. The player with the most votes is put in the spotlight. The TV shows **every room they have searched** and who voted for whom, and they must defend themselves.
4. **Final accusation:** Everyone names a killer, a weapon and a room.
5. **Reveal:** The TV shows the vote tally, then the killer, then the weapon and room, then every forged clue (where it was planted and who was fooled by it), then the mission results, then the scoreboard.

**Deduction hooks:** True clues never contradict each other. Forged clues do. The killer is "seen" in whichever room they plant in, and interrogation exposes those rooms. The killer also holds a copy of each forgery. If both copies end up on the board, the duplicate gives away who planted it.

### Scoring (accumulates across games)
- Innocent: correct killer **+3**, correct weapon **+1**, correct room **+1**, secret mission completed **+2**
- Killer: escapes, i.e. does not get the most votes in the final accusation (a tie for most still counts as caught) **+5**; plus **+1** for each forged clue that reached another player

### Phone features
Private role card (tap to reveal, hides itself after 15 seconds), clue hand with pin-to-TV, a deduction notebook (tap to mark ✕ or ؟, saved per game), reconnect-safe identity (the phone remembers who it is), and vibration when it's your turn to act.

## Edit the content
All Persian text lives in **`content.js`**: story, characters, traits, weapons, rooms, clue templates and missions. Each character needs a unique trait combination.

## Tests
```bash
npm test
```
- `test/engine.js` plays 200 random games (4–8 players) directly against the engine. It checks that every genuine clue is true, every forged clue is a lie, the TV never sees private data, scoring adds up, and the lobby edge cases behave.
- `test/e2e.js` boots the real server and plays two full games with socket bots, including a phone that drops and reconnects mid-game.

## Project layout
```
server.js        Express + Socket.IO, QR code, per-player private state
game.js          Game engine / state machine (no networking)
content.js       All Persian game text
public/tv.*      TV screen (public info only)
public/play.*    Phone controller (/)
public/shared.*  Fonts, colours, helpers
public/fonts/    Vazirmatn + Lalezar (SIL OFL, licences included)
test/            Engine simulation + end-to-end socket test
```
