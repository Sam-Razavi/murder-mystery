// Balance report from the server's game log (data/games.jsonl, one line per
// finished game). Run: npm run stats            (games with people only)
//                      npm run stats -- --bots  (include games with bots)
//                      npm run stats -- path/to/games.jsonl
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const withBots = args.includes('--bots');
const file = args.find((a) => !a.startsWith('--')) || process.env.GAME_LOG || path.join(__dirname, '..', 'data', 'games.jsonl');

let games = [];
try {
  games = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
} catch {
  console.log(`No game log yet at ${file}. Play a game first.`);
  process.exit(0);
}
const skipped = games.filter((g) => g.bots > 0).length;
if (!withBots) games = games.filter((g) => !g.bots);

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const avg = (list, f) => (list.length ? (list.reduce((s, g) => s + f(g), 0) / list.length).toFixed(1) : '–');
const count = (list, f) => list.filter(f).length;
const row = (label, value) => console.log(`  ${label.padEnd(42)} ${value}`);

console.log(`\nGames in ${path.relative(process.cwd(), file) || file}: ${games.length}${!withBots && skipped ? ` (left out ${skipped} with bots; add --bots to include them)` : ''}`);

// Below/above these, one side wins too often to be fun.
const verdict = (killerWinRate, n) => {
  if (n < 10) return 'Too few games to judge yet (aim for 10+).';
  if (killerWinRate < 0.3) return 'Killers rarely win: consider more forgeries, a longer search, or a 4th round.';
  if (killerWinRate > 0.6) return 'Killers win a lot: consider more true clues per search or a longer discussion.';
  return 'Looks balanced.';
};

const classic = games.filter((g) => g.mode === 'classic');
for (const story of [...new Set(classic.map((g) => g.story))]) {
  const list = classic.filter((g) => g.story === story);
  const escaped = count(list, (g) => !g.caught);
  console.log(`\nClassic — ${story} (${list.length} games)`);
  row('Killer escaped', `${pct(escaped, list.length)}  (${escaped}/${list.length})`);
  row('Innocents naming the killer (avg)', `${pct(list.reduce((s, g) => s + g.innocentsRight, 0), list.reduce((s, g) => s + g.innocentsVoted, 0))}`);
  row('Right weapon / right room (avg players)', `${avg(list, (g) => g.weaponRight)} / ${avg(list, (g) => g.roomRight)}`);
  row('Forgeries that reached someone (avg)', `${avg(list, (g) => g.forgeriesDelivered)} of ${avg(list, (g) => g.forgeries)}`);
  row('Forgeries that made it to the board (avg)', avg(list, (g) => g.forgeriesPinned));
  row('Clues pinned per game (avg)', avg(list, (g) => g.cluesPinned));
  row('Killer was interrogated', pct(count(list, (g) => g.killerInterrogated), list.length));
  row('Secret missions done per game (avg)', avg(list, (g) => g.missionsDone));
  const bySize = [...new Set(list.map((g) => g.players))].sort((a, b) => a - b)
    .map((n) => { const s = list.filter((g) => g.players === n); return `${n}p ${pct(count(s, (g) => !g.caught), s.length)}`; });
  row('Killer escaped, by table size', bySize.join(' · '));
  console.log(`  → ${verdict(escaped / list.length, list.length)}`);
}

const items = games.filter((g) => g.mode === 'items');
if (items.length) {
  const killersWon = count(items, (g) => !g.innocentsWin);
  console.log(`\nHand to Hand (${items.length} games)`);
  row('Killers won', `${pct(killersWon, items.length)}  (${killersWon}/${items.length})`);
  row('…of which by a tie', pct(count(items, (g) => !g.innocentsWin && g.tie), killersWon));
  row('Votes on a killer (avg)', pct(items.reduce((s, g) => s + g.votesOnKillers, 0), items.reduce((s, g) => s + g.votes, 0)));
  const byKillers = [...new Set(items.map((g) => g.killers))].sort()
    .map((k) => { const s = items.filter((g) => g.killers === k); return `${k} killer${k > 1 ? 's' : ''}: ${pct(count(s, (g) => !g.innocentsWin), s.length)}`; });
  row('Killers won, by number of killers', byKillers.join(' · '));
  const byRounds = [...new Set(items.map((g) => g.rounds))].sort((a, b) => a - b)
    .map((r) => { const s = items.filter((g) => g.rounds === r); return `${r} rounds: ${pct(count(s, (g) => !g.innocentsWin), s.length)}`; });
  row('Killers won, by game length', byRounds.join(' · '));
  console.log(`  → ${verdict(killersWon / items.length, items.length)}`);
}
console.log('');
