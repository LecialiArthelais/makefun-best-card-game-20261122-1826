// tests/card-checks.mjs — the card-game skill's checks, run in Node against
// the game's own modules (no browser, no DOM). Not shipped in game/.
//   node tests/card-checks.mjs
// Checks:
//   1. Zone invariant: 10,000 random legal turns — every card id in exactly
//      one zone, total count never changes.
//   2. Shuffle uniformity: a 4-card deck shuffled 24,000 times; chi-square
//      over the 24 orders must stay under ~41 (23 df, p < 0.01).
//   3. Replay determinism: same seed + same inputs -> same final state hash.
//   4. Balance sweep (casual-game-systems + playtest-report): a competent
//      bot (reads combos, banks Surge, times the Tidecaller) and a greedy
//      bot vs Rill across mistake rates; target ~50-60% for the competent
//      bot, ~20-30% for the greedy one, games lasting 4-6 hands.

import { createHash } from 'node:crypto';
import { HAND_SIZE, LANES, hasOp, isTidecaller } from '../game/src/cards.js';
import { buildTideDeck, drawUpToHand, makeRng, newPlayerState, shuffleDeck } from '../game/src/deck.js';
import { bankSurgeForCard, gainSurgePerTurn, resetSurge } from '../game/src/surge.js';
import { checkVictory, handIsOver, laneTotal, playCard, scoreLane, tideTurns } from '../game/src/rules.js';
import { applyRivalMove, chooseRivalMove } from '../game/src/rivalBrain.js';

const REPO = process.argv[1].includes('tests/') ? '.' : '.';
void REPO;

function newGame(seed) {
  const s = { seed, rng: makeRng(seed), handNumber: 1,
    current: makeRng(seed)() < 0.5 ? 1 : -1,
    you: newPlayerState(makeRng(seed + 11)), rival: newPlayerState(makeRng(seed + 77)),
    lanes: [{ you: [], rival: [] }, { you: [], rival: [] }, { you: [], rival: [] }] };
  s.you.deck = buildTideDeck(s.you.rng, 'y');
  s.rival.deck = buildTideDeck(s.rival.rng, 'r');
  drawUpToHand(s.you, HAND_SIZE);
  drawUpToHand(s.rival, HAND_SIZE);
  return s;
}
function nextHand(s) {
  s.handNumber += 1;
  s.current = s.rng() < 0.5 ? 1 : -1;
  s.you.playsUsed = 0; s.rival.playsUsed = 0;
  resetSurge(s.you); resetSurge(s.rival);
  s.you.discard.push(...s.you.hand); s.you.hand = [];
  s.rival.discard.push(...s.rival.hand); s.rival.hand = [];
  drawUpToHand(s.you, HAND_SIZE); drawUpToHand(s.rival, HAND_SIZE);
}
function resolveHand(s) {
  tideTurns(s);
  const w = checkVictory(s);
  if (w) return w;
  nextHand(s);
  return null;
}
function allCardUids(s) {
  const uids = [];
  for (const p of [s.you, s.rival]) uids.push(...p.deck, ...p.hand, ...p.discard);
  for (const lane of s.lanes) uids.push(...lane.you, ...lane.rival);
  return uids.map((c) => c.uid);
}
function checkZones(s) {
  const uids = allCardUids(s);
  return uids.length === 48 && new Set(uids).size === 48;
}

// --- 1. zone invariant, 10,000 random legal turns -------------------------
let zoneFailures = 0;
{
  const rng = makeRng(999);
  const s = newGame(4242);
  for (let turn = 0; turn < 10000; turn += 1) {
    if (!checkZones(s)) { zoneFailures += 1; break; }
    if (handIsOver(s)) { const w = resolveHand(s); if (w) { Object.assign(s, newGame(4242 + turn)); } continue; }
    // random legal player action
    const roll = rng();
    if (roll < 0.6) {
      const affordable = s.you.hand.filter((c) => c.cost <= s.you.surge);
      if (affordable.length) playCard(s, 'you', affordable[Math.floor(rng() * affordable.length)].uid, Math.floor(rng() * 3));
      else s.you.playsUsed += 1;
    } else if (roll < 0.8 && s.you.hand.length) {
      bankSurgeForCard(s.you, s.you.hand[Math.floor(rng() * s.you.hand.length)].uid);
    } else {
      s.you.playsUsed += 1;
    }
    if (!checkZones(s)) { zoneFailures += 1; break; }
    if (handIsOver(s)) { const w = resolveHand(s); if (w) Object.assign(s, newGame(4242 + turn)); continue; }
    gainSurgePerTurn(s.rival);
    applyRivalMove(s, chooseRivalMove(s));
    if (handIsOver(s)) { const w = resolveHand(s); if (w) Object.assign(s, newGame(4242 + turn)); continue; }
    gainSurgePerTurn(s.you);
  }
}
console.log('1. zone invariant (10,000 random turns):', zoneFailures === 0 ? 'PASS' : `FAIL (${zoneFailures})`);

// --- 2. shuffle uniformity --------------------------------------------------
{
  const counts = new Map();
  const rng = makeRng(7);
  for (let i = 0; i < 24000; i += 1) {
    const order = shuffleDeck(['a', 'b', 'c', 'd'], rng).join('');
    counts.set(order, (counts.get(order) || 0) + 1);
  }
  let chi2 = 0;
  for (const [, n] of counts) chi2 += ((n - 1000) ** 2) / 1000;
  chi2 += (24 - counts.size) * 1000; // orders never seen count fully
  console.log(`2. shuffle uniformity (24k shuffles, chi2=${chi2.toFixed(1)}, need <41):`, chi2 < 41 ? 'PASS' : 'FAIL');
}

// --- 3. replay determinism --------------------------------------------------
function stateHash(s) {
  const snap = JSON.stringify({
    favour: [s.you.favour, s.rival.favour], hull: [s.you.hull, s.rival.hull],
    surge: [s.you.surge, s.rival.surge], hand: s.handNumber, current: s.current,
    youHand: s.you.hand.map((c) => c.uid).sort(), rivalHand: s.rival.hand.map((c) => c.uid).sort(),
    lanes: s.lanes.map((l) => [l.you.map((c) => c.uid), l.rival.map((c) => c.uid)]),
  });
  return createHash('sha256').update(snap).digest('hex').slice(0, 16);
}
{
  const scripted = (s) => {
    for (let guard = 0; guard < 200; guard++) {
      const mv = greedyMove(s);
      if (mv) playCard(s, 'you', mv.c.uid, mv.lane); else s.you.playsUsed += 1;
      if (handIsOver(s)) { const w = resolveHand(s); if (w) return w; continue; }
      gainSurgePerTurn(s.rival);
      applyRivalMove(s, chooseRivalMove(s));
      if (handIsOver(s)) { const w = resolveHand(s); if (w) return w; continue; }
      gainSurgePerTurn(s.you);
    }
    return 'timeout';
  };
  const run = () => { const s = newGame(1234); const w = scripted(s); return `${w}:${stateHash(s)}`; };
  const a = run(); const b = run();
  console.log('3. replay determinism (same seed -> same hash):', a === b ? `PASS (${a})` : `FAIL (${a} vs ${b})`);
}

// --- 4. balance sweep -------------------------------------------------------
function greedyMove(s) {
  const hand = s.you.hand.filter((c) => c.cost <= s.you.surge);
  if (!hand.length) return null;
  let best = null;
  for (const c of hand) for (let lane = 0; lane < 3; lane++) {
    const mine = s.lanes[lane].you.reduce((a, x) => a + x.strength, 0) + c.strength;
    const theirs = s.lanes[lane].rival.reduce((a, x) => a + x.strength, 0);
    const score = (mine - theirs) + lane * 0.6 + c.strength * 0.1;
    if (!best || score > best.score) best = { c, lane, score };
  }
  return best;
}

// A competent player: simulates each card x lane with the real lane totals
// (auras, fleet, current), values favour swing and breakthrough damage,
// banks Surge when nothing wins a lane, and times the Tidecaller.
function competentMove(s) {
  let best = null;
  for (const card of s.you.hand) {
    if (card.cost > s.you.surge) continue;
    if (isTidecaller(card)) {
      const leads = LANES.some((_, i) => laneTotal(s, 'you', i) > laneTotal(s, 'rival', i));
      const desperate = s.you.favour + 5 <= s.rival.favour;
      if (!leads && !desperate) continue;
    }
    for (let lane = 0; lane < 3; lane++) {
      const before = scoreLane(s, lane);
      const snapshot = s.lanes.map((l) => ({ you: l.you.slice(), rival: l.rival.slice() }));
      s.lanes[lane].you.push(card);
      const after = scoreLane(s, lane);
      s.lanes = snapshot;
      let score = 0;
      if (before.winner !== 'you' && after.winner === 'you') score += 12 + LANES[lane].value * 3;
      if (before.winner === 'you' && after.winner === 'you') score += 4 + LANES[lane].value;
      if (after.winner === 'you' && after.damage > 0) score += after.damage * 2;
      if (hasOp(card, 'dragRival') && lane > 0 && s.lanes[lane].rival.length) score += 5;
      if (card.aura) score += (card.aura.side === 'self' ? s.lanes[lane].you.length : s.lanes[lane].rival.length) * 3;
      score -= card.cost * 0.7;
      if (!best || score > best.score) best = { card, lane, score };
    }
  }
  if (best && best.score > 2) return { kind: 'play', ...best };
  const bankable = s.you.hand.filter((c) => !isTidecaller(c)).sort((a, b) => a.cost - b.cost || a.strength - b.strength)[0];
  if (bankable && s.you.surge < 3) return { kind: 'bank', card: bankable };
  if (best) return { kind: 'play', ...best };
  return { kind: 'pass' };
}

function playGame(seed, playerFn, mistakeRate) {
  const s = newGame(seed);
  for (let guard = 0; guard < 200; guard++) {
    const mv = playerFn(s);
    if (!mv) s.you.playsUsed += 1;
    else if (mv.kind === 'play') playCard(s, 'you', mv.card.uid, mv.lane);
    else if (mv.kind === 'bank') bankSurgeForCard(s.you, mv.card.uid);
    else s.you.playsUsed += 1;
    if (handIsOver(s)) { const w = resolveHand(s); if (w) return { winner: w, hands: s.handNumber, hull: [s.you.hull, s.rival.hull] }; continue; }
    gainSurgePerTurn(s.rival);
    applyRivalMove(s, chooseRivalMove(s, mistakeRate));
    if (handIsOver(s)) { const w = resolveHand(s); if (w) return { winner: w, hands: s.handNumber, hull: [s.you.hull, s.rival.hull] }; continue; }
    gainSurgePerTurn(s.you);
  }
  return { winner: 'timeout', hands: s.handNumber, hull: [s.you.hull, s.rival.hull] };
}

for (const rate of [0, 0.15, 0.22, 0.3]) {
  const comp = []; const greedy = [];
  for (let seed = 1; seed <= 30; seed++) {
    comp.push(playGame(seed * 13 + 5, competentMove, rate));
    greedy.push(playGame(seed * 13 + 5, (s) => { const m = greedyMove(s); return m ? { kind: 'play', card: m.c, lane: m.lane } : null; }, rate));
  }
  const compWins = comp.filter((r) => r.winner === 'you').length;
  const greedyWins = greedy.filter((r) => r.winner === 'you').length;
  const compHullKO = comp.filter((r) => r.winner === 'you' && r.hull[1] <= 0).length + comp.filter((r) => r.winner === 'rival' && r.hull[0] <= 0).length;
  const avgHands = (comp.reduce((a, r) => a + r.hands, 0) / comp.length).toFixed(1);
  console.log(`4. mistake=${rate}: competent wins ${compWins}/30, greedy wins ${greedyWins}/30, hull-KO games ${compHullKO}/30, avg hands ${avgHands}`);
}

// --- 5. beginner check: a casual bot (random card, random lane, sometimes
// banks) must still win sometimes, and hull KO must be a real path --------
function casualMove(s, rng) {
  const roll = rng();
  if (roll < 0.2 && s.you.hand.length) {
    const c = s.you.hand[Math.floor(rng() * s.you.hand.length)];
    return { kind: 'bank', card: c };
  }
  if (roll < 0.3) return { kind: 'pass' };
  const affordable = s.you.hand.filter((c) => c.cost <= s.you.surge);
  if (!affordable.length) return { kind: 'pass' };
  return { kind: 'play', card: affordable[Math.floor(rng() * affordable.length)], lane: Math.floor(rng() * 3) };
}
function playGameHull(seed, playerFn, mistakeRate, hull) {
  const s = newGame(seed);
  s.you.hull = hull; s.rival.hull = hull;
  const rng = makeRng(seed * 31 + 3);
  for (let guard = 0; guard < 200; guard++) {
    const mv = playerFn(s, rng);
    if (!mv) s.you.playsUsed += 1;
    else if (mv.kind === 'play') playCard(s, 'you', mv.card.uid, mv.lane);
    else if (mv.kind === 'bank') bankSurgeForCard(s.you, mv.card.uid);
    else s.you.playsUsed += 1;
    if (handIsOver(s)) { const w = resolveHand(s); if (w) return { winner: w, hands: s.handNumber, hull: [s.you.hull, s.rival.hull] }; continue; }
    gainSurgePerTurn(s.rival);
    applyRivalMove(s, chooseRivalMove(s, mistakeRate));
    if (handIsOver(s)) { const w = resolveHand(s); if (w) return { winner: w, hands: s.handNumber, hull: [s.you.hull, s.rival.hull] }; continue; }
    gainSurgePerTurn(s.you);
  }
  return { winner: 'timeout', hands: s.handNumber, hull: [s.you.hull, s.rival.hull] };
}
for (const [rate, hull] of [[0.18, 16], [0.15, 16], [0.22, 16]]) {
  const casual = []; const comp = [];
  for (let seed = 1; seed <= 30; seed++) {
    casual.push(playGameHull(seed * 13 + 5, casualMove, rate, hull));
    comp.push(playGameHull(seed * 13 + 5, (s) => competentMove(s), rate, hull));
  }
  const casualWins = casual.filter((r) => r.winner === 'you').length;
  const compWins = comp.filter((r) => r.winner === 'you').length;
  const koGames = comp.filter((r) => r.hull[0] <= 0 || r.hull[1] <= 0).length;
  const avgHands = (comp.reduce((a, r) => a + r.hands, 0) / comp.length).toFixed(1);
  console.log(`5. mistake=${rate} hull=${hull}: casual wins ${casualWins}/30, competent wins ${compWins}/30, hull-KO games ${koGames}/30, avg hands ${avgHands}`);
}
